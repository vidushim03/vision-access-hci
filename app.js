/**
 * VisionAccess — Core Interaction & HCI Analytics Engine
 * Implements:
 * 1. Low-Pass Exponential Smoothing (Jitter reduction)
 * 2. Radial Dwell-Time Filter (Midas Touch mitigation)
 * 3. Eye Aspect Ratio (EAR) Blink Detection
 * 4. Fitts's Law Target Acquisition Benchmark
 * 5. AAC Speech Synthesis (TTS)
 */

// Configuration State
const config = {
  dwellDuration: 1200,      // ms to dwell before trigger
  sensitivity: 2.4,         // Head movement gain factor
  smoothingAlpha: 0.18,     // Exponential low-pass filter (0 = frozen, 1 = raw jitter)
  earBlinkThreshold: 0.22,  // Eye Aspect Ratio threshold
  blinkDurationMin: 180,    // Min duration (ms) for deliberate blink vs reflex
};

// Runtime State
let rawCursor = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let smoothCursor = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let neutralNose = null;     // Calibration origin
let currentHoveredElem = null;
let dwellStartTime = null;
let dwellAnimationFrame = null;

// Blink Detection State
let blinkStartTime = null;
let isBlinking = false;

// FPS tracking
let lastFrameTime = performance.now();
let frameCount = 0;
let currentFps = 30;

// DOM Elements
const virtualCursor = document.getElementById('virtual-cursor');
const dwellIndicator = document.getElementById('dwell-indicator');
const cursorLabel = document.getElementById('cursor-label');
const cameraStatusPill = document.getElementById('camera-status-pill');
const cameraStatusText = document.getElementById('camera-status-text');
const fpsCounter = document.getElementById('fps-counter');
const hudNoseCoords = document.getElementById('hud-nose-coords');
const hudEarVal = document.getElementById('hud-ear-val');
const hudBlinkState = document.getElementById('hud-blink-state');
const speechTextDisplay = document.getElementById('speech-text');

// Video & Canvas
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('face-canvas');
const canvasCtx = canvasElement.getContext('2d');

let accumulatedText = "";

/* =========================================================================
   1. AAC Keyboard, Phrases & Speech Synthesis
   ========================================================================= */
function updateSpeechDisplay() {
  speechTextDisplay.textContent = accumulatedText.length > 0 ? accumulatedText : "_";
}

function speakText(text) {
  if (!text || text.trim() === "_" || text.trim() === "") return;
  window.speechSynthesis.cancel(); // Stop ongoing speech
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

// Bind Button Click Events
document.querySelectorAll('.key-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.key;
    accumulatedText += key;
    updateSpeechDisplay();
    flashButton(btn);
  });
});

document.querySelectorAll('.phrase-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    accumulatedText = btn.dataset.phrase;
    updateSpeechDisplay();
    speakText(accumulatedText);
    flashButton(btn);
  });
});

document.querySelectorAll('.emergency-card').forEach(card => {
  card.addEventListener('click', () => {
    const announcement = card.dataset.announce;
    speakText(announcement);
    flashButton(card);
  });
});

document.getElementById('btn-speak').addEventListener('click', () => {
  speakText(accumulatedText);
  flashButton(document.getElementById('btn-speak'));
});

document.getElementById('btn-backspace').addEventListener('click', () => {
  if (accumulatedText.length > 0) {
    accumulatedText = accumulatedText.slice(0, -1);
    updateSpeechDisplay();
  }
  flashButton(document.getElementById('btn-backspace'));
});

document.getElementById('btn-clear').addEventListener('click', () => {
  accumulatedText = "";
  updateSpeechDisplay();
  flashButton(document.getElementById('btn-clear'));
});

function flashButton(elem) {
  elem.style.transform = "scale(0.94)";
  elem.style.borderColor = "var(--accent-cyan)";
  setTimeout(() => {
    elem.style.transform = "";
    elem.style.borderColor = "";
  }, 180);
}

/* =========================================================================
   2. Tab Switching (Nav Tabs)
   ========================================================================= */
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    const targetPane = document.getElementById(tab.dataset.tab);
    if (targetPane) targetPane.classList.add('active');
    flashButton(tab);
  });
});

/* =========================================================================
   3. Settings Controls Listeners
   ========================================================================= */
const sliderDwell = document.getElementById('slider-dwell');
const valDwell = document.getElementById('val-dwell');
sliderDwell.addEventListener('input', (e) => {
  config.dwellDuration = parseInt(e.target.value);
  valDwell.textContent = `${config.dwellDuration} ms`;
});

