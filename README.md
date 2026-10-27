# 🎙️ VoiceCalc AI - Automatic Voice Talking Calculator

A modern, voice-interactive calculator web application featuring natural language speech recognition, automatic speech synthesis (voice readout), permission management, calculation history, and settings.

---

## 🌟 Key Features

1. **Automatic Voice (Text-to-Speech)**:
   - Reads out calculations and answers automatically (e.g. *"25 plus 30 equals 55"*).
   - Instant "Speak Answer" button to replay the result.
   - Customizable voices (male/female/accents), speech rate, and speech pitch.
   - Toggle Auto-Voice ON/OFF with one click.

2. **Microphone Voice Control (Speech-to-Text)**:
   - Calculate entirely hands-free by speaking naturally.
   - Live transcription feedback indicator.
   - Continuous listening mode or push-to-talk.
   - Built-in permission status indicator (Granted / Prompt / Blocked) with guidance for unblocking.

3. **Natural Voice Commands Supported**:
   - Arithmetic: `"What is 50 divided by 2"`, `"120 times 8"`, `"45 plus 19"`, `"80 minus 35"`
   - Percentage: `"15 percent of 200"`, `"50 percent"`
   - Advanced math: `"Square root of 81"`, `"2 to the power of 8"`
   - Voice actions: `"Clear"`, `"Reset"`, `"Equals"`, `"Calculate"`, `"Delete"`, `"Repeat"`

4. **Rich Calculator UI**:
   - Glassmorphic dark theme with glowing audio visualizers.
   - Full standard keypad (`0-9`, `.`, `+`, `−`, `×`, `÷`, `( )`, `%`, `AC`, `⌫`, `=`).
   - Physical keyboard input support.
   - Calculation history drawer with one-click reload and voice replay.
   - Synthesized key-click sound effects (Web Audio API).

---

## 🚀 How to Run the App

Because modern web browsers require a secure origin (`http://localhost` or `https://`) to grant microphone access for speech recognition, running through the included local server ensures full compatibility.

### Option 1: Double-Click Launcher (Windows)
- Simply double-click **`start.bat`** in this folder!
- It starts the local server and automatically opens your browser to `http://localhost:3000`.

### Option 2: Run via Terminal
```bash
node server.js
```
Then open your browser and navigate to:
**`http://localhost:3000`**

---

## 🎙️ Microphone Permission Instructions

1. When you first open the app, click **"Enable Microphone"** or tap the **"Tap to Speak"** button.
2. When your browser displays the prompt:
   - Click **"Allow"** to grant microphone access.
3. If previously blocked:
   - Click the **padlock (🔒)** or **microphone icon** in the browser's address bar.
   - Set **Microphone** to **Allow**.
   - Reload the page.

