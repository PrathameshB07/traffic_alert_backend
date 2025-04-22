#!/bin/bash
mkdir -p ml/yolov5s
# Install tfjs dependencies
npm install -g @tensorflow/tfjs-node

# Download pre-converted TensorFlow.js model files
git clone https://github.com/ultralytics/yolov5.git tmp-yolov5
cd tmp-yolov5
# Export to TensorFlow.js format using YOLOv5's export script
python3 export.py --weights yolov5s.pt --include tfjs
# Copy the exported model to our destination
cp -r runs/train/exp/web_model/* ../ml/yolov5s/
cd ..
# Clean up
rm -rf tmp-yolov5
echo "Downloaded pre-converted model successfully!"