const sliderSensitivity = document.getElementById('slider-sensitivity');
const valSensitivity = document.getElementById('val-sensitivity');
sliderSensitivity.addEventListener('input', (e) => {
  config.sensitivity = parseFloat(e.target.value);
  valSensitivity.textContent = `${config.sensitivity.toFixed(1)}x`;
});

const sliderSmoothing = document.getElementById('slider-smoothing');
const valSmoothing = document.getElementById('val-smoothing');
sliderSmoothing.addEventListener('input', (e) => {
  config.smoothingAlpha = parseFloat(e.target.value);
  valSmoothing.textContent = config.smoothingAlpha.toFixed(2);
});

const sliderEar = document.getElementById('slider-ear');
const valEar = document.getElementById('val-ear');
sliderEar.addEventListener('input', (e) => {
  config.earBlinkThreshold = parseFloat(e.target.value);
  valEar.textContent = config.earBlinkThreshold.toFixed(2);
});

/* =========================================================================
   4. Virtual Cursor, Jitter Filtering & Dwell Activation
   ========================================================================= */
function updateVirtualCursorPosition() {
  // Exponential Moving Average (Low-Pass Filter)
  // S_t = alpha * Y_t + (1 - alpha) * S_{t-1}
  smoothCursor.x = config.smoothingAlpha * rawCursor.x + (1 - config.smoothingAlpha) * smoothCursor.x;
  smoothCursor.y = config.smoothingAlpha * rawCursor.y + (1 - config.smoothingAlpha) * smoothCursor.y;

  // Clamp inside viewport
  smoothCursor.x = Math.max(10, Math.min(window.innerWidth - 10, smoothCursor.x));
  smoothCursor.y = Math.max(10, Math.min(window.innerHeight - 10, smoothCursor.y));

  virtualCursor.style.left = `${smoothCursor.x}px`;
  virtualCursor.style.top = `${smoothCursor.y}px`;

  // Detect which interactive element is under cursor
  detectHoveredElement(smoothCursor.x, smoothCursor.y);

  requestAnimationFrame(updateVirtualCursorPosition);
}
requestAnimationFrame(updateVirtualCursorPosition);

function detectHoveredElement(x, y) {
  // Hide cursor temporarily for elementFromPoint
  virtualCursor.style.display = 'none';
  let elem = document.elementFromPoint(x, y);
  virtualCursor.style.display = 'flex';

  if (!elem) return;

  // Find closest interactive element
  const interactive = elem.closest('.interactive-btn');

  if (interactive !== currentHoveredElem) {
    // Reset previous
    if (currentHoveredElem) {
      currentHoveredElem.classList.remove('hovered');
    }
    cancelDwell();

    currentHoveredElem = interactive;

    if (currentHoveredElem) {
      currentHoveredElem.classList.add('hovered');
      startDwell(currentHoveredElem);
    }
  }
}

function startDwell(targetElem) {
  dwellStartTime = performance.now();
  virtualCursor.classList.add('dwelling');

  function dwellStep(timestamp) {
    if (!dwellStartTime || !currentHoveredElem) return;

    const elapsed = timestamp - dwellStartTime;
    const progress = Math.min(1, elapsed / config.dwellDuration);

    // SVG stroke-dashoffset (132 full circumference to 0)
    const offset = 132 * (1 - progress);
    dwellIndicator.style.strokeDashoffset = offset;

    if (progress >= 1) {
      // Trigger selection!
      triggerSelection(targetElem, "Dwell");
      cancelDwell();
    } else {
      dwellAnimationFrame = requestAnimationFrame(dwellStep);
    }
  }

  dwellAnimationFrame = requestAnimationFrame(dwellStep);
}

function cancelDwell() {
  if (dwellAnimationFrame) cancelAnimationFrame(dwellAnimationFrame);
  dwellStartTime = null;
  dwellIndicator.style.strokeDashoffset = 132;
  virtualCursor.classList.remove('dwelling');
}

function triggerSelection(elem, modalitySource) {
  if (!elem) return;

  // Visual audio feedback
  cursorLabel.textContent = `Selected (${modalitySource})`;
  cursorLabel.style.opacity = '1';
  setTimeout(() => { cursorLabel.style.opacity = '0'; }, 800);

  // Play subtle feedback beep
  playAudioFeedback();

  // Trigger standard click event
  elem.click();
}

function playAudioFeedback() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 tone
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch (e) {
    // AudioContext autoplay restrictions fallback
  }
}

/* =========================================================================
   5. Eye Aspect Ratio (EAR) & Blink Calculation
   ========================================================================= */
