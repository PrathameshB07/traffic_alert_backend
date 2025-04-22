// ml/mobileNetDetection.js
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const Detection = require('../models/Detection');

// Classes in MobileNet SSD model
const CLASSES = ["background", "aeroplane", "bicycle", "bird", "boat",
                "bottle", "bus", "car", "cat", "chair", "cow", "diningtable",
                "dog", "horse", "motorbike", "person", "pottedplant", "sheep",
                "sofa", "train", "tvmonitor"];

// Vehicle classes we're interested in
const VEHICLE_CLASSES = ["car", "bus", "motorbike", "bicycle", "train", "aeroplane", "boat"];
const VEHICLE_INDICES = VEHICLE_CLASSES.map(cls => CLASSES.indexOf(cls)).filter(idx => idx !== -1);

// Emergency vehicle types - we'll use this for special processing if needed
const EMERGENCY_TYPES = ["ambulance", "police_car", "fire_truck"];

// Function to run Python script for detection
function runPythonDetection(mediaPath, options = {}) {
  return new Promise((resolve, reject) => {
    // Create a Python script path
    const scriptPath = path.join(__dirname, 'vehicleDetection.py');
    
    // Ensure the Python script exists
    if (!fs.existsSync(scriptPath)) {
      // If it doesn't exist, we'll create it
      const pythonScript = generatePythonScript();
      fs.writeFileSync(scriptPath, pythonScript);
    }
    
    // Prepare arguments for the Python script
    const args = [
      scriptPath,
      '--input', mediaPath,
      '--confidence', options.confidenceThreshold || '0.5'
    ];
    
    if (options.outputPath) {
      args.push('--output', options.outputPath);
    }
    
    // Spawn Python process
    const pythonProcess = spawn('python3', args);
    
    let dataString = '';
    let errorString = '';
    
    // Collect data from stdout
    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });
    
    // Collect errors from stderr
    pythonProcess.stderr.on('data', (data) => {
      errorString += data.toString();
      console.error(`Python stderr: ${data}`);
    });
    
    // Handle process completion
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Python process exited with code ${code}: ${errorString}`));
      }
      
      try {
        // Parse the results from Python
        const results = JSON.parse(dataString);
        resolve(results);
      } catch (error) {
        reject(new Error(`Failed to parse Python output: ${error.message}`));
      }
    });
  });
}

// Function to generate Python detection script
function generatePythonScript() {
  return `
import cv2
import numpy as np
import time
import os
import json
import argparse
from collections import Counter

def vehicle_detection(video_path, output_path=None, confidence_threshold=0.5):
    """
    Detect vehicles in a video or image and return JSON results.
    """
    # Check if input file exists
    if not os.path.exists(video_path):
        return json.dumps({"error": f"Input file not found: {video_path}"})
    
    # Determine if input is image or video
    file_ext = os.path.splitext(video_path)[1].lower()
    is_image = file_ext in ['.jpg', '.jpeg', '.png', '.bmp']
    
    # Load MobileNet SSD
    try:
        prototxt_path = "MobileNetSSD_deploy.prototxt"
        model_path = "MobileNetSSD_deploy.caffemodel"
        
        # Check if model files exist, download if needed
        if not os.path.exists(prototxt_path) or not os.path.exists(model_path):
            # URLs for the model files
            prototxt_url = "https://raw.githubusercontent.com/chuanqi305/MobileNet-SSD/master/deploy.prototxt"
            model_url = "https://github.com/chuanqi305/MobileNet-SSD/raw/master/mobilenet_iter_73000.caffemodel"
            
            # Download the files
            import urllib.request
            if not os.path.exists(prototxt_path):
                urllib.request.urlretrieve(prototxt_url, prototxt_path)
            if not os.path.exists(model_path):
                urllib.request.urlretrieve(model_url, model_path)
        
        # Load the model
        net = cv2.dnn.readNetFromCaffe(prototxt_path, model_path)
        
    except Exception as e:
        return json.dumps({"error": f"Error loading model: {str(e)}"})
    
    # Initialize class labels
    classes = ["background", "aeroplane", "bicycle", "bird", "boat",
               "bottle", "bus", "car", "cat", "chair", "cow", "diningtable",
               "dog", "horse", "motorbike", "person", "pottedplant", "sheep",
               "sofa", "train", "tvmonitor"]
    
    # Define vehicle classes
    vehicle_classes = ["car", "bus", "motorbike", "bicycle", "train", "aeroplane", "boat"]
    vehicle_indices = [classes.index(cls) for cls in vehicle_classes if cls in classes]
    
    # Results dict
    results = {
        "totalVehicles": 0,
        "vehicles": [],
        "detections": [],
        "processedFrames": 0
    }
    
    # Vehicle count by type
    vehicle_counts = Counter()
    
    # Process image
    if is_image:
        frame = cv2.imread(video_path)
        if frame is None:
            return json.dumps({"error": "Could not read image file"})
        
        results["processedFrames"] = 1
        frame_results = process_frame(frame, net, classes, vehicle_indices, confidence_threshold)
        
        # Update results
        for v_type, count in frame_results["vehicle_counts"].items():
            vehicle_counts[v_type] += count
        
        results["detections"].extend(frame_results["detections"])
        results["totalVehicles"] = sum(vehicle_counts.values())
        
        # Save output image if requested
        if output_path:
            cv2.imwrite(output_path, frame_results["annotated_frame"])
    
    # Process video
    else:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return json.dumps({"error": f"Could not open video {video_path}"})
        
        # Video properties
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Initialize video writer if output path is provided
        writer = None
        if output_path:
            try:
                # Try different codecs based on output file extension
                extension = os.path.splitext(output_path)[1].lower()
                if extension == '.mp4':
                    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                elif extension == '.avi':
                    fourcc = cv2.VideoWriter_fourcc(*'XVID')
                else:
                    fourcc = cv2.VideoWriter_fourcc(*'mp4v')  # Default
                    
                writer = cv2.VideoWriter(output_path, fourcc, fps, (frame_width, frame_height))
            except Exception as e:
                print(f"Error creating video writer: {e}")
        
        # Process each frame with a sampling rate
        # For longer videos, process every 30th frame (1 sec assuming 30fps)
        # For shorter videos, process more frames
        sampling_rate = max(1, min(30, total_frames // 10)) if total_frames > 0 else 30
        frame_count = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            frame_count += 1
            
            # Only process frames according to sampling rate
            if frame_count % sampling_rate != 0:
                if writer:
                    writer.write(frame)
                continue
            
            # Process the frame
            frame_results = process_frame(frame, net, classes, vehicle_indices, confidence_threshold)
            
            # Update results
            for v_type, count in frame_results["vehicle_counts"].items():
                vehicle_counts[v_type] = max(vehicle_counts[v_type], count)
            
            # Only keep top detections
            results["detections"] = frame_results["detections"] if len(frame_results["detections"]) > len(results["detections"]) else results["detections"]
            
            # Write frame with annotations to output video
            if writer:
                writer.write(frame_results["annotated_frame"])
        
        # Clean up video resources
        cap.release()
        if writer:
            writer.release()
        
        results["processedFrames"] = frame_count // sampling_rate
    
    # Format the final results
    results["totalVehicles"] = sum(vehicle_counts.values())
    for v_type, count in vehicle_counts.items():
        if count > 0:
            results["vehicles"].append({"type": v_type, "count": count})
    
    # Convert Python objects to JSON-compatible format
    clean_detections = []
    for det in results["detections"]:
        clean_det = {
            "box": det["box"],
            "score": float(det["score"]),
            "class": int(det["class"]),
            "className": det["className"]
        }
        clean_detections.append(clean_det)
    
    results["detections"] = clean_detections[:50]  # Limit to top 50 detections for performance
    
    return json.dumps(results)

def process_frame(frame, net, classes, vehicle_indices, confidence_threshold):
    """Process a single frame for vehicle detection."""
    height, width = frame.shape[:2]
    
    # Create blob from frame
    blob = cv2.dnn.blobFromImage(
        frame, 0.007843, (300, 300), (127.5, 127.5, 127.5), swapRB=True
    )
    
    # Pass blob through the network
    net.setInput(blob)
    detections = net.forward()
    
    # Variables for current frame
    vehicles_in_frame = 0
    vehicle_counts = Counter()
    detections_list = []
    
    # Process detections
    for i in range(detections.shape[2]):
        confidence = detections[0, 0, i, 2]
        
        # Filter detections by confidence threshold
        if confidence > confidence_threshold:
            class_id = int(detections[0, 0, i, 1])
            
            # Check if detected class is a vehicle
            if class_id in vehicle_indices:
                vehicles_in_frame += 1
                vehicle_type = classes[class_id]
                vehicle_counts[vehicle_type] += 1
                
                # Scale bounding box coordinates to frame size
                box = detections[0, 0, i, 3:7] * np.array([width, height, width, height])
                (startX, startY, endX, endY) = box.astype("int")
                
                # Ensure coordinates are within frame boundaries
                startX = max(0, startX)
                startY = max(0, startY)
                endX = min(width, endX)
                endY = min(height, endY)
                
                # Draw bounding box
                cv2.rectangle(frame, (startX, startY), (endX, endY), (0, 255, 0), 2)
                
                # Add label
                label = f"{classes[class_id]}: {confidence:.2f}"
                y = startY - 15 if startY - 15 > 15 else startY + 15
                cv2.putText(frame, label, (startX, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                
                # Add detection to list
                detections_list.append({
                    "box": [int(startX), int(startY), int(endX - startX), int(endY - startY)],
                    "score": float(confidence),
                    "class": class_id,
                    "className": classes[class_id]
                })
    
    # Add frame info
    info_text = f"Vehicles in frame: {vehicles_in_frame}"
    cv2.putText(frame, info_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
    
    return {
        "annotated_frame": frame,
        "vehicle_counts": vehicle_counts,
        "detections": detections_list
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Detect vehicles in image or video')
    parser.add_argument('--input', required=True, help='Path to input image or video file')
    parser.add_argument('--output', help='Path to output file (optional)')
    parser.add_argument('--confidence', type=float, default=0.5, help='Confidence threshold')
    
    args = parser.parse_args()
    
    # Run detection and print results to stdout
    result_json = vehicle_detection(
        args.input, 
        args.output, 
        args.confidence
    )
    
    print(result_json)
  `;
}

// Main function to run detection
async function runMobileNetDetection(mediaPath, detectionId) {
  try {
    const detection = await Detection.findById(detectionId);
    if (!detection) {
      throw new Error('Detection not found');
    }

    console.log(`Running MobileNet SSD detection on ${mediaPath} (type: ${detection.mediaType})`);
    
    // Get file extension to check if it's an image or video
    const fileExt = path.extname(mediaPath).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.bmp'].includes(fileExt);
    
    // Optional: create output path for visualization
    const outputDir = path.join(__dirname, '../public/detections');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputFilename = `${path.basename(mediaPath, path.extname(mediaPath))}_detected${path.extname(mediaPath)}`;
    const outputPath = path.join(outputDir, outputFilename);
    
    // Run detection using Python script
    const results = await runPythonDetection(mediaPath, {
      confidenceThreshold: 0.5,
      outputPath: outputPath
    });
    
    // Check for errors from Python
    if (results.error) {
      throw new Error(results.error);
    }
    
    console.log(`Detection results: ${results.totalVehicles} vehicles found`);
    
    // Generate detailed text summary
    const vehicleSummary = results.vehicles
      .map(v => `${v.count} ${v.type}${v.count > 1 ? 's' : ''}`)
      .join(', ');
      
    results.textSummary = `Detected ${results.totalVehicles} vehicles: ${vehicleSummary}`;
    
    if (detection.mediaType === 'video' && results.processedFrames) {
      results.textSummary += ` Analysis based on ${results.processedFrames} frames.`;
    }
    
    // Add visualization URL if available
    if (fs.existsSync(outputPath)) {
      results.visualizationUrl = `/detections/${outputFilename}`;
    }
    
    // Look for potential emergency vehicles based on colors
    // This is a placeholder - for accurate detection, you need a custom model
    if (detection.mediaType === 'image' && results.totalVehicles > 0) {
      results.potentialEmergencyVehicles = await checkForEmergencyColors(mediaPath);
      
      if (results.potentialEmergencyVehicles > 0) {
        results.textSummary += ` Potential emergency vehicles detected: ${results.potentialEmergencyVehicles}.`;
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error running MobileNet SSD detection:', error);
    throw error;
  }
}

// Helper function to check for emergency vehicle colors (red/blue patterns)
// This is a placeholder - would need computer vision implementation
async function checkForEmergencyColors(imagePath) {
  // In a full implementation, this would analyze the image for red/blue patterns
  // Since this is just a placeholder, we'll return 0
  return 0;
}

module.exports = {
  runMobileNetDetection
};