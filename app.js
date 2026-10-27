/**
 * VoiceCalc AI - Automatic Voice & Interactive Calculator
 * Features:
 * - Robust Natural Language & Math Parser (handles compound numbers like "twenty five" -> 25)
 * - Safe Math Evaluator with standard percentage rules (100 + 10% = 110), implicit multiplication, and auto-closing parens
 * - Visual arithmetic formatting with standard typographic symbols (×, ÷, −, +)
 * - Real-time Speech Recognition (STT) with continuous auto-listening and pause-debounce
 * - Chrome-compatible Speech Synthesis (TTS) with echo prevention and voice selection
 * - Web Audio API synthesized click & beep sound effects
 * - Permission manager with live status indicators and unblocking assistance
 */

// ==========================================
// STATE MANAGEMENT
// ==========================================
const state = {
  currentExpression: '0',
  prevExpression: '',
  isEvaluated: false,
  history: [],

  // Voice & Audio
  isListening: false,
  isSpeaking: false,
  autoVoiceEnabled: true,
  continuousListening: true,
  soundEffectsEnabled: true,
  speechRate: 1.0,
  speechPitch: 1.0,
  selectedVoice: null,
  availableVoices: [],

  // Permissions: 'prompt' | 'granted' | 'denied' | 'unsupported'
  micPermissionStatus: 'prompt',
};

// ==========================================
// DOM ELEMENTS
// ==========================================
const elements = {
  expressionDisplay: document.getElementById('expressionDisplay'),
  prevExpressionDisplay: document.getElementById('prevExpressionDisplay'),
  voiceStatusBadge: document.getElementById('voiceStatusBadge'),
  voiceStatusText: document.getElementById('voiceStatusText'),
  liveTranscript: document.getElementById('liveTranscript'),

  // Permissions & Banner
  permissionBtn: document.getElementById('permissionBtn'),
  permDot: document.getElementById('permDot'),
  permLabel: document.getElementById('permLabel'),
  permissionBanner: document.getElementById('permissionBanner'),
  bannerTitle: document.getElementById('bannerTitle'),
  bannerDesc: document.getElementById('bannerDesc'),
  requestPermBtn: document.getElementById('requestPermBtn'),
  dismissBannerBtn: document.getElementById('dismissBannerBtn'),

  // Quick Controls
  micToggleBtn: document.getElementById('micToggleBtn'),
  micBtnLabel: document.getElementById('micBtnLabel'),
  speakResultBtn: document.getElementById('speakResultBtn'),
  autoVoiceToggle: document.getElementById('autoVoiceToggle'),

  // History Drawer
  historyToggleBtn: document.getElementById('historyToggleBtn'),
  historyPanel: document.getElementById('historyPanel'),
  historyList: document.getElementById('historyList'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  closeHistoryBtn: document.getElementById('closeHistoryBtn'),
  calculatorLayout: document.querySelector('.calculator-layout'),

  // Settings Modal
  settingsToggleBtn: document.getElementById('settingsToggleBtn'),
  settingsModal: document.getElementById('settingsModal'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  voiceSelect: document.getElementById('voiceSelect'),
  rateRange: document.getElementById('rateRange'),
  rateVal: document.getElementById('rateVal'),
  pitchRange: document.getElementById('pitchRange'),
  pitchVal: document.getElementById('pitchVal'),
  continuousSwitch: document.getElementById('continuousSwitch'),
  soundEffectsSwitch: document.getElementById('soundEffectsSwitch'),
  testVoiceBtn: document.getElementById('testVoiceBtn'),

  // Voice help chips
  helpChips: document.querySelectorAll('.chip')
};

// ==========================================
// WEB AUDIO SYNTHESIZER
// ==========================================
class SoundSynth {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  playBeep(freq = 600, duration = 0.05, type = 'sine') {
    if (!state.soundEffectsEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  keyClick() { this.playBeep(520, 0.04, 'sine'); }
  operatorClick() { this.playBeep(740, 0.06, 'triangle'); }
  equalsClick() { this.playBeep(880, 0.1, 'sine'); }
  micStart() { this.playBeep(640, 0.08, 'sine'); setTimeout(() => this.playBeep(920, 0.1, 'sine'), 80); }
  micStop() { this.playBeep(850, 0.08, 'sine'); setTimeout(() => this.playBeep(500, 0.1, 'sine'), 80); }
  errorSound() { this.playBeep(220, 0.18, 'sawtooth'); }
}

const soundSynth = new SoundSynth();

// ==========================================
// PERMISSION MANAGER
// ==========================================
class PermissionManager {
  static async checkStatus() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      PermissionManager.updateUI('unsupported');
      return 'unsupported';
    }

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' });
        PermissionManager.updateUI(result.state);
        result.onchange = () => {
          PermissionManager.updateUI(result.state);
        };
        return result.state;
      } catch (err) {
        PermissionManager.updateUI('prompt');
        return 'prompt';
      }
    } else {
      PermissionManager.updateUI('prompt');
      return 'prompt';
    }
  }

  static updateUI(status) {
    state.micPermissionStatus = status;
    elements.permDot.className = 'status-dot';

    switch (status) {
      case 'granted':
        elements.permDot.classList.add('granted');
        elements.permLabel.textContent = 'Mic Active';
        elements.permissionBanner.classList.add('hidden');
        break;

      case 'denied':
        elements.permDot.classList.add('denied');
        elements.permLabel.textContent = 'Mic Blocked';
        elements.bannerTitle.textContent = 'Microphone Access Blocked';
        elements.bannerDesc.innerHTML = 'Please click the 🔒 or 🎙️ icon in your browser address bar and set Microphone to <b>Allow</b>, then refresh the page.';
        elements.requestPermBtn.textContent = 'How to Unblock';
        elements.permissionBanner.classList.remove('hidden');
        elements.permissionBanner.classList.add('denied');
        break;

      case 'unsupported':
        elements.permDot.classList.add('denied');
        elements.permLabel.textContent = 'Unsupported';
        elements.bannerTitle.textContent = 'Browser Unsupported';
        elements.bannerDesc.textContent = 'Voice recognition is supported in Google Chrome, Microsoft Edge, and Safari.';
        elements.requestPermBtn.style.display = 'none';
        elements.permissionBanner.classList.remove('hidden');
        break;

      case 'prompt':
      default:
        elements.permLabel.textContent = 'Allow Mic';
        elements.bannerTitle.textContent = 'Enable Microphone Access';
        elements.bannerDesc.textContent = 'Click below to allow voice control for calculating hands-free.';
        elements.requestPermBtn.textContent = 'Enable Microphone';
        elements.requestPermBtn.style.display = 'inline-block';
        elements.permissionBanner.classList.remove('hidden', 'denied');
        break;
    }
  }
}