function calculateEyeAspectRatio(p1, p2, p3, p4, p5, p6) {
  // Euclidean distance between vertical eye landmarks
  const v1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
  const v2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
  // Horizontal eye length
  const h = Math.hypot(p1.x - p4.x, p1.y - p4.y);
  return (v1 + v2) / (2.0 * h);
}

/* =========================================================================
   6. MediaPipe FaceMesh & Camera Setup
   ========================================================================= */
const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

faceMesh.onResults(onFaceMeshResults);

function onFaceMeshResults(results) {
  frameCount++;
  const now = performance.now();
  if (now - lastFrameTime >= 1000) {
    currentFps = frameCount;
    frameCount = 0;
    lastFrameTime = now;
    fpsCounter.textContent = `${currentFps} FPS`;
  }

  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    cameraStatusPill.classList.add('active');
    cameraStatusText.textContent = "Tracking Active";

    const landmarks = results.multiFaceLandmarks[0];

    // Landmark 1: Nose tip (Primary cursor tracking point)
    const nose = landmarks[1];

    if (!neutralNose) {
      neutralNose = { x: nose.x, y: nose.y };
    }

    // Relative displacement from center
    const dx = (nose.x - neutralNose.x) * config.sensitivity;
    const dy = (nose.y - neutralNose.y) * config.sensitivity;

    // Map to screen coordinates (Inverted horizontal for mirror camera)
    rawCursor.x = window.innerWidth / 2 - dx * window.innerWidth;
    rawCursor.y = window.innerHeight / 2 + dy * window.innerHeight;

    hudNoseCoords.textContent = `X: ${nose.x.toFixed(2)}, Y: ${nose.y.toFixed(2)}`;

    // Draw Nose Tracking Dot on HUD
    canvasCtx.beginPath();
    canvasCtx.arc(nose.x * canvasElement.width, nose.y * canvasElement.height, 4, 0, 2 * Math.PI);
    canvasCtx.fillStyle = '#06b6d4';
    canvasCtx.fill();

    // Eye Landmarks for EAR Calculation:
    // Left eye: 33 (corner), 160, 158 (top), 133 (corner), 153, 144 (bottom)
    const leftEar = calculateEyeAspectRatio(
      landmarks[33], landmarks[160], landmarks[158],
      landmarks[133], landmarks[153], landmarks[144]
    );

    // Right eye: 362 (corner), 385, 387 (top), 263 (corner), 373, 380 (bottom)
    const rightEar = calculateEyeAspectRatio(
      landmarks[362], landmarks[385], landmarks[387],
      landmarks[263], landmarks[373], landmarks[380]
    );

    const avgEar = (leftEar + rightEar) / 2.0;
    hudEarVal.textContent = avgEar.toFixed(3);

    // Blink State Machine
    if (avgEar < config.earBlinkThreshold) {
      if (!isBlinking) {
        isBlinking = true;
        blinkStartTime = performance.now();
        hudBlinkState.textContent = "Closed";
        hudBlinkState.className = "state-blink";
      }
    } else {
      if (isBlinking) {
        const blinkDuration = performance.now() - blinkStartTime;
        isBlinking = false;
        hudBlinkState.textContent = "Open";
        hudBlinkState.className = "state-open";

        // Deliberate click action if blink was > 180ms
        if (blinkDuration >= config.blinkDurationMin && currentHoveredElem) {
          triggerSelection(currentHoveredElem, "Blink");
          cancelDwell();
        }
      }
    }
  } else {
    cameraStatusPill.classList.remove('active');
    cameraStatusText.textContent = "Looking for face...";
  }

  canvasCtx.restore();
}

// Camera initialization
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await faceMesh.send({ image: videoElement });
  },
  width: 640,
  height: 480,
});
camera.start().catch(err => {
  console.warn("Camera start failed, falling back to mouse-driven emulation mode:", err);
  cameraStatusText.textContent = "Mouse Emulation Mode";
  cameraStatusPill.classList.add('active');
});

// Fallback: Enable mouse movement to drive virtual cursor if webcam not available
window.addEventListener('mousemove', (e) => {
  if (!neutralNose) {
    rawCursor.x = e.clientX;
    rawCursor.y = e.clientY;
  }
});

/* =========================================================================
   7. Fitts's Law Quantitative Usability Benchmark
   ========================================================================= */
const btnStartBenchmark = document.getElementById('btn-start-benchmark');
const benchmarkStage = document.getElementById('benchmark-stage');
const benchmarkTarget = document.getElementById('benchmark-target');
const benchmarkInstruction = document.getElementById('benchmark-instruction');

