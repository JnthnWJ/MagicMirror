# MagicMirror Auto-Start Setup

This guide will help you set up MagicMirror to automatically start when your system boots, with automatic git pull to keep it updated.

## 🚀 Quick Setup

Run the interactive setup script:

```bash
cd /home/jonathanj/MagicMirror
./setup-autostart.sh
```

## 📋 What's Included

### 1. `start-magicmirror.sh`

- Main startup script that handles the entire process
- Automatically runs `git pull` to get latest changes
- Waits for git pull to complete before starting
- Sets up proper environment (Node.js, display, GPU acceleration)
- Includes error handling and logging
- Retries failed operations

### 2. `magicmirror.service`

- Systemd service file for proper system integration
- Handles dependencies and restart policies
- Runs as user service to access display properly
- Includes security settings

### 3. `setup-autostart.sh`

- Interactive setup script
- Offers both systemd and cron options
- Tests configuration
- Shows current status

## 🎯 Setup Methods

### Method 1: Systemd Service (Recommended)

**Advantages:**

- Better integration with system
- Automatic restart on failure
- Proper dependency management
- Easy to manage with systemctl commands

**Setup:**

```bash
./setup-autostart.sh
# Choose option 1
```

**Manual setup:**

```bash
# Copy service file
mkdir -p ~/.config/systemd/user
cp magicmirror.service ~/.config/systemd/user/

# Enable service
systemctl --user daemon-reload
systemctl --user enable magicmirror.service

# Enable user services at boot
sudo loginctl enable-linger jonathanj
```

**Management commands:**

```bash
# Start service
systemctl --user start magicmirror

# Stop service
systemctl --user stop magicmirror

# Check status
systemctl --user status magicmirror

# View logs
journalctl --user -u magicmirror -f

# Disable auto-start
systemctl --user disable magicmirror
```

### Method 2: Cron Job (Alternative)

**Advantages:**

- Simple setup
- Works on all systems
- Easy to understand

**Setup:**

```bash
./setup-autostart.sh
# Choose option 2
```

**Manual setup:**

```bash
# Add to crontab
crontab -e
# Add this line:
@reboot sleep 30 && /home/jonathanj/MagicMirror/start-magicmirror.sh
```

**Management:**

```bash
# View cron jobs
crontab -l

# Edit cron jobs
crontab -e

# Remove (edit and delete the line)
crontab -e
```

## 📊 Features

### Automatic Updates

- Runs `git fetch` and `git pull` before starting
- Checks if updates are available
- Automatically runs `npm install` if package.json changes
- Continues with current version if git operations fail

### Error Handling

- Retries failed operations (configurable)
- Comprehensive logging with timestamps
- Graceful fallbacks for network issues
- Stops existing instances before starting

### Environment Setup

- Loads Node.js environment (NVM)
- Sets proper display variables
- Configures GPU acceleration
- Sets up all required paths

### Logging

- All operations logged to `startup.log`
- Systemd logs available via journalctl
- Timestamps on all log entries
- Separate logs for different components

## 🔧 Configuration

### Customizing the Startup Script

Edit `start-magicmirror.sh` to modify:

```bash
# Configuration section at top of file
MAGICMIRROR_DIR="/home/jonathanj/MagicMirror"  # Change path if needed
LOG_FILE="/home/jonathanj/MagicMirror/startup.log"  # Log location
MAX_RETRIES=3  # Number of retry attempts
RETRY_DELAY=10  # Seconds between retries
```

### Customizing the Service

Edit `magicmirror.service` to modify:

- User/Group settings
- Environment variables
- Restart policies
- Security settings

## 🐛 Troubleshooting

### Check if MagicMirror is running

```bash
ps aux | grep -E "(electron|MagicMirror)"
```

### View startup logs

```bash
tail -f /home/jonathanj/MagicMirror/startup.log
```

### Test startup script manually

```bash
cd /home/jonathanj/MagicMirror
./start-magicmirror.sh
```

### Check systemd service status

```bash
systemctl --user status magicmirror
journalctl --user -u magicmirror --no-pager
```

### Check cron job

```bash
crontab -l
grep CRON /var/log/syslog
```

### Common Issues

1. **Display not available**: Make sure DISPLAY=:0 is set and X11 is running
2. **Node.js not found**: Check NVM installation and paths
3. **Git pull fails**: Check network connection and repository access
4. **Permission issues**: Ensure all scripts are executable and owned by correct user

## 🔄 Updating

The system automatically updates MagicMirror on each startup. To update the startup scripts themselves:

1. Pull latest changes: `git pull`
2. Re-run setup if needed: `./setup-autostart.sh`

## 🛑 Removing Auto-Start

### Remove systemd service:

```bash
systemctl --user stop magicmirror
systemctl --user disable magicmirror
rm ~/.config/systemd/user/magicmirror.service
systemctl --user daemon-reload
```

### Remove cron job:

```bash
crontab -e
# Delete the line containing start-magicmirror.sh
```

## 📞 Support

If you encounter issues:

1. Check the logs first
2. Test the startup script manually
3. Verify your Node.js and npm installation
4. Ensure git repository is properly configured
