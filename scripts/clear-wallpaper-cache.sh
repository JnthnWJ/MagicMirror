#!/bin/bash

# MMM-Wallpaper Cache Clearing Script
# This script clears all cached data for the MMM-Wallpaper module
# Use this when you need to force fresh album fetching or after bug fixes

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Assume MagicMirror root is one level up from scripts/
MM_ROOT="$(dirname "$SCRIPT_DIR")"

print_status "MMM-Wallpaper Cache Clearing Script"
print_status "MagicMirror root: $MM_ROOT"
echo

# Check if we're in the right directory
if [ ! -f "$MM_ROOT/package.json" ] || ! grep -q "magicmirror" "$MM_ROOT/package.json" 2>/dev/null; then
    print_error "This doesn't appear to be a MagicMirror directory!"
    print_error "Expected to find package.json with 'magicmirror' in: $MM_ROOT"
    exit 1
fi

# Check if MMM-Wallpaper module exists
if [ ! -d "$MM_ROOT/modules/MMM-Wallpaper" ]; then
    print_error "MMM-Wallpaper module not found in $MM_ROOT/modules/"
    exit 1
fi

print_status "Found MMM-Wallpaper module"

# Function to check if MagicMirror is running
check_mm_running() {
    if pgrep -f "electron.*js/electron.js" > /dev/null || pgrep -f "npm.*start" > /dev/null; then
        return 0  # Running
    else
        return 1  # Not running
    fi
}

# Check if MagicMirror is running
if check_mm_running; then
    print_warning "MagicMirror appears to be running!"
    print_warning "For best results, stop MagicMirror before clearing cache."
    echo
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Aborted by user"
        exit 0
    fi
fi

# Clear different types of cache
cache_cleared=false

# 1. Clear node_helper cache files (if they exist)
print_status "Looking for MMM-Wallpaper cache files..."

# Look for cache files in the module directory
if find "$MM_ROOT/modules/MMM-Wallpaper" -name "*.cache" -type f 2>/dev/null | grep -q .; then
    print_status "Found cache files in MMM-Wallpaper directory"
    find "$MM_ROOT/modules/MMM-Wallpaper" -name "*.cache" -type f -delete
    print_success "Deleted cache files from MMM-Wallpaper directory"
    cache_cleared=true
fi

# 2. Clear any temp files
if [ -d "$MM_ROOT/modules/MMM-Wallpaper/temp" ]; then
    print_status "Found temp directory, clearing contents..."
    rm -rf "$MM_ROOT/modules/MMM-Wallpaper/temp"/*
    print_success "Cleared temp directory"
    cache_cleared=true
fi

# 3. Clear any cache in the main MagicMirror directory
if find "$MM_ROOT" -maxdepth 1 -name "*.cache" -type f 2>/dev/null | grep -q .; then
    print_status "Found cache files in MagicMirror root"
    find "$MM_ROOT" -maxdepth 1 -name "*.cache" -type f -delete
    print_success "Deleted cache files from MagicMirror root"
    cache_cleared=true
fi

# 4. Clear any wallpaper-related cache in common cache locations
for cache_dir in "$HOME/.cache/MagicMirror" "$MM_ROOT/.cache" "$MM_ROOT/cache"; do
    if [ -d "$cache_dir" ]; then
        print_status "Checking cache directory: $cache_dir"
        if find "$cache_dir" -name "*wallpaper*" -o -name "*icloud*" 2>/dev/null | grep -q .; then
            find "$cache_dir" -name "*wallpaper*" -o -name "*icloud*" -delete 2>/dev/null || true
            print_success "Cleared wallpaper-related cache from $cache_dir"
            cache_cleared=true
        fi
    fi
done

# 5. Clear browser cache (Electron cache)
electron_cache_dirs=(
    "$HOME/.config/MagicMirror"
    "$HOME/.config/Electron"
    "$MM_ROOT/.config"
)

for cache_dir in "${electron_cache_dirs[@]}"; do
    if [ -d "$cache_dir" ]; then
        print_status "Checking Electron cache: $cache_dir"
        if [ -d "$cache_dir/Cache" ] || [ -d "$cache_dir/CachedData" ]; then
            rm -rf "$cache_dir/Cache" "$cache_dir/CachedData" 2>/dev/null || true
            print_success "Cleared Electron cache from $cache_dir"
            cache_cleared=true
        fi
    fi
done

echo
if [ "$cache_cleared" = true ]; then
    print_success "Cache clearing completed!"
    echo
    print_status "What was cleared:"
    print_status "  ✓ MMM-Wallpaper module cache files"
    print_status "  ✓ Temporary files"
    print_status "  ✓ Electron browser cache"
    print_status "  ✓ Any wallpaper-related cached data"
    echo
    print_warning "Next steps:"
    print_warning "  1. Restart MagicMirror to force fresh album fetching"
    print_warning "  2. Check logs to verify albums are being re-fetched"
    print_warning "  3. Wait for the initial album fetch to complete"
else
    print_warning "No cache files found to clear"
    print_status "This could mean:"
    print_status "  - Cache was already cleared"
    print_status "  - MMM-Wallpaper hasn't run yet"
    print_status "  - Cache is stored in a different location"
fi

echo
print_status "Cache clearing script completed"
