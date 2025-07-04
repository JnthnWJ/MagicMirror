# Loading Indicator Implementation

## Overview

A visual loading indicator has been added to the MMM-Wallpaper module to provide user feedback during the batch loading process when processing multiple iCloud albums. This addresses the issue where users experienced long startup times without any visual indication that the system was working.

## Features Implemented

### 1. Visual Loading Indicator

- **Spinner Animation**: CSS-animated rotating spinner
- **Loading Text**: Descriptive text showing current operation
- **Progress Information**: Optional percentage or status updates
- **Consistent Styling**: Matches MagicMirror's design aesthetic

### 2. Smart Display Logic

- **Automatic Detection**: Only shows for multi-album iCloud configurations
- **Progressive Updates**: Updates progress as albums are processed
- **Intelligent Hiding**: Disappears when first photo is ready to display
- **Safety Timeout**: Automatically hides after 5 minutes if something goes wrong

### 3. Socket Notification System

- **LOADING_STARTED**: Sent when batch processing begins
- **LOADING_PROGRESS**: Sent with progress updates during processing
- **LOADING_COMPLETE**: Sent when all albums are processed

## Implementation Details

### Frontend Changes (MMM-Wallpaper.js)

#### New Properties

```javascript
self.isLoading = false;
self.loadingProgress = null;
self.loadingTimeout = null;
```

#### New Methods

- `createLoadingIndicator()`: Creates DOM elements for the loading indicator
- `showLoadingIndicator(message)`: Displays the loading indicator with a message
- `updateLoadingProgress(message, progress)`: Updates progress information
- `hideLoadingIndicator()`: Hides the loading indicator and cleans up

#### Enhanced Socket Notification Handling

- Added handlers for `LOADING_STARTED`, `LOADING_PROGRESS`, and `LOADING_COMPLETE`
- Integrated with existing `WALLPAPERS` notification handling

#### Smart Detection in getData()

```javascript
// Show loading indicator for multi-album configurations
if (Array.isArray(config.source) && config.source.length > 1 && config.source.every((src) => typeof src === "string" && src.toLowerCase().startsWith("icloud:"))) {
  self.showLoadingIndicator("Loading photos from albums...");
}
```

### Backend Changes (node_helper.js)

#### Loading Start Notification

```javascript
// Send loading started notification
self.sendSocketNotification("LOADING_STARTED", {
  message: `Loading photos from ${self.totalAlbums} album${self.totalAlbums > 1 ? "s" : ""}...`
});
```

#### Progress Notifications

```javascript
// Send progress notification
const progressPercent = Math.round((self.currentAlbumIndex / self.totalAlbums) * 100);
self.sendSocketNotification("LOADING_PROGRESS", {
  message: `Processing album ${self.currentAlbumIndex + 1} of ${self.totalAlbums}...`,
  progress: progressPercent
});
```

#### Completion Notification

```javascript
// Send loading complete notification
self.sendSocketNotification("LOADING_COMPLETE", {
  message: `Loaded ${allImages.length} photos from ${self.albumResults.length} albums`
});
```

### CSS Styling (MMM-Wallpaper.css)

#### Loading Container

```css
.MMM-Wallpaper .loading-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 10px;
  padding: 30px;
  min-width: 250px;
  text-align: center;
}
```

#### Animated Spinner

```css
.MMM-Wallpaper .loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid #ffffff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
```

## User Experience

### Before Implementation

- Long startup times with no visual feedback
- Users unsure if the system was working or frozen
- No indication of progress during batch processing

### After Implementation

- Immediate visual feedback when loading begins
- Clear progress indicators showing which album is being processed
- Percentage completion for better time estimation
- Professional loading experience consistent with modern applications

## Testing

A comprehensive test suite was created (`test/loading-indicator.test.js`) that verifies:

- Loading indicator element creation
- Show/hide functionality
- Progress update handling
- Socket notification integration
- getData method integration

All tests pass successfully, confirming the implementation works as expected.

## Configuration

No additional configuration is required. The loading indicator:

- Automatically detects multi-album iCloud configurations
- Uses existing debug settings (`debugPhotoSelection`) for logging
- Respects the module's existing styling and positioning

## Compatibility

- Works with existing MagicMirror installations
- Compatible with all existing MMM-Wallpaper configurations
- Does not affect single-album or non-iCloud sources
- Maintains backward compatibility with all existing features

## Future Enhancements

Potential improvements could include:

- Customizable loading messages via configuration
- Different spinner styles or animations
- Integration with MagicMirror's notification system
- Loading indicator for other slow operations (EXIF processing, etc.)
