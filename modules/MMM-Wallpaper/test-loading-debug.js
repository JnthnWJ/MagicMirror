/**
 * Debug test for loading indicator with multi-album processing
 * This simulates the loading process to see the debug output
 */

const path = require('path');

// Mock the MagicMirror environment
global.Log = {
  log: console.log,
  error: console.error,
  warn: console.warn
};

// Mock NodeHelper
const NodeHelper = {
  extend: function(obj) {
    return obj;
  },
  create: function(obj) {
    return obj;
  }
};

// Set up the module path
const modulePath = path.join(__dirname, '.');
process.chdir(modulePath);

// Mock require for node_helper
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  if (id === 'node_helper') {
    return NodeHelper;
  }
  return originalRequire.apply(this, arguments);
};

// Load the node helper
const nodeHelper = require('./node_helper.js');

// Create a test instance
const testHelper = Object.create(nodeHelper);

// Mock socket notification to see what's being sent
testHelper.sendSocketNotification = function(notification, payload) {
  console.log(`📡 [SOCKET] ${notification}:`, payload);
};

// Test configuration with multiple albums
const testConfig = {
  source: [
    "icloud:test_album_1",
    "icloud:test_album_2", 
    "icloud:test_album_3"
  ],
  debugAlbumCombining: true,
  debugPhotoSelection: true,
  maximumEntries: 200,
  orientation: "horizontal",
  albumProcessingDelay: 1000, // Shorter delay for testing
  photoChunkSize: 10,
  chunkProcessingDelay: 50,
  progressiveLoading: true
};

console.log('🧪 Testing Multi-Album Loading with Debug Output');
console.log('================================================');
console.log('Configuration:', testConfig);
console.log('');

// Mock the cache to force fresh loading
testHelper.getCacheEntry = function(config) {
  return {
    images: [],
    expires: 0
  };
};

// Mock the album processing to simulate real behavior
testHelper.requestMultiAlbum = function(config, params) {
  const albumIndex = config.albumIndex;
  const albumName = config.source;
  
  console.log(`🌐 [MOCK] Making request for album ${albumIndex + 1}: ${albumName}`);
  
  // Simulate async processing with setTimeout
  setTimeout(() => {
    // Simulate successful album processing
    const mockImages = [];
    const numImages = Math.floor(Math.random() * 50) + 10; // 10-60 images
    
    for (let i = 0; i < numImages; i++) {
      mockImages.push({
        url: `https://example.com/album${albumIndex + 1}/photo${i + 1}.jpg`,
        title: `Photo ${i + 1} from Album ${albumIndex + 1}`,
        caption: `Test photo ${i + 1}`
      });
    }
    
    console.log(`✅ [MOCK] Album ${albumIndex + 1} processed: ${mockImages.length} images`);
    
    // Call handleAlbumComplete
    this.handleAlbumComplete(albumIndex, mockImages);
  }, Math.random() * 2000 + 500); // Random delay 500-2500ms
};

// Start the test
console.log('🚀 Starting fetchMultipleiCloudAlbums...');
testHelper.fetchMultipleiCloudAlbums(testConfig);

// Keep the process alive to see the async results
setTimeout(() => {
  console.log('\n⏰ Test completed after 15 seconds');
  process.exit(0);
}, 15000);