const fittsTrials = document.getElementById('fitts-trials');
const fittsAvgTime = document.getElementById('fitts-avg-time');
const fittsAvgId = document.getElementById('fitts-avg-id');
const fittsThroughput = document.getElementById('fitts-throughput');

let benchmarkActive = false;
let currentTrial = 0;
const totalTrials = 10;
let trialStartTime = null;
let lastTargetPos = { x: 0, y: 0 };

const benchmarkResults = [];

btnStartBenchmark.addEventListener('click', () => {
  benchmarkActive = true;
  currentTrial = 0;
  benchmarkResults.length = 0;
  benchmarkInstruction.style.display = 'none';
  benchmarkTarget.classList.remove('hidden');
  spawnNextTarget();
  flashButton(btnStartBenchmark);
});

function spawnNextTarget() {
  if (currentTrial >= totalTrials) {
    endBenchmark();
    return;
  }

  const stageRect = benchmarkStage.getBoundingClientRect();

  // Varying Target Widths (W): 45px to 90px
  const sizes = [50, 65, 80, 95];
  const targetSize = sizes[Math.floor(Math.random() * sizes.length)];

  // Random coordinates inside stage boundary
  const pad = targetSize + 20;
  const x = Math.random() * (stageRect.width - pad * 2) + pad;
  const y = Math.random() * (stageRect.height - pad * 2) + pad;

  benchmarkTarget.style.width = `${targetSize}px`;
  benchmarkTarget.style.height = `${targetSize}px`;
  benchmarkTarget.style.left = `${x - targetSize / 2}px`;
  benchmarkTarget.style.top = `${y - targetSize / 2}px`;

  // Compute Distance (D) from last target or center
  const origin = currentTrial === 0
    ? { x: stageRect.width / 2, y: stageRect.height / 2 }
    : lastTargetPos;

  const distance = Math.hypot(x - origin.x, y - origin.y);
  lastTargetPos = { x, y };

  // Fitts's Index of Difficulty: ID = log2(2D / W)
  const id = Math.log2((2 * distance) / targetSize);

  benchmarkTarget.dataset.id = id.toFixed(2);
  benchmarkTarget.dataset.size = targetSize;
  benchmarkTarget.dataset.dist = distance.toFixed(1);

  trialStartTime = performance.now();
  currentTrial++;
  fittsTrials.textContent = `${currentTrial} / ${totalTrials}`;
}

benchmarkTarget.addEventListener('click', () => {
  if (!benchmarkActive) return;

  const movementTime = performance.now() - trialStartTime;
  const id = parseFloat(benchmarkTarget.dataset.id);

  benchmarkResults.push({
    trial: currentTrial,
    mt: movementTime,
    id: Math.max(0.5, id), // Guard against non-positive ID
  });

  // Brief hit pulse animation
  benchmarkTarget.style.transform = "scale(1.25)";
  setTimeout(() => { benchmarkTarget.style.transform = "scale(1)"; }, 120);

  spawnNextTarget();
});

function endBenchmark() {
  benchmarkActive = false;
  benchmarkTarget.classList.add('hidden');
  benchmarkInstruction.style.display = 'block';

  // Compute Metrics
  const totalMt = benchmarkResults.reduce((acc, r) => acc + r.mt, 0);
  const avgMt = totalMt / benchmarkResults.length;

  const totalId = benchmarkResults.reduce((acc, r) => acc + r.id, 0);
  const avgId = totalId / benchmarkResults.length;

  // Fitts's Throughput (bits / second): TP = ID / MT (in seconds)
  const throughput = avgId / (avgMt / 1000);

  fittsAvgTime.textContent = `${Math.round(avgMt)} ms`;
  fittsAvgId.textContent = `${avgId.toFixed(2)} bits`;
  fittsThroughput.textContent = `${throughput.toFixed(2)} bits/s`;

  benchmarkInstruction.innerHTML = `
    <h3 style="color: var(--accent-green); margin-bottom: 8px;">✓ Experiment Complete!</h3>
    <p>Average Acquisition Time: <strong>${Math.round(avgMt)} ms</strong></p>
    <p>Average Index of Difficulty: <strong>${avgId.toFixed(2)} bits</strong></p>
    <p>Empirical Throughput: <strong>${throughput.toFixed(2)} bits/second</strong></p>
    <p style="font-size: 11px; margin-top: 8px; color: var(--text-muted);">You can quote these exact metrics in your HCI Viva and Project Report.</p>
  `;

  speakText("Benchmark complete. Data recorded.");
}
