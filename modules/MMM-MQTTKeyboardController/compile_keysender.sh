#!/bin/bash

# Compile the KeySender Swift application
# This script should be run on macOS

# Check if Swift is installed
if ! command -v swiftc &> /dev/null; then
    echo "Swift compiler not found. Please install Xcode or the Swift toolchain."
    exit 1
fi

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Compile the Swift code
echo "Compiling KeySender..."
swiftc -o "$DIR/KeySender" "$DIR/KeySender.swift"

# Check if compilation was successful
if [ $? -eq 0 ]; then
    echo "Compilation successful. KeySender executable created."
    echo ""
    echo "IMPORTANT: You need to grant Accessibility permissions to the KeySender executable."
    echo "1. Go to System Preferences > Security & Privacy > Privacy > Accessibility"
    echo "2. Click the lock icon to make changes"
    echo "3. Click the + button and add the KeySender executable"
    echo "4. Make sure the checkbox next to KeySender is checked"
    echo ""
    echo "The KeySender executable is located at: $DIR/KeySender"
else
    echo "Compilation failed."
fi
