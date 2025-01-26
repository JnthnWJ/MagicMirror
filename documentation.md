# Module: MMM-Wallpaper (Customized)

This customized version of the `MMM-Wallpaper` module adds several features beyond the original module's functionality:

1. **EXIF Data Extraction:** Extracts EXIF data from images, specifically the date the photo was taken, the location (latitude and longitude), and the contributor's name (for iCloud shared albums).

2. **Intelligent Location String:** Uses reverse geocoding (via the Nominatim API) to generate a human-readable location string from the GPS coordinates. It prioritizes location parts intelligently and handles both US and non-US locations differently.

3. **US Location Formatting:**
    *   **Priority Order:**
        1. `tourism` (e.g., "Golden Gate Bridge")
        2. `amenity` (e.g., "Weimar University")
        3. `hamlet`
        4. `town` or `city`
        5. `road`, `county`, and state abbreviation (if road and county are present)
    *   **State Appending:** Appends the state name (or abbreviation for `road/county`) if it's not already present in the location string.
    *   **Territory Handling:** Appends the US territory name (e.g., "Guam") if it's not already included in the location string and is different from the state name.

4. **Non-US Location Formatting:**
    *   **Priority Order:**
        1. `tourism`
        2. `amenity`
        3. `hamlet`
        4. `town` or `city`
        5. `road` and `county` (if available)
        6. `village`
        7. `hamlet`
        8. `borough`
        9. `suburb`
    *   **Country Appending:** Appends the country name if it's not already included in the location string.

5. **Info String Display:** Displays a formatted string with the date, location, and contributor information in a semi-transparent black box at the bottom of the screen. The text is truncated with an ellipsis if it's too long to fit on one line.

6. **Keyboard Shortcuts:** Allows users to manually advance to the next image or go back to the previous image using the right and left arrow keys, respectively.

7. **Removed Unused Services:** Support for several image sources not used in this implementation have been removed. This version is only designed to work with **iCloud, Bing, and Chromecast**.

## Configuration Options:

The module retains all the original configuration options of `MMM-Wallpaper`, and no new configuration options have been added for these custom features.

## Code Modifications:

### `MMM-Wallpaper.js`

*   Added a new variable `infoString` to store the formatted date, location, and contributor string.
*   Modified the `socketNotificationReceived` function to listen for the `NEW_INFO_STRING` notification and update the `infoString` variable. It then calls `updateDom()` to refresh the display.
*   Modified the `getDom` function to create a `div` element with the class `info-container` and set its `innerHTML` to the `infoString`. This `div` is used to display the information on the screen.
*   Added a `div` with the class `info-container` to display the formatted info string.
*   Added keyboard event listeners to handle the left and right arrow keys for navigating through images:

```javascript
    document.addEventListener("keydown", function(event) {
      if (event.key === "ArrowLeft") {
        self.loadPreviousImage();
      } else if (event.key === "ArrowRight") {
        self.loadNextImage();
      }
    });
```

*   Added two new functions: `loadNextImage` and `loadPreviousImage` to handle the logic for advancing to the next or previous image, respectively.

### `node_helper.js`

*   Added a new constant object `stateAbbreviations` to map US state names to their abbreviations.
*   Modified the `getExifData` function to call `processExifData` with both the EXIF data and the image URL.
*   Added the `processExifData` function to:
    *   Extract the date, latitude, longitude, and contributor name from the EXIF data and image URL.
    *   Call the `reverseGeocode` function to get the location string.
    *   Handle cases where no location data is available.
*   Modified the `reverseGeocode` function to:
    *   Always use zoom level 18 for the reverse geocoding request to get the most detailed address information.
    *   Correctly prioritize location parts for both US and non-US locations.
    *   Handle US territories correctly, appending the territory name only if it's not already included and is different from the state.
    *   Format the location string according to the specified logic.
    *   Call the `createInfoString` helper function to construct the final info string.
    *   Send the `NEW_INFO_STRING` notification with the constructed info string.
*   Added a new helper function `createInfoString` to construct the formatted info string, only including parts that have values.
*   Added a new function `getTerritory` to specifically get the territory name for US locations.
*   Added extensive logging within `reverseGeocode` to help with debugging.
*   Removed a lot of the code for services that will not be supported.

### `MMM-Wallpaper.css`

*   Added new CSS rules for the `.info-container` class to style the info string display:
    *   Positioning: `position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);`
    *   Appearance: `background-color: rgba(0, 0, 0, 0.5); color: white; padding: 10px 20px; border-radius: 5px;`
    *   Font: `font-family: Roboto Condensed, sans-serif; font-size: 35px; font-weight: 500;`
    *   Z-index: `z-index: 1000;` (to ensure it's on top of other elements)
    *   Blur: `backdrop-filter: blur(5px);`
    *   Text wrapping: `white-space: nowrap;`
    *   Overflow handling: `overflow: hidden; text-overflow: ellipsis;`
    *   Maximum width: `max-width: 90%;`

## Dependencies:

*   **`exif`:** Used for extracting EXIF data from images. Installed using `npm install exif`.
*   **`node-fetch`:** Used for making HTTP requests to the Nominatim API. Installed using `npm install node-fetch`.
*   **`uuid`:** Used for generating unique temporary file names. Installed using `npm install uuid`.

## Notes:

*   The Nominatim API has usage limits. If you are making a large number of requests, you should consider using a caching mechanism to avoid exceeding the limits.
*   The accuracy of the location string depends on the quality of the GPS data in the EXIF data and the availability of address information in the Nominatim database.
*   The appearance of the info string can be further customized by modifying the CSS rules for the `.info-container` class.

This documentation provides a comprehensive overview of the custom changes made to the `MMM-Wallpaper` module. Remember to consult the original `MMM-Wallpaper` documentation for information on the base module's functionality and configuration options.
