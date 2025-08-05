/**
 * Test for First Initialization Loading Indicator Behavior
 * 
 * This test verifies that the loading indicator only appears during the first
 * initialization of the module and not during subsequent photo loading operations.
 */

// Mock DOM environment
global.document = {
  createElement: function(tag) {
    return {
      className: '',
      style: {},
      textContent: '',
      appendChild: function() {},
      insertBefore: function() {},
      removeChild: function() {},
      addEventListener: function() {}
    };
  },
  addEventListener: function() {}
};

global.Log = {
  log: function() {},
  info: function() {},
  warn: function() {},
  error: function() {}
};

global.Module = {
  register: function(name, definition) {
    global.registeredModule = definition;
    return definition;
  }
};

// Load the module
require('../MMM-Wallpaper.js');

function runFirstInitializationTest() {
  console.log('🧪 Testing First Initialization Loading Indicator Behavior');
  console.log('=' .repeat(60));

  // Create module instance - the module is registered globally
  const moduleDefinition = global.registeredModule;
  const module = Object.create(moduleDefinition);
  module.config = {
    source: ["icloud:album1", "icloud:album2"], // Multi-album config
    updateInterval: 60 * 60 * 1000,
    slideInterval: 5 * 60 * 1000,
    maximumEntries: 1000,
    debugPhotoSelection: true
  };

  // Mock methods
  module.sendSocketNotification = function(notification, payload) {
    console.log(`📡 Socket notification sent: ${notification}`);
  };

  module.getOrientation = function() {
    return 'auto';
  };

  module.showLoadingIndicator = function(message) {
    console.log(`🔄 Loading indicator shown: ${message}`);
    this.loadingIndicatorShown = true;
  };

  module.hideLoadingIndicator = function() {
    console.log(`✅ Loading indicator hidden`);
    this.loadingIndicatorShown = false;
  };

  // Initialize the module
  console.log('\n📋 Test 1: Initial module startup');
  module.start();
  
  if (module.isFirstInitialization === true) {
    console.log('✅ isFirstInitialization correctly set to true on startup');
  } else {
    console.log('❌ isFirstInitialization should be true on startup');
    return false;
  }

  // Test first getData call (should show loading indicator)
  console.log('\n📋 Test 2: First getData call (should show loading indicator)');
  module.loadingIndicatorShown = false;
  module.getData();
  
  if (module.loadingIndicatorShown === true) {
    console.log('✅ Loading indicator shown during first initialization');
  } else {
    console.log('❌ Loading indicator should be shown during first initialization');
    return false;
  }

  // Simulate LOADING_COMPLETE notification
  console.log('\n📋 Test 3: LOADING_COMPLETE notification');
  module.socketNotificationReceived("LOADING_COMPLETE", {
    message: "Loaded 1000 photos from 2 albums"
  });
  
  if (module.isFirstInitialization === false) {
    console.log('✅ isFirstInitialization correctly set to false after LOADING_COMPLETE');
  } else {
    console.log('❌ isFirstInitialization should be false after LOADING_COMPLETE');
    return false;
  }

  // Test subsequent getData call (should NOT show loading indicator)
  console.log('\n📋 Test 4: Subsequent getData call (should NOT show loading indicator)');
  module.loadingIndicatorShown = false;
  module.getData();
  
  if (module.loadingIndicatorShown === false) {
    console.log('✅ Loading indicator NOT shown during subsequent updates');
  } else {
    console.log('❌ Loading indicator should NOT be shown during subsequent updates');
    return false;
  }

  // Test config update (should reset to first initialization)
  console.log('\n📋 Test 5: Config update (should reset to first initialization)');
  module.notificationReceived("UPDATE_WALLPAPER_CONFIG", {
    source: ["icloud:newalbum1", "icloud:newalbum2"]
  });
  
  if (module.isFirstInitialization === true) {
    console.log('✅ isFirstInitialization correctly reset to true after config update');
  } else {
    console.log('❌ isFirstInitialization should be reset to true after config update');
    return false;
  }

  // Test single album config (should NOT show loading indicator even on first init)
  console.log('\n📋 Test 6: Single album config (should NOT show loading indicator)');
  module.config.source = "icloud:singlealbum";
  module.isFirstInitialization = true;
  module.loadingIndicatorShown = false;
  module.getData();
  
  if (module.loadingIndicatorShown === false) {
    console.log('✅ Loading indicator NOT shown for single album config');
  } else {
    console.log('❌ Loading indicator should NOT be shown for single album config');
    return false;
  }

  console.log('\n🎉 All tests passed! First initialization loading behavior is working correctly.');
  return true;
}

// Run the test
if (require.main === module) {
  const success = runFirstInitializationTest();
  process.exit(success ? 0 : 1);
}

module.exports = { runFirstInitializationTest };
