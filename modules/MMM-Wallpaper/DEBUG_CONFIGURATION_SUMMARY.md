# Debug Configuration Summary

## Changes Made

### 1. Disabled General Debug Logging

**Files Modified:**

- `MMM-Wallpaper.js` - Removed verbose console logs from image loading, transitions, and general operations
- `node_helper.js` - Removed verbose console logs from album fetching, EXIF processing, and geocoding

**Logs Removed:**

- Image loading progress messages
- Album fetching status updates
- EXIF data processing logs
- Geocoding API response logs
- General image transition logs

### 2. Enhanced Duplicate Prevention Debug Logging

**Enabled Only Photo Selection Debug Logs:**

- Set `debugPhotoSelection: true` by default
- Enhanced duplicate detection logging with emojis for easy identification
- Added detailed weight calculation logging
- Added selection process visualization

**New Debug Features:**

#### Weight Calculation Logging

```
Image 42: Recently shown 15.3 min ago (cooldown: 400 min), weight reduced from 1 to 0.0038
Image 43: Not recently shown, weight = 1
```

#### Selection Process Logging

```
🎲 Starting weighted random selection from 1000 images
📊 Weight summary: 127 recently shown images (reduced weight), 873 fresh images (full weight)
📊 Total weight: 885.42
🎯 Random target: 234.5678 of 885.42
✅ Selected image 156 with weight 1.0000 (cumulative: 235.0000)
```

#### Duplicate Detection Logging

```
🔄 Tracked image 156 (abc123def456...) - NEW - Total tracked: 128/500
⚠️  DUPLICATE DETECTED: Image was shown 12.5 minutes ago (cooldown: 400 min)
```

### 3. Fixed Configuration Issue

**🚨 ISSUE IDENTIFIED:** The `maximumEntries` was set to only 10, severely limiting the photo pool size and causing frequent duplicates.

**✅ SOLUTION:** Updated default settings:

```javascript
maximumEntries: 1000,        // INCREASED from 10 - THIS WAS THE PROBLEM!
enhancedShuffle: true,
recentlyShownTracking: true,
recentlyShownCount: 500,
recentlyShownCooldown: 400, // 6.67 hours
selectionMethod: "weighted_random",
debugPhotoSelection: true, // ENABLED for debugging
```

**Why This Fixes Duplicates:**

- With only 36 images in the pool, you'd see duplicates every 36 photos
- With 1000+ images, duplicates should be extremely rare
- The enhanced shuffle system needs a large pool to work effectively

## How to Use

### 1. Monitor Browser Console

Open Developer Tools (F12) and watch for these specific logs:

**System Initialization:**

```
Enhanced photo selection system initialized
Selection method: weighted_random
Recently shown tracking: true
Recently shown count: 500
Recently shown cooldown: 400 minutes
```

**Photo Selection Process:**

- 🎲 Selection start
- 📊 Weight summaries
- 🎯 Random target selection
- ✅ Final selection
- 🔄 Tracking updates
- ⚠️ Duplicate warnings

### 2. Identify Duplicate Issues

**Look for these warning patterns:**

1. **Immediate Duplicates:**

```
⚠️  DUPLICATE DETECTED: Image was shown 2.1 minutes ago (cooldown: 400 min)
```

2. **Weight Calculation Issues:**

```
Image 42: Recently shown 15.3 min ago (cooldown: 400 min), weight reduced from 1 to 0.0038
✅ Selected image 42 with weight 0.0038 (cumulative: 234.5678)
```

3. **Tracking Problems:**

```
Tracking skipped: recentlyShownTracking=false, imageIndex=42, imagesLength=1000
```

### 3. Common Issues to Check

**Configuration Issues:**

- `enhancedShuffle` not enabled
- `recentlyShownTracking` disabled
- `recentlyShownCooldown` too short
- `selectionMethod` not set to "weighted_random"

**System Issues:**

- All weights becoming zero (fallback to pure random)
- Recently shown list not being maintained
- Weight calculations incorrect

### 4. Disable Debug Logging for Production

When debugging is complete, set:

```javascript
debugPhotoSelection: false;
```

This will disable all the enhanced debug logging while keeping the duplicate prevention system active.

## Expected Behavior

**With Working Duplicate Prevention:**

- Recently shown photos should have very low weights (< 0.1)
- Fresh photos should have weight = 1.0
- Duplicates should only occur after cooldown period expires
- Selection should favor fresh photos heavily

**Signs of Problems:**

- ⚠️ DUPLICATE warnings appearing frequently
- Recently shown photos being selected despite low weights
- Weight calculations showing incorrect values
- Tracking system not recording photos properly

## Testing

1. **Enable debug logging** (already done)
2. **Monitor console** for 10-15 photo transitions
3. **Look for duplicate warnings** within cooldown period
4. **Check weight calculations** for recently shown photos
5. **Verify tracking system** is recording photos correctly

If duplicates are still occurring, the debug logs will now clearly show where the system is failing.
