# Enhanced Photo Selection Configuration

This document describes the new enhanced photo selection features added to MMM-Wallpaper to improve photo diversity and reduce repetition in large iCloud albums.

## New Configuration Options

### `enhancedShuffle` (boolean, default: `true`)

Enables the enhanced photo selection system. When enabled, replaces the sequential cycling with intelligent photo selection algorithms.

### `recentlyShownTracking` (boolean, default: `true`)

Enables tracking of recently shown photos to prevent immediate repetition. Only works when `enhancedShuffle` is enabled.

### `recentlyShownCount` (number, default: `50`)

Number of recently shown photos to track. Larger values provide better diversity but use more memory. For 6+ hour cooldowns with fast intervals, consider 500+.

### `recentlyShownCooldown` (number, default: `30`)

Time in minutes before a recently shown photo can be selected again. Photos shown within this timeframe have heavily reduced selection probability. For 6+ hour avoidance, use 400+ minutes.

### `selectionMethod` (string, default: `"weighted_random"`)

Photo selection algorithm to use. Options:

- `"weighted_random"`: Smart random selection that avoids recently shown photos
- `"pure_random"`: Completely random selection (no recently shown avoidance)
- `"sequential"`: Original sequential cycling behavior

### `persistRecentlyShown` (boolean, default: `false`)

**Not yet implemented** - Will save recently shown photos to disk for persistence across restarts.

### `debugPhotoSelection` (boolean, default: `false`)

Enables detailed logging of photo selection decisions for debugging purposes.

### `rotatingPools` (boolean, default: `false`)

Enables rotating photo pools to ensure ALL photos from large albums are eventually seen. Automatically cycles through different subsets of photos over time.

### `poolSize` (number, default: `1000`)

Number of photos in each rotating pool. Larger pools provide more variety per rotation but take longer to cycle through all photos.

### `poolRotationInterval` (number, default: `2`)

Hours between pool rotations. Smaller intervals mean you see fresh photos more frequently, but may cycle through pools faster than you can see all photos in each pool.

## Example Configuration

```javascript
{
  module: "MMM-Wallpaper",
  position: "fullscreen_below",
  config: {
    source: ["icloud:ALBUM1", "icloud:ALBUM2"],
    slideInterval: 5 * 60 * 1000, // 5 minutes
    maximumEntries: 50, // Will be automatically increased to 500 for enhanced shuffle

    // Enhanced photo selection options
    enhancedShuffle: true,
    recentlyShownTracking: true,
    recentlyShownCount: 100,
    recentlyShownCooldown: 60, // 1 hour
    selectionMethod: "weighted_random",
    debugPhotoSelection: false
  }
}
```

## How It Works

### Enhanced Shuffle Algorithm

1. **Larger Image Pool**: When `enhancedShuffle` is enabled, the system automatically increases the working image pool from the default 10 images to up to 500 images (or the total available if less).

2. **Weighted Random Selection**: The `weighted_random` method assigns weights to each photo based on when it was last shown:

   - Photos never shown: Full weight (1.0)
   - Photos shown outside cooldown period: Full weight (1.0)
   - Photos shown within cooldown period: Heavily reduced weight (0.1 \* cooldown_factor)

3. **Recently Shown Tracking**: The system maintains an in-memory list of recently shown photos with timestamps, automatically removing old entries.

### Performance Considerations

- **Memory Usage**: Each tracked photo uses ~100 bytes of memory. With default settings (50 tracked photos), this adds ~5KB of memory usage.
- **CPU Usage**: Photo selection adds minimal CPU overhead (~1ms per selection).
- **Network Usage**: Larger image pools may increase initial load time but don't affect ongoing network usage.

## Troubleshooting

### Enable Debug Logging

Set `debugPhotoSelection: true` to see detailed selection information in the console:

```
Enhanced photo selection system initialized
Selection method: weighted_random
Recently shown tracking: true
Recently shown count: 50
Recently shown cooldown: 30 minutes
Selected image index: 42 (method: weighted_random)
Selected image URL: https://...
Tracked recently shown: https://... (total tracked: 15)
```

### Common Issues

**Still seeing repeated photos**:

- Increase `recentlyShownCount` to track more photos
- Increase `recentlyShownCooldown` for longer avoidance periods
- Ensure `enhancedShuffle` is enabled

**Photos changing too randomly**:

- Use `selectionMethod: "sequential"` for original behavior
- Reduce `recentlyShownCooldown` for faster photo recycling

**Performance issues**:

- Reduce `recentlyShownCount` if memory is constrained
- Disable `debugPhotoSelection` in production

## Migration from Original Version

The enhanced photo selection is backward compatible. Existing configurations will continue to work with the original sequential behavior unless `enhancedShuffle` is explicitly enabled.

To migrate:

1. Add `enhancedShuffle: true` to your config
2. Optionally adjust other enhanced shuffle settings
3. Test with `debugPhotoSelection: true` initially
