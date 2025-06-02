# MagicMirror Scripts

This directory contains utility scripts for maintaining and troubleshooting your MagicMirror installation.

## clear-wallpaper-cache.sh

### Purpose

Clears all cached data for the MMM-Wallpaper module to force fresh album fetching. This is particularly useful:

- After applying bug fixes to MMM-Wallpaper
- When albums appear to be "stuck" showing old content
- When switching between different album configurations
- When troubleshooting multi-album issues

### When to Use

**Definitely use this script when:**

- You've updated MMM-Wallpaper code and need to clear old cached data
- You're seeing only a small number of photos (like 36) instead of the full collection
- Albums appear to be switching instead of mixing properly
- You've changed your album configuration in config.js

**You might want to use this script when:**

- Photos seem to be repeating too frequently
- You suspect the cache is corrupted
- You want to force a complete refresh of album data

### Usage

#### Basic Usage

```bash
# From the MagicMirror root directory
./scripts/clear-wallpaper-cache.sh
```

#### Remote Usage (for TV/remote systems)

```bash
# SSH into your remote system and run
ssh jonathan@192.168.0.221
cd MagicMirror
./scripts/clear-wallpaper-cache.sh
```

### What It Does

The script automatically:

1. **Validates Environment**

   - Checks that you're in a MagicMirror directory
   - Verifies MMM-Wallpaper module exists
   - Warns if MagicMirror is currently running

2. **Clears Multiple Cache Types**

   - MMM-Wallpaper module cache files (\*.cache)
   - Temporary files in the module directory
   - Electron browser cache
   - Any wallpaper-related cached data

3. **Provides Feedback**
   - Shows what was found and cleared
   - Gives colored status messages
   - Provides next steps

### Sample Output

```
[INFO] MMM-Wallpaper Cache Clearing Script
[INFO] MagicMirror root: /home/jonathan/MagicMirror

[INFO] Found MMM-Wallpaper module
[WARNING] MagicMirror appears to be running!
[WARNING] For best results, stop MagicMirror before clearing cache.

[INFO] Looking for MMM-Wallpaper cache files...
[INFO] Found cache files in MMM-Wallpaper directory
[SUCCESS] Deleted cache files from MMM-Wallpaper directory
[SUCCESS] Cleared Electron cache from /home/jonathan/.config/MagicMirror

[SUCCESS] Cache clearing completed!

[INFO] What was cleared:
[INFO]   ✓ MMM-Wallpaper module cache files
[INFO]   ✓ Temporary files
[INFO]   ✓ Electron browser cache
[INFO]   ✓ Any wallpaper-related cached data

[WARNING] Next steps:
[WARNING]   1. Restart MagicMirror to force fresh album fetching
[WARNING]   2. Check logs to verify albums are being re-fetched
[WARNING]   3. Wait for the initial album fetch to complete
```

### After Running the Script

1. **Restart MagicMirror**

   ```bash
   # Stop MagicMirror (Ctrl+C if running in terminal)
   # Then restart
   npm run start
   ```

2. **Monitor the Logs**

   - Look for album fetching messages
   - Verify you see "Combined total: XXXX photos from 2 albums"
   - Check that the correct number of images are being sent

3. **Wait for Initial Fetch**
   - First run after cache clear will take longer
   - Albums need to be re-fetched from iCloud
   - Be patient during the initial load

### Troubleshooting

**Script says "No cache files found":**

- This is normal if cache was already cleared
- Or if MMM-Wallpaper hasn't run yet
- The script will still clear any Electron cache

**Permission errors:**

- Make sure the script is executable: `chmod +x scripts/clear-wallpaper-cache.sh`
- Run with appropriate permissions for your system

**MagicMirror won't start after clearing cache:**

- This is unrelated to cache clearing
- Check your config.js for syntax errors
- Look at the MagicMirror logs for specific error messages

### Safety

The script is designed to be safe:

- Only deletes cache and temporary files
- Never touches your configuration or module code
- Warns before proceeding if MagicMirror is running
- Uses safe deletion methods with error handling

### Integration with Bug Fixes

This script is particularly important after the June 2, 2025 multi-album caching bug fix. The old cache contains processed pools (36 images) instead of the full combined collection (4,930 images). Running this script ensures you get the benefits of the fix.
