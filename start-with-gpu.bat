@echo off
REM MagicMirror Startup Script with GPU Acceleration for Windows
REM This script enables GPU acceleration for optimal liquid glass effects

echo Starting MagicMirror with GPU acceleration enabled...
echo This will provide the best visual quality for liquid glass effects.

REM Set environment variable to enable GPU acceleration
set ELECTRON_ENABLE_GPU=1

REM Additional Electron flags for better rendering
set ELECTRON_EXTRA_ARGS=--enable-gpu-rasterization --enable-zero-copy --enable-features=VaapiVideoDecoder --disable-features=VizDisplayCompositor

REM Start MagicMirror
npm run start

echo MagicMirror started with GPU acceleration.
pause
