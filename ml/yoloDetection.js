// ml/yoloDetection.js
const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const Detection = require('../models/Detection');

// YOLO class mapping
const CLASS_MAPPING = {
  0: 'person',
  1: 'bicycle',
  2: 'car',
  3: 'motorcycle',
  4: 'airplane',
  5: 'bus',
  6: 'train',
  7: 'truck',
  8: 'boat',
  // We only keep vehicle-related classes
};

// Classes we're interested in for traffic monitoring
const VEHICLE_CLASSES = {
  1: 'bicycle',
  2: 'car',
  3: 'motorcycle', 
  5: 'bus',
  7: 'truck',
  // We could map police car and ambulance if we had custom classes
};

// Load YOLO model
let model;
async function loadModel() {
  try {
    const modelPath = path.join(__dirname, '../ml/yolov5s/model.json');
    console.log(`Loading model from: ${modelPath}`);
    
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model file not found at ${modelPath}`);
    }
    
    model = await tf.loadGraphModel(`file://${modelPath}`);
    console.log('YOLO model loaded successfully');
    return model;
  } catch (error) {
    console.error('Error loading YOLO model:', error);
    throw error;
  }
}

// Extract frames from video using ffmpeg
function extractFrameFromVideo(videoPath) {
  return new Promise((resolve, reject) => {
    const outputPath = `${videoPath.replace(/\.[^/.]+$/, '')}_frame.jpg`;
    
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-vf', 'select=eq(n\\,0)',
      '-q:v', '1',
      '-f', 'image2',
      outputPath
    ]);

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`ffmpeg process exited with code ${code}`));
      }
    });

    ffmpeg.stderr.on('data', (data) => {
      console.log(`ffmpeg: ${data}`);
    });
  });
}

// Process image with YOLO
async function processImage(imagePath) {
  try {
    if (!model) {
      await loadModel();
    }

    // Read image and convert to tensor
    const imageBuffer = fs.readFileSync(imagePath);
    const tfImage = tf.node.decodeImage(imageBuffer);
    
    // Get original dimensions for scaling back
    const originalHeight = tfImage.shape[0];
    const originalWidth = tfImage.shape[1];
    
    // Preprocess image (YOLOv5 expects 640x640)
    const input = tf.image.resizeBilinear(tfImage, [640, 640])
      .div(255.0)
      .expandDims(0);
    
    // Run model
    const predictions = await model.predict(input);
    
    // Process results
    const detections = await postprocess(predictions, originalWidth, originalHeight);
    
    // Clean up
    tfImage.dispose();
    input.dispose();
    
    return detections;
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}

// Process results
async function postprocess(predictions, originalWidth, originalHeight) {
  try {
    // YOLOv5 outputs format: [batches, boxes(x,y,w,h,conf,classes)]
    const output = await predictions.array();
    
    // Clean up tensor
    predictions.dispose();
    
    // Filter detections
    const threshold = 0.25;
    const validDetections = [];
    
    for (const detection of output[0]) {
      const [x, y, w, h, confidence, ...classProbs] = detection;
      
      if (confidence > threshold) {
        // Find class with highest probability
        const classIndex = classProbs.indexOf(Math.max(...classProbs));
        
        // Only include if it's a vehicle class we're interested in
        if (VEHICLE_CLASSES[classIndex] !== undefined) {
          validDetections.push({
            box: [
              (x - w/2) * originalWidth, // scale back to original image
              (y - h/2) * originalHeight,
              w * originalWidth,
              h * originalHeight
            ],
            score: confidence,
            class: classIndex,
            className: VEHICLE_CLASSES[classIndex]
          });
        }
      }
    }
    
    // Count vehicles by type
    const typeCounts = {};
    
    for (const detection of validDetections) {
      const type = detection.className;
      if (!typeCounts[type]) {
        typeCounts[type] = 0;
      }
      typeCounts[type]++;
    }
    
    // Format results
    const vehicles = [];
    for (const [type, count] of Object.entries(typeCounts)) {
      vehicles.push({ type, count });
    }
    
    const totalVehicles = validDetections.length;
    
    return {
      totalVehicles,
      vehicles,
      detections: validDetections
    };
  } catch (error) {
    console.error('Error in postprocessing:', error);
    throw error;
  }
}

// Process video
async function processVideo(videoPath) {
  try {
    // Extract first frame from video
    const framePath = await extractFrameFromVideo(videoPath);
    
    // Process the frame as an image
    const results = await processImage(framePath);
    
    // Clean up temp image
    try {
      fs.unlinkSync(framePath);
    } catch (error) {
      console.error('Error removing temp frame:', error);
    }
    
    return results;
  } catch (error) {
    console.error('Error processing video:', error);
    throw error;
  }
}

// Main function to run detection
async function runYOLODetection(mediaPath, detectionId) {
  try {
    const detection = await Detection.findById(detectionId);
    if (!detection) {
      throw new Error('Detection not found');
    }

    console.log(`Running YOLO detection on ${mediaPath} (type: ${detection.mediaType})`);
    
    let results;
    if (detection.mediaType === 'image') {
      results = await processImage(mediaPath);
    } else if (detection.mediaType === 'video') {
      results = await processVideo(mediaPath);
    } else {
      throw new Error('Unsupported media type');
    }
    
    console.log(`Detection results: ${results.totalVehicles} vehicles found`);
    return results;
  } catch (error) {
    console.error('Error running YOLO detection:', error);
    throw error;
  }
}

// Initialize model at startup
loadModel().catch(console.error);

module.exports = {
  loadModel,
  runYOLODetection
};