/* Magic Mirror
 * Module: MMM-MQTTKeyboardController
 *
 * By Jonathan Jensen
 * MIT Licensed.
 */

Module.register("MMM-MQTTKeyboardController", {
    defaults: {
        mqttServer: "192.168.0.193",
        mqttPort: 1883,
        previousTopic: "local/wallpaper/previous",
        nextTopic: "local/wallpaper/next",
        debug: false
    },

    start: function() {
        Log.info("Starting module: " + this.name);
        this.loaded = false;
        this.sendSocketNotification("INIT", this.config);
    },

    // Override socket notification handler.
    socketNotificationReceived: function(notification, payload) {
        if (notification === "MQTT_CONNECTED") {
            this.loaded = true;
            Log.info(this.name + ": MQTT Connected");
        } else if (notification === "KEY_PRESSED") {
            Log.info(this.name + ": Key pressed: " + payload.key);
        } else if (notification === "ERROR") {
            Log.error(this.name + ": " + payload.message);
        } else if (notification === "DEBUG") {
            if (this.config.debug) {
                Log.info(this.name + " DEBUG: " + payload.message);
            }
        }
    },

    // Override dom generator.
    getDom: function() {
        var wrapper = document.createElement("div");
        
        if (!this.loaded) {
            wrapper.innerHTML = "Connecting to MQTT...";
            wrapper.className = "dimmed light small";
            return wrapper;
        }

        // This module doesn't display anything when loaded
        wrapper.style.display = "none";
        return wrapper;
    }
});
