/**
 * Low-Power Device Configuration for MMM-Wallpaper
 * 
 * This configuration is optimized for slower devices, Raspberry Pi, and older hardware.
 * It implements aggressive batch processing and performance optimizations to prevent
 * Electron freezing while still displaying all photos from your albums.
 * 
 * Copy the relevant sections to your config/config.js file and adjust as needed.
 */

// RECOMMENDED: Low-power configuration with aggressive optimizations
{
  module: "MMM-Wallpaper",
  position: "fullscreen_below",
  config: {
    source: ["icloud:YOUR_ALBUM_1", "icloud:YOUR_ALBUM_2"], // Your album IDs
    slideInterval: 2 * 60 * 1000, // Change photo every 2 minutes (slower for performance)
    updateInterval: 2 * 60 * 60 * 1000, // Check for new photos every 2 hours
    
    // Performance optimizations for low-powered devices
    lowPowerMode: true, // Enable all aggressive optimizations
    albumProcessingDelay: 5000, // 5 second delay between albums
    photoChunkSize: 25, // Process only 25 photos at a time
    chunkProcessingDelay: 300, // 300ms delay between chunks
    maxConcurrentRequests: 1, // Process albums one at a time
    progressiveLoading: true, // Start showing photos while others load
    
    // Conservative photo selection settings
    maximumEntries: 500, // Reasonable limit for low-power devices
    enhancedShuffle: true,
    recentlyShownTracking: true,
    recentlyShownCount: 200, // Track fewer photos to save memory
    recentlyShownCooldown: 300, // 5 hours cooldown
    selectionMethod: "weighted_random",
    
    // Rotating pools with conservative settings
    rotatingPools: true,
    poolSize: 500, // Smaller pools for better performance
    poolRotationInterval: 3, // 3 hours between rotations
    
    // Disable debug logging for better performance
    debugPhotoSelection: false,
    debugImageCropping: false,
    debugAlbumCombining: false,
    
    // Display optimizations
    caption: true,
    crossfade: true,
    filter: "brightness(0.8)", // Light filter to reduce processing
    intelligentCropping: false, // Disable for better performance
  }
}

// ALTERNATIVE: Ultra-conservative configuration for very slow devices
{
  module: "MMM-Wallpaper",
  position: "fullscreen_below",
  config: {
    source: ["icloud:YOUR_ALBUM_1"], // Start with just one album
    slideInterval: 5 * 60 * 1000, // Change photo every 5 minutes
    updateInterval: 4 * 60 * 60 * 1000, // Check for new photos every 4 hours
    
    // Ultra-conservative performance settings
    lowPowerMode: true,
    albumProcessingDelay: 10000, // 10 second delay between albums
    photoChunkSize: 10, // Process only 10 photos at a time
    chunkProcessingDelay: 500, // 500ms delay between chunks
    maxConcurrentRequests: 1,
    progressiveLoading: true,
    
    // Minimal photo pool
    maximumEntries: 200, // Very small pool
    enhancedShuffle: false, // Disable for simplicity
    recentlyShownTracking: false, // Disable tracking to save memory
    
    // Disable advanced features
    rotatingPools: false,
    intelligentCropping: false,
    debugPhotoSelection: false,
    debugImageCropping: false,
    debugAlbumCombining: false,
    
    // Basic display
    caption: false, // Disable caption for performance
    crossfade: false, // Disable crossfade for performance
    filter: "none",
  }
}

// TESTING: Debug configuration to monitor performance improvements
{
  module: "MMM-Wallpaper",
  position: "fullscreen_below",
  config: {
    source: ["icloud:YOUR_ALBUM_1", "icloud:YOUR_ALBUM_2"],
    slideInterval: 60 * 1000, // 1 minute for testing
    updateInterval: 30 * 60 * 1000, // 30 minutes for testing
    
    // Performance settings with debugging
    lowPowerMode: true,
    albumProcessingDelay: 3000,
    photoChunkSize: 30,
    chunkProcessingDelay: 200,
    maxConcurrentRequests: 1,
    progressiveLoading: true,
    
    // Enable debugging to monitor performance
    debugPhotoSelection: true,
    debugAlbumCombining: true,
    debugImageCropping: false,
    
    // Standard settings
    maximumEntries: 300,
    enhancedShuffle: true,
    recentlyShownTracking: true,
    recentlyShownCount: 150,
    recentlyShownCooldown: 200,
    selectionMethod: "weighted_random",
    
    rotatingPools: true,
    poolSize: 300,
    poolRotationInterval: 2,
    
    caption: true,
    crossfade: true,
    filter: "brightness(0.9)",
    intelligentCropping: false,
  }
}

/**
 * Performance Tuning Guidelines:
 * 
 * 1. Start with the RECOMMENDED configuration above
 * 2. If still experiencing freezing, try the ULTRA-CONSERVATIVE configuration
 * 3. Use the TESTING configuration to monitor improvements
 * 4. Gradually increase settings once stable
 * 
 * Key Performance Parameters:
 * - albumProcessingDelay: Higher = slower but more stable
 * - photoChunkSize: Lower = slower but less memory usage
 * - chunkProcessingDelay: Higher = slower but prevents blocking
 * - maximumEntries: Lower = less memory usage
 * - progressiveLoading: true = start showing photos immediately
 * 
 * Memory Management:
 * - Lower recentlyShownCount to reduce memory usage
 * - Disable debugPhotoSelection in production
 * - Use smaller poolSize values
 * - Consider disabling intelligentCropping
 * 
 * If problems persist:
 * - Try processing only one album at a time
 * - Increase all delay values
 * - Reduce photoChunkSize to 5-10
 * - Disable crossfade and other visual effects
 */
