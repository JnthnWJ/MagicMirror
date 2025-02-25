/* Magic Mirror
 * Node Helper: MMM-MQTTKeyboardController
 *
 * By Jonathan Jensen
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const mqtt = require("mqtt");
const { exec } = require("child_process");
const os = require("os");

module.exports = NodeHelper.create({
    start: function() {
        this.mqttClient = null;
        console.log("Starting node helper for: " + this.name);
    },

    // Initialize the module
    socketNotificationReceived: function(notification, payload) {
        if (notification === "INIT") {
            this.config = payload;
            this.initMQTT();
        }
    },

    // Initialize MQTT connection
    initMQTT: function() {
        const self = this;

        // Connect to MQTT server
        const mqttServer = `mqtt://${this.config.mqttServer}:${this.config.mqttPort}`;
        
        try {
            this.mqttClient = mqtt.connect(mqttServer);
            
            this.mqttClient.on("connect", () => {
                console.log(`${this.name}: Connected to MQTT server ${mqttServer}`);
                this.sendSocketNotification("MQTT_CONNECTED", {});
                
                // Subscribe to topics
                this.mqttClient.subscribe(this.config.previousTopic);
                this.mqttClient.subscribe(this.config.nextTopic);
                
                console.log(`${this.name}: Subscribed to ${this.config.previousTopic} and ${this.config.nextTopic}`);
            });
            
            this.mqttClient.on("error", (error) => {
                console.error(`${this.name}: MQTT Error: ${error}`);
                this.sendSocketNotification("ERROR", { message: `MQTT Error: ${error}` });
            });
            
            this.mqttClient.on("message", (topic, message) => {
                this.debug(`Received message on topic ${topic}: ${message.toString()}`);
                
                if (topic === this.config.previousTopic) {
                    this.simulateKeyPress("left");
                } else if (topic === this.config.nextTopic) {
                    this.simulateKeyPress("right");
                }
            });
            
        } catch (error) {
            console.error(`${this.name}: Failed to connect to MQTT: ${error}`);
            this.sendSocketNotification("ERROR", { message: `Failed to connect to MQTT: ${error}` });
        }
    },
    
    // Simulate a keyboard key press using platform-specific commands
    simulateKeyPress: function(key) {
        try {
            const platform = os.platform();
            let command = '';
            const path = require('path');
            
            if (platform === 'darwin') {
                // macOS - use our custom KeySender executable
                const keySenderPath = path.join(__dirname, 'KeySender');
                command = `"${keySenderPath}" ${key}`;
                
                // Check if KeySender exists
                const fs = require('fs');
                if (!fs.existsSync(keySenderPath)) {
                    console.error(`${this.name}: KeySender executable not found at ${keySenderPath}`);
                    console.error(`${this.name}: Please run the compile_keysender.sh script to create it`);
                    this.sendSocketNotification("ERROR", { 
                        message: `KeySender executable not found. Please run the compile_keysender.sh script.` 
                    });
                    return;
                }
            } else if (platform === 'win32') {
                // Windows - use PowerShell and SendKeys
                if (key === 'left') {
                    command = 'powershell -command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys(\'{LEFT}\')"';
                } else if (key === 'right') {
                    command = 'powershell -command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys(\'{RIGHT}\')"';
                }
            } else {
                // Linux - use xdotool
                if (key === 'left') {
                    command = 'xdotool key Left';
                } else if (key === 'right') {
                    command = 'xdotool key Right';
                }
            }
            
            if (command) {
                exec(command, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`${this.name}: Error executing command: ${error}`);
                        this.sendSocketNotification("ERROR", { message: `Error executing command: ${error}` });
                        return;
                    }
                    this.debug(`Simulated key press: ${key} using command: ${command}`);
                    this.sendSocketNotification("KEY_PRESSED", { key: key });
                });
            } else {
                this.sendSocketNotification("ERROR", { 
                    message: `Unsupported platform: ${platform} or key: ${key}` 
                });
            }
        } catch (error) {
            console.error(`${this.name}: Error simulating key press: ${error}`);
            this.sendSocketNotification("ERROR", { message: `Error simulating key press: ${error}` });
        }
    },
    
    // Debug logging
    debug: function(message) {
        if (this.config.debug) {
            console.log(`${this.name} DEBUG: ${message}`);
            this.sendSocketNotification("DEBUG", { message: message });
        }
    },
    
    // Clean up on module stop
    stop: function() {
        if (this.mqttClient) {
            this.mqttClient.end();
            this.mqttClient = null;
            console.log(`${this.name}: MQTT client disconnected`);
        }
    }
});
