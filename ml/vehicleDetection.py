
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
  