// ==========================================
// SPEECH SYNTHESIS (VOICE OUTPUT / TTS)
// ==========================================
window._voiceUtterance = null;

class VoiceSynthesizer {
  static init() {
    if (!('speechSynthesis' in window)) return;
    VoiceSynthesizer.loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = VoiceSynthesizer.loadVoices;
    }
  }

  static loadVoices() {
    const voices = speechSynthesis.getVoices();
    state.availableVoices = voices;

    if (voices.length > 0 && elements.voiceSelect) {
      elements.voiceSelect.innerHTML = '';
      voices.forEach((voice, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' — Default' : ''}`;
        elements.voiceSelect.appendChild(option);

        if (!state.selectedVoice && (voice.lang.startsWith('en') || voice.default)) {
          state.selectedVoice = voice;
          elements.voiceSelect.value = index;
        }
      });
    }
  }

  static speak(text, onComplete) {
    if (!('speechSynthesis' in window)) return;

    let spokenText = String(text)
      .replace(/\*/g, ' times ')
      .replace(/\//g, ' divided by ')
      .replace(/\+/g, ' plus ')
      .replace(/(?<=\d|\))\-(?=\d|\()/g, ' minus ')
      .replace(/^\-/, 'negative ')
      .replace(/\^/g, ' to the power of ')
      .replace(/sqrt\((.*?)\)/gi, 'square root of $1')
      .replace(/%/g, ' percent ')
      .replace(/=/g, ' equals ');

    if (speechSynthesis.paused) {
      speechSynthesis.resume();
    }
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(spokenText);
    window._voiceUtterance = utterance;

    if (state.selectedVoice) {
      utterance.voice = state.selectedVoice;
    }
    utterance.rate = state.speechRate;
    utterance.pitch = state.speechPitch;

    // Temporarily pause recognition to prevent microphone hearing the synthesizer
    state.isSpeaking = true;
    if (voiceRecognizer) {
      voiceRecognizer.pauseListening();
    }

    elements.voiceStatusBadge.className = 'voice-badge speaking';
    elements.voiceStatusText.textContent = 'Speaking...';

    utterance.onend = () => {
      state.isSpeaking = false;
      window._voiceUtterance = null;

      if (!state.isListening) {
        elements.voiceStatusBadge.className = 'voice-badge';
        elements.voiceStatusText.textContent = 'Voice ready';
      }

      if (voiceRecognizer && state.continuousListening) {
        setTimeout(() => {
          voiceRecognizer.resumeListening();
        }, 350);
      }

      if (onComplete) onComplete();
    };

    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis error:', e);
      state.isSpeaking = false;
      window._voiceUtterance = null;
      if (voiceRecognizer && state.continuousListening) {
        voiceRecognizer.resumeListening();
      }
    };

    speechSynthesis.speak(utterance);
  }
}

// ==========================================
// NATURAL LANGUAGE COMPILER & INTERPRETER
// ==========================================
class VoiceInterpreter {
  // Convert spoken English words into mathematical numbers (e.g. "twenty five" -> 25)
  static convertWordsToNumbers(text) {
    const smalls = {
      'zero': 0, 'oh': 0, 'nought': 0, 'nil': 0,
      'one': 1, 'won': 1,
      'two': 2, 'to': 2, 'too': 2,
      'three': 3, 'tree': 3, 'free': 3,
      'four': 4, 'for': 4, 'fore': 4,
      'five': 5,
      'six': 6, 'sex': 6,
      'seven': 7,
      'eight': 8, 'ate': 8,
      'nine': 9,
      'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13,
      'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17,
      'eighteen': 18, 'nineteen': 19
    };

    const tens = {
      'twenty': 20, 'thirty': 30, 'forty': 40, 'fourty': 40,
      'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80,
      'ninety': 90
    };

    let s = text.toLowerCase();

    // 1. Compound tens: "twenty five" -> 25, "thirty two" -> 32
    for (const [tWord, tVal] of Object.entries(tens)) {
      for (const [sWord, sVal] of Object.entries(smalls)) {
        if (sVal > 0 && sVal < 10) {
          const re = new RegExp(`\\b${tWord}[ -]${sWord}\\b`, 'gi');
          s = s.replace(re, ` ${tVal + sVal} `);
        }
      }
      s = s.replace(new RegExp(`\\b${tWord}\\b`, 'gi'), ` ${tVal} `);
    }

    // 2. Hundreds: "two hundred" -> 200, "a hundred" -> 100
    for (const [sWord, sVal] of Object.entries(smalls)) {
      const re = new RegExp(`\\b(?:${sWord}|${sVal})\\s+hundred\\b`, 'gi');
      s = s.replace(re, ` ${sVal * 100} `);
    }
    s = s.replace(/\ba hundred\b/gi, ' 100 ');
    s = s.replace(/\bhundred\b/gi, ' 100 ');

    // 3. Thousands
    for (const [sWord, sVal] of Object.entries(smalls)) {
      const re = new RegExp(`\\b(?:${sWord}|${sVal})\\s+thousand\\b`, 'gi');
      s = s.replace(re, ` ${sVal * 1000} `);
    }

    // 4. Single digits & teens
    for (const [sWord, sVal] of Object.entries(smalls)) {
      s = s.replace(new RegExp(`\\b${sWord}\\b`, 'gi'), ` ${sVal} `);
    }

    // 5. Fractions & Decimals
    s = s.replace(/\bhalf\b/gi, ' 0.5 ');
    s = s.replace(/\bquarter\b/gi, ' 0.25 ');

    // Merge compound numbers like "100 25" -> "125" or "100 and 25" -> "125"
    s = s.replace(/\b([1-9]00)\s+(?:and\s+)?([1-9][0-9]?)\b/gi, (match, h, r) => {
      return String(parseInt(h) + parseInt(r));
    });

    return s;
  }

  static parseWordsToExpression(phrase) {
    if (!phrase || typeof phrase !== 'string') return null;
    let text = phrase.toLowerCase().trim();

    // 1. Control commands
    if (/^(clear|all clear|reset|wipe|erase)$/i.test(text)) {
      Calculator.clearAll();
      VoiceSynthesizer.speak('All cleared');
      return null;
    }

    if (/^(delete|backspace|remove|undo)$/i.test(text)) {
      Calculator.deleteLast();
      VoiceSynthesizer.speak('Deleted');
      return null;
    }

    if (/^(repeat|say again|speak again|what was that|repeat answer)$/i.test(text)) {
      Calculator.speakCurrentResult();
      return null;
    }

    if (/^(equals|calculate|solve|give me the answer)$/i.test(text)) {
      Calculator.calculate(true);
      return null;
    }

    // 2. Strip conversational preambles
    text = text.replace(/^(hey|hi|hello|please|can you|could you|what is|what's|calculate|solve|tell me|find|how much is)\s+/gi, '');
    text = text.replace(/\s+(please|thank you|thanks|equal|equals)$/gi, '');

    // 3. Math functions
    text = text.replace(/(?:square root of|sqrt of|square root|root of)\s*([0-9a-z.]+)/gi, 'sqrt($1)');
    text = text.replace(/([0-9a-z.]+)\s*(?:squared|to the power of 2)\b/gi, '($1^2)');
    text = text.replace(/([0-9a-z.]+)\s*(?:cubed|to the power of 3)\b/gi, '($1^3)');
    text = text.replace(/\b(?:to the power of|raised to|power of|power)\b/gi, '^');

    // 4. Percentage syntax: "15 percent of 200"
    text = text.replace(/([0-9a-z.]+)\s*(?:percent of|% of)\s*([0-9a-z.]+)/gi, '($1/100)*$2');

    // 5. Replace spoken operators
    text = text
      .replace(/\b(?:plus|add|added to)\b/gi, ' + ')
      .replace(/\b(?:negative)\b/gi, ' -')
      .replace(/\b(?:minus|subtract|subtracted by|take away|less)\b/gi, ' - ')
      .replace(/\b(?:times|multiplied by|multiply by|into|x|multiplied)\b/gi, ' * ')
      .replace(/\b(?:divided by|divide by|over|division)\b/gi, ' / ')
      .replace(/\b(?:open parenthesis|open bracket)\b/gi, ' ( ')
      .replace(/\b(?:close parenthesis|close bracket)\b/gi, ' ) ')
      .replace(/\b(?:point|dot)\b/gi, '.')
      .replace(/\bpercent\b/gi, '%');

    // Handle "and" between numbers: e.g. "2 and 2" -> "2 + 2"
    text = text.replace(/([0-9a-z])\s+and\s+([0-9a-z])/gi, '$1 + $2');

    // 6. Convert number words
    text = VoiceInterpreter.convertWordsToNumbers(text);

    // 7. Clean up all non-math characters
    let cleaned = text.replace(/\s+/g, '');
    cleaned = cleaned.replace(/[^0-9+\-*/().%^sqrt]/gi, '');
    cleaned = cleaned.replace(/=+$/, '');

    return cleaned || null;
  }

  static processCommand(transcript) {
    if (!transcript) return;

    elements.liveTranscript.textContent = `Heard: "${transcript}"`;
    const expr = VoiceInterpreter.parseWordsToExpression(transcript);

    if (!expr) {
      elements.voiceStatusText.textContent = 'Could not understand command';
      return;
    }

    elements.voiceStatusText.textContent = `Evaluating ${expr}`;
    Calculator.setExpression(expr);
    Calculator.calculate(true);
  }
}

// ==========================================
// SPEECH RECOGNITION (VOICE INPUT / STT)
// ==========================================
class VoiceRecognizer {
  constructor() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = SpeechRecognition ? new SpeechRecognition() : null;
    this.isManuallyStopped = false;
    this.isTemporarilyPaused = false;
    this.debounceTimer = null;
    this.lastProcessedText = '';

    if (this.recognition) {
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      this.setupListeners();
    }
  }

  setupListeners() {
    this.recognition.onstart = () => {
      state.isListening = true;
      PermissionManager.updateUI('granted');
      elements.micToggleBtn.classList.add('listening');
      elements.micBtnLabel.textContent = 'Listening (Speak now)...';
      elements.voiceStatusBadge.className = 'voice-badge listening';
      elements.voiceStatusText.textContent = 'Listening...';
      soundSynth.micStart();
    };

    this.recognition.onresult = (event) => {
      if (state.isSpeaking) return;

      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      const heardText = (final || interim).trim();
      if (heardText) {
        elements.liveTranscript.textContent = `Hearing: "${heardText}"`;
      }

      if (final) {
        clearTimeout(this.debounceTimer);
        this.lastProcessedText = final.trim();
        VoiceInterpreter.processCommand(final);
      } else if (interim) {
        // Debounce: evaluate when speech pauses for 650ms
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          if (interim.trim() && interim.trim() !== this.lastProcessedText) {
            this.lastProcessedText = interim.trim();
            VoiceInterpreter.processCommand(interim);
          }
        }, 650);
      }
    };

    this.recognition.onerror = (event) => {
      console.warn('SpeechRecognition error:', event.error);
      if (event.error === 'not-allowed') {
        PermissionManager.updateUI('denied');
        this.isManuallyStopped = true;
        this.updateUIStopped();
      } else if (event.error === 'no-speech') {
        elements.voiceStatusText.textContent = 'Listening (Waiting for speech)...';
      }
    };

    this.recognition.onend = () => {
      state.isListening = false;

      if (state.continuousListening && !this.isManuallyStopped && !this.isTemporarilyPaused) {
        setTimeout(() => {
          if (!state.isListening && !state.isSpeaking) {
            try {
              this.recognition.start();
            } catch (e) {}
          }
        }, 300);
      } else {
        this.updateUIStopped();
      }
    };
  }

  updateUIStopped() {
    elements.micToggleBtn.classList.remove('listening');
    elements.micBtnLabel.textContent = 'Tap to Speak';
    if (!state.isSpeaking) {
      elements.voiceStatusBadge.className = 'voice-badge';
      elements.voiceStatusText.textContent = 'Voice ready';
    }
  }

  pauseListening() {
    this.isTemporarilyPaused = true;
    if (this.recognition && state.isListening) {
      try {
        this.recognition.abort();
      } catch (e) {}
    }
  }

  resumeListening() {
    this.isTemporarilyPaused = false;
    if (this.recognition && !this.isManuallyStopped && !state.isListening) {
      try {
        this.recognition.start();
      } catch (e) {}
    }
  }

  start() {
    if (!this.recognition) {
      alert('Speech Recognition is not supported by your browser. Please open in Google Chrome or Microsoft Edge.');
      return;
    }

    this.isManuallyStopped = false;
    this.isTemporarilyPaused = false;
    try {
      this.recognition.start();
    } catch (e) {
      console.warn('Recognition already running:', e);
    }
  }

  stop() {
    this.isManuallyStopped = true;
    if (this.recognition && state.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    soundSynth.micStop();
    this.updateUIStopped();
  }

  toggle() {
    if (state.isListening) {
      this.stop();
    } else {
      this.start();
    }
  }
}

const voiceRecognizer = new VoiceRecognizer();

// ==========================================
// CALCULATOR CORE ENGINE & EVALUATOR
// ==========================================
class Calculator {
  // Format math expression into visually appealing typographic representation
  static formatDisplay(expr) {
    if (!expr) return '0';
    if (expr === 'Error' || expr === 'Cannot divide by 0') return expr;
    return expr
      .replace(/\*/g, ' × ')
      .replace(/\//g, ' ÷ ')
      .replace(/\+/g, ' + ')
      .replace(/(?<=\d|\))\-(?=\d|\()/g, ' − ')
      .replace(/\^/g, ' ^ ');
  }

  static updateUI() {
    elements.expressionDisplay.textContent = Calculator.formatDisplay(state.currentExpression);
    elements.prevExpressionDisplay.textContent = state.prevExpression
      ? Calculator.formatDisplay(state.prevExpression)
      : '\u00A0';

    const len = state.currentExpression.length;
    if (len > 22) {
      elements.expressionDisplay.style.fontSize = '1.25rem';
    } else if (len > 14) {
      elements.expressionDisplay.style.fontSize = '1.7rem';
    } else {
      elements.expressionDisplay.style.fontSize = '2.3rem';
    }
  }

  static appendNumber(num) {
    soundSynth.keyClick();
    if (state.isEvaluated || state.currentExpression === 'Error' || state.currentExpression === 'Cannot divide by 0') {
      state.currentExpression = num === '.' ? '0.' : num;
      state.isEvaluated = false;
    } else {
      if (state.currentExpression === '0' && num !== '.') {
        state.currentExpression = num;
      } else {
        if (num === '.') {
          const parts = state.currentExpression.split(/[\+\-\*\/\(\)\^]/);
          const currentPart = parts[parts.length - 1];
          if (currentPart.includes('.')) return;
        }
        state.currentExpression += num;
      }
    }
    Calculator.updateUI();
  }

  static appendOperator(op) {
    soundSynth.operatorClick();

    // If screen has an error, reset to 0 before operating
    if (state.currentExpression === 'Error' || state.currentExpression === 'Cannot divide by 0') {
      state.currentExpression = '0';
    }

    state.isEvaluated = false;

    // Handle leading minus
    if (state.currentExpression === '0' && op === '-') {
      state.currentExpression = '-';
      Calculator.updateUI();
      return;
    }

    const lastChar = state.currentExpression.slice(-1);

    if (['+', '-', '*', '/'].includes(lastChar)) {
      state.currentExpression = state.currentExpression.slice(0, -1) + op;
    } else {
      state.currentExpression += op;
    }
    Calculator.updateUI();
  }

  static appendParentheses() {
    soundSynth.keyClick();
    if (state.isEvaluated || state.currentExpression === 'Error' || state.currentExpression === 'Cannot divide by 0') {
      state.currentExpression = '(';
      state.isEvaluated = false;
      Calculator.updateUI();
      return;
    }

    const openCount = (state.currentExpression.match(/\(/g) || []).length;
    const closeCount = (state.currentExpression.match(/\)/g) || []).length;
    const lastChar = state.currentExpression.slice(-1);

    if (openCount > closeCount && !['+', '-', '*', '/', '(', '-'].includes(lastChar)) {
      state.currentExpression += ')';
    } else {
      if (state.currentExpression === '0') {
        state.currentExpression = '(';
      } else if (['+', '-', '*', '/', '('].includes(lastChar)) {
        state.currentExpression += '(';
      } else {
        state.currentExpression += '*(';
      }
    }
    Calculator.updateUI();
  }

  static appendPercent() {
    soundSynth.keyClick();
    if (state.currentExpression === 'Error' || state.currentExpression === 'Cannot divide by 0') return;

    const lastChar = state.currentExpression.slice(-1);
    if (!['+', '-', '*', '/', '%', '('].includes(lastChar)) {
      state.currentExpression += '%';
      Calculator.updateUI();
    }
  }

  static deleteLast() {
    soundSynth.keyClick();
    if (state.isEvaluated || state.currentExpression === 'Error' || state.currentExpression === 'Cannot divide by 0') {
      state.currentExpression = '0';
      state.isEvaluated = false;
    } else {
      state.currentExpression = state.currentExpression.slice(0, -1);
      if (state.currentExpression === '' || state.currentExpression === '-') {
        state.currentExpression = '0';
      }
    }
    Calculator.updateUI();
  }

  static clearAll() {
    soundSynth.keyClick();
    state.currentExpression = '0';
    state.prevExpression = '';
    state.isEvaluated = false;
    elements.liveTranscript.textContent = 'Cleared. Ready for voice or touch input.';
    Calculator.updateUI();
  }

  static setExpression(expr) {
    state.currentExpression = expr;
    state.isEvaluated = false;
    Calculator.updateUI();
  }

  // Safe Tokenizer & Mathematical Evaluator
  static evaluateMath(rawExpr) {
    try {
      let expr = String(rawExpr).trim();
      if (!expr || expr === 'Error' || expr === 'Cannot divide by 0') return '0';

      // Auto-strip trailing operators: "5 +" -> "5"
      expr = expr.replace(/[\+\-\*\/\^]+$/, '');

      // Auto-close missing parentheses: "(5 + 5" -> "(5 + 5)"
      const openP = (expr.match(/\(/g) || []).length;
      const closeP = (expr.match(/\)/g) || []).length;
      if (openP > closeP) {
        expr += ')'.repeat(openP - closeP);
      }

      // Standard calculator percentage logic:
      // "100 + 10%" -> "100 + (100 * (10 / 100))" = 110
      // "200 - 20%" -> "200 - (200 * (20 / 100))" = 160
      // "50 * 10%"  -> "50 * (10 / 100)" = 5
      expr = expr.replace(/([0-9.]+)\s*([\+\-])\s*([0-9.]+)%/g, '($1 $2 ($1 * ($3 / 100)))');
      expr = expr.replace(/([0-9.]+)\s*([\*\/])\s*([0-9.]+)%/g, '($1 $2 ($3 / 100))');
      expr = expr.replace(/([0-9.]+)%/g, '($1/100)');

      // Handle square roots
      expr = expr.replace(/sqrt\(([0-9.]+)\)/gi, 'Math.sqrt($1)');
      expr = expr.replace(/sqrt([0-9.]+)/gi, 'Math.sqrt($1)');

      // Handle implicit multiplication like 2(3) -> 2*(3) or (2)(3) -> (2)*(3)
      expr = expr.replace(/([0-9])\(/g, '$1*(');
      expr = expr.replace(/\)([0-9])/g, ')*$1');
      expr = expr.replace(/\)\(/g, ')*(');

      // Handle power ^
      expr = expr.replace(/\^/g, '**');

      // Safe character whitelist
      const sanitized = expr.replace(/Math\.sqrt/g, '');
      if (/[^0-9+\-*/().\s]/g.test(sanitized)) {
        throw new Error('Invalid math expression');
      }

      const compute = new Function(`'use strict'; return (${expr});`);
      let result = compute();

      if (typeof result !== 'number' || isNaN(result)) {
        throw new Error('Invalid calculation');
      }

      if (!isFinite(result)) {
        return 'Cannot divide by 0';
      }

      // Round to 10 decimal places to eliminate floating point quirks
      return parseFloat(result.toFixed(10));
    } catch (err) {
      console.warn('Math evaluation error:', err);
      return 'Error';
    }
  }

  static calculate(isFromVoice = false) {
    const rawExpression = state.currentExpression;
    const result = Calculator.evaluateMath(rawExpression);

    if (result === 'Error' || result === 'Cannot divide by 0') {
      soundSynth.errorSound();
      state.prevExpression = `${Calculator.formatDisplay(rawExpression)} =`;
      state.currentExpression = result;
      state.isEvaluated = true;
      Calculator.updateUI();

      if (isFromVoice || state.autoVoiceEnabled) {
        VoiceSynthesizer.speak(`Sorry, ${result}`);
      }
      return;
    }

    soundSynth.equalsClick();
    state.prevExpression = `${Calculator.formatDisplay(rawExpression)} =`;
    state.currentExpression = String(result);
    state.isEvaluated = true;
    Calculator.updateUI();

    // Record in History
    Calculator.addToHistory(rawExpression, result);

    // Speak result
    if (isFromVoice || state.autoVoiceEnabled) {
      const speechPhrase = `${rawExpression} equals ${result}`;
      VoiceSynthesizer.speak(speechPhrase);
    }
  }

  static speakCurrentResult() {
    if (state.currentExpression && state.currentExpression !== '0' && state.currentExpression !== 'Error') {
      const speech = state.prevExpression
        ? `${state.prevExpression} ${state.currentExpression}`
        : `The answer is ${state.currentExpression}`;
      VoiceSynthesizer.speak(speech);
    } else {
      VoiceSynthesizer.speak('Zero');
    }
  }

  // ==========================================
  // HISTORY MANAGEMENT
  // ==========================================
  static addToHistory(expr, result) {
    const item = {
      id: Date.now(),
      expression: expr,
      result: result,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    state.history.unshift(item);
    if (state.history.length > 30) state.history.pop();
    Calculator.saveHistory();
    Calculator.renderHistory();
  }

  static renderHistory() {
    if (state.history.length === 0) {
      elements.historyList.innerHTML = `
        <div class="empty-history">
          <span>📝</span>
          <p>No calculations yet. Speak or type a calculation!</p>
        </div>`;
      return;
    }

    elements.historyList.innerHTML = '';
    state.history.forEach(item => {
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `
        <div class="history-item-top">
          <span class="history-item-expr">${Calculator.formatDisplay(item.expression)} =</span>
          <span class="history-item-time" style="font-size: 0.72rem; color: var(--text-muted);">${item.timestamp}</span>
        </div>
        <div class="history-item-res">${item.result}</div>
        <div class="history-item-actions">
          <button class="history-item-speak" title="Speak this calculation">🔊 Repeat</button>
        </div>
      `;

      div.addEventListener('click', (e) => {
        if (e.target.classList.contains('history-item-speak')) {
          e.stopPropagation();
          VoiceSynthesizer.speak(`${item.expression} equals ${item.result}`);
          return;
        }
        state.currentExpression = String(item.result);
        state.prevExpression = `${Calculator.formatDisplay(item.expression)} =`;
        state.isEvaluated = true;
        Calculator.updateUI();
      });

      elements.historyList.appendChild(div);
    });
  }

  static saveHistory() {
    try {
      localStorage.setItem('voicecalc_history', JSON.stringify(state.history));
    } catch (e) {}
  }

  static loadHistory() {
    try {
      const saved = localStorage.getItem('voicecalc_history');
      if (saved) {
        state.history = JSON.parse(saved);
        Calculator.renderHistory();
      }
    } catch (e) {}
  }

  static clearHistory() {
    soundSynth.keyClick();
    state.history = [];
    Calculator.saveHistory();
    Calculator.renderHistory();
  }
}

// ==========================================
// USER SETTINGS & LOCAL STORAGE
// ==========================================
function loadSettings() {
  try {
    const autoVoice = localStorage.getItem('voicecalc_autoVoice');
    if (autoVoice !== null) {
      state.autoVoiceEnabled = autoVoice === 'true';
      updateAutoVoiceUI();
    }

    const continuous = localStorage.getItem('voicecalc_continuous');
    if (continuous !== null) {
      state.continuousListening = continuous === 'true';
      elements.continuousSwitch.checked = state.continuousListening;
    } else {
      elements.continuousSwitch.checked = true;
    }

    const sounds = localStorage.getItem('voicecalc_sounds');
    if (sounds !== null) {
      state.soundEffectsEnabled = sounds === 'true';
      elements.soundEffectsSwitch.checked = state.soundEffectsEnabled;
    }

    const rate = localStorage.getItem('voicecalc_rate');
    if (rate !== null) {
      state.speechRate = parseFloat(rate);
      elements.rateRange.value = state.speechRate;
      elements.rateVal.textContent = `${state.speechRate}x`;
    }

    const pitch = localStorage.getItem('voicecalc_pitch');
    if (pitch !== null) {
      state.speechPitch = parseFloat(pitch);
      elements.pitchRange.value = state.speechPitch;
      elements.pitchVal.textContent = state.speechPitch;
    }
  } catch (e) {}
}

function updateAutoVoiceUI() {
  if (state.autoVoiceEnabled) {
    elements.autoVoiceToggle.classList.add('active');
    elements.autoVoiceToggle.textContent = '🗣️ Auto-Voice: ON';
  } else {
    elements.autoVoiceToggle.classList.remove('active');
    elements.autoVoiceToggle.textContent = '🔇 Auto-Voice: OFF';
  }
}

// ==========================================
// EVENT LISTENERS INITIALIZATION
// ==========================================
function initEventListeners() {
  // Keypad clicks
  document.querySelectorAll('.key.num').forEach(btn => {
    btn.addEventListener('click', () => {
      Calculator.appendNumber(btn.getAttribute('data-num'));
    });
  });

  document.querySelectorAll('.key.operator').forEach(btn => {
    btn.addEventListener('click', () => {
      Calculator.appendOperator(btn.getAttribute('data-operator'));
    });
  });

  document.querySelectorAll('.key.function').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      if (action === 'clear') Calculator.clearAll();
      if (action === 'delete') Calculator.deleteLast();
      if (action === 'parentheses') Calculator.appendParentheses();
      if (action === 'percent') Calculator.appendPercent();
    });
  });

  document.querySelector('.key.equals').addEventListener('click', () => {
    Calculator.calculate(false);
  });

  // Physical Keyboard Support
  window.addEventListener('keydown', (e) => {
    if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.'].includes(e.key)) {
      Calculator.appendNumber(e.key);
    } else if (['+', '-', '*', '/'].includes(e.key)) {
      Calculator.appendOperator(e.key);
    } else if (e.key === 'Enter' || e.key === '=') {
      e.preventDefault();
      Calculator.calculate(false);
    } else if (e.key === 'Backspace') {
      Calculator.deleteLast();
    } else if (e.key === 'Escape') {
      Calculator.clearAll();
    } else if (e.key === '(' || e.key === ')') {
      Calculator.appendParentheses();
    } else if (e.key === '%') {
      Calculator.appendPercent();
    }
  });

  // Voice Controls
  elements.micToggleBtn.addEventListener('click', () => {
    voiceRecognizer.toggle();
  });

  elements.speakResultBtn.addEventListener('click', () => {
    Calculator.speakCurrentResult();
  });

  elements.autoVoiceToggle.addEventListener('click', () => {
    state.autoVoiceEnabled = !state.autoVoiceEnabled;
    try {
      localStorage.setItem('voicecalc_autoVoice', state.autoVoiceEnabled);
    } catch (e) {}
    updateAutoVoiceUI();
  });

  // Permissions
  elements.requestPermBtn.addEventListener('click', () => {
    voiceRecognizer.start();
  });

  elements.permissionBtn.addEventListener('click', () => {
    voiceRecognizer.toggle();
  });

  elements.dismissBannerBtn.addEventListener('click', () => {
    elements.permissionBanner.classList.add('hidden');
  });

  // Help Chips
  elements.helpChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const text = chip.textContent.replace(/["']/g, '');
      VoiceInterpreter.processCommand(text);
    });
  });

  // History Drawer Toggle
  elements.historyToggleBtn.addEventListener('click', () => {
    const isOpen = elements.historyPanel.classList.toggle('open');
    elements.calculatorLayout.classList.toggle('has-history', isOpen);
  });

  elements.closeHistoryBtn.addEventListener('click', () => {
    elements.historyPanel.classList.remove('open');
    elements.calculatorLayout.classList.remove('has-history');
  });

  elements.clearHistoryBtn.addEventListener('click', () => {
    Calculator.clearHistory();
  });

  // Settings Modal
  elements.settingsToggleBtn.addEventListener('click', () => {
    elements.settingsModal.classList.remove('hidden');
  });

  elements.closeSettingsBtn.addEventListener('click', () => {
    elements.settingsModal.classList.add('hidden');
  });

  elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) {
      elements.settingsModal.classList.add('hidden');
    }
  });

  elements.voiceSelect.addEventListener('change', (e) => {
    const idx = parseInt(e.target.value);
    state.selectedVoice = state.availableVoices[idx] || null;
  });

  elements.rateRange.addEventListener('input', (e) => {
    state.speechRate = parseFloat(e.target.value);
    elements.rateVal.textContent = `${state.speechRate}x`;
    localStorage.setItem('voicecalc_rate', state.speechRate);
  });

  elements.pitchRange.addEventListener('input', (e) => {
    state.speechPitch = parseFloat(e.target.value);
    elements.pitchVal.textContent = state.speechPitch;
    localStorage.setItem('voicecalc_pitch', state.speechPitch);
  });

  elements.continuousSwitch.addEventListener('change', (e) => {
    state.continuousListening = e.target.checked;
    localStorage.setItem('voicecalc_continuous', state.continuousListening);
    if (!state.continuousListening && state.isListening) {
      voiceRecognizer.stop();
    }
  });

  elements.soundEffectsSwitch.addEventListener('change', (e) => {
    state.soundEffectsEnabled = e.target.checked;
    localStorage.setItem('voicecalc_sounds', state.soundEffectsEnabled);
  });

  elements.testVoiceBtn.addEventListener('click', () => {
    VoiceSynthesizer.speak('Hello! Voice output is working loud and clear.');
  });
}

// ==========================================
// BOOTSTRAP APPLICATION
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
  VoiceSynthesizer.init();
  Calculator.updateUI();
  Calculator.loadHistory();
  loadSettings();
  initEventListeners();
  await PermissionManager.checkStatus();
});
