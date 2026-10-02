/**
 * AIRWAVE PRO - Web Audio Studio Engine
 * Full-featured broadcast mixer, Winamp 10-band EQ, Auto-Ducker, Voice FX,
 * Procedural Jingles & Synthwave generator.
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.isInitialized = false;

    // Nodes
    this.masterGain = null;
    this.musicGain = null;
    this.micGain = null;
    this.jingleGain = null;
    this.balanceNode = null;
    this.preampNode = null;

    // 10-band Equalizer
    this.eqFrequencies = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    this.eqFilters = [];
    this.eqEnabled = true;

    // Visualizers & Analysers
    this.analyser = null;
    this.leftAnalyser = null;
    this.rightAnalyser = null;
    this.micAnalyser = null;

    // Mic & Broadcast
    this.micStream = null;
    this.micSource = null;
    this.micActive = false;
    this.voiceFxMode = 'clean'; // 'clean', 'radio', 'studio', 'echo', 'robot'
    this.voiceFxNodes = {};

    // Auto-ducking (Talkover)
    this.autoDuckingEnabled = true;
    this.duckingThreshold = 0.05; // Mic level threshold to trigger ducking
    this.duckingAmount = 0.50; // Balanced background music volume (50%) when talking
    this.isDucking = false;
    this.duckingReleaseTimer = null;
    this.duckingMonitorId = null;

    // Media element player for live streams / external URLs
    this.audioElement = null;
    this.mediaSourceNode = null;

    // Buffer source player for local audio files (enables pitch/speed, accurate seek)
    this.bufferSource = null;
    this.currentAudioBuffer = null;
    this.bufferStartTime = 0;
    this.bufferPauseOffset = 0;
    this.playbackRate = 1.0;
    this.isPlayingBuffer = false;

    // Broadcast stream destination & Recorder
    this.broadcastDest = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.isOnAir = false;

    // Real-time live mix inter-tab channel and WS
    this.liveChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('khanza_radio_live_mix') : null;
    this.ws = null;
    this.nextPcmTime = 0;
    this.micProcessor = null;
    this.micProcessorDummy = null;

    // Callbacks
    this.onTrackEnded = null;
    this.onMicLevel = null;
    this.onDuckingStateChange = null;
  }

  // Attach WebSocket connection for live event streaming
  setWebSocket(ws) {
    this.ws = ws;
  }

  // Broadcast event to both same-machine tabs (BroadcastChannel) and external network listeners (WebSocket)
  broadcastLiveEvent(event) {
    if (this.liveChannel) {
      try {
        this.liveChannel.postMessage(event);
      } catch (e) {}
    }
    if (this.ws && this.ws.readyState === 1) { // 1 = WebSocket.OPEN
      try {
        this.ws.send(JSON.stringify(event));
      } catch (e) {}
    }
  }

  // Play real-time raw PCM float32 samples from DJ's mic on listener side
  playPcmChunk(pcmData, sampleRate) {
    this.init();
    if (!this.ctx) return;
    try {
      const float32 = pcmData instanceof Float32Array ? pcmData : new Float32Array(pcmData);
      const buffer = this.ctx.createBuffer(1, float32.length, sampleRate || this.ctx.sampleRate);
      buffer.copyToChannel(float32, 0);

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;

      // Clean, natural vocal channel on listener — no compressor to avoid pumping/echo artifacts
      if (!this.listenerVoiceGain) {
        this.listenerVoiceGain = this.ctx.createGain();
        this.listenerVoiceGain.gain.value = 1.0; // Unity gain — natural level, no artificial boost

        // High-pass filter at 80 Hz to remove sub-bass rumble and breath pops
        this.voiceLowCut = this.ctx.createBiquadFilter();
        this.voiceLowCut.type = 'highpass';
        this.voiceLowCut.frequency.value = 80;
        this.voiceLowCut.Q.value = 0.7; // Gentle slope, no resonant peak

        // Subtle low-shelf warmth at 200 Hz for natural voice body/bass (+1.5 dB)
        this.voiceWarmth = this.ctx.createBiquadFilter();
        this.voiceWarmth.type = 'lowshelf';
        this.voiceWarmth.frequency.value = 200;
        this.voiceWarmth.gain.value = 1.5;

        // Presence peak at 3 kHz for vocal clarity and intelligibility (+2.5 dB)
        this.voicePresence = this.ctx.createBiquadFilter();
        this.voicePresence.type = 'peaking';
        this.voicePresence.frequency.value = 3000;
        this.voicePresence.Q.value = 1.0;
        this.voicePresence.gain.value = 2.5;

        // De-esser: gentle high-shelf cut above 7.5 kHz to tame sibilance (-1.5 dB)
        this.voiceDeEss = this.ctx.createBiquadFilter();
        this.voiceDeEss.type = 'highshelf';
        this.voiceDeEss.frequency.value = 7500;
        this.voiceDeEss.gain.value = -1.5;

        this.listenerVoiceGain.connect(this.voiceLowCut);
        this.voiceLowCut.connect(this.voiceWarmth);
        this.voiceWarmth.connect(this.voicePresence);
        this.voicePresence.connect(this.voiceDeEss);
        this.voiceDeEss.connect(this.masterGain);
      }

      source.connect(this.listenerVoiceGain);

      const now = this.ctx.currentTime;
      const targetJitter = 0.07; // 70ms target jitter window

      // Check if queue has run dry (pause between sentences > 90ms)
      if (!this.nextPcmTime || (now - this.nextPcmTime) > 0.09) {
        this.nextPcmTime = now + targetJitter;
      } else if (this.nextPcmTime < now) {
        // Mild network drift: schedule at current time immediately without inserting silence gap
        this.nextPcmTime = now;
      }

      source.start(this.nextPcmTime);
      this.nextPcmTime += buffer.duration;
    } catch (err) {
      console.warn('Error playing PCM audio chunk:', err);
    }
  }

  // Initialize AudioContext on first user interaction
  init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext({ latencyHint: 'interactive' });

    // Master Destination and Broadcast Split
    this.broadcastDest = this.ctx.createMediaStreamDestination();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;

    // Dedicated Local Speaker Monitor Gain (allows DJ to mute local laptop speakers while broadcast continues!)
    this.localMonitorGain = this.ctx.createGain();
    this.localMonitorGain.gain.value = 1.0;
    this.isMonitorMuted = false;

    // Connect master to local speakers via localMonitorGain, AND to broadcast stream destination independently!
    this.masterGain.connect(this.localMonitorGain);
    this.localMonitorGain.connect(this.ctx.destination);
    this.masterGain.connect(this.broadcastDest);

    // Master Analysers for Spectrum & Stereo VU
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.82;

    const splitter = this.ctx.createChannelSplitter(2);
    this.leftAnalyser = this.ctx.createAnalyser();
    this.rightAnalyser = this.ctx.createAnalyser();
    this.leftAnalyser.fftSize = 128;
    this.rightAnalyser.fftSize = 128;

    this.masterGain.connect(this.analyser);
    this.masterGain.connect(splitter);
    splitter.connect(this.leftAnalyser, 0);
    splitter.connect(this.rightAnalyser, 1);

    // Music Channel (Winamp player deck)
    this.preampNode = this.ctx.createGain();
    this.preampNode.gain.value = 1.0;

    // Setup 10-band Graphic EQ
    let prevFilter = this.preampNode;
    this.eqFilters = this.eqFrequencies.map((freq) => {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.4;
      filter.gain.value = 0;
      prevFilter.connect(filter);
      prevFilter = filter;
      return filter;
    });

    // Balance (Pan) and Music Volume Gain
    if (this.ctx.createStereoPanner) {
      this.balanceNode = this.ctx.createStereoPanner();
      this.balanceNode.pan.value = 0;
      prevFilter.connect(this.balanceNode);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.85;
      this.balanceNode.connect(this.musicGain);
    } else {
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.85;
      prevFilter.connect(this.musicGain);
    }

    this.musicGain.connect(this.masterGain);

    // Mic Channel
    this.micGain = this.ctx.createGain();
    this.micGain.gain.value = 1.2;
    this.micGain.connect(this.masterGain);

    this.micAnalyser = this.ctx.createAnalyser();
    this.micAnalyser.fftSize = 128;

    // Jingles & Soundboard Channel
    this.jingleGain = this.ctx.createGain();
    this.jingleGain.gain.value = 0.9;
    this.jingleGain.connect(this.masterGain);

    // HTML5 Audio Element for web radio streams
    this.audioElement = new Audio();
    this.audioElement.crossOrigin = 'anonymous';
    this.audioElement.preload = 'metadata';

    try {
      this.mediaSourceNode = this.ctx.createMediaElementSource(this.audioElement);
      this.mediaSourceNode.connect(this.preampNode);
    } catch (e) {
      console.warn('MediaElementSource initialization fallback:', e);
    }

    this.audioElement.addEventListener('ended', () => {
      if (this.onTrackEnded) {
        const dur = this.audioElement.duration;
        const cur = this.audioElement.currentTime;
        if (dur > 0 && cur >= (dur - 1.5)) {
          this.onTrackEnded();
        } else if (dur === 0 || isNaN(dur)) {
          this.onTrackEnded();
        }
      }
    });

    this.isInitialized = true;
    this.startAutoDuckingLoop();
    this.preloadSfxPack();
  }

  // Set Master Volume (0.0 to 1.0)
  setMasterVolume(val) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
    }
  }

  // Mute only the local laptop/studio speakers (Broadcast output to listeners stays playing!)
  setStudioMonitorMute(isMuted) {
    this.isMonitorMuted = isMuted;
    if (this.localMonitorGain && this.ctx) {
      this.localMonitorGain.gain.setTargetAtTime(isMuted ? 0 : 1.0, this.ctx.currentTime, 0.03);
    }
    this.broadcastLiveEvent({ type: 'DJ_SPK_MUTE', isMuted });
  }

  // Set Music Player Volume (0.0 to 1.0)
  setMusicVolume(val) {
    if (this.musicGain && this.ctx && !this.isDucking) {
      this.musicGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
    }
  }

  // Set Stereo Balance (-1.0 to +1.0)
  setBalance(val) {
    if (this.balanceNode && this.ctx) {
      this.balanceNode.pan.setTargetAtTime(val, this.ctx.currentTime, 0.05);
    }
  }

  // Set Preamp Gain in dB (-12 to +12)
  setPreamp(db) {
    if (this.preampNode && this.ctx) {
      const gainVal = Math.pow(10, db / 20);
      this.preampNode.gain.setTargetAtTime(gainVal, this.ctx.currentTime, 0.05);
    }
  }

  // Set individual EQ band gain in dB (-12 to +12)
  setEqBand(index, db) {
    if (this.eqFilters[index] && this.ctx) {
      this.eqFilters[index].gain.setTargetAtTime(
        this.eqEnabled ? db : 0,
        this.ctx.currentTime,
        0.05
      );
    }
  }

  // Enable/Disable EQ
  setEqEnabled(enabled, gains = []) {
    this.eqEnabled = enabled;
    if (this.ctx) {
      this.eqFilters.forEach((filter, i) => {
        const target = enabled ? (gains[i] !== undefined ? gains[i] : 0) : 0;
        filter.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
      });
    }
  }

  // Play audio file from ArrayBuffer / File
  async playAudioBuffer(buffer, offset = 0) {
    this.init();
    this.stopPlayback();

    this.currentAudioBuffer = buffer;
    this.bufferSource = this.ctx.createBufferSource();
    this.bufferSource.buffer = buffer;
    this.bufferSource.playbackRate.value = this.playbackRate;
    this.bufferSource.connect(this.preampNode);

    this.bufferStartTime = this.ctx.currentTime - offset;
    this.bufferPauseOffset = offset;
    this.isPlayingBuffer = true;

    this.bufferSource.onended = () => {
      if (this.isPlayingBuffer && this.ctx.currentTime >= this.bufferStartTime + (buffer.duration / this.playbackRate) - 0.2) {
        this.isPlayingBuffer = false;
        if (this.onTrackEnded) this.onTrackEnded();
      }
    };

    this.bufferSource.start(0, offset);
  }

  // Play audio from URL (Stream or remote MP3)
  playStreamUrl(url) {
    this.init();
    this.stopPlayback();

    this.isPlayingBuffer = false;
    this.audioElement.src = url;
    this.audioElement.play().catch(e => {
      console.warn('Stream play error:', e);
    });
  }

  pausePlayback() {
    if (this.isPlayingBuffer && this.bufferSource) {
      this.bufferPauseOffset = this.ctx.currentTime - this.bufferStartTime;
      this.isPlayingBuffer = false;
      try { this.bufferSource.stop(); } catch (e) {}
      this.bufferSource = null;
    } else if (this.audioElement) {
      this.audioElement.pause();
    }
  }

  resumePlayback() {
    if (this.currentAudioBuffer) {
      this.playAudioBuffer(this.currentAudioBuffer, this.bufferPauseOffset);
    } else if (this.audioElement && this.audioElement.src) {
      this.audioElement.play().catch(console.warn);
    }
  }

  stopPlayback() {
    if (this.isPlayingBuffer && this.bufferSource) {
      this.isPlayingBuffer = false;
      try { this.bufferSource.stop(); } catch (e) {}
      this.bufferSource = null;
    }
    this.bufferPauseOffset = 0;
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
  }

  seekPlayback(timeInSeconds) {
    if (this.isPlayingBuffer && this.currentAudioBuffer) {
      this.playAudioBuffer(this.currentAudioBuffer, timeInSeconds);
    } else if (this.audioElement && this.audioElement.duration) {
      this.audioElement.currentTime = timeInSeconds;
    }
    this.broadcastLiveEvent({ type: 'TRACK_SEEK', time: timeInSeconds });
  }

  setPlaybackRate(rate) {
    this.playbackRate = Math.max(0.5, Math.min(2.0, rate));
    if (this.bufferSource) {
      this.bufferSource.playbackRate.setTargetAtTime(this.playbackRate, this.ctx.currentTime, 0.05);
    }
    if (this.audioElement) {
      this.audioElement.playbackRate = this.playbackRate;
    }
  }

  getCurrentTime() {
    if (this.isPlayingBuffer && this.ctx) {
      return (this.ctx.currentTime - this.bufferStartTime) * this.playbackRate;
    }
    if (this.audioElement) {
      return this.audioElement.currentTime;
    }
    return 0;
  }

  getDuration() {
    if (this.currentAudioBuffer) {
      return this.currentAudioBuffer.duration;
    }
    if (this.audioElement && !isNaN(this.audioElement.duration)) {
      return this.audioElement.duration;
    }
    return 0;
  }

  // ==========================================
  // MICROPHONE & VOICE FX STUDIO
  // ==========================================
  async startMicrophone() {
    this.init();
    if (this.micActive) return true;

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.micSource = this.ctx.createMediaStreamSource(this.micStream);
      this.setupVoiceFxChain();
      this.micActive = true;
      this.startLiveStreamRelay();
      this.broadcastLiveEvent({ type: 'MIC_STATUS', active: true });
      return true;
    } catch (err) {
      console.error('Microphone access denied or error:', err);
      throw err;
    }
  }

  stopMicrophone() {
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    if (this.micSource) {
      try { this.micSource.disconnect(); } catch (e) {}
      this.micSource = null;
    }
    if (this.micProcessor) {
      try { this.micProcessor.disconnect(); } catch (e) {}
      this.micProcessor = null;
    }
    if (this.micProcessorDummy) {
      try { this.micProcessorDummy.disconnect(); } catch (e) {}
      this.micProcessorDummy = null;
    }
    this.micActive = false;
    this.broadcastLiveEvent({ type: 'MIC_STATUS', active: false });
    this.broadcastLiveEvent({ type: 'MIC_DUCKING', isDucking: false });
  }

  setMicGain(val) {
    if (this.micGain && this.ctx) {
      this.micGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
    }
  }

  setVoiceFx(mode) {
    this.voiceFxMode = mode;
    if (this.micActive && this.micSource) {
      this.setupVoiceFxChain();
    }
  }

  setupVoiceFxChain() {
    if (!this.micSource || !this.ctx) return;

    try {
      this.micSource.disconnect();
    } catch (e) {}

    // Clean previous FX nodes
    Object.values(this.voiceFxNodes).forEach(node => {
      try { node.disconnect(); } catch (e) {}
    });
    this.voiceFxNodes = {};

    let lastNode = this.micSource;

    if (this.voiceFxMode === 'radio') {
      // Bandpass telephone/radio announcer sound
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 550;

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3200;

      const boost = this.ctx.createBiquadFilter();
      boost.type = 'peaking';
      boost.frequency.value = 1800;
      boost.gain.value = 7;

      lastNode.connect(hp);
      hp.connect(lp);
      lp.connect(boost);
      lastNode = boost;
      this.voiceFxNodes = { hp, lp, boost };

    } else if (this.voiceFxMode === 'studio') {
      // Warm broadcast voice: compressor + warm low end
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -24;
      comp.knee.value = 15;
      comp.ratio.value = 4;
      comp.attack.value = 0.005;
      comp.release.value = 0.2;

      const warmth = this.ctx.createBiquadFilter();
      warmth.type = 'lowshelf';
      warmth.frequency.value = 180;
      warmth.gain.value = 4.5;

      const air = this.ctx.createBiquadFilter();
      air.type = 'highshelf';
      air.frequency.value = 8000;
      air.gain.value = 3;

      lastNode.connect(warmth);
      warmth.connect(air);
      air.connect(comp);
      lastNode = comp;
      this.voiceFxNodes = { warmth, air, comp };

    } else if (this.voiceFxMode === 'echo') {
      // DJ Delay / Echo
      const delay = this.ctx.createDelay(1.0);
      delay.delayTime.value = 0.24;

      const feedback = this.ctx.createGain();
      feedback.gain.value = 0.45;

      const delayFilter = this.ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.value = 3000;

      const dryGain = this.ctx.createGain();
      dryGain.gain.value = 1.0;
      const wetGain = this.ctx.createGain();
      wetGain.gain.value = 0.6;

      lastNode.connect(dryGain);
      lastNode.connect(delay);
      delay.connect(delayFilter);
      delayFilter.connect(feedback);
      feedback.connect(delay);
      delayFilter.connect(wetGain);

      const merger = this.ctx.createGain();
      dryGain.connect(merger);
      wetGain.connect(merger);

      lastNode = merger;
      this.voiceFxNodes = { delay, feedback, delayFilter, dryGain, wetGain, merger };

    } else if (this.voiceFxMode === 'robot') {
      // Ring modulator style robot voice
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 65;
      osc.start();

      const modGain = this.ctx.createGain();
      modGain.gain.value = 0.8;

      lastNode.connect(modGain.gain);
      osc.connect(modGain);
      lastNode = modGain;
      this.voiceFxNodes = { osc, modGain };
    }

    // Connect to mic analyser and mic master gain
    lastNode.connect(this.micAnalyser);
    lastNode.connect(this.micGain);

    // Setup live PCM streamer to listeners AFTER micGain so DJ's mic gain slider directly amplifies the broadcast stream!
    this.setupMicStreamProcessor(this.micGain);
  }

  // Real-time PCM Voice Streamer from DJ Mic to Listeners
  setupMicStreamProcessor(node) {
    if (!this.ctx || !node) return;
    try {
      if (this.micProcessor) this.micProcessor.disconnect();
      if (this.micProcessorDummy) this.micProcessorDummy.disconnect();
    } catch (e) {}

    try {
      let silenceHangover = 0;
      const HANGOVER_MAX = 15; // ~700ms hangover to prevent word cutoffs
      let wasActive = false; // Track silence→voice transition for fade-in

      this.micProcessor = this.ctx.createScriptProcessor(2048, 1, 1);
      this.micProcessor.onaudioprocess = (e) => {
        if (!this.micActive) return;
        const inputData = e.inputBuffer.getChannelData(0);

        let maxAmp = 0;
        for (let i = 0; i < inputData.length; i++) {
          const abs = Math.abs(inputData[i]);
          if (abs > maxAmp) maxAmp = abs;
        }

        if (maxAmp > 0.003) {
          silenceHangover = HANGOVER_MAX;
        } else if (silenceHangover > 0) {
          silenceHangover--;
        }

        const isActive = silenceHangover > 0;

        if (isActive) {
          const samples = new Float32Array(inputData.length);
          // Transparent soft-limiter (only engages above 0.92 to prevent clipping)
          for (let i = 0; i < inputData.length; i++) {
            let s = inputData[i];
            if (s > 0.92) s = 0.92 + (s - 0.92) * 0.2;
            else if (s < -0.92) s = -0.92 + (s + 0.92) * 0.2;
            samples[i] = s;
          }

          // Only apply fade-in on silence→voice transition (first chunk after silence)
          // No fade-out on continuous chunks — avoids rhythmic tremolo/echo
          if (!wasActive) {
            const taper = 16;
            for (let i = 0; i < taper && i < samples.length; i++) {
              samples[i] *= i / taper;
            }
          }

          // Apply gentle fade-out only on the very last hangover chunk (voice→silence)
          if (silenceHangover === 1) {
            const taper = 16;
            for (let i = 0; i < taper && i < samples.length; i++) {
              samples[samples.length - 1 - i] *= i / taper;
            }
          }

          this.broadcastLiveEvent({
            type: 'MIC_PCM',
            pcm: Array.from(samples),
            sampleRate: this.ctx.sampleRate
          });
        }

        wasActive = isActive;
      };

      node.connect(this.micProcessor);
      this.micProcessorDummy = this.ctx.createGain();
      this.micProcessorDummy.gain.value = 0;
      this.micProcessor.connect(this.micProcessorDummy);
      this.micProcessorDummy.connect(this.ctx.destination);
    } catch (err) {
      console.warn('ScriptProcessor setup fallback:', err);
    }
  }

  // ==========================================
  // AUTO-DUCKING (TALKOVER) ENGINE
  // ==========================================
  // Enable or disable auto-ducking dynamically
  setAutoDucking(enabled) {
    this.autoDuckingEnabled = !!enabled;
    if (!this.autoDuckingEnabled) {
      if (this.duckingReleaseTimer) {
        clearTimeout(this.duckingReleaseTimer);
        this.duckingReleaseTimer = null;
      }
      this.isDucking = false;
      if (this.musicGain && this.ctx) {
        this.musicGain.gain.setTargetAtTime(0.85, this.ctx.currentTime, 0.05);
      }
      if (this.onDuckingStateChange) this.onDuckingStateChange(false);
      this.broadcastLiveEvent({ type: 'MIC_DUCKING', isDucking: false });
      this.broadcastLiveEvent({ type: 'AUTO_DUCKING_CONFIG', enabled: false });
    } else {
      this.broadcastLiveEvent({ type: 'AUTO_DUCKING_CONFIG', enabled: true });
    }
  }

  startAutoDuckingLoop() {
    if (this.duckingMonitorId) return;

    const micData = new Uint8Array(64);
    const checkDucking = () => {
      if (this.micActive && this.micAnalyser) {
        this.micAnalyser.getByteTimeDomainData(micData);

        // Calculate RMS
        let sum = 0;
        for (let i = 0; i < micData.length; i++) {
          const val = (micData[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / micData.length);

        // Always update mic VU level so meter continues moving
        if (this.onMicLevel) {
          this.onMicLevel(rms);
        }

        // Only duck music if auto-ducking is explicitly enabled
        if (this.autoDuckingEnabled) {
          if (rms > this.duckingThreshold) {
            // Voice detected! Duck the music smoothly to 50%
            if (!this.isDucking) {
              this.isDucking = true;
              if (this.musicGain && this.ctx) {
                this.musicGain.gain.setTargetAtTime(this.duckingAmount, this.ctx.currentTime, 0.08);
              }
              if (this.onDuckingStateChange) this.onDuckingStateChange(true);
              this.broadcastLiveEvent({ type: 'MIC_DUCKING', isDucking: true });
            }

            if (this.duckingReleaseTimer) {
              clearTimeout(this.duckingReleaseTimer);
              this.duckingReleaseTimer = null;
            }
          } else if (this.isDucking && !this.duckingReleaseTimer) {
            // Release ducking after 400ms of silence
            this.duckingReleaseTimer = setTimeout(() => {
              this.isDucking = false;
              if (this.musicGain && this.ctx) {
                this.musicGain.gain.setTargetAtTime(0.85, this.ctx.currentTime, 0.25);
              }
              if (this.onDuckingStateChange) this.onDuckingStateChange(false);
              this.broadcastLiveEvent({ type: 'MIC_DUCKING', isDucking: false });
              this.duckingReleaseTimer = null;
            }, 400);
          }
        } else {
          // If auto-ducking is disabled, ensure music volume stays 100% normal/stable
          if (this.isDucking) {
            this.isDucking = false;
            if (this.musicGain && this.ctx) {
              this.musicGain.gain.setTargetAtTime(0.85, this.ctx.currentTime, 0.05);
            }
            if (this.onDuckingStateChange) this.onDuckingStateChange(false);
            this.broadcastLiveEvent({ type: 'MIC_DUCKING', isDucking: false });
          }
        }
      }

      this.duckingMonitorId = requestAnimationFrame(checkDucking);
    };

    this.duckingMonitorId = requestAnimationFrame(checkDucking);
  }

  // Play genuine recorded real audio sound effect through radio engine & broadcast
  playRealSfx(name) {
    this.init();
    if (!this.ctx) return;
    const url = `/sfx/${name}.mp3`;
    if (!this.sfxCache) this.sfxCache = {};

    if (this.sfxCache[url]) {
      try {
        const source = this.ctx.createBufferSource();
        source.buffer = this.sfxCache[url];
        source.connect(this.jingleGain);
        source.start(this.ctx.currentTime);
        return;
      } catch (e) {}
    }

    // Direct fetch & decode + immediate playback
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.arrayBuffer();
      })
      .then(ab => this.ctx.decodeAudioData(ab))
      .then(buffer => {
        this.sfxCache[url] = buffer;
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.jingleGain);
        source.start(this.ctx.currentTime);
      })
      .catch(() => {
        // Fallback to HTML5 audio element
        try {
          const audio = new Audio(url);
          audio.volume = 0.95;
          audio.play().catch(() => {});
        } catch (e) {}
      });
  }

  // Preload common real sound effects into memory for instant 0ms playback
  preloadSfxPack() {
    if (!this.ctx || this.hasPreloadedSfx) return;
    this.hasPreloadedSfx = true;
    const list = ['applause', 'boo', 'gasp', 'tada', 'victory', 'wrong'];
    list.forEach(name => {
      const url = `/sfx/${name}.mp3`;
      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error();
          return res.arrayBuffer();
        })
        .then(ab => this.ctx.decodeAudioData(ab))
        .then(buf => {
          if (!this.sfxCache) this.sfxCache = {};
          this.sfxCache[url] = buf;
        })
        .catch(() => {});
    });
  }

  // ==========================================
  // SOUNDBOARD / JINGLES SYNTHESIZER
  // ==========================================
  playJingle(id, isRemote = false) {
    this.init();
    if (!isRemote) {
      this.startLiveStreamRelay();
      this.broadcastLiveEvent({
        type: 'JINGLE_TRIGGER',
        id,
        timestamp: Date.now()
      });
    }

    const t = this.ctx.currentTime;

    switch (id) {
      case 'airhorn': {
        // Classic DJ Airhorn synthesis
        const freqs = [466.16, 466.16, 466.16, 466.16, 370];
        const times = [0, 0.12, 0.24, 0.36, 0.52];
        const durations = [0.1, 0.1, 0.1, 0.14, 0.4];

        times.forEach((start, i) => {
          const osc1 = this.ctx.createOscillator();
          const osc2 = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc1.type = 'sawtooth';
          osc2.type = 'sawtooth';
          osc1.frequency.setValueAtTime(freqs[i], t + start);
          osc2.frequency.setValueAtTime(freqs[i] * 1.015, t + start);

          gain.gain.setValueAtTime(0, t + start);
          gain.gain.linearRampToValueAtTime(0.7, t + start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + start + durations[i]);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(this.jingleGain);

          osc1.start(t + start);
          osc2.start(t + start);
          osc1.stop(t + start + durations[i]);
          osc2.stop(t + start + durations[i]);
        });
        break;
      }

      case 'station_id': {
        // Radio station chime: C5, E5, G5, C6 arpeggio with shimmer
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t + idx * 0.15);

          gain.gain.setValueAtTime(0, t + idx * 0.15);
          gain.gain.linearRampToValueAtTime(0.6, t + idx * 0.15 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + idx * 0.15 + 1.2);

          osc.connect(gain);
          gain.connect(this.jingleGain);
          osc.start(t + idx * 0.15);
          osc.stop(t + idx * 0.15 + 1.2);
        });
        break;
      }

      case 'scratch': {
        // DJ vinyl record scratch
        const bufferSize = this.ctx.sampleRate * 0.35;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 5.0;
        filter.frequency.setValueAtTime(1200, t);
        filter.frequency.exponentialRampToValueAtTime(300, t + 0.15);
        filter.frequency.exponentialRampToValueAtTime(1800, t + 0.35);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

        whiteNoise.connect(filter);
        filter.connect(gain);
        gain.connect(this.jingleGain);

        whiteNoise.start(t);
        whiteNoise.stop(t + 0.35);
        break;
      }

      case 'applause': {
        // Genuine recorded human crowd clapping & applause
        this.playRealSfx('applause');
        break;
      }

      case 'badum_tss': {
        // Comedy Punchline Rimshot & Cymbal Crash
        // 1. Kick Drum
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kickOsc.frequency.setValueAtTime(140, t);
        kickOsc.frequency.exponentialRampToValueAtTime(45, t + 0.09);
        kickGain.gain.setValueAtTime(0.9, t);
        kickGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        kickOsc.connect(kickGain);
        kickGain.connect(this.jingleGain);
        kickOsc.start(t);
        kickOsc.stop(t + 0.1);

        // 2. Snare 1 (Ba-)
        const tSnare1 = t + 0.16;
        const s1Osc = this.ctx.createOscillator();
        const s1Gain = this.ctx.createGain();
        s1Osc.type = 'triangle';
        s1Osc.frequency.setValueAtTime(200, tSnare1);
        s1Gain.gain.setValueAtTime(0.6, tSnare1);
        s1Gain.gain.exponentialRampToValueAtTime(0.01, tSnare1 + 0.08);
        s1Osc.connect(s1Gain);
        s1Gain.connect(this.jingleGain);
        s1Osc.start(tSnare1);
        s1Osc.stop(tSnare1 + 0.08);

        // 3. Snare 2 (-Dum)
        const tSnare2 = t + 0.32;
        const s2Osc = this.ctx.createOscillator();
        const s2Gain = this.ctx.createGain();
        s2Osc.type = 'triangle';
        s2Osc.frequency.setValueAtTime(175, tSnare2);
        s2Gain.gain.setValueAtTime(0.7, tSnare2);
        s2Gain.gain.exponentialRampToValueAtTime(0.01, tSnare2 + 0.09);
        s2Osc.connect(s2Gain);
        s2Gain.connect(this.jingleGain);
        s2Osc.start(tSnare2);
        s2Osc.stop(tSnare2 + 0.09);

        // 4. Splash Cymbal (-Tss!)
        const tCymbal = t + 0.48;
        const bSize = this.ctx.sampleRate * 1.5;
        const cymBuf = this.ctx.createBuffer(1, bSize, this.ctx.sampleRate);
        const cOut = cymBuf.getChannelData(0);
        for (let i = 0; i < bSize; i++) cOut[i] = Math.random() * 2 - 1;
        const cSrc = this.ctx.createBufferSource();
        cSrc.buffer = cymBuf;
        const cHp = this.ctx.createBiquadFilter();
        cHp.type = 'highpass';
        cHp.frequency.value = 4500;
        const cG = this.ctx.createGain();
        cG.gain.setValueAtTime(0.85, tCymbal);
        cG.gain.exponentialRampToValueAtTime(0.001, tCymbal + 1.4);
        cSrc.connect(cHp);
        cHp.connect(cG);
        cG.connect(this.jingleGain);
        cSrc.start(tCymbal);
        cSrc.stop(tCymbal + 1.5);
        break;
      }

      case 'laser': {
        // Retro Sci-Fi Laser pew
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(2400, t);
        osc.frequency.exponentialRampToValueAtTime(90, t + 0.28);
        gain.gain.setValueAtTime(0.75, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);
        osc.connect(gain);
        gain.connect(this.jingleGain);
        osc.start(t);
        osc.stop(t + 0.28);
        break;
      }

      case 'drum_roll': {
        // Snare roll stinger + cymbal crash
        for (let i = 0; i < 16; i++) {
          const hitTime = t + i * 0.06;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(180, hitTime);
          gain.gain.setValueAtTime(0.1 + (i / 16) * 0.4, hitTime);
          gain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.05);

          osc.connect(gain);
          gain.connect(this.jingleGain);
          osc.start(hitTime);
          osc.stop(hitTime + 0.05);
        }

        // Final Crash
        const crashTime = t + 16 * 0.06;
        const bSize = this.ctx.sampleRate * 1.5;
        const buf = this.ctx.createBuffer(1, bSize, this.ctx.sampleRate);
        const out = buf.getChannelData(0);
        for (let i = 0; i < bSize; i++) out[i] = Math.random() * 2 - 1;
        const crash = this.ctx.createBufferSource();
        crash.buffer = buf;

        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 3500;

        const cGain = this.ctx.createGain();
        cGain.gain.setValueAtTime(0.7, crashTime);
        cGain.gain.exponentialRampToValueAtTime(0.001, crashTime + 1.4);

        crash.connect(hp);
        hp.connect(cGain);
        cGain.connect(this.jingleGain);
        crash.start(crashTime);
        crash.stop(crashTime + 1.5);
        break;
      }

      case 'bleep': {
        // Censor bleep (1000Hz standard)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, t);
        gain.gain.setValueAtTime(0.7, t);
        gain.gain.setValueAtTime(0, t + 0.65);

        osc.connect(gain);
        gain.connect(this.jingleGain);
        osc.start(t);
        osc.stop(t + 0.65);
        break;
      }

      case 'news_flash': {
        // Dramatic breaking news intro tones + teletype
        const freqs = [330, 440, 554, 659, 880];
        freqs.forEach((f, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f, t + i * 0.11);
          gain.gain.setValueAtTime(0.35, t + i * 0.11);
          gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.11 + 0.16);
          osc.connect(gain);
          gain.connect(this.jingleGain);
          osc.start(t + i * 0.11);
          osc.stop(t + i * 0.11 + 0.18);
        });

        // Urgent teletype clicks
        for (let j = 0; j < 8; j++) {
          const tickTime = t + 0.6 + j * 0.08;
          const tOsc = this.ctx.createOscillator();
          const tG = this.ctx.createGain();
          tOsc.type = 'square';
          tOsc.frequency.setValueAtTime(1800, tickTime);
          tG.gain.setValueAtTime(0.2, tickTime);
          tG.gain.exponentialRampToValueAtTime(0.001, tickTime + 0.03);
          tOsc.connect(tG);
          tG.connect(this.jingleGain);
          tOsc.start(tickTime);
          tOsc.stop(tickTime + 0.04);
        }
        break;
      }

      case 'impact_boom': {
        // Massive Sub-Bass Impact & Cinematic Transition Drop
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(85, t);
        subOsc.frequency.exponentialRampToValueAtTime(30, t + 1.2);
        subGain.gain.setValueAtTime(1.0, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 2.2);

        // Explosive lowpass noise layer
        const bSize = Math.floor(this.ctx.sampleRate * 2.0);
        const noiseBuf = this.ctx.createBuffer(1, bSize, this.ctx.sampleRate);
        const nOut = noiseBuf.getChannelData(0);
        for (let i = 0; i < bSize; i++) nOut[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bSize * 0.2));
        const nSrc = this.ctx.createBufferSource();
        nSrc.buffer = noiseBuf;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(450, t);
        lp.frequency.exponentialRampToValueAtTime(60, t + 1.0);
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.9, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);

        subOsc.connect(subGain);
        subGain.connect(this.jingleGain);
        nSrc.connect(lp);
        lp.connect(nGain);
        nGain.connect(this.jingleGain);

        subOsc.start(t);
        subOsc.stop(t + 2.2);
        nSrc.start(t);
        nSrc.stop(t + 2.0);
        break;
      }

      case 'cash_register': {
        // Kuis Hadiah / Ka-Ching (Drawer slide + dual bell chimes + coins)
        // Dual bells (D#7 2489Hz & G7 3136Hz)
        const bellFreqs = [2489, 3136];
        bellFreqs.forEach((freq, idx) => {
          const bOsc = this.ctx.createOscillator();
          const bG = this.ctx.createGain();
          bOsc.type = 'sine';
          bOsc.frequency.setValueAtTime(freq, t + 0.08 * idx);
          bG.gain.setValueAtTime(0.65, t + 0.08 * idx);
          bG.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
          bOsc.connect(bG);
          bG.connect(this.jingleGain);
          bOsc.start(t + 0.08 * idx);
          bOsc.stop(t + 1.5);
        });

        // Mechanical drawer slide
        const slideOsc = this.ctx.createOscillator();
        const slideG = this.ctx.createGain();
        slideOsc.type = 'sawtooth';
        slideOsc.frequency.setValueAtTime(320, t);
        slideOsc.frequency.exponentialRampToValueAtTime(80, t + 0.15);
        slideG.gain.setValueAtTime(0.3, t);
        slideG.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        slideOsc.connect(slideG);
        slideG.connect(this.jingleGain);
        slideOsc.start(t);
        slideOsc.stop(t + 0.15);
        break;
      }

      case 'fanfare': {
        // Genuine recorded victory fanfare (Tada!)
        this.playRealSfx('tada');
        break;
      }

      case 'boo': {
        // Genuine recorded crowd booing
        this.playRealSfx('boo');
        break;
      }

      case 'wrong_buzzer': {
        // Genuine recorded quiz wrong answer buzzer
        this.playRealSfx('wrong');
        break;
      }

      case 'gasp': {
        // Genuine recorded crowd shock / gasp
        this.playRealSfx('gasp');
        break;
      }

      case 'vinyl_brake': {
        // Vinyl Turntable Tape Stop / Motor Brake ("Whuuuurp")
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(25, t + 0.85);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, t);
        filter.frequency.exponentialRampToValueAtTime(180, t + 0.85);

        gain.gain.setValueAtTime(0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.85);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.jingleGain);

        osc.start(t);
        osc.stop(t + 0.85);
        break;
      }

      case 'sweeper_whoosh': {
        // Radio Station Sweeper / White Noise Riser Transition
        const dur = 1.4;
        const bSize = Math.floor(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, bSize, this.ctx.sampleRate);
        const out = buf.getChannelData(0);
        for (let i = 0; i < bSize; i++) out[i] = Math.random() * 2 - 1;

        const src = this.ctx.createBufferSource();
        src.buffer = buf;

        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 4.0;
        bp.frequency.setValueAtTime(350, t);
        bp.frequency.exponentialRampToValueAtTime(6500, t + 1.0);
        bp.frequency.exponentialRampToValueAtTime(400, t + 1.4);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.linearRampToValueAtTime(0.85, t + 1.0);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 1.4);

        src.connect(bp);
        bp.connect(gain);
        gain.connect(this.jingleGain);

        src.start(t);
        src.stop(t + 1.4);
        break;
      }

      case 'tick_tock': {
        // Suspense Quiz Countdown (4 clock ticks + finish)
        for (let i = 0; i < 4; i++) {
          const tickT = t + i * 0.32;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(i % 2 === 0 ? 1100 : 850, tickT);
          gain.gain.setValueAtTime(0.6, tickT);
          gain.gain.exponentialRampToValueAtTime(0.001, tickT + 0.05);

          osc.connect(gain);
          gain.connect(this.jingleGain);
          osc.start(tickT);
          osc.stop(tickT + 0.06);
        }
        break;
      }

      case 'laugh_track': {
        // Sitcom / Studio Audience Laugh & Chuckles
        for (let i = 0; i < 6; i++) {
          const chuckleT = t + i * 0.16 + (Math.random() * 0.03);
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(320 + (i % 2) * 50, chuckleT);
          osc.frequency.exponentialRampToValueAtTime(180, chuckleT + 0.13);

          const lp = this.ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 1400;

          gain.gain.setValueAtTime(0.55, chuckleT);
          gain.gain.exponentialRampToValueAtTime(0.01, chuckleT + 0.13);

          osc.connect(lp);
          lp.connect(gain);
          gain.connect(this.jingleGain);

          osc.start(chuckleT);
          osc.stop(chuckleT + 0.14);
        }
        break;
      }
    }
  }

  // ==========================================
  // BROADCAST RECORDING & ON AIR
  // ==========================================
  startRecording() {
    this.init();
    if (this.isRecording) return;

    this.recordedChunks = [];
    const stream = this.broadcastDest.stream;

    try {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      this.mediaRecorder = new MediaRecorder(stream, { mimeType });
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.start(250); // Slice every 250ms
      this.isRecording = true;
    } catch (err) {
      console.error('Error starting MediaRecorder:', err);
      throw err;
    }
  }

  stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) return null;

    return new Promise((resolve) => {
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        this.isRecording = false;
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }

  // Live Stream Relay to Server /api/broadcast-chunk
  startLiveStreamRelay() {
    this.init();
    if (this.isBroadcastingLive || this.streamRelayRecorder) return;

    try {
      const stream = this.broadcastDest.stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      this.streamRelayRecorder = new MediaRecorder(stream, { mimeType });
      let isHeader = true;

      this.streamRelayRecorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0) {
          try {
            await fetch('/api/broadcast-chunk', {
              method: 'POST',
              headers: {
                'Content-Type': 'audio/webm',
                'x-is-header': isHeader ? 'true' : 'false'
              },
              body: e.data
            });
            isHeader = false;
          } catch (err) {}
        }
      };

      this.streamRelayRecorder.start(250); // Send chunks every 250ms
      this.isBroadcastingLive = true;
    } catch (err) {
      console.warn('Could not start live stream relay recorder:', err);
    }
  }

  stopLiveStreamRelay() {
    if (this.streamRelayRecorder) {
      try {
        this.streamRelayRecorder.stop();
      } catch (e) {}
      this.streamRelayRecorder = null;
    }
    this.isBroadcastingLive = false;
  }

  // ==========================================
  // PROCEDURAL DEMO MUSIC GENERATOR
  // Generates complete 40s royalty-free tracks directly in Web Audio
  // ==========================================
  async generateDemoTrack(style = 'synthwave') {
    this.init();
    const sampleRate = this.ctx.sampleRate;
    const duration = 38; // 38 seconds of high-energy demo music
    const numSamples = sampleRate * duration;
    const buffer = this.ctx.createBuffer(2, numSamples, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    const bpm = style === 'synthwave' ? 120 : style === 'lofi' ? 84 : 128;
    const beatDuration = 60 / bpm;
    const sixteenth = beatDuration / 4;

    // Chord progressions
    const progressions = {
      synthwave: [
        [130.81, 155.56, 196.00], // C minor
        [116.54, 138.59, 174.61], // Bb major
        [103.83, 130.81, 155.56], // Ab major
        [116.54, 146.83, 174.61], // Bb sus
      ],
      lofi: [
        [174.61, 220.00, 261.63, 329.63], // Fmaj7
        [164.81, 207.65, 246.94, 311.13], // E7
        [146.83, 174.61, 220.00, 261.63], // Dm7
        [130.81, 164.81, 196.00, 246.94], // Cmaj7
      ]
    };

    const chords = progressions[style] || progressions.synthwave;

    for (let i = 0; i < numSamples; i++) {
      const time = i / sampleRate;
      const beat = time / beatDuration;
      const measure = Math.floor(beat / 4);
      const chord = chords[measure % chords.length];

      let sampleL = 0;
      let sampleR = 0;

      // 1. Kick Drum (every beat for synthwave, beats 1 & 3 for lofi)
      const beatFrac = beat % 1;
      const isKickBeat = style === 'synthwave' ? true : (Math.floor(beat) % 2 === 0);
      if (isKickBeat && beatFrac < 0.25) {
        const kickPitch = 120 * Math.exp(-beatFrac * 35);
        const kickVol = Math.sin(2 * Math.PI * kickPitch * beatFrac * beatDuration) * Math.exp(-beatFrac * 14);
        sampleL += kickVol * 0.65;
        sampleR += kickVol * 0.65;
      }

      // 2. Snare / Clack (beats 2 and 4)
      const snareBeatFrac = (beat + 1) % 2;
      if (snareBeatFrac < 0.2) {
        const noise = (Math.random() * 2 - 1) * Math.exp(-snareBeatFrac * 18);
        const tone = Math.sin(2 * Math.PI * 180 * snareBeatFrac) * Math.exp(-snareBeatFrac * 22);
        sampleL += (noise * 0.4 + tone * 0.25);
        sampleR += (noise * 0.4 + tone * 0.25);
      }

      // 3. Hi-Hat (16th notes)
      const hatFrac = (time / sixteenth) % 1;
      if (hatFrac < 0.08) {
        const hat = (Math.random() * 2 - 1) * Math.exp(-hatFrac * 40);
        sampleL += hat * 0.12;
        sampleR += hat * 0.16;
      }

      // 4. Bassline (Arpeggiated)
      const bassStep = Math.floor(time / sixteenth) % 16;
      const root = chord[0] * 0.5;
      const bassFreq = root * (bassStep % 2 === 0 ? 1 : 1.5);
      const bassVol = Math.sin(2 * Math.PI * bassFreq * time) * 0.28;
      sampleL += bassVol;
      sampleR += bassVol;

      // 5. Synth Chords / Atmosphere (Panned)
      chord.forEach((note, idx) => {
        const detune = idx * 0.003;
        const wave = Math.sin(2 * Math.PI * note * (1 + detune) * time);
        const env = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.25 * time);
        sampleL += wave * env * 0.08;
        sampleR += wave * (1 - env) * 0.08;
      });

      // Soft Limiting
      left[i] = Math.tanh(sampleL * 0.85);
      right[i] = Math.tanh(sampleR * 0.85);
    }

    return buffer;
  }
}

export const audioEngine = new AudioEngine();
