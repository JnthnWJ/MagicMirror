#!/usr/bin/env node

/**
 * Test script for Enhanced Photo Selection
 *
 * This script simulates the enhanced photo selection algorithm
 * to verify it works correctly and provides good distribution.
 */

// Mock the enhanced photo selection logic
class EnhancedPhotoSelector {
  constructor(config) {
    this.config = {
      enhancedShuffle: true,
      recentlyShownTracking: true,
      recentlyShownCount: 50,
      recentlyShownCooldown: 30,
      selectionMethod: "weighted_random",
      debugPhotoSelection: false,
      ...config
    };

    this.recentlyShown = [];
    this.images = [];
    this.imageIndex = -1;
  }

  setImages(images) {
    this.images = images.map((url, index) => ({ url, index }));
  }

  selectNextImageIndex() {
    if (!this.images || this.images.length === 0) {
      return -1;
    }

    if (this.images.length === 1) {
      return 0;
    }

    let selectedIndex = -1;

    switch (this.config.selectionMethod) {
      case "pure_random":
        selectedIndex = this.selectPureRandom();
        break;
      case "weighted_random":
        selectedIndex = this.selectWeightedRandom();
        break;
      case "sequential":
        selectedIndex = this.selectSequential();
        break;
      default:
        selectedIndex = this.selectWeightedRandom();
    }

    if (selectedIndex >= 0 && this.config.recentlyShownTracking) {
      this.trackRecentlyShown(selectedIndex);
    }

    return selectedIndex;
  }

  selectPureRandom() {
    return Math.floor(Math.random() * this.images.length);
  }

  selectSequential() {
    return (this.imageIndex + 1) % this.images.length;
  }

  selectWeightedRandom() {
    const weights = [];
    let totalWeight = 0;

    for (let i = 0; i < this.images.length; i++) {
      const weight = this.calculateImageWeight(i);
      weights.push(weight);
      totalWeight += weight;
    }

    if (totalWeight === 0) {
      return this.selectPureRandom();
    }

    const random = Math.random() * totalWeight;
    let currentWeight = 0;

    for (let i = 0; i < weights.length; i++) {
      currentWeight += weights[i];
      if (random <= currentWeight) {
        return i;
      }
    }

    return this.images.length - 1;
  }

  calculateImageWeight(imageIndex) {
    const baseWeight = 1.0;

    if (!this.config.recentlyShownTracking) {
      return baseWeight;
    }

    const imageUrl = this.images[imageIndex].url;
    const recentEntry = this.recentlyShown.find(entry => entry.url === imageUrl);

    if (!recentEntry) {
      return baseWeight;
    }

    const timeSinceShown = (Date.now() - recentEntry.timestamp) / (1000 * 60);

    if (timeSinceShown < this.config.recentlyShownCooldown) {
      const cooldownFactor = timeSinceShown / this.config.recentlyShownCooldown;
      return baseWeight * cooldownFactor * 0.1;
    }

    return baseWeight;
  }

  trackRecentlyShown(imageIndex) {
    if (!this.config.recentlyShownTracking || imageIndex < 0 || imageIndex >= this.images.length) {
      return;
    }

    const imageUrl = this.images[imageIndex].url;
    const timestamp = Date.now();

    this.recentlyShown = this.recentlyShown.filter(entry => entry.url !== imageUrl);

    this.recentlyShown.unshift({
      url: imageUrl,
      timestamp: timestamp,
      index: imageIndex
    });

    if (this.recentlyShown.length > this.config.recentlyShownCount) {
      this.recentlyShown = this.recentlyShown.slice(0, this.config.recentlyShownCount);
    }
  }

  getStats() {
    return {
      totalImages: this.images.length,
      recentlyShownCount: this.recentlyShown.length,
      config: this.config
    };
  }
}

// Test function
function runTest(testName, config, imageCount, selectionCount) {
  console.log(`\n=== ${testName} ===`);
  console.log(`Images: ${imageCount}, Selections: ${selectionCount}`);
  console.log(`Config: ${JSON.stringify(config, null, 2)}`);

  const selector = new EnhancedPhotoSelector(config);

  // Create mock images
  const images = Array.from({ length: imageCount }, (_, i) => `image_${i}.jpg`);
  selector.setImages(images);

  // Track selection frequency
  const selectionCounts = new Array(imageCount).fill(0);
  const selections = [];

  // Perform selections
  for (let i = 0; i < selectionCount; i++) {
    const selectedIndex = selector.selectNextImageIndex();
    if (selectedIndex >= 0) {
      selectionCounts[selectedIndex]++;
      selections.push(selectedIndex);
      selector.imageIndex = selectedIndex;
    }

    // Add some time delay simulation for cooldown testing
    if (i % 10 === 0) {
      // Simulate 5 minutes passing
      selector.recentlyShown.forEach(entry => {
        entry.timestamp -= 5 * 60 * 1000;
      });
    }
  }

  // Calculate statistics
  const totalSelections = selections.length;
  const uniqueImages = selectionCounts.filter(count => count > 0).length;
  const averageSelections = totalSelections / imageCount;
  const maxSelections = Math.max(...selectionCounts);
  const minSelections = Math.min(...selectionCounts.filter(count => count > 0));

  console.log(`\nResults:`);
  console.log(`- Total selections: ${totalSelections}`);
  console.log(`- Unique images shown: ${uniqueImages}/${imageCount} (${(uniqueImages/imageCount*100).toFixed(1)}%)`);
  console.log(`- Average selections per image: ${averageSelections.toFixed(2)}`);
  console.log(`- Max selections for single image: ${maxSelections}`);
  console.log(`- Min selections for shown image: ${minSelections}`);
  console.log(`- Distribution ratio (max/min): ${(maxSelections/minSelections).toFixed(2)}`);

  // Show first 20 selections for pattern analysis
  console.log(`- First 20 selections: [${selections.slice(0, 20).join(', ')}]`);

  return {
    uniqueImages,
    totalImages: imageCount,
    distributionRatio: maxSelections / minSelections,
    selections: selections.slice(0, 20)
  };
}

// Run tests
console.log("Enhanced Photo Selection Test Suite");
console.log("===================================");

// Test 1: Weighted Random with large pool (6+ hour settings)
runTest(
  "Weighted Random - 6+ Hour Cooldown",
  { selectionMethod: "weighted_random", recentlyShownCount: 500, recentlyShownCooldown: 400 },
  1000,
  600
);

// Test 2: Pure Random
runTest(
  "Pure Random",
  { selectionMethod: "pure_random", recentlyShownTracking: false },
  100,
  200
);

// Test 3: Sequential (original behavior)
runTest(
  "Sequential (Original)",
  { selectionMethod: "sequential", recentlyShownTracking: false },
  100,
  200
);

// Test 4: Small pool with tracking
runTest(
  "Weighted Random - Small Pool",
  { selectionMethod: "weighted_random", recentlyShownCount: 5, recentlyShownCooldown: 15 },
  10,
  50
);

console.log("\n=== Test Complete ===");
console.log("Expected results:");
console.log("- Weighted Random should show high diversity with good distribution");
console.log("- Pure Random should show good diversity but may have clustering");
console.log("- Sequential should show perfect order: 0,1,2,3...9,0,1,2...");
console.log("- Small pool should show all images with reasonable distribution");
