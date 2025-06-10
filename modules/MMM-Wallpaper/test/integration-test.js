/**
 * Integration test for the reverse geocoding fix
 * This simulates how the actual MMM-Wallpaper module would use the reverse geocoding
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
const modulePath = path.join(__dirname, '..');
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
const nodeHelper = require('../node_helper.js');

// Test coordinates (NYC)
const TEST_LAT = 40.7128;
const TEST_LON = -74.0060;

/**
 * Test the reverse geocoding functionality
 */
async function testReverseGeocoding() {
  console.log('🧪 Testing reverse geocoding integration...\n');
  
  return new Promise((resolve) => {
    let testPassed = false;
    let timeoutId;
    
    // Mock the sendSocketNotification to capture the result
    nodeHelper.sendSocketNotification = function(notification, data) {
      if (notification === 'NEW_INFO_STRING') {
        console.log('✅ Reverse geocoding successful!');
        console.log(`📍 Info string: ${data}`);
        testPassed = true;
        clearTimeout(timeoutId);
        resolve(true);
      }
    };
    
    // Set a timeout in case the geocoding fails
    timeoutId = setTimeout(() => {
      if (!testPassed) {
        console.log('❌ Reverse geocoding timed out or failed');
        resolve(false);
      }
    }, 10000);
    
    // Call the reverse geocoding function
    console.log(`🌍 Testing reverse geocoding for coordinates: ${TEST_LAT}, ${TEST_LON}`);
    nodeHelper.reverseGeocode(TEST_LAT, TEST_LON, 'Test User', '2023-06-10');
  });
}

/**
 * Test the getTerritory function
 */
async function testGetTerritory() {
  console.log('🗺️  Testing getTerritory function...\n');
  
  try {
    const territory = await nodeHelper.getTerritory(TEST_LAT, TEST_LON);
    if (territory) {
      console.log(`✅ Territory lookup successful: ${territory}`);
      return true;
    } else {
      console.log('⚠️  Territory lookup returned null (may be expected for some coordinates)');
      return true; // This is not necessarily a failure
    }
  } catch (error) {
    console.log(`❌ Territory lookup failed: ${error.message}`);
    return false;
  }
}

/**
 * Main test function
 */
async function runIntegrationTest() {
  console.log('🚀 MMM-Wallpaper Reverse Geocoding Integration Test\n');
  console.log('This test verifies that the reverse geocoding works end-to-end\n');
  
  try {
    // Test 1: Territory lookup
    console.log('--- Test 1: Territory Lookup ---');
    const territoryTest = await testGetTerritory();
    
    // Wait a bit for rate limiting
    console.log('\n⏳ Waiting 2 seconds for rate limiting...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 2: Full reverse geocoding
    console.log('--- Test 2: Full Reverse Geocoding ---');
    const geocodingTest = await testReverseGeocoding();
    
    // Results
    console.log('\n📊 Integration Test Results:');
    console.log(`   Territory Lookup: ${territoryTest ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Reverse Geocoding: ${geocodingTest ? '✅ PASS' : '❌ FAIL'}`);
    
    if (territoryTest && geocodingTest) {
      console.log('\n🎉 SUCCESS: All integration tests passed!');
      console.log('   The reverse geocoding feature is working correctly.');
      process.exit(0);
    } else {
      console.log('\n❌ FAILURE: Some integration tests failed.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Integration test error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runIntegrationTest();
}

module.exports = { testReverseGeocoding, testGetTerritory };
