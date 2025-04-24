// // ml/yoloDetection.js
// const tf = require('@tensorflow/tfjs-node');
// const fs = require('fs');
// const path = require('path');
// const { spawn } = require('child_process');
// const Detection = require('../models/Detection');

// // YOLO class mapping
// const CLASS_MAPPING = {
//   0: 'person',
//   1: 'bicycle',
//   2: 'car',
//   3: 'motorcycle',
//   4: 'airplane',
//   5: 'bus',
//   6: 'train',
//   7: 'truck',
//   8: 'boat',
//   // We only keep vehicle-related classes
// };

// // Classes we're interested in for traffic monitoring
// const VEHICLE_CLASSES = {
//   1: 'bicycle',
//   2: 'car',
//   3: 'motorcycle', 
//   5: 'bus',
//   7: 'truck',
//   // We could map police car and ambulance if we had custom classes
// };

// // Load YOLO model
// let model;
// async function loadModel() {
//   try {
//     const modelPath = path.join(__dirname, '../ml/yolov5s/model.json');
//     console.log(`Loading model from: ${modelPath}`);
    
//     if (!fs.existsSync(modelPath)) {
//       throw new Error(`Model file not found at ${modelPath}`);
//     }
    
//     model = await tf.loadGraphModel(`file://${modelPath}`);
//     console.log('YOLO model loaded successfully');
//     return model;
//   } catch (error) {
//     console.error('Error loading YOLO model:', error);
//     throw error;
//   }
// }

// // Extract frames from video using ffmpeg
// function extractFrameFromVideo(videoPath) {
//   return new Promise((resolve, reject) => {
//     const outputPath = `${videoPath.replace(/\.[^/.]+$/, '')}_frame.jpg`;
    
//     const ffmpeg = spawn('ffmpeg', [
//       '-i', videoPath,
//       '-vf', 'select=eq(n\\,0)',
//       '-q:v', '1',
//       '-f', 'image2',
//       outputPath
//     ]);

//     ffmpeg.on('close', (code) => {
//       if (code === 0) {
//         resolve(outputPath);
//       } else {
//         reject(new Error(`ffmpeg process exited with code ${code}`));
//       }
//     });

//     ffmpeg.stderr.on('data', (data) => {
//       console.log(`ffmpeg: ${data}`);
//     });
//   });
// }

// // Process image with YOLO
// async function processImage(imagePath) {
//   try {
//     if (!model) {
//       await loadModel();
//     }

//     // Read image and convert to tensor
//     const imageBuffer = fs.readFileSync(imagePath);
//     const tfImage = tf.node.decodeImage(imageBuffer);
    
//     // Get original dimensions for scaling back
//     const originalHeight = tfImage.shape[0];
//     const originalWidth = tfImage.shape[1];
    
//     // Preprocess image (YOLOv5 expects 640x640)
//     const input = tf.image.resizeBilinear(tfImage, [640, 640])
//       .div(255.0)
//       .expandDims(0);
    
//     // Run model
//     const predictions = await model.predict(input);
    
//     // Process results
//     const detections = await postprocess(predictions, originalWidth, originalHeight);
    
//     // Clean up
//     tfImage.dispose();
//     input.dispose();
    
//     return detections;
//   } catch (error) {
//     console.error('Error processing image:', error);
//     throw error;
//   }
// }

// // Process results
// async function postprocess(predictions, originalWidth, originalHeight) {
//   try {
//     // YOLOv5 outputs format: [batches, boxes(x,y,w,h,conf,classes)]
//     const output = await predictions.array();
    
//     // Clean up tensor
//     predictions.dispose();
    
//     // Filter detections
//     const threshold = 0.25;
//     const validDetections = [];
    
//     for (const detection of output[0]) {
//       const [x, y, w, h, confidence, ...classProbs] = detection;
      
//       if (confidence > threshold) {
//         // Find class with highest probability
//         const classIndex = classProbs.indexOf(Math.max(...classProbs));
        
//         // Only include if it's a vehicle class we're interested in
//         if (VEHICLE_CLASSES[classIndex] !== undefined) {
//           validDetections.push({
//             box: [
//               (x - w/2) * originalWidth, // scale back to original image
//               (y - h/2) * originalHeight,
//               w * originalWidth,
//               h * originalHeight
//             ],
//             score: confidence,
//             class: classIndex,
//             className: VEHICLE_CLASSES[classIndex]
//           });
//         }
//       }
//     }
    
//     // Count vehicles by type
//     const typeCounts = {};
    
//     for (const detection of validDetections) {
//       const type = detection.className;
//       if (!typeCounts[type]) {
//         typeCounts[type] = 0;
//       }
//       typeCounts[type]++;
//     }
    
//     // Format results
//     const vehicles = [];
//     for (const [type, count] of Object.entries(typeCounts)) {
//       vehicles.push({ type, count });
//     }
    
//     const totalVehicles = validDetections.length;
    
//     return {
//       totalVehicles,
//       vehicles,
//       detections: validDetections
//     };
//   } catch (error) {
//     console.error('Error in postprocessing:', error);
//     throw error;
//   }
// }

// // Process video
// async function processVideo(videoPath) {
//   try {
//     // Extract first frame from video
//     const framePath = await extractFrameFromVideo(videoPath);
    
//     // Process the frame as an image
//     const results = await processImage(framePath);
    
