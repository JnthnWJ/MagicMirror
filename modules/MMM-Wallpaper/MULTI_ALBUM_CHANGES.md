# MMM-Wallpaper Multi-Album Support

## Overview

Modified the MMM-Wallpaper plugin to support multiple iCloud albums that shuffle together as if they were a single combined album. This allows users to work around iCloud's per-album limits by combining multiple albums into one larger image pool.

## Changes Made

### 1. Enhanced `fetchWallpapers()` Function

- Added detection for arrays of multiple iCloud albums
- Maintains backward compatibility with single sources
- Routes multi-album requests to new `fetchMultipleiCloudAlbums()` function

### 2. New Multi-Album Functions

#### `fetchMultipleiCloudAlbums(config)`

- Handles fetching from multiple iCloud albums concurrently
- Sets up tracking variables for album progress
- Includes 30-second timeout for stuck requests
- Distributes maximum entries across albums to prevent dominance

#### `requestMultiAlbum(config, params)`

- Specialized request function for multi-album fetching
- Includes error handling and timeout protection

#### `processMultiAlbumResponse(response, body, config, params)`

- Processes responses from multi-album requests
- Only calls completion handler for final results or errors

#### `processiCloudDataMulti(response, body, config, params)`

- Handles iCloud-specific data processing for multiple albums
- Manages the two-stage iCloud API process (webstream → asset URLs)
- Includes detailed logging for debugging
- Filters out images without valid URLs

#### `handleAlbumComplete(albumIndex, images)`

- Tracks completion of individual albums
- Triggers combination when all albums are complete

#### `combineAlbumResults()`

- Combines images from all completed albums
- Applies shuffling if enabled
- Respects maximum entry limits
- Cleans up tracking variables

### 3. Enhanced Cache Management

#### Updated `getCacheEntry(config)`

- Handles both single sources and arrays
- Creates consistent cache keys for arrays (sorted and joined)
- Ensures same cache key regardless of array order

### 4. Configuration Support

The plugin now supports this configuration format:

```javascript
{
  module: "MMM-Wallpaper",
  position: "fullscreen_below",
  config: {
    source: ["icloud:B20JtdOXm8Xvdky", "icloud:B2d5nhQSTHYS5Lh"], // Array of albums
    slideInterval: 45 * 1000,
    filter: "none",
    size: "contain",
    maximumEntries: 200,
    shuffle: true
  }
}
```

## Backward Compatibility

- Single album sources work exactly as before
- Arrays with single albums work the same as strings
- Only arrays with multiple iCloud sources get new behavior
- All existing configuration options remain supported

## Features

- **Concurrent Fetching**: Albums are fetched simultaneously for faster loading
- **Fair Distribution**: Images are distributed evenly across albums
- **Shuffling**: Combined image collection is shuffled if enabled
- **Caching**: Proper cache management for combined sources
- **Error Handling**: Robust error handling with timeouts
- **Logging**: Detailed console logging for debugging

## Testing

The implementation includes:

- Input validation for multi-album detection
- Cache key consistency verification
- Error handling for failed album requests
- Timeout protection for stuck requests

## Usage

1. Update your config.js to use an array of iCloud album sources
2. Restart MagicMirror
3. The plugin will automatically detect multiple albums and combine them
4. Images will be shuffled together from all albums

## Critical Bug Fix (June 2, 2025)

### Issue: Caching Bug Causing Album Switching Behavior

**Problem**: Users reported that the system appeared to be "switching between albums" rather than truly shuffling photos from multiple albums together. Investigation revealed that only 36 images (the size of the smaller album) were being sent to the frontend instead of the expected 1,000+ images from the combined pool.

**Root Cause**: The caching system was storing already-processed rotating pools instead of the full combined collection. This caused subsequent requests to return the cached processed pool (which might contain photos from only one album) rather than applying fresh rotating pool logic to the full combined collection.

**Symptoms**:

- Frontend received exactly 36 images instead of 1,000
- Long periods showing only photos from one album
- Appearance of "switching" between albums rather than mixing

**Fix Applied**:

1. **Modified `combineAlbumResults()`**:

   - Now caches the **full combined collection** (4,930 photos) instead of processed pools
   - Removed rotating pool processing from the combination phase

2. **Enhanced `sendResult()`**:

   - Added logic to apply rotating pool processing **every time** photos are requested
   - Ensures fresh pool calculation on each request, not just initial fetch
   - Added debug logging to track pool generation

3. **Updated `fetchMultipleiCloudAlbums()`**:
   - Modified cache check to properly handle full collections
   - Improved cache validation logic

**Result**:

- System now correctly sends 1,000 images per pool from the combined 4,930-photo collection
- Photos from both albums are properly mixed in each rotating pool
- Rotating pools change every 2 hours as designed
- All 4,930 photos are accessible across the 5-pool rotation cycle

**Debug Features Added**:

- `debugAlbumCombining` configuration option
- Detailed logging of album combination process
- Pool generation and size tracking
- Cache usage monitoring

This fix ensures the multi-album system works as originally intended, with true photo mixing rather than album switching.

**Important**: After applying this fix, you must clear the cache to get the benefits. Use the provided script:

```bash
./scripts/clear-wallpaper-cache.sh
```

See `scripts/README.md` for detailed instructions.

## Limitations

- Only works with iCloud album sources
- Mixed source types (iCloud + Bing) are not supported in arrays
- Maximum entries are distributed across all albums
