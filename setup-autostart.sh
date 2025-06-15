#!/bin/bash

# MagicMirror Auto-Start Setup Script
# This script sets up automatic startup for MagicMirror using either systemd or cron

MAGICMIRROR_DIR="/home/jonathanj/MagicMirror"
SERVICE_FILE="magicmirror.service"
STARTUP_SCRIPT="start-magicmirror.sh"

echo "🚀 MagicMirror Auto-Start Setup"
echo "================================"

# Function to check if running as correct user
check_user() {
    if [ "$(whoami)" != "jonathanj" ]; then
        echo "❌ This script must be run as user 'jonathanj'"
        echo "   Please run: su - jonathanj"
        exit 1
    fi
}

# Function to setup systemd service (recommended)
setup_systemd() {
    echo "📋 Setting up systemd service..."
    
    # Create user systemd directory if it doesn't exist
    mkdir -p ~/.config/systemd/user
    
    # Copy service file to user systemd directory
    cp "$MAGICMIRROR_DIR/$SERVICE_FILE" ~/.config/systemd/user/
    
    # Reload systemd user daemon
    systemctl --user daemon-reload
    
    # Enable the service
    systemctl --user enable magicmirror.service
    
    # Enable lingering for user (allows user services to start at boot)
    sudo loginctl enable-linger jonathanj
    
    echo "✅ Systemd service setup complete!"
    echo "   Service will start automatically on boot"
    echo ""
    echo "   Useful commands:"
    echo "   - Start:   systemctl --user start magicmirror"
    echo "   - Stop:    systemctl --user stop magicmirror"
    echo "   - Status:  systemctl --user status magicmirror"
    echo "   - Logs:    journalctl --user -u magicmirror -f"
    echo "   - Disable: systemctl --user disable magicmirror"
}

# Function to setup cron job (alternative method)
setup_cron() {
    echo "📋 Setting up cron job..."
    
    # Create cron entry
    CRON_ENTRY="@reboot sleep 30 && $MAGICMIRROR_DIR/$STARTUP_SCRIPT"
    
    # Add to crontab if not already present
    (crontab -l 2>/dev/null | grep -v "$STARTUP_SCRIPT"; echo "$CRON_ENTRY") | crontab -
    
    echo "✅ Cron job setup complete!"
    echo "   MagicMirror will start 30 seconds after boot"
    echo ""
    echo "   Useful commands:"
    echo "   - View cron jobs: crontab -l"
    echo "   - Edit cron jobs: crontab -e"
    echo "   - Remove cron job: crontab -e (then delete the line)"
}

# Function to test the startup script
test_startup_script() {
    echo "🧪 Testing startup script..."
    
    if [ ! -f "$MAGICMIRROR_DIR/$STARTUP_SCRIPT" ]; then
        echo "❌ Startup script not found: $MAGICMIRROR_DIR/$STARTUP_SCRIPT"
        return 1
    fi
    
    if [ ! -x "$MAGICMIRROR_DIR/$STARTUP_SCRIPT" ]; then
        echo "❌ Startup script is not executable"
        echo "   Run: chmod +x $MAGICMIRROR_DIR/$STARTUP_SCRIPT"
        return 1
    fi
    
    echo "✅ Startup script is ready"
    return 0
}

# Function to show current status
show_status() {
    echo "📊 Current Status"
    echo "=================="
    
    # Check if MagicMirror is running
    if pgrep -f "electron.*js/electron.js" > /dev/null || pgrep -f "npm.*start" > /dev/null; then
        echo "🟢 MagicMirror is currently running"
    else
        echo "🔴 MagicMirror is not running"
    fi
    
    # Check systemd service status
    if systemctl --user is-enabled magicmirror.service >/dev/null 2>&1; then
        echo "🟢 Systemd service is enabled"
        echo "   Status: $(systemctl --user is-active magicmirror.service)"
    else
        echo "🔴 Systemd service is not enabled"
    fi
    
    # Check cron job
    if crontab -l 2>/dev/null | grep -q "$STARTUP_SCRIPT"; then
        echo "🟢 Cron job is configured"
    else
        echo "🔴 Cron job is not configured"
    fi
    
    echo ""
}

# Main menu
main_menu() {
    while true; do
        echo ""
        echo "🎯 Choose setup method:"
        echo "1) Systemd service (recommended)"
        echo "2) Cron job (alternative)"
        echo "3) Test startup script"
        echo "4) Show status"
        echo "5) Exit"
        echo ""
        read -p "Enter your choice (1-5): " choice
        
        case $choice in
            1)
                if test_startup_script; then
                    setup_systemd
                fi
                ;;
            2)
                if test_startup_script; then
                    setup_cron
                fi
                ;;
            3)
                test_startup_script
                ;;
            4)
                show_status
                ;;
            5)
                echo "👋 Goodbye!"
                exit 0
                ;;
            *)
                echo "❌ Invalid choice. Please enter 1-5."
                ;;
        esac
    done
}

# Main execution
main() {
    check_user
    
    echo "📁 Working directory: $MAGICMIRROR_DIR"
    echo "📄 Startup script: $STARTUP_SCRIPT"
    echo "📄 Service file: $SERVICE_FILE"
    echo ""
    
    show_status
    main_menu
}

# Run main function
main "$@"
