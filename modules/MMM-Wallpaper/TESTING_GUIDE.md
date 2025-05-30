# Enhanced Photo Selection Testing Guide

## Quick Start Testing

### 1. Enable Enhanced Shuffle with Debug Logging

Add this to your MagicMirror config to test the enhanced photo selection:

```javascript
{
  module: "MMM-Wallpaper",
  position: "fullscreen_below",
  config: {
    source: "icloud:YOUR_ALBUM_ID",
    slideInterval: 30 * 1000, // 30 seconds for quick testing

    // Enable enhanced shuffle with debug logging
    enhancedShuffle: true,
    recentlyShownTracking: true,
    recentlyShownCount: 20,
    recentlyShownCooldown: 5, // 5 minutes for testing
    selectionMethod: "weighted_random",
    debugPhotoSelection: true, // Enable detailed logging

    caption: true,
    crossfade: true,
  }
}
```

### 2. Monitor the Console

Open your browser's developer console (F12) and watch for enhanced shuffle logs:

```
Enhanced photo selection system initialized
Selection method: weighted_random
Recently shown tracking: true
Recently shown count: 20
Recently shown cooldown: 5 minutes
Selected image index: 42 (method: weighted_random)
Selected image URL: https://...
Tracked recently shown: https://... (total tracked: 1)
```

### 3. Verify Behavior

**Expected Results:**

- Photos should change every 30 seconds
- You should see different photos each time (not sequential 1,2,3,4...)
- Recently shown photos should rarely repeat within 5 minutes
- Console should show selection decisions and tracking

## Testing Different Algorithms

### Test 1: Weighted Random (Recommended)

```javascript
selectionMethod: "weighted_random",
recentlyShownTracking: true,
```

**Expected:** Good diversity, recently shown photos avoided

### Test 2: Pure Random

```javascript
selectionMethod: "pure_random",
recentlyShownTracking: false,
```

**Expected:** Random selection, may have some clustering

### Test 3: Sequential (Original Behavior)

```javascript
selectionMethod: "sequential",
recentlyShownTracking: false,
```

**Expected:** Photos in order: 1,2,3,4...n,1,2,3,4...

### Test 4: Disable Enhanced Shuffle

```javascript
enhancedShuffle: false,
```

**Expected:** Original plugin behavior (sequential through 10 images)

## Algorithm Testing Script

Run the standalone test to verify algorithms work correctly:

```bash
cd /path/to/MagicMirror
node modules/MMM-Wallpaper/test_enhanced_shuffle.js
```

**Expected Output:**

```
Enhanced Photo Selection Test Suite
===================================

=== Weighted Random - Large Pool ===
Images: 100, Selections: 200
- Unique images shown: 96/100 (96.0%)
- Distribution ratio (max/min): 4.00
- First 20 selections: [12, 26, 50, 55, 82, ...]
```

## Performance Testing

### Memory Usage Test

1. Enable debug logging and run for 1 hour
2. Check browser memory usage in developer tools
3. Expected increase: ~6KB for default settings

### CPU Usage Test

1. Monitor CPU usage during photo transitions
2. Expected impact: <1% CPU increase
3. Selection should complete in <1ms

## Troubleshooting

### Issue: Still seeing repeated photos

**Solutions:**

- Increase `recentlyShownCount` (try 50-100)
- Increase `recentlyShownCooldown` (try 30-60 minutes)
- Verify `enhancedShuffle: true` is set
- Check console for error messages

### Issue: Photos changing too randomly

**Solutions:**

- Use `selectionMethod: "sequential"` for predictable order
- Reduce `recentlyShownCooldown` for faster recycling
- Consider `selectionMethod: "pure_random"` without tracking

### Issue: Performance problems

**Solutions:**

- Reduce `recentlyShownCount` (try 25-50)
- Disable `debugPhotoSelection` in production
- Check browser console for JavaScript errors

### Issue: Not seeing debug logs

**Solutions:**

- Verify `debugPhotoSelection: true` in config
- Check browser console (F12 → Console tab)
- Restart MagicMirror after config changes
- Look for "Enhanced photo selection system initialized" message

## Production Configuration

Once testing is complete, use these production settings:

```javascript
{
  module: "MMM-Wallpaper",
  position: "fullscreen_below",
  config: {
    source: "icloud:YOUR_ALBUM_ID",
    slideInterval: 5 * 60 * 1000, // 5 minutes

    // Production settings
    enhancedShuffle: true,
    recentlyShownTracking: true,
    recentlyShownCount: 50, // Adjust based on album size
    recentlyShownCooldown: 30, // 30 minutes
    selectionMethod: "weighted_random",
    debugPhotoSelection: false, // Disable debug logging

    caption: true,
    crossfade: true,
  }
}
```

## Validation Checklist

- [ ] Enhanced shuffle initializes without errors
- [ ] Photos display in non-sequential order
- [ ] Recently shown photos are avoided for cooldown period
- [ ] Debug logging shows selection decisions (when enabled)
- [ ] Memory usage remains reasonable
- [ ] No JavaScript errors in console
- [ ] Photo transitions work smoothly
- [ ] Configuration changes take effect after restart

## Getting Help

If you encounter issues:

1. **Check the logs:** Enable `debugPhotoSelection: true` and check console
2. **Test algorithms:** Run `test_enhanced_shuffle.js` to verify core logic
3. **Try different settings:** Test with various `selectionMethod` options
4. **Verify config:** Ensure `enhancedShuffle: true` is set
5. **Restart MagicMirror:** Configuration changes require restart

## Success Metrics

Your enhanced photo selection is working correctly if:

- ✅ You see 50-500 different photos instead of just 10
- ✅ Photos don't repeat for the configured cooldown period
- ✅ Selection appears random but avoids recent photos
- ✅ Memory usage increases by <20KB
- ✅ No performance degradation during photo transitions
- ✅ Debug logs show intelligent selection decisions
