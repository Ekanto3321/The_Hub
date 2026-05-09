#!/bin/bash

# --- Configuration ---
INPUT_FILE="$1"
OUTPUT_FILE="$2"

if [ -z "$INPUT_FILE" ] || [ -z "$OUTPUT_FILE" ]; then
    echo "Usage: ./transcode.sh <input_file> <output_file>"
    exit 1
fi

# --- Hardware Acceleration Detection ---
# Check for NVIDIA GPU
if command -v nvidia-smi &> /dev/null; then
    echo "NVIDIA GPU detected. Using h264_nvenc acceleration."
    # Removed -level 3.0 as it often conflicts with nvenc auto-leveling
    ACCEL="-c:v h264_nvenc -preset fast"
else
    echo "No NVIDIA GPU detected. Using CPU encoding (libx264)."
    ACCEL="-c:v libx264 -preset medium"
fi

# --- Transcoding Command ---
# Removed -level 3.0 and -profile:v baseline to avoid invalid param errors
ffmpeg -y -i "$INPUT_FILE" $ACCEL -pix_fmt yuv420p -c:a aac -movflags +faststart "$OUTPUT_FILE"

echo "Transcoding complete: $OUTPUT_FILE"