//     // Clean up temp image
//     try {
//       fs.unlinkSync(framePath);
//     } catch (error) {
//       console.error('Error removing temp frame:', error);
//     }
    
//     return results;
//   } catch (error) {
//     console.error('Error processing video:', error);
//     throw error;
//   }
// }

// // Main function to run detection
// async function runYOLODetection(mediaPath, detectionId) {
//   try {
//     const detection = await Detection.findById(detectionId);
//     if (!detection) {
//       throw new Error('Detection not found');
//     }

//     console.log(`Running YOLO detection on ${mediaPath} (type: ${detection.mediaType})`);
    
//     let results;
//     if (detection.mediaType === 'image') {
//       results = await processImage(mediaPath);
//     } else if (detection.mediaType === 'video') {
//       results = await processVideo(mediaPath);
//     } else {
//       throw new Error('Unsupported media type');
//     }
    
//     console.log(`Detection results: ${results.totalVehicles} vehicles found`);
//     return results;
//   } catch (error) {
//     console.error('Error running YOLO detection:', error);
//     throw error;
//   }
// }

// // Initialize model at startup
// loadModel().catch(console.error);

// module.exports = {
//   loadModel,
//   runYOLODetection
// };



// ml/yoloDetection.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const Detection = require('../models/Detection');

// YOLOv8 vehicle classes
const VEHICLE_CLASSES = [
  "car", "motorcycle", "bus", "truck", "bicycle", 
  "train", "airplane", "boat"
];

// Emergency vehicle types - we'll use this for special processing if needed
const EMERGENCY_TYPES = ["ambulance", "police_car", "fire_truck"];

// Function to run detection via the Colab API
async function runYoloDetectionHepler(mediaPath, options = {}) {
  // Set the Colab ngrok URL here - you'll need to update this each time you start the Colab notebook
  const COLAB_API_URL = process.env.YOLO_API_URL;
  
  if (!COLAB_API_URL) {
    throw new Error('YOLO API URL not configured. Please set YOLO_API_URL in environment variables.');
  }
  
  try {
    console.log(`Sending ${mediaPath} to YOLOv8 API at ${COLAB_API_URL}`);
    
    // Create form data with the file
    const formData = new FormData();
    formData.append('file', fs.createReadStream(mediaPath));
    formData.append('confidence', options.confidenceThreshold || 0.25);
    
    // Send request to Colab API
    const response = await axios.post(`${COLAB_API_URL}/detect`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 180000 // 3 minutes timeout - video processing can take time
    });
    
    // Return the detection results
    return response.data;
  } catch (error) {
    console.error('Error calling YOLOv8 API:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    throw new Error(`YOLOv8 API error: ${error.message}`);
  }
}

// Function to download visualization from Colab (if available)
async function downloadVisualization(detectionId, publicId) {
  // This would implement downloading the visualization file from the Colab API
  // and storing it locally or uploading to Cloudinary
  // Not fully implemented in this template
}

// Main function to run detection
async function runYoloDetection(mediaPath, detectionId) {
  try {
    const detection = await Detection.findById(detectionId);
    if (!detection) {
      throw new Error('Detection not found');
    }

    console.log(`Running YOLOv8 detection on ${mediaPath} (type: ${detection.mediaType})`);
    
    // Create a directory for local visualizations if needed
    const outputDir = path.join(__dirname, '../public/detections');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Run detection using Colab API
    const results = await runYoloDetectionHepler(mediaPath, {
      confidenceThreshold: 0.25,
      apiUrl: process.env.YOLO_API_URL
    });
    
    // Check for errors from the API
    if (results.error) {
      throw new Error(results.error);
    }
    
    console.log(`Detection results: ${results.totalVehicles} vehicles found`);
    
    // Download visualization if available
    if (results.visualizationAvailable) {
      // Implementation would depend on how you want to handle this
      // Could download from Colab or use Cloudinary directly
      
      const visualizationFilename = `detection_${detectionId}.jpg`;
      const localPath = path.join(outputDir, visualizationFilename);
      
      // For now, just note that visualization is available (actual download would be implemented)
      results.visualizationUrl = `/detections/${visualizationFilename}`;
    }
    
    // Process emergency vehicle detection
    // YOLOv8 doesn't detect emergency vehicles specifically, so we could implement
    // a separate classifier or analysis if needed
    if (detection.mediaType === 'image' && results.totalVehicles > 0) {
      results.potentialEmergencyVehicles = await checkForEmergencyVehicles(results);
      
      if (results.potentialEmergencyVehicles > 0) {
        results.textSummary += ` Potential emergency vehicles detected: ${results.potentialEmergencyVehicles}.`;
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error running YOLOv8 detection:', error);
    throw error;
  }
}

// Helper function to check for potential emergency vehicles
// This is placeholder logic - would need more sophisticated analysis in production
async function checkForEmergencyVehicles(results) {
  // In a full implementation, this would analyze the detections for emergency vehicle characteristics
  // For now, we'll just implement a simple heuristic assuming large vehicles might be emergency vehicles
  let potentialEmergency = 0;
  
  if (results.vehicles) {
    // Count larger vehicles (buses, trucks) as potential emergency vehicles
    for (const vehicle of results.vehicles) {
      if (vehicle.type === 'bus' || vehicle.type === 'truck') {
        potentialEmergency += Math.min(vehicle.count, 2); // Count up to 2 per type
      }
    }
  }
  
  return potentialEmergency;
}

module.exports = {
  runYoloDetection
};