/**
 * Test for the loading indicator functionality
 * This simulates the loading indicator behavior during multi-album batch processing
 * and verifies that loading indicators only appear during first initialization
 */

const path = require('path');

// Mock the DOM environment
global.document = {
  createElement: function(tagName) {
    return {
      tagName: tagName.toUpperCase(),
      className: '',
      style: {},
      textContent: '',
      innerHTML: '',
      appendChild: function(child) {
        this.children = this.children || [];
        this.children.push(child);
      },
      removeChild: function(child) {
        this.children = this.children || [];
        const index = this.children.indexOf(child);
        if (index > -1) {
          this.children.splice(index, 1);
        }
      },
      addEventListener: function() {}
    };
  },
  documentElement: {
    clientWidth: 1920,
    clientHeight: 1080
  },
  body: {
    clientWidth: 1920,
    clientHeight: 1080
  },
  addEventListener: function() {}
};

global.window = {
  innerWidth: 1920,
  innerHeight: 1080
};

// Keep console.log for test output
const originalConsoleLog = console.log;

// Mock MagicMirror Log
global.Log = {
  log: function() {},
  info: function() {},
  warn: function() {},
  error: function() {}
};

// Mock MagicMirror Module
let moduleDefinition = null;
global.Module = {
  register: function(name, definition) {
    moduleDefinition = definition;
    return definition;
  }
};

// Set up the module path
const modulePath = path.join(__dirname, '..');
process.chdir(modulePath);

// Load the main module
require('../MMM-Wallpaper.js');
const MMM_Wallpaper = moduleDefinition;

/**
 * Test the loading indicator functionality
 */
function testLoadingIndicator() {
  console.log('🧪 Testing Loading Indicator Functionality');
  console.log('==========================================');

  // Create a module instance with test config
  const module = Object.create(MMM_Wallpaper);
  module.config = {
    source: [
      "icloud:album1",
      "icloud:album2",
      "icloud:album3"
    ],
    debugPhotoSelection: true,
    maximumEntries: 200,
    orientation: "auto",
    fillRegion: true
  };

  // Mock required methods
  module.sendSocketNotification = function(notification, payload) {
    // Mock implementation
  };
  module.getOrientation = function() {
    return this.config.orientation === "auto" ? "horizontal" : this.config.orientation;
  };
  module.updateDom = function() {
    // Mock implementation
  };

  // Initialize the module
  console.log('📋 Initializing module...');
  module.start();

  // Test 1: Check if loading indicator elements are created
  console.log('\n🔍 Test 1: Loading indicator creation');
  if (module.loadingContainer && module.loadingSpinner && module.loadingText && module.loadingProgress) {
    console.log('✅ Loading indicator elements created successfully');
  } else {
    console.log('❌ Loading indicator elements not created properly');
    return false;
  }

  // Test 2: Test showing loading indicator
  console.log('\n🔍 Test 2: Show loading indicator');
  module.showLoadingIndicator("Loading photos from 3 albums...");
  if (module.isLoading && module.loadingContainer.style.display === 'flex') {
    console.log('✅ Loading indicator shown successfully');
  } else {
    console.log('❌ Loading indicator not shown properly');
    return false;
  }

  // Test 3: Test progress updates
  console.log('\n🔍 Test 3: Progress updates');
  module.updateLoadingProgress("Processing album 1 of 3...", 33);
  if (module.loadingText.textContent.includes('Processing album 1') && 
      module.loadingProgress.textContent === '33%') {
    console.log('✅ Progress updates working correctly');
  } else {
    console.log('❌ Progress updates not working properly');
    return false;
  }

  // Test 4: Test hiding loading indicator
  console.log('\n🔍 Test 4: Hide loading indicator');
  module.hideLoadingIndicator();
  if (!module.isLoading && module.loadingContainer.style.display === 'none') {
    console.log('✅ Loading indicator hidden successfully');
  } else {
    console.log('❌ Loading indicator not hidden properly');
    return false;
  }

  // Test 5: Test socket notification handling
  console.log('\n🔍 Test 5: Socket notification handling');
  
  // Simulate loading started notification
  module.socketNotificationReceived("LOADING_STARTED", {
    message: "Loading photos from albums..."
  });
  
  if (module.isLoading) {
    console.log('✅ LOADING_STARTED notification handled correctly');
  } else {
    console.log('❌ LOADING_STARTED notification not handled properly');
    return false;
  }

  // Simulate progress notification
  module.socketNotificationReceived("LOADING_PROGRESS", {
    message: "Processing album 2 of 3...",
    progress: 66
  });
  
  if (module.loadingText.textContent.includes('Processing album 2') && 
      module.loadingProgress.textContent === '66%') {
    console.log('✅ LOADING_PROGRESS notification handled correctly');
  } else {
    console.log('❌ LOADING_PROGRESS notification not handled properly');
    return false;
  }

  // Simulate completion notification
  module.socketNotificationReceived("LOADING_COMPLETE", {
    message: "Loaded 150 photos from 3 albums"
  });
  
  if (!module.isLoading) {
    console.log('✅ LOADING_COMPLETE notification handled correctly');
  } else {
    console.log('❌ LOADING_COMPLETE notification not handled properly');
    return false;
  }

  console.log('\n🎉 All loading indicator tests passed!');
  return true;
}

/**
 * Test the integration with getData method
 */
function testGetDataIntegration() {
  console.log('\n🧪 Testing getData Integration');
  console.log('==============================');

  const module = Object.create(MMM_Wallpaper);
  module.config = {
    source: [
      "icloud:album1",
      "icloud:album2"
    ],
    debugPhotoSelection: true,
    orientation: "auto"
  };

  // Mock required methods
  let notificationSent = false;
  module.sendSocketNotification = function(notification, payload) {
    if (notification === "FETCH_WALLPAPERS") {
      notificationSent = true;
    }
  };
  module.getOrientation = function() {
    return this.config.orientation === "auto" ? "horizontal" : this.config.orientation;
  };
  module.updateDom = function() {
    // Mock implementation
  };

  module.start();

  // Test 1: First initialization should show loading indicator
  console.log('\n🔍 Test 1: First initialization with multi-album config');
  module.getData();

  if (module.isLoading && notificationSent && module.isFirstInitialization) {
    console.log('✅ getData correctly shows loading indicator on first initialization');
  } else {
    console.log('❌ getData should show loading indicator on first initialization');
    return false;
  }

  // Test 2: Simulate LOADING_COMPLETE and test subsequent calls
  console.log('\n🔍 Test 2: Subsequent calls after LOADING_COMPLETE');
  module.socketNotificationReceived("LOADING_COMPLETE", {
    message: "Loaded 1000 photos from 2 albums"
  });

  // Reset state for next test
  module.isLoading = false;
  notificationSent = false;

  // Call getData again - should NOT show loading indicator
  module.getData();

  if (!module.isLoading && notificationSent && !module.isFirstInitialization) {
    console.log('✅ getData correctly does NOT show loading indicator on subsequent calls');
    return true;
  } else {
    console.log('❌ getData should NOT show loading indicator on subsequent calls');
    return false;
  }
}

// Run the tests
if (require.main === module) {
  const test1Passed = testLoadingIndicator();
  const test2Passed = testGetDataIntegration();
  
  if (test1Passed && test2Passed) {
    console.log('\n🎉 All tests passed! Loading indicator is working correctly.');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Please check the implementation.');
    process.exit(1);
  }
}

module.exports = {
  testLoadingIndicator,
  testGetDataIntegration
};
