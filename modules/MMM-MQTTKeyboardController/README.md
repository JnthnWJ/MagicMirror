# MMM-MQTTKeyboardController

This is a module for the [MagicMirror²](https://github.com/MichMich/MagicMirror/) that allows you to control keyboard actions via MQTT messages. It simulates actual keyboard key presses at the system level, making it compatible with any module that listens for keyboard events.

## Features

- Subscribes to MQTT topics for keyboard control
- Simulates actual keyboard key presses using platform-specific commands:
  - macOS: Uses a custom Swift executable (KeySender)
  - Windows: Uses PowerShell and SendKeys
  - Linux: Uses xdotool (must be installed)
- Works across Windows, Mac, and Linux
- Designed to work with the MMM-Wallpaper module for image navigation
- Can be extended to support additional keyboard actions

## Installation

1. Navigate to your MagicMirror's modules folder:
```bash
cd ~/MagicMirror/modules/
```

2. Clone this repository:
```bash
git clone https://github.com/yourusername/MMM-MQTTKeyboardController.git
```

3. Install the dependencies:
```bash
cd MMM-MQTTKeyboardController
npm install
```

4. Platform-specific setup:

   **For macOS:**
   - Compile the KeySender executable:
     ```bash
     ./compile_keysender.sh
     ```
   - Grant Accessibility permissions to the KeySender executable:
     1. Go to System Preferences > Security & Privacy > Privacy > Accessibility
     2. Click the lock icon to make changes
     3. Click the + button and add the KeySender executable (located in the MMM-MQTTKeyboardController directory)
     4. Make sure the checkbox next to KeySender is checked

   **For Linux:**
   - Install xdotool:
     ```bash
     # Debian/Ubuntu
     sudo apt-get install xdotool

     # Fedora
     sudo dnf install xdotool

     # Arch Linux
     sudo pacman -S xdotool
     ```

   **For Windows:**
   - No additional setup required

## Configuration

Add the module to the `modules` array in the `config/config.js` file:

```javascript
modules: [
    {
        module: 'MMM-MQTTKeyboardController',
        config: {
            mqttServer: "192.168.0.193", // MQTT broker address
            mqttPort: 1883,              // MQTT broker port
            previousTopic: "local/wallpaper/previous", // Topic for previous image
            nextTopic: "local/wallpaper/next",         // Topic for next image
            debug: false                 // Enable debug logging
        }
    }
]
```

## Usage

Once the module is installed and configured, it will automatically connect to the specified MQTT broker and subscribe to the configured topics.

### Testing the Module

The module includes test scripts to help you verify that it's working correctly:

**For macOS/Linux:**
```bash
# Navigate to the next image
./test_mqtt_control.sh --action next

# Navigate to the previous image
./test_mqtt_control.sh --action previous

# For more options
./test_mqtt_control.sh --help
```

**For Windows:**
```powershell
# Navigate to the next image
.\test_mqtt_control.ps1 -Action next

# Navigate to the previous image
.\test_mqtt_control.ps1 -Action previous
```

### Manual MQTT Commands

You can also publish MQTT messages manually using mosquitto_pub:

```bash
# Navigate to the previous image
mosquitto_pub -h 192.168.0.193 -p 1883 -t local/wallpaper/previous -m ""

# Navigate to the next image
mosquitto_pub -h 192.168.0.193 -p 1883 -t local/wallpaper/next -m ""
```

## Compatibility

This module is designed to work with any MagicMirror module that listens for keyboard events. It has been specifically tested with the MMM-Wallpaper module for image navigation.

## Dependencies

- [mqtt](https://github.com/mqttjs/MQTT.js) - For MQTT communication
- Platform-specific dependencies:
  - macOS: Swift compiler (included with Xcode or Command Line Tools)
  - Windows: PowerShell (built-in)
  - Linux: xdotool (must be installed separately)

## License

MIT
