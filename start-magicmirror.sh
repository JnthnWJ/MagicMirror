#!/bin/bash

# MagicMirror Auto-Startup Script with Git Pull and GPU Acceleration
# This script automatically updates the repository and starts MagicMirror
# Designed for system startup via cron or systemd

# Configuration
MAGICMIRROR_DIR="/home/jonathanj/MagicMirror"
LOG_FILE="/home/jonathanj/MagicMirror/startup.log"
MAX_RETRIES=3
RETRY_DELAY=10

# Function to log messages with timestamp
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to check if MagicMirror is already running
is_magicmirror_running() {
    pgrep -f "electron.*js/electron.js" > /dev/null || pgrep -f "npm.*start" > /dev/null
}

# Function to kill existing MagicMirror processes
kill_existing_magicmirror() {
    log_message "Stopping any existing MagicMirror processes..."
    pkill -f "MagicMirror\|electron" 2>/dev/null
    sleep 2
}

# Function to setup environment
setup_environment() {
    log_message "Setting up environment..."
    
    # Ensure we're in the correct directory
    if [ ! -d "$MAGICMIRROR_DIR" ]; then
        log_message "ERROR: MagicMirror directory not found: $MAGICMIRROR_DIR"
        exit 1
    fi
    
    cd "$MAGICMIRROR_DIR" || {
        log_message "ERROR: Failed to change to MagicMirror directory"
        exit 1
    }
    
    # Set up Node.js environment (NVM)
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
    
    # Set display for GUI applications
    export DISPLAY="${DISPLAY:=:0}"
    
    # Set environment variables for GPU acceleration
    export ELECTRON_ENABLE_GPU=1
    export ELECTRON_EXTRA_ARGS="--enable-gpu-rasterization --enable-zero-copy --enable-features=VaapiVideoDecoder --disable-features=VizDisplayCompositor"
    
    log_message "Environment setup complete"
    log_message "Node version: $(node --version 2>/dev/null || echo 'Not found')"
    log_message "NPM version: $(npm --version 2>/dev/null || echo 'Not found')"
}

# Function to update repository
update_repository() {
    log_message "Updating MagicMirror repository..."
    
    # Check if we're in a git repository
    if [ ! -d ".git" ]; then
        log_message "WARNING: Not a git repository, skipping git pull"
        return 0
    fi
    
    # Fetch latest changes
    log_message "Fetching latest changes from remote repository..."
    if ! git fetch origin 2>&1 | tee -a "$LOG_FILE"; then
        log_message "WARNING: Git fetch failed, continuing with current version"
        return 0
    fi
    
    # Check if there are updates available
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/$(git branch --show-current))
    
    if [ "$LOCAL" = "$REMOTE" ]; then
        log_message "Repository is already up to date"
        return 0
    fi
    
    log_message "Updates available, pulling changes..."
    if git pull origin $(git branch --show-current) 2>&1 | tee -a "$LOG_FILE"; then
        log_message "Repository updated successfully"
        
        # Check if package.json was updated and run npm install if needed
        if git diff --name-only HEAD@{1} HEAD | grep -q "package.json\|package-lock.json"; then
            log_message "Package files updated, running npm install..."
            if npm install 2>&1 | tee -a "$LOG_FILE"; then
                log_message "Dependencies updated successfully"
            else
                log_message "WARNING: npm install failed, continuing anyway"
            fi
        fi
    else
        log_message "WARNING: Git pull failed, continuing with current version"
        return 0
    fi
}

# Function to start MagicMirror
start_magicmirror() {
    log_message "Starting MagicMirror with GPU acceleration..."
    log_message "This will provide the best visual quality for liquid glass effects."
    
    # Start MagicMirror
    npm run start 2>&1 | tee -a "$LOG_FILE" &
    MAGICMIRROR_PID=$!
    
    log_message "MagicMirror started with PID: $MAGICMIRROR_PID"
    log_message "GPU acceleration enabled for enhanced visual effects"
    
    return 0
}

# Main execution
main() {
    log_message "=========================================="
    log_message "MagicMirror Auto-Startup Script Starting"
    log_message "=========================================="
    
    # Check if already running
    if is_magicmirror_running; then
        log_message "MagicMirror is already running, stopping existing instance..."
        kill_existing_magicmirror
    fi
    
    # Setup environment
    setup_environment
    
    # Update repository with retries
    for i in $(seq 1 $MAX_RETRIES); do
        log_message "Update attempt $i of $MAX_RETRIES"
        if update_repository; then
            break
        elif [ $i -eq $MAX_RETRIES ]; then
            log_message "All update attempts failed, starting with current version"
        else
            log_message "Update failed, retrying in $RETRY_DELAY seconds..."
            sleep $RETRY_DELAY
        fi
    done
    
    # Start MagicMirror
    start_magicmirror
    
    log_message "Startup script completed"
}

# Run main function
main "$@"
