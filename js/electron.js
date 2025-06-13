"use strict";

const electron = require("electron");
const core = require("./app");
const Log = require("./logger");

// Config
let config = process.env.config ? JSON.parse(process.env.config) : {};
// Module to control application life.
const app = electron.app;

/*
 * By default, Electron is started with the --disable-gpu flag.
 * To enable GPU acceleration, set the environment variable ELECTRON_ENABLE_GPU=1 on startup.
 * For liquid glass effects, GPU acceleration is recommended for optimal performance.
 * Refer to https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering for more information.
 */
if (process.env.ELECTRON_ENABLE_GPU !== "1" && !config.enableGPUAcceleration) {
    app.disableHardwareAcceleration();
    Log.warn("GPU acceleration disabled. For better liquid glass effects, set ELECTRON_ENABLE_GPU=1 or enableGPUAcceleration: true in config.");
} else {
    Log.log("GPU acceleration enabled for enhanced visual effects.");
}

// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

/*
 * Keep a global reference of the window object.
 * If you don't, the window will be closed automatically when the JavaScript object is garbage collected.
 */
let mainWindow;

/**
 * Creates the main application window.
 */
function createWindow() {
    /*
     * Attempt to get the primary display's work area size.
     * If unsuccessful, fallback to default dimensions.
     */
    let workArea = { x: 0, y: 0, width: 1200, height: 800 }; // Default work area
    try {
        const primaryDisplay = electron.screen.getPrimaryDisplay();
        workArea = primaryDisplay.workArea;
    } catch {
        Log.warn("Could not retrieve display size. Using default dimensions.");
    }

    // Define Electron window options for borderless fullscreen without covering taskbar
    let electronOptionsDefaults = {
        width: workArea.width,
        height: workArea.height,
        x: workArea.x,
        y: workArea.y,
        darkTheme: true,
        show: false, // Initially hide to prevent flicker
        frame: false,  // Disable window frame for borderless window
        kiosk: false, // Disable kiosk mode
        fullscreen: false, // Disable true fullscreen
        resizable: false, // Prevent window resizing
        hasShadow: false, // No shadow for a cleaner look
        transparent: false, // No transparency
        backgroundColor: "#000000",
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            zoomFactor: config.zoom || 1,
            // Enhanced rendering options for liquid glass effects
            experimentalFeatures: true,
            enableBlinkFeatures: 'CSSBackdropFilter,CSSFilters',
            webSecurity: true,
            // Force hardware acceleration for better visual effects
            hardwareAcceleration: true,
            // Enable advanced graphics features
            offscreen: false
        }
    };

    // Merge user-specified electronOptions from config.js (if any)
    const userElectronOptions = config.electronOptions || {};
    const electronOptions = Object.assign({}, electronOptionsDefaults, userElectronOptions);

    /*
     * Handle kiosk mode settings.
     * If `kioskmode` is true, enforce kiosk settings.
     * Otherwise, ensure standard window behavior.
     */
    if (config.kioskmode) {
        electronOptions.kiosk = true;
        electronOptions.frame = false;
        electronOptions.transparent = true;
        electronOptions.hasShadow = false;
        electronOptions.fullscreen = true;
    } else {
        // Ensure standard window behavior
        electronOptions.kiosk = false;
        electronOptions.fullscreen = false;
        electronOptions.frame = false; // Borderless
        electronOptions.transparent = false;
        electronOptions.hasShadow = false;
        electronOptions.show = false; // Will show after setting size
    }

    // Create the browser window.
    mainWindow = new BrowserWindow(electronOptions);

    /*
     * Load the MagicMirror URL.
     * If `config.address` is not defined or is an empty string (listening on all interfaces),
     * default to "localhost".
     */
    let prefix = (config.tls || config.useHttps) ? "https://" : "http://";
    let address = (!config.address || config.address === "0.0.0.0") ? "localhost" : config.address;
    const port = process.env.MM_PORT || config.port;
    mainWindow.loadURL(`${prefix}${address}:${port}`);

    // Open DevTools if running in development mode
    if (process.argv.includes("dev")) {
        if (process.env.JEST_WORKER_ID !== undefined) {
            // If running with Jest (testing), set DevTools accordingly
            const devtools = new BrowserWindow(electronOptions);
            mainWindow.webContents.setDevToolsWebContents(devtools.webContents);
        }
        mainWindow.webContents.openDevTools();
    }

    // Simulate a mouse move to prevent cursor issues on start
    mainWindow.webContents.on("dom-ready", () => {
        mainWindow.webContents.sendInputEvent({ type: "mouseMove", x: 0, y: 0 });
    });

    // Handle window closed event
    mainWindow.on("closed", function () {
        mainWindow = null;
    });

    // Additional kiosk mode event handlers
    if (config.kioskmode) {
        mainWindow.on("blur", function () {
            mainWindow.focus();
        });

        mainWindow.on("leave-full-screen", function () {
            mainWindow.setFullScreen(true);
        });

        mainWindow.on("resize", function () {
            setTimeout(function () {
                mainWindow.reload();
            }, 1000);
        });
    }

    // Remove security headers if configured in config.js
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        let curHeaders = details.responseHeaders;
        if (config.ignoreXOriginHeader || false) {
            curHeaders = Object.fromEntries(
                Object.entries(curHeaders).filter(([key]) => !/x-frame-options/i.test(key))
            );
        }
        if (config.ignoreContentSecurityPolicy || false) {
            curHeaders = Object.fromEntries(
                Object.entries(curHeaders).filter(([key]) => !/content-security-policy/i.test(key))
            );
        }
        callback({ responseHeaders: curHeaders });
    });

    // Once the window is ready to show, set size and show it
    mainWindow.once("ready-to-show", () => {
        // No maximize, window is already set to workArea size
        mainWindow.show(); // Show the window
    });
}

// Quit the application when all windows are closed, except on macOS.
app.on("window-all-closed", function () {
    if (process.platform !== "darwin") {
        app.quit();
    } else {
        createWindow();
    }
});

app.on("activate", function () {
    /*
     * On macOS, it's common to re-create a window in the app when the dock icon is clicked
     * and there are no other windows open.
     */
    if (mainWindow === null) {
        createWindow();
    }
});

/*
 * This method will be called when SIGINT is received and will call
 * each node_helper's stop function if it exists. Added to fix #1056
 *
 * Note: this is only used if running Electron. Otherwise
 * core.stop() is called by process.on("SIGINT"... in `app.js`
 */
app.on("before-quit", async (event) => {
    Log.log("Shutting down server...");
    event.preventDefault();
    setTimeout(() => {
        process.exit(0);
    }, 3000); // Force-quit after 3 seconds.
    await core.stop();
    process.exit(0);
});

/**
 * Handle errors from self-signed certificates
 */
app.on("certificate-error", (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
});

if (process.env.clientonly) {
    app.whenReady().then(() => {
        Log.log("Launching client viewer application.");
        createWindow();
    });
}

/*
 * Start the core application if server is run on localhost
 * This starts all node helpers and starts the webserver.
 */
if (["localhost", "127.0.0.1", "::1", "::ffff:127.0.0.1", undefined].includes(config.address)) {
    core.start().then((c) => {
        config = c;
        app.whenReady().then(() => {
            Log.log("Launching application.");
            createWindow();
        });
    });
}