import React, { useState, useEffect, useRef } from 'react';
import { audioEngine } from '../utils/audioEngine';
import { SOUNDBOARD_EFFECTS } from '../utils/stationData';
import {
  Mic,
  MicOff,
  Radio,
  RadioTower,
  Volume2,
  Sliders,
  Disc,
  Download,
  Share2,
  Sparkles,
  Zap,
  Info
} from 'lucide-react';

export default function BroadcastConsole({ theme = 'classic' }) {
  const [isOnAir, setIsOnAir] = useState(false);
  const [onAirSeconds, setOnAirSeconds] = useState(0);

  // Mic state
  const [micActive, setMicActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micGain, setMicGain] = useState(1.8);
  const [voiceFx, setVoiceFx] = useState('clean');

  // Auto-ducking state
  const [autoDucking, setAutoDucking] = useState(true);
  const [isDuckingActive, setIsDuckingActive] = useState(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);

  // Soundboard volume & active pad flash
  const [jingleVol, setJingleVol] = useState(0.9);
  const [activePadId, setActivePadId] = useState(null);

  // Stream Info
  const [streamUrl, setStreamUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Setup stream URL, WebSocket, and hotkeys
  useEffect(() => {
    setStreamUrl(`${window.location.origin}/api/stream`);

    // Connect WebSocket for live mic & jingle relay to listeners
    let ws;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/ws?role=dj`);
      ws.onopen = () => {
        try {
          ws.send(JSON.stringify({ type: 'REGISTER_ROLE', role: 'dj' }));
        } catch (err) {}
        audioEngine.setWebSocket(ws);
      };
    } catch (e) {}

    // Listen to mic level and ducking
    audioEngine.onMicLevel = (lvl) => {
      setMicLevel(lvl);
    };

    audioEngine.onDuckingStateChange = (ducking) => {
      setIsDuckingActive(ducking);
    };

    // Keyboard shortcuts for Soundboard (1-0, Q-Y)
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      const keyUpper = e.key.toUpperCase();
      const effect = SOUNDBOARD_EFFECTS.find(s => s.key.toUpperCase() === keyUpper);
      if (effect) {
        triggerSoundEffect(effect.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (ws) ws.close();
      audioEngine.setWebSocket(null);
    };
  }, []);

  // On Air Timer
  useEffect(() => {
    let interval;
    if (isOnAir) {
      interval = setInterval(() => {
        setOnAirSeconds(s => s + 1);
      }, 1000);
    } else {
      setOnAirSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isOnAir]);

  // Recording Timer
  useEffect(() => {
    let interval;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordSeconds(s => s + 1);
      }, 1000);
    } else {
      setRecordSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTimer = (totalSecs) => {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleOnAir = () => {
    const next = !isOnAir;
    setIsOnAir(next);
    audioEngine.isOnAir = next;

    if (next) {
      audioEngine.startLiveStreamRelay();
      fetch('/api/radio-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOnAir: true })
      }).catch(console.warn);
    } else {
      audioEngine.stopLiveStreamRelay();
      fetch('/api/radio-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOnAir: false })
      }).catch(console.warn);
    }
  };

  const toggleMicrophone = async () => {
    if (micActive) {
      audioEngine.stopMicrophone();
      setMicActive(false);
    } else {
      try {
        await audioEngine.startMicrophone();
        setMicActive(true);
      } catch (err) {
        alert('Gagal mengakses mikrofon. Pastikan Anda memberikan izin akses mikrofon pada browser.');
      }
    }
  };

  const handleMicGainChange = (e) => {
    const val = parseFloat(e.target.value);
    setMicGain(val);
    audioEngine.setMicGain(val);
  };

  const handleVoiceFxChange = (mode) => {
    setVoiceFx(mode);
    audioEngine.setVoiceFx(mode);
  };

  const handleAutoDuckingToggle = () => {
    const next = !autoDucking;
    setAutoDucking(next);
    audioEngine.setAutoDucking(next);
  };

  const triggerSoundEffect = (id) => {
    setActivePadId(id);
    setTimeout(() => setActivePadId(null), 400);
    audioEngine.playJingle(id);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      const blob = await audioEngine.stopRecording();
      setIsRecording(false);
      setRecordedBlob(blob);
    } else {
      try {
        setRecordedBlob(null);
        audioEngine.startRecording();
        setIsRecording(true);
      } catch (err) {
        alert('Gagal memulai rekaman siaran: ' + err.message);
      }
    }
  };

  const downloadRecording = () => {
    if (!recordedBlob) return;
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `radio-broadcast-recording-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyStreamLink = () => {
    navigator.clipboard.writeText(streamUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="winamp-chassis w-full max-w-xl mx-auto rounded-lg p-3 relative flex flex-col gap-3 shadow-2xl">
      {/* Studio Header */}
      <div className="flex items-center justify-between px-2 py-1 bg-gradient-to-r from-[#201c2d] via-[#322a42] to-[#201c2d] rounded border border-[#563b50]">
        <div className="flex items-center gap-2">
          <RadioTower className="w-4 h-4 text-rose-400" />
          <span className="font-orbitron text-[11px] font-bold tracking-wider text-rose-200 uppercase">
            BROADCAST STUDIO & DJ TALKOVER CONSOLE
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-chakra text-[10px]">
          <span className="text-gray-400">STUDIO MASTER</span>
        </div>
      </div>

      {/* Primary ON AIR Switch Bar */}
      <div className="winamp-panel p-2.5 rounded flex items-center justify-between gap-3 bg-[#0d0a14]">
        {/* Big On Air Indicator & Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleOnAir}
            className={`px-4 py-2 rounded-lg font-orbitron font-black tracking-widest text-sm uppercase transition-all flex items-center gap-2 border-2 ${
              isOnAir
                ? 'bg-rose-600 border-rose-400 text-white on-air-active shadow-[0_0_20px_rgba(255,51,68,0.8)]'
                : 'bg-[#1b1c26] border-gray-700 text-gray-500 hover:text-gray-300'
            }`}
          >
            <Radio className={`w-4 h-4 ${isOnAir ? 'animate-pulse' : ''}`} />
            <span>{isOnAir ? '● ON AIR' : '○ OFF AIR'}</span>
          </button>

          {/* On Air Timer */}
          <div className="flex flex-col">
            <span className="text-[9px] font-chakra text-gray-500 uppercase">SIARAN BERJALAN</span>
            <span className={`font-lcd text-2xl font-bold ${isOnAir ? 'glow-red' : 'text-gray-600'}`}>
              {formatTimer(onAirSeconds)}
            </span>
          </div>
        </div>

        {/* Live Broadcast Link */}
        <div className="flex items-center gap-1.5 bg-[#171520] border border-[#2d2538] px-2.5 py-1.5 rounded">
          <button
            onClick={copyStreamLink}
            className="winamp-btn px-2 py-1 text-[11px] font-chakra text-cyan-300 flex items-center gap-1 rounded"
            title="Salin Link Streaming untuk Pendengar"
          >
            <Share2 className="w-3 h-3" />
            <span>{copiedLink ? 'TERSALIN!' : 'SHARE LINK'}</span>
          </button>
        </div>
      </div>

      {/* Microphone & Talkover Section */}
      <div className="winamp-panel p-2.5 rounded flex flex-col gap-2.5 bg-[#090b10]">
        <div className="flex items-center justify-between border-b border-[#1e2430] pb-1.5">
          <div className="flex items-center gap-2">
            <Mic className={`w-4 h-4 ${micActive ? 'text-green-400 animate-pulse' : 'text-gray-500'}`} />
            <span className="font-chakra text-xs font-bold text-gray-200">
              DJ MICROPHONE & VOICE PROCESSOR
            </span>
          </div>

          {/* Auto-Ducking Badge */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoDucking}
                onChange={handleAutoDuckingToggle}
                className="accent-cyan-400"
              />
              <span className="text-[10px] font-chakra text-gray-300">
                AUTO-DUCKING (TALKOVER)
              </span>
            </label>

            {isDuckingActive && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-orbitron font-bold bg-amber-500 text-black animate-pulse">
                DUCKING ACTIVE
              </span>
            )}
          </div>
        </div>

        {/* Mic Controls Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Mic Toggle Button */}
          <button
            onClick={toggleMicrophone}
            className={`winamp-btn px-4 py-2 rounded font-chakra text-xs font-bold flex items-center gap-2 w-full sm:w-auto justify-center ${
              micActive
                ? 'active bg-green-900 border-green-400 text-green-300 shadow-[0_0_12px_rgba(0,255,102,0.4)]'
                : 'text-gray-400'
            }`}
          >
            {micActive ? <Mic className="w-4 h-4 text-green-400" /> : <MicOff className="w-4 h-4 text-rose-400" />}
            <span>{micActive ? 'MIC ON (AKTIF)' : 'NYALAKAN MIC'}</span>
          </button>

          {/* Mic Level VU Bar */}
          <div className="flex-1 w-full flex flex-col gap-1">
            <div className="flex justify-between text-[9px] font-chakra text-gray-400">
              <span>INPUT LEVEL</span>
              <span className="font-lcd text-xs text-green-400">
                {micActive ? `${Math.round(micLevel * 100)}%` : 'MUTED'}
              </span>
            </div>
            <div className="w-full bg-[#121620] h-3 rounded overflow-hidden border border-[#2d3748] relative">
              <div
                className="h-full transition-all duration-75"
                style={{
                  width: `${Math.min(100, micLevel * 250)}%`,
                  background: micLevel > 0.35 ? 'linear-gradient(90deg, #00ff66 70%, #ffcc00 85%, #ff3344 100%)' : '#00ff66'
                }}
              />
            </div>
          </div>

          {/* Mic Gain Slider */}
          <div className="flex items-center gap-2 w-full sm:w-36 bg-[#121620] px-2 py-1 rounded border border-[#232b3a]">
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between text-[8px] font-chakra text-gray-400">
                <span>MIC GAIN</span>
                <span className="text-cyan-400 font-bold">{Math.round(micGain * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="4.0"
                step="0.05"
                value={micGain}
                onChange={handleMicGainChange}
                disabled={!micActive}
                className="winamp-slider"
              />
            </div>
          </div>
        </div>

        {/* Voice FX Selector */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[#1e2430]">
          <span className="text-[10px] font-chakra text-gray-400 mr-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            VOICE FX:
          </span>

          {[
            { id: 'clean', label: 'Clean Studio' },
            { id: 'radio', label: 'Radio AM/FM' },
            { id: 'studio', label: 'Warm Vocal' },
            { id: 'echo', label: 'DJ Echo' },
            { id: 'robot', label: 'Robot RingMod' }
          ].map(fx => (
            <button
              key={fx.id}
              onClick={() => handleVoiceFxChange(fx.id)}
              className={`winamp-btn px-2 py-1 text-[10px] font-chakra rounded ${
                voiceFx === fx.id ? 'active text-cyan-300 border-cyan-400 font-bold' : 'text-gray-400'
              }`}
            >
              {fx.label}
            </button>
          ))}
        </div>
      </div>

      {/* Soundboard / Jingle Cart Wall */}
      <div className="winamp-panel p-2.5 rounded flex flex-col gap-2.5 bg-[#090b10] border border-[#242b3a]">
        <div className="flex items-center justify-between border-b border-[#1e2430] pb-1.5">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="font-chakra text-xs font-bold text-gray-200 uppercase">
              JINGLE & SOUND EFFECT CART (16 PRO PADS)
            </span>
          </div>

          <span className="text-[10px] font-chakra text-cyan-400 font-bold">
            HOTKEYS 1 - 0 &bull; Q - Y
          </span>
        </div>

        {/* 16 Instant Trigger Pads (4x4 Grid) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SOUNDBOARD_EFFECTS.map((fx) => {
            const isActive = activePadId === fx.id;
            return (
              <button
                key={fx.id}
                onClick={() => triggerSoundEffect(fx.id)}
                className={`winamp-btn p-2 rounded flex flex-col items-center justify-center gap-1 text-center transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'active border-amber-400 bg-amber-950/70 scale-95 shadow-[0_0_12px_rgba(251,191,36,0.6)]'
                    : 'hover:scale-[1.03] active:scale-95'
                }`}
                title={`Picu ${fx.name} (Hotkey: ${fx.key})`}
              >
                <div className="flex items-center justify-between w-full text-[9px] font-orbitron text-gray-400">
                  <span className="px-1 py-0.2 rounded bg-[#131722] border border-[#252f40] text-cyan-300 font-bold">
                    [{fx.key}]
                  </span>
                  <span className="text-[8px] font-chakra text-gray-400 uppercase tracking-tighter">
                    {fx.category}
                  </span>
                  <span className="text-base select-none">{fx.icon}</span>
                </div>
                <span className="font-chakra text-[11px] font-bold text-gray-200 tracking-wide mt-0.5">
                  {fx.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Broadcast Recording Section */}
      <div className="flex items-center justify-between gap-2 p-2 winamp-panel rounded bg-[#090b10]">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleRecording}
            className={`winamp-btn px-3 py-1.5 rounded font-chakra text-xs font-bold flex items-center gap-1.5 ${
              isRecording
                ? 'active bg-rose-900 border-rose-400 text-rose-300 animate-pulse'
                : 'text-gray-300'
            }`}
          >
            <Disc className={`w-3.5 h-3.5 ${isRecording ? 'text-rose-400 animate-spin' : ''}`} />
            <span>{isRecording ? 'STOP REKAM' : 'REKAM SIARAN'}</span>
          </button>

          {isRecording && (
            <div className="flex items-center gap-1 font-lcd text-lg glow-red">
              <span>● REC {formatTimer(recordSeconds)}</span>
            </div>
          )}

          {recordedBlob && !isRecording && (
            <button
              onClick={downloadRecording}
              className="winamp-btn px-3 py-1.5 rounded font-chakra text-xs font-bold text-green-300 border-green-500 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-green-400" />
              <span>DOWNLOAD HASIL SIARAN ({(recordedBlob.size / (1024 * 1024)).toFixed(2)} MB)</span>
            </button>
          )}
        </div>

        <div className="text-[10px] font-chakra text-gray-500 hidden sm:block">
          Audio Engine: 48kHz Stereo / Web Audio Mixed
        </div>
      </div>
    </div>
  );
}
