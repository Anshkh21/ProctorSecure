import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

let model = null;

/**
 * Loads the COCO-SSD model.
 */
export const loadModel = async () => {
  try {
    model = await cocoSsd.load();
    console.log("COCO-SSD model loaded successfully");
    return true;
  } catch (err) {
    console.error("Failed to load COCO-SSD model", err);
    return false;
  }
};

/**
 * Detects objects in the video stream.
 * @param {HTMLVideoElement} videoElement
 * @returns {Promise<Array<{class: string, score: number}>>} List of detected prohibited items.
 */
export const detectObjects = async (videoElement) => {
  if (!model || !videoElement) return [];

  // Prohibited items list (subset of COCO classes)
  const prohibitedItems = [
    'cell phone', 

    'laptop', 
    'book', 
    'notebook',
    'remote',
    'scissors' // potential weapon/tool
  ];

  try {
    const predictions = await model.detect(videoElement);
    
    // Filter for prohibited items with high confidence
    const detectedProhibited = predictions
      .filter(p => prohibitedItems.includes(p.class.toLowerCase()) && p.score > 0.6)
      .map(p => ({
        class: p.class,
        score: p.score,
        bbox: p.bbox
      }));

    return detectedProhibited;
  } catch (err) {
    console.error("Object detection error:", err);
    return [];
  }
};
