# PowerShell script to test the MMM-MQTTKeyboardController module
# This script requires the MQTT-Client PowerShell module

param (
    [string]$MqttServer = "192.168.0.193",
    [int]$MqttPort = 1883,
    [string]$Action = "next"  # "next" or "previous"
)

# Check if MQTT-Client module is installed
if (-not (Get-Module -ListAvailable -Name MQTT-Client)) {
    Write-Host "MQTT-Client module not found. Installing..."
    Install-Module -Name MQTT-Client -Force -Scope CurrentUser
}

# Import the module
Import-Module MQTT-Client

# Define the topic based on the action
$topic = if ($Action -eq "next") { "local/wallpaper/next" } else { "local/wallpaper/previous" }

# Connect to MQTT server
try {
    Write-Host "Connecting to MQTT server $MqttServer:$MqttPort..."
    $client = Connect-MQTT -Server $MqttServer -Port $MqttPort -ClientId "PowerShellTest$(Get-Random)"
    
    # Publish message
    Write-Host "Publishing message to topic: $topic"
    Publish-MQTTMessage -Client $client -Topic $topic -Message ""
    
    # Disconnect
    Disconnect-MQTT -Client $client
    
    Write-Host "Message sent successfully!"
    Write-Host "If the MagicMirror is running, you should see the wallpaper change."
} catch {
    Write-Host "Error: $_"
}

Write-Host "`nUsage examples:"
Write-Host "  .\test_mqtt_control.ps1 -Action next     # Send next image command"
Write-Host "  .\test_mqtt_control.ps1 -Action previous # Send previous image command"
Write-Host "  .\test_mqtt_control.ps1 -MqttServer 192.168.1.100 -MqttPort 1883 -Action next"
