#!/bin/bash
# Shell script to test the MMM-MQTTKeyboardController module
# This script requires mosquitto_pub to be installed

# Default values
MQTT_SERVER="192.168.0.193"
MQTT_PORT="1883"
ACTION="next"  # "next" or "previous"

# Function to display usage
usage() {
    echo "Usage: $0 [options]"
    echo "Options:"
    echo "  -s, --server SERVER   MQTT server address (default: $MQTT_SERVER)"
    echo "  -p, --port PORT       MQTT server port (default: $MQTT_PORT)"
    echo "  -a, --action ACTION   Action to perform: 'next' or 'previous' (default: $ACTION)"
    echo "  -h, --help            Display this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --action next                         # Send next image command"
    echo "  $0 --action previous                     # Send previous image command"
    echo "  $0 --server 192.168.1.100 --port 1883 --action next"
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -s|--server)
            MQTT_SERVER="$2"
            shift 2
            ;;
        -p|--port)
            MQTT_PORT="$2"
            shift 2
            ;;
        -a|--action)
            ACTION="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Check if mosquitto_pub is installed
if ! command -v mosquitto_pub &> /dev/null; then
    echo "Error: mosquitto_pub command not found."
    echo "Please install the Mosquitto clients package:"
    echo "  - On Debian/Ubuntu: sudo apt-get install mosquitto-clients"
    echo "  - On macOS with Homebrew: brew install mosquitto"
    echo "  - On Fedora: sudo dnf install mosquitto"
    exit 1
fi

# Define the topic based on the action
if [ "$ACTION" = "next" ]; then
    TOPIC="local/wallpaper/next"
elif [ "$ACTION" = "previous" ]; then
    TOPIC="local/wallpaper/previous"
else
    echo "Error: Invalid action '$ACTION'. Must be 'next' or 'previous'."
    usage
fi

# Publish the MQTT message
echo "Connecting to MQTT server $MQTT_SERVER:$MQTT_PORT..."
echo "Publishing message to topic: $TOPIC"

mosquitto_pub -h "$MQTT_SERVER" -p "$MQTT_PORT" -t "$TOPIC" -m ""

if [ $? -eq 0 ]; then
    echo "Message sent successfully!"
    echo "If the MagicMirror is running, you should see the wallpaper change."
else
    echo "Error: Failed to send MQTT message."
fi
