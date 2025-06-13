#!/bin/bash

# MagicMirror Startup Script with GPU Acceleration
# This script enables GPU acceleration for optimal liquid glass effects

echo "Starting MagicMirror with GPU acceleration enabled..."
echo "This will provide the best visual quality for liquid glass effects."

# Set environment variable to enable GPU acceleration
export ELECTRON_ENABLE_GPU=1

# Additional Electron flags for better rendering
export ELECTRON_EXTRA_ARGS="--enable-gpu-rasterization --enable-zero-copy --enable-features=VaapiVideoDecoder --disable-features=VizDisplayCompositor"

# Start MagicMirror
npm run start

echo "MagicMirror started with GPU acceleration."
