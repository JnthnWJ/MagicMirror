/**
 * Example MagicMirror configuration for MMM-Wallpaper with Enhanced Photo Selection
 * 
 * Copy the relevant sections to your config/config.js file
 */

// Example 1: Single iCloud album with enhanced shuffle
{
  module: "MMM-Wallpaper",
  position: "fullscreen_below",
  config: {
    source: "icloud:YOUR_ALBUM_ID_HERE",
    slideInterval: 5 * 60 * 1000, // Change photo every 5 minutes
    updateInterval: 60 * 60 * 1000, // Check for new photos every hour
    
    // Enhanced photo selection (recommended for large albums)
    enhancedShuffle: true,
    recentlyShownTracking: true,
    recentlyShownCount: 100, // Track last 100 photos
    recentlyShownCooldown: 60, // Don't repeat photos for 1 hour
    selectionMethod: "weighted_random",
    
    // Optional: Enable debug logging during setup
    debugPhotoSelection: false,
    
    // Display options
    caption: true,
    crossfade: true,
    filter: "grayscale(0.3) brightness(0.7)",
  }
}

// Example 2: Multiple iCloud albums combined
{
  module: "MMM-Wallpaper",
  position: "fullscreen_below", 
  config: {
    source: [
      "icloud:ALBUM_1_ID",
      "icloud:ALBUM_2_ID", 
      "icloud:ALBUM_3_ID"
    ],
    slideInterval: 3 * 60 * 1000, // Faster rotation with more photos
    
    // Enhanced settings for multiple albums
    enhancedShuffle: true,
    recentlyShownTracking: true,
    recentlyShownCount: 150, // Track more photos from multiple albums
    recentlyShownCooldown: 90, // Longer cooldown for larger pool
    selectionMethod: "weighted_random",
    
    caption: true,
    crossfade: true,
  }
}

// Example 3: Conservative settings for smaller albums
{
  module: "MMM-Wallpaper",
  position: "fullscreen_below",
  config: {
    source: "icloud:SMALL_ALBUM_ID",
    slideInterval: 10 * 60 * 1000, // Slower rotation
    
    // Lighter enhanced shuffle settings
    enhancedShuffle: true,
    recentlyShownTracking: true,
    recentlyShownCount: 25, // Track fewer photos
    recentlyShownCooldown: 30, // Shorter cooldown
    selectionMethod: "weighted_random",
    
    caption: true,
    crossfade: true,
  }
}

// Example 4: Pure random (no recently shown tracking)
{
  module: "MMM-Wallpaper",
  position: "fullscreen_below",
  config: {
    source: "icloud:YOUR_ALBUM_ID",
    slideInterval: 5 * 60 * 1000,
    
    // Pure random selection
    enhancedShuffle: true,
    recentlyShownTracking: false, // Disable tracking
    selectionMethod: "pure_random",
    
    caption: true,
    crossfade: true,
  }
}

// Example 5: Original sequential behavior (backward compatibility)
{
  module: "MMM-Wallpaper", 
  position: "fullscreen_below",
  config: {
    source: "icloud:YOUR_ALBUM_ID",
    slideInterval: 5 * 60 * 1000,
    maximumEntries: 10, // Keep original small pool
    
    // Disable enhanced shuffle for original behavior
    enhancedShuffle: false,
    
    caption: true,
    crossfade: true,
  }
}

/**
 * Configuration Tips:
 * 
 * 1. For albums with 1000+ photos:
 *    - Use recentlyShownCount: 100-200
 *    - Use recentlyShownCooldown: 60-120 minutes
 *    - Consider selectionMethod: "weighted_random"
 * 
 * 2. For albums with 100-500 photos:
 *    - Use recentlyShownCount: 50-100
 *    - Use recentlyShownCooldown: 30-60 minutes
 * 
 * 3. For albums with <100 photos:
 *    - Use recentlyShownCount: 20-50
 *    - Use recentlyShownCooldown: 15-30 minutes
 * 
 * 4. Memory usage: Each tracked photo uses ~100 bytes
 *    - 50 photos = ~5KB
 *    - 100 photos = ~10KB
 *    - 200 photos = ~20KB
 * 
 * 5. To find your iCloud album ID:
 *    - Share the album and copy the URL
 *    - Extract the ID from the URL (the part after the last /)
 *    - Use format: "icloud:ALBUM_ID"
 */
