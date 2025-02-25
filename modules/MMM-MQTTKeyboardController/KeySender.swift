import Cocoa

// Simple Swift application to send keyboard events
// Usage: ./KeySender [left|right]

func simulateKeyPress(keyCode: CGKeyCode) {
    let source = CGEventSource(stateID: .hidSystemState)
    
    // Create key down event
    let keyDown = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: true)
    keyDown?.post(tap: .cghidEventTap)
    
    // Small delay
    usleep(10000) // 10ms
    
    // Create key up event
    let keyUp = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: false)
    keyUp?.post(tap: .cghidEventTap)
}

// Main
if CommandLine.arguments.count > 1 {
    let key = CommandLine.arguments[1].lowercased()
    
    switch key {
    case "left":
        simulateKeyPress(keyCode: 123) // Left arrow key
    case "right":
        simulateKeyPress(keyCode: 124) // Right arrow key
    default:
        print("Unknown key: \(key)")
        print("Usage: ./KeySender [left|right]")
        exit(1)
    }
} else {
    print("No key specified")
    print("Usage: ./KeySender [left|right]")
    exit(1)
}
