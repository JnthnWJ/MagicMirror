# Intelligent Image Cropping Feature

The MMM-Wallpaper plugin now includes intelligent image cropping that automatically adjusts how images are displayed based on their aspect ratio and content type.

## Overview

This feature eliminates black bars on landscape images while preserving the full content of portraits, panoramic images, and other special cases that would be damaged by cropping.

## How It Works

The system analyzes each image's aspect ratio and applies different display modes:

### Landscape Images (width > height)

- **Standard landscapes**: Cropped to fill the screen, eliminating black bars
- **Face-aware cropping**: Crop position biased toward upper portion (25% from top) to preserve faces
- **Panoramic images**: Preserved in full to maintain content (configurable threshold)

### Portrait Images (height > width)

- **Always preserved**: Full image displayed with letterboxing as needed
- **Maintains aspect ratio**: No content is lost

### Square Images (1:1 aspect ratio)

- **Content preserved**: Full image displayed with letterboxing as needed
- **No cropping**: Ensures no content is lost from centered subjects

### Special Cases

- **Panoramic images**: Extremely wide images (default >3:1 ratio) are not cropped
- **Extreme aspect ratios**: Very tall/narrow images (default <0.3:1 ratio) are not cropped

## Configuration Options

Add these options to your MMM-Wallpaper config:

```javascript
{
  module: "MMM-Wallpaper",
  position: "fullscreen_below",
  config: {
    // ... other config options ...

    // Intelligent cropping options
    intelligentCropping: true,              // Enable/disable the feature
    landscapeCroppingMode: "crop",          // "crop", "fit", "auto"
    panoramicThreshold: 3.0,                // Aspect ratio threshold for panoramic images
    extremeAspectThreshold: 0.3,            // Threshold for extremely tall/narrow images
    debugImageCropping: false,              // Enable debug logging
  }
}
```

### Configuration Details

#### `intelligentCropping` (boolean, default: true)

- `true`: Enable intelligent cropping analysis
- `false`: Use traditional behavior with the `size` setting

#### `landscapeCroppingMode` (string, default: "crop")

- `"crop"`: Always crop landscape images to fill screen
- `"fit"`: Never crop landscape images, always show full image
- `"auto"`: Only crop when image is significantly wider than screen

#### `panoramicThreshold` (number, default: 3.0)

- Images with aspect ratio greater than this value are considered panoramic
- Panoramic images are never cropped to preserve their content
- Example: 3.0 means images wider than 3:1 ratio won't be cropped

#### `extremeAspectThreshold` (number, default: 0.3)

- Images with aspect ratio less than this value are considered extremely tall/narrow
- These images are never cropped to preserve their content
- Example: 0.3 means images narrower than 0.3:1 ratio won't be cropped

#### `debugImageCropping` (boolean, default: false)

- Enable detailed console logging for troubleshooting
- Shows aspect ratio analysis and display mode decisions for each image

## Examples

### Example 1: Aggressive Cropping

```javascript
intelligentCropping: true,
landscapeCroppingMode: "crop",
panoramicThreshold: 4.0,        // Only very wide panoramas preserved
extremeAspectThreshold: 0.2,    // Only very narrow images preserved
```

### Example 2: Conservative Cropping

```javascript
intelligentCropping: true,
landscapeCroppingMode: "auto",  // Only crop when much wider than screen
panoramicThreshold: 2.5,        // More images treated as panoramic
extremeAspectThreshold: 0.4,    // More images treated as extreme
```

### Example 3: Disabled (Traditional Behavior)

```javascript
intelligentCropping: false,
size: "contain",                // Traditional object-fit setting
```

## Technical Implementation

The feature works by:

1. **Analyzing image dimensions** when each image loads
2. **Calculating aspect ratios** and comparing to thresholds
3. **Applying appropriate CSS** object-fit values and classes
4. **Maintaining compatibility** with existing crossfade and other features

### CSS Classes Applied

- `.wallpaper-crop-landscape`: Landscape images that are cropped (with face-aware positioning)
- `.wallpaper-fit-portrait`: Portrait images that are fitted
- `.wallpaper-fit-square`: Square images that are fitted (content preserved)
- `.wallpaper-fit-panoramic`: Panoramic images that are fitted
- `.wallpaper-fit-extreme`: Extremely tall/narrow images that are fitted
- `.wallpaper-default`: Default behavior when intelligent cropping is disabled

## Compatibility

This feature is fully compatible with:

- ✅ iCloud photo integration
- ✅ Enhanced photo selection and cooldown system
- ✅ Crossfade transitions
- ✅ Photo rotation and navigation
- ✅ All existing configuration options

## Troubleshooting

### Enable Debug Logging

Set `debugImageCropping: true` to see detailed analysis in the browser console:

```
🖼️  Image analysis: {aspectRatio: 1.78, type: "landscape", shouldCrop: true, reason: "Landscape image with cropping enabled"}
🎨 Display mode: {objectFit: "cover", cssClass: "wallpaper-crop-landscape", reason: "Cropping landscape image to fill screen"}
```

### Common Issues

1. **Images still have black bars**: Check that `intelligentCropping: true` and `landscapeCroppingMode: "crop"`
2. **Panoramic images are cropped**: Lower the `panoramicThreshold` value
3. **Too many images are cropped**: Use `landscapeCroppingMode: "auto"` or increase thresholds

### Performance

The intelligent cropping analysis adds minimal overhead:

- Analysis runs only when images load (not during display)
- Calculations are simple arithmetic operations
- No impact on photo selection or rotation performance
