# VisionAccess: Multimodal Hands-Free Assistive Interface

**Course / Purpose:** 4th Year B.Tech / BE Final HCI Project  
**Author:** Vidushi  
**Domain:** Human-Computer Interaction (HCI) / Assistive Technology / Computer Vision  

---

## 1. Project Overview

**VisionAccess** is a real-time, browser-native assistive computing interface tailored for motor-impaired individuals (e.g., users afflicted with ALS, spinal cord injuries, cerebral palsy, or upper-limb trauma). 

Rather than requiring physical peripheral devices (mouse, physical keyboard), VisionAccess transforms standard, low-cost integrated laptop webcams into a precise, multimodal gaze and gesture interaction channel.

### Primary Modalities:
1. **Head-Pose Gaze Steering:** Uses MediaPipe FaceMesh (468 3D facial landmarks) tracking the nasal bridge and head rotation to position an on-screen assistive cursor.
2. **Radial Dwell-Time Activation (Midas Touch Mitigation):** Prevents unintended selections by requiring a continuous, calibrated dwell duration (default 1200 ms) over target hitboxes, visualized via a radial progress ring.
3. **Deliberate Blink Triggering (Eye Aspect Ratio - EAR):** Continuously monitors the vertical-to-horizontal eye aperture. Deliberate blinks exceeding 180 ms serve as discrete selection signals.
4. **AAC (Augmentative and Alternative Communication) Virtual Keyboard & Speech Engine:** High-affordance Fitts's Law-optimized keypad paired with Web Speech API for voice synthesis.
5. **Integrated Quantitative Usability & Fitts's Law Evaluator:** Embedded benchmarking suite calculating Movement Time ($MT$), Index of Difficulty ($ID$), and Information Throughput ($TP$) in bits/second.

---

## 2. Core HCI Theoretical Concepts (Viva Defense Guide)

When presenting to examiners, highlight these exact theoretical terms:

### A. The "Midas Touch" Problem
* **Definition:** In hands-free gaze/head interaction, whatever the user looks at could be accidentally activated because looking is both an act of perception and an act of command.
* **Our Solution:** We decoupled perception from selection by combining an **animated radial dwell-time filter** and **Eye Aspect Ratio (EAR) blink gating**. A brief glance does not trigger an action; only sustained, intentional dwelling or a deliberate blink completes the selection.

### B. Fitts's Law ($MT = a + b \log_2(2D / W)$)
* **Application:** Target acquisition time is a function of target distance ($D$) and width ($W$).
* **UI Implementation:** Every interactive button and key in VisionAccess has enlarged hitboxes (minimum 58px height for keys, 120px+ for emergency cards), minimizing the Index of Difficulty ($ID$) and human pointing error rate.
* **Benchmarking:** The application features a built-in empirical testing suite that directly records pointing data and computes information throughput ($TP = ID / MT$).

### C. Jitter Attenuation & Ergonomics (Exponential Low-Pass Filter)
* **Problem:** Raw webcam coordinates exhibit severe pixel-level jitter due to physiological head tremors and sensor sensor noise, causing rapid user neck fatigue.
* **Algorithm:** We implement an Exponential Moving Average (EMA) smoothing filter:
  $$S_t = \alpha \cdot Y_t + (1 - \alpha) \cdot S_{t-1}$$
  where $\alpha = 0.18$ balances instantaneous responsiveness against jitter dampening.

---

## 3. How to Run the Project

No database setup or installation of heavy packages is required. The project runs directly via any modern web browser (Google Chrome, Microsoft Edge, Brave) with webcam permissions:

### Method 1: Local HTTP Server (Recommended)
Open PowerShell in this directory:
```powershell
cd C:\Users\vidus\Desktop\Projects\vision-access-hci
npx serve -l 3000
```
Or with Python:
```powershell
python -m http.server 3000
```
Then visit: `http://localhost:3000`

### Method 2: Direct File Launch
Double-click `index.html` to open directly in Chrome/Edge and allow camera access.

---

## 4. Live Demo Flow for Examiners (3-Minute Script)

1. **Initialization:**
   * Open the app. Point out the **Vision Telemetry HUD** on the right side: shows live camera feed, tracked nasal anchor dot, 30 FPS counter, and dynamic EAR values.
2. **AAC Keyboard Demo:**
   * Hover the virtual cursor over letters (e.g., `H`, `E`, `L`, `P`). 
   * Show how the radial dwell ring smoothly fills up and clicks without any hand movement.
   * Hover over the **"Speak Aloud (TTS)"** button. The computer vocalizes the constructed sentence.
3. **Emergency Quick-Needs Deck:**
   * Switch to the **Quick Needs** tab.
   * Hover or blink on **"Call Nurse"** or **"Need Water"** to show instant multi-modal emergency signaling.
4. **Fitts's Law Usability Benchmark:**
   * Switch to the **Fitts's Law Benchmark** tab.
   * Click **"Start 10-Target Experiment"**.
   * Hit the random circular targets hands-free.
   * Show the calculated **Empirical Throughput (bits/s)** and **Movement Time (ms)** metrics to the examiner as experimental validation.
