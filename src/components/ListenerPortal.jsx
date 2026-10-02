import React, { useState, useEffect, useRef } from 'react';
import { audioEngine } from '../utils/audioEngine';
import { SOUNDBOARD_EFFECTS } from '../utils/stationData';
import Visualizer from './Visualizer';
import ListenerChat from './ListenerChat';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Radio,
  RadioTower,
  Headphones,
  Share2,
  Calendar,
  Clock,
  Sparkles,
  MessageCircle,
  Mic,
  Volume1,
  Activity,
  MessageSquare,
  ChevronUp
} from 'lucide-react';

const getListenerClientId = () => {
  try {
    let id = sessionStorage.getItem('khanza_listener_id');
    if (!id) {
      id = 'listener_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      sessionStorage.setItem('khanza_listener_id', id);
    }
    return id;
  } catch (e) {
    return 'listener_tab';
  }
};

// Eagerly generate & cache the listener ID so child components (ListenerChat) can read it from sessionStorage
// Theme Skin Definitions for Full Aesthetic Synchronization
const THEME_CONFIG = {
  classic: {
    heroGlow1: 'bg-emerald-500/15',
    heroGlow2: 'bg-green-600/10',
    heroBorder: 'border-emerald-500/40 shadow-emerald-950/40',
    vinylCenter: 'bg-gradient-to-br from-emerald-400 via-green-600 to-teal-700',
    stationBadge: 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300',
    nowPlayingBox: 'bg-[#080d14] border-[#1d2d24]',
    towerIcon: 'text-emerald-400',
    towerBg: 'bg-emerald-500/10 border-emerald-500/40',
    trackTitle: 'text-emerald-300',
    btnPlayReady: 'bg-gradient-to-r from-emerald-400 to-green-600 text-black shadow-emerald-500/40 hover:from-emerald-300 hover:to-green-500',
    volIcon: 'text-emerald-400',
    volText: 'text-emerald-300',
    tabBorder: 'border-emerald-500/30',
    tabActiveChat: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-black shadow-md shadow-emerald-500/30',
    stickyBorder: 'border-t-emerald-500/40',
    stickyVinyl: 'from-emerald-400 via-green-600 to-teal-700',
    stickyPlayBtn: 'bg-gradient-to-r from-emerald-400 to-green-500 text-black shadow-emerald-500/30',
    stickyTitle: 'text-emerald-300',
    scheduleActiveBg: 'bg-emerald-950/70 border-emerald-500/60 text-emerald-200',
    scheduleActiveClock: 'text-emerald-400',
    scheduleBadge: 'bg-emerald-500 text-black'
  },
  cyberpunk: {
    heroGlow1: 'bg-cyan-500/15',
    heroGlow2: 'bg-purple-600/15',
    heroBorder: 'border-cyan-500/50 shadow-cyan-950/40',
    vinylCenter: 'bg-gradient-to-br from-cyan-400 via-purple-600 to-pink-600',
    stationBadge: 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300',
    nowPlayingBox: 'bg-[#0a0d14] border-[#1e2a3c]',
    towerIcon: 'text-cyan-400',
    towerBg: 'bg-cyan-500/10 border-cyan-500/40',
    trackTitle: 'text-cyan-300',
    btnPlayReady: 'bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-purple-600 text-black shadow-cyan-500/40 hover:from-cyan-300 hover:to-purple-500',
    volIcon: 'text-cyan-400',
    volText: 'text-cyan-300',
    tabBorder: 'border-cyan-500/30',
    tabActiveChat: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black shadow-md shadow-cyan-500/30',
    stickyBorder: 'border-t-cyan-500/40',
    stickyVinyl: 'from-cyan-400 via-blue-600 to-purple-600',
    stickyPlayBtn: 'bg-gradient-to-r from-cyan-400 to-blue-500 text-black shadow-cyan-500/30',
    stickyTitle: 'text-cyan-200',
    scheduleActiveBg: 'bg-cyan-950/70 border-cyan-500/60 text-cyan-200',
    scheduleActiveClock: 'text-cyan-400',
    scheduleBadge: 'bg-cyan-400 text-black'
  },
  amber: {
    heroGlow1: 'bg-amber-500/20',
    heroGlow2: 'bg-orange-600/15',
    heroBorder: 'border-amber-500/50 shadow-amber-950/40',
    vinylCenter: 'bg-gradient-to-br from-amber-300 via-amber-600 to-yellow-700',
    stationBadge: 'bg-amber-950/80 border-amber-500/60 text-amber-300',
    nowPlayingBox: 'bg-[#0f0c08] border-[#382613]',
    towerIcon: 'text-amber-400',
    towerBg: 'bg-amber-500/10 border-amber-500/40',
    trackTitle: 'text-amber-300',
    btnPlayReady: 'bg-gradient-to-r from-amber-400 via-orange-500 to-yellow-500 text-black shadow-amber-500/40 hover:from-amber-300 hover:to-yellow-400',
    volIcon: 'text-amber-400',
    volText: 'text-amber-300',
    tabBorder: 'border-amber-500/30',
    tabActiveChat: 'bg-gradient-to-r from-amber-500 to-orange-600 text-black shadow-md shadow-amber-500/30',
    stickyBorder: 'border-t-amber-500/40',
    stickyVinyl: 'from-amber-400 via-orange-600 to-yellow-600',
    stickyPlayBtn: 'bg-gradient-to-r from-amber-400 to-orange-500 text-black shadow-amber-500/30',
    stickyTitle: 'text-amber-200',
    scheduleActiveBg: 'bg-amber-950/70 border-amber-500/60 text-amber-200',
    scheduleActiveClock: 'text-amber-400',
    scheduleBadge: 'bg-amber-400 text-black'
  }
};

export default function ListenerPortal({ theme = 'classic' }) {
  const skin = THEME_CONFIG[theme] || THEME_CONFIG.classic;
  // Live Track Metadata synced from DJ
  const [liveTrack, setLiveTrack] = useState({
    title: 'Khanza.NET Live Stream',
    artist: 'Menunggu Siaran DJ...',
    album: 'Live Broadcast',
    audioUrl: '/api/current-audio',
    kbps: '320 KBPS',
    khz: '48.0 KHZ'
  });

  const [isDjLive, setIsDjLive] = useState(false);
  const [isPlayingRadio, setIsPlayingRadio] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [listenerCount, setListenerCount] = useState(1);
  const [copiedLink, setCopiedLink] = useState(false);

  // Real-time DJ live interaction states
  const [djMicActive, setDjMicActive] = useState(false);
  const [activeJingle, setActiveJingle] = useState(null);
  const [isDucked, setIsDucked] = useState(false);
  const [isDjPlaying, setIsDjPlaying] = useState(false);
  const [isTunedIn, setIsTunedIn] = useState(false);
  const [mobileTab, setMobileTab] = useState('chat'); // Mobile Tab: 'chat', 'visualizer', 'schedule'
  const [programSchedule, setProgramSchedule] = useState([
    { id: 1, startTime: '06:00', endTime: '10:00', title: 'Morning Vibes & Semangat Pagi', dj: 'DJ Rian', tracks: [] },
    { id: 2, startTime: '10:00', endTime: '14:00', title: 'Work & Code Lo-Fi Chill', dj: 'DJ Khanza Pro', tracks: [] },
    { id: 3, startTime: '14:00', endTime: '18:00', title: 'Hits Pop Nusantara & Dunia', dj: 'DJ Maya', tracks: [] },
    { id: 4, startTime: '18:00', endTime: '22:00', title: 'Retro 80s Synthwave & Nostalgia', dj: 'DJ Reza', tracks: [] },
    { id: 5, startTime: '22:00', endTime: '02:00', title: 'Midnight Jazz & Acoustic Night', dj: 'DJ Dian', tracks: [] }
  ]);

  // Dedicated HTML5 Audio Player for Listener
  const audioRef = useRef(null);
  const audioSourceNodeRef = useRef(null);

  // References to avoid re-triggering main subscription useEffect on volume changes
  const isPlayingRadioRef = useRef(isPlayingRadio);
  isPlayingRadioRef.current = isPlayingRadio;

  const isTunedInRef = useRef(isTunedIn);
  isTunedInRef.current = isTunedIn;

  const isDjPlayingRef = useRef(isDjPlaying);
  isDjPlayingRef.current = isDjPlaying;

  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const isDuckedRef = useRef(isDucked);
  isDuckedRef.current = isDucked;

  // Track paused time to resume smoothly without restarting from 0
  const pausedTimeRef = useRef(0);
  const [hasStarted, setHasStarted] = useState(false);

  // 1. Sync Radio State via WebSocket & Polling & BroadcastChannel
  useEffect(() => {
    // Setup audio element
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = 'anonymous';
      audioRef.current.preload = 'auto';
    }

    const audio = audioRef.current;

    // Connect audio element to Web Audio Analyser for visualizer
    const connectVisualizer = () => {
      try {
        audioEngine.init();
        if (!audioSourceNodeRef.current && audioEngine.ctx) {
          audioSourceNodeRef.current = audioEngine.ctx.createMediaElementSource(audio);
          audioSourceNodeRef.current.connect(audioEngine.preampNode || audioEngine.masterGain);
        }
      } catch (err) {
        // Already connected or browser policy
      }
    };

    // Synchronize music play/pause strictly with DJ studio state
    const applyDjPlayState = (playing, track) => {
      const isPlay = !!playing;
      setIsDjPlaying(isPlay);
      isDjPlayingRef.current = isPlay;

      if (!audio) return;

      if (isTunedInRef.current) {
        if (isPlay) {
          const targetSrc = (track && track.audioUrl) || liveTrack.audioUrl || '/api/current-audio';
          const currentSrcPath = audio.src ? new URL(audio.src, window.location.origin).pathname : '';
          const targetSrcPath = new URL(targetSrc, window.location.origin).pathname;

          const isNewTrack = !audio.src || currentSrcPath !== targetSrcPath;

          if (isNewTrack) {
            audio.src = targetSrc;

            // Live broadcast sync: if broadcaster sent startedAt timestamp, sync playback position!
            const startedAt = (track && track.startedAt) || (liveTrack && liveTrack.startedAt);
            if (startedAt) {
              const elapsed = Math.max(0, (Date.now() - startedAt) / 1000);
              const onMeta = () => {
                const maxDur = audio.duration || 3600;
                if (elapsed > 1 && elapsed < (maxDur - 1)) {
                  audio.currentTime = elapsed;
                }
                audio.removeEventListener('loadedmetadata', onMeta);
              };
              audio.addEventListener('loadedmetadata', onMeta);
            }
          }

          audio.volume = isMutedRef.current ? 0 : (isDuckedRef.current ? volumeRef.current * 0.5 : volumeRef.current);
          if (audio.paused) {
            audio.play().then(() => {
              setIsPlayingRadio(true);
              setHasStarted(true);
            }).catch(console.warn);
          }
        } else {
          // Broadcaster stopped or paused music in studio
          audio.pause();
          setIsPlayingRadio(false);
        }
      }
    };

    // Handler for real-time live broadcast signals (mic, jingles, ducking)
    const handleIncomingLiveSignal = (msg) => {
      if (!msg || !msg.type) return;

      if (msg.type === 'JINGLE_TRIGGER' && msg.id) {
        const eff = SOUNDBOARD_EFFECTS.find(s => s.id === msg.id);
        const name = eff ? eff.name : msg.id.toUpperCase();
        setActiveJingle(name);
        setTimeout(() => setActiveJingle(null), 3000);

        // Synthesize and play jingle in listener speakers directly!
        try {
          audioEngine.playJingle(msg.id, true);
        } catch (e) {}
      } else if (msg.type === 'MIC_STATUS') {
        setDjMicActive(!!msg.active);
        // Do NOT duck music simply because mic is opened
        if (!msg.active) {
          setIsDucked(false);
          if (audioRef.current && !isMutedRef.current) {
            audioRef.current.volume = volumeRef.current;
          }
        }
      } else if (msg.type === 'MIC_DUCKING') {
        const duckingActive = !!msg.isDucking;
        setIsDucked(duckingActive);
        if (audioRef.current && !isMutedRef.current) {
          // When speaking with auto-ducking ON, lower gently to 50% (NOT 16%)
          // When auto-ducking is OFF or DJ pauses speaking, stays 100% normal/stable!
          audioRef.current.volume = duckingActive ? volumeRef.current * 0.5 : volumeRef.current;
        }
      } else if (msg.type === 'AUTO_DUCKING_CONFIG') {
        if (!msg.enabled) {
          setIsDucked(false);
          if (audioRef.current && !isMutedRef.current) {
            audioRef.current.volume = volumeRef.current;
          }
        }
      } else if (msg.type === 'MIC_PCM' && msg.pcm) {
        setDjMicActive(true);
        try {
          audioEngine.playPcmChunk(msg.pcm, msg.sampleRate);
        } catch (e) {}
      } else if (msg.type === 'TRACK_SEEK' && typeof msg.time === 'number') {
        // Broadcaster fast-forwarded or rewound track time -> sync listener instantly!
        if (audioRef.current && isTunedInRef.current) {
          audioRef.current.currentTime = msg.time;
          setLiveTrack(prev => ({
            ...prev,
            startedAt: Date.now() - (msg.time * 1000)
          }));
        }
      }
    };

    // A. Fetch current state from Server on load
    const fetchRadioState = async () => {
      try {
        const res = await fetch('/api/radio-state');
        if (res.ok) {
          const data = await res.json();
          if (data.currentTrack) {
            setLiveTrack(prev => ({
              ...prev,
              ...data.currentTrack,
              audioUrl: data.currentTrack.audioUrl || '/api/current-audio'
            }));
          }
          setIsDjLive(data.isOnAir);
          if (data.listeners !== undefined) setListenerCount(data.listeners);
          if (data.isPlaying !== undefined) {
            applyDjPlayState(data.isPlaying, data.currentTrack);
          }
        }
      } catch (e) {}
    };

    fetchRadioState();
    const pollTimer = setInterval(fetchRadioState, 2500);

    // Fetch program schedule from server
    fetch('/api/schedule').then(r => r.json()).then(data => {
      if (data.schedule) setProgramSchedule(data.schedule);
    }).catch(() => {});

    // B. Real-time WebSocket connection for instant song updates & live DJ signals
    let ws;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const listenerId = getListenerClientId();
      ws = new WebSocket(`${protocol}//${window.location.host}/ws?role=listener&clientId=${listenerId}`);
      ws.onopen = () => {
        try {
          ws.send(JSON.stringify({ type: 'REGISTER_ROLE', role: 'listener' }));
        } catch (err) {}
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'RADIO_STATE' && msg.data) {
            if (msg.data.currentTrack) {
              setLiveTrack(prev => ({
                ...prev,
                ...msg.data.currentTrack,
                audioUrl: msg.data.currentTrack.audioUrl || '/api/current-audio'
              }));
            }
            if (msg.data.isOnAir !== undefined) setIsDjLive(msg.data.isOnAir);
            if (msg.data.listeners !== undefined) setListenerCount(msg.data.listeners);
            if (msg.data.isPlaying !== undefined) {
              applyDjPlayState(msg.data.isPlaying, msg.data.currentTrack);
            }
          } else if (msg.type === 'SCHEDULE_UPDATE' || msg.type === 'SCHEDULE_INIT') {
              if (msg.schedule) setProgramSchedule(msg.schedule);
          } else {
            handleIncomingLiveSignal(msg);
          }
        } catch (err) {}
      };
    } catch (err) {}

    // C. Instant BroadcastChannel Sync (for multiple tabs on same computer)
    let syncChannel;
    let liveMixChannel;
    if ('BroadcastChannel' in window) {
      syncChannel = new BroadcastChannel('khanza_radio_sync');
      syncChannel.onmessage = (e) => {
        const { type, track, isPlaying } = e.data || {};
        if (type === 'PLAY_STATE') {
          applyDjPlayState(isPlaying, track);
        } else if (type === 'TRACK_CHANGED' && track) {
          setLiveTrack(prev => ({
            ...prev,
            ...track,
            audioUrl: track.audioUrl || '/api/current-audio'
          }));
          applyDjPlayState(true, track);
        }
      };

      liveMixChannel = new BroadcastChannel('khanza_radio_live_mix');
      liveMixChannel.onmessage = (e) => {
        handleIncomingLiveSignal(e.data);
      };
    }

    return () => {
      clearInterval(pollTimer);
      if (ws) ws.close();
      if (syncChannel) syncChannel.close();
      if (liveMixChannel) liveMixChannel.close();
      if (audio) {
        audio.pause();
        audio.src = '';
      }
    };
  }, []);

  // Handle Play / Stop Radio
  const handleTogglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isTunedIn) {
      // Disconnect / stop listening session
      pausedTimeRef.current = audio.currentTime;
      audio.pause();
      setIsPlayingRadio(false);
      setIsTunedIn(false);
      isTunedInRef.current = false;
      audioEngine.pausePlayback();
    } else {
      // Connect to radio broadcast!
      audioEngine.init();
      setIsTunedIn(true);
      isTunedInRef.current = true;

      // Connect to visualizer
      try {
        if (!audioSourceNodeRef.current && audioEngine.ctx) {
          audioSourceNodeRef.current = audioEngine.ctx.createMediaElementSource(audio);
          audioSourceNodeRef.current.connect(audioEngine.preampNode || audioEngine.masterGain);
        }
      } catch (e) {}

      // If broadcaster is currently playing music, play music!
      if (isDjPlayingRef.current) {
        const targetSrc = liveTrack.audioUrl || '/api/current-audio';
        const currentSrcPath = audio.src ? new URL(audio.src, window.location.origin).pathname : '';
        const targetSrcPath = new URL(targetSrc, window.location.origin).pathname;

        if (!audio.src || currentSrcPath !== targetSrcPath) {
          audio.src = targetSrc;
          pausedTimeRef.current = 0;

          // Sync with broadcaster's elapsed play time
          if (liveTrack && liveTrack.startedAt) {
            const elapsed = Math.max(0, (Date.now() - liveTrack.startedAt) / 1000);
            const onMeta = () => {
              const maxDur = audio.duration || 3600;
              if (elapsed > 1 && elapsed < (maxDur - 1)) {
                audio.currentTime = elapsed;
              }
              audio.removeEventListener('loadedmetadata', onMeta);
            };
            audio.addEventListener('loadedmetadata', onMeta);
          }
        } else if (pausedTimeRef.current > 0) {
          audio.currentTime = pausedTimeRef.current;
        }

        audio.volume = isMuted ? 0 : (isDucked ? volume * 0.5 : volume);

        audio
          .play()
          .then(() => {
            setIsPlayingRadio(true);
            setHasStarted(true);
          })
          .catch(err => {
            console.warn('Audio play attempt with fallback stream:', err);
            audio.src = 'https://ice5.somafm.com/groovesalad-128-mp3';
            audio.play().then(() => {
              setIsPlayingRadio(true);
              setHasStarted(true);
            }).catch(console.warn);
          });
      } else {
        // Broadcaster hasn't played music yet:
        // Keep music paused, but listener is tuned in and Web Audio is ready to receive DJ mic & jingles!
        audio.pause();
        setIsPlayingRadio(false);
      }
    }
  };

  const handleVolume = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    volumeRef.current = val;
    const muted = val === 0;
    setIsMuted(muted);
    isMutedRef.current = muted;

    if (audioRef.current) {
      audioRef.current.volume = isDuckedRef.current ? val * 0.5 : val;
    }
    audioEngine.setMasterVolume(val);
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    isMutedRef.current = nextMuted;

    const targetVol = nextMuted ? 0 : (volume || 0.85);
    if (audioRef.current) {
      audioRef.current.volume = isDuckedRef.current ? targetVol * 0.5 : targetVol;
    }
    audioEngine.setMasterVolume(targetVol);
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/pendengar`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`Yuk dengerin siaran radio online seru di Khanza.NET RADIO! 📻✨\n${window.location.origin}/pendengar`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  // Detect which schedule slot is currently active based on real time
  const isSlotActive = (startTime, endTime) => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const slotStart = sh * 60 + sm;
    let slotEnd = eh * 60 + em;
    if (slotEnd <= slotStart) slotEnd += 24 * 60;
    const adjustedNow = currentMinutes < slotStart && slotEnd > 24 * 60 ? currentMinutes + 24 * 60 : currentMinutes;
    return adjustedNow >= slotStart && adjustedNow < slotEnd;
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-4 sm:gap-6 pb-20 sm:pb-6">
      {/* Hero Live Radio Card for Listeners */}
      <div className={`winamp-chassis rounded-xl sm:rounded-2xl p-3.5 sm:p-6 md:p-8 relative overflow-hidden shadow-2xl border-2 transition-all duration-300 ${skin.heroBorder}`}>
        {/* Glow ambient background effect */}
        <div className={`absolute -top-24 -right-24 w-72 sm:w-96 h-72 sm:h-96 ${skin.heroGlow1} rounded-full blur-3xl pointer-events-none transition-all duration-500`} />
        <div className={`absolute -bottom-24 -left-24 w-72 sm:w-96 h-72 sm:h-96 ${skin.heroGlow2} rounded-full blur-3xl pointer-events-none transition-all duration-500`} />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-5 sm:gap-8">
          {/* Radio Album Art / Spinning Vinyl (Compact on mobile) */}
          <div className="relative flex items-center justify-center">
            {/* Spinning Disc Effect */}
            <div className={`w-32 h-32 sm:w-44 sm:h-44 md:w-56 md:h-56 rounded-full bg-gradient-to-tr from-gray-900 via-gray-800 to-gray-900 border-3 sm:border-4 border-[#2b3548] p-2 sm:p-3 shadow-2xl relative flex items-center justify-center shrink-0 ${
              isPlayingRadio ? 'animate-[spin_10s_linear_infinite]' : ''
            }`}>
              {/* Vinyl Grooves */}
              <div className="w-full h-full rounded-full border border-gray-700/60 flex items-center justify-center">
                <div className="w-3/4 h-3/4 rounded-full border border-gray-700/40 flex items-center justify-center">
                  {/* Center Label */}
                  <div className={`w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full ${skin.vinylCenter} p-0.5 sm:p-1 flex flex-col items-center justify-center text-center shadow-lg transition-all duration-300`}>
                    <Radio className="w-4 h-4 sm:w-6 sm:h-6 text-black stroke-[2.5]" />
                    <span className="font-orbitron font-black text-[7px] sm:text-[9px] text-black tracking-widest mt-0.5">
                      KHANZA.NET
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Pulsing Badge */}
            <div className="absolute -top-1.5 -left-1.5 sm:-top-2 sm:-left-2">
              <span className={`px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-orbitron font-bold flex items-center gap-1.5 shadow-lg ${
                isDjLive
                  ? 'bg-rose-600 text-white on-air-active border border-rose-400'
                  : 'bg-emerald-600 text-white border border-emerald-400'
              }`}>
                <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isDjLive ? 'bg-white animate-ping' : 'bg-white'}`} />
                {isDjLive ? '🔴 DJ ON AIR' : '🟢 AUTO STREAM'}
              </span>
            </div>
          </div>

          {/* Player Info & Big Play Controls */}
          <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left gap-2.5 sm:gap-3 w-full">
            {/* Station Sub-badge */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-chakra font-bold border transition-all ${skin.stationBadge}`}>
                FM 107.7 MHz HD DIGITAL
              </span>
              <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-chakra text-gray-400">
                <Headphones className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-400" />
                <span className="text-gray-200 font-bold">{listenerCount}</span> Pendengar Aktif
              </span>
            </div>

            {/* Station Title */}
            <div>
              <h2 className="font-orbitron font-black text-xl sm:text-2xl md:text-3xl tracking-wider text-white">
                Khanza.NET RADIO
              </h2>
              <p className="font-chakra text-[11px] sm:text-xs text-gray-400 pt-0.5 sm:pt-1 max-w-lg">
                Radio streaming interaktif terbaik dengan kualitas audio 48kHz HD. Dengarkan musik siaran langsung penyiar dan nikmati obrolan seru!
              </p>
            </div>

            {/* Now Playing Bar */}
            <div className={`w-full border p-2.5 sm:p-3 rounded-xl flex items-center gap-2.5 sm:gap-3 transition-all ${skin.nowPlayingBox}`}>
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg border flex items-center justify-center shrink-0 transition-all ${skin.towerBg}`}>
                <RadioTower className={`w-4 h-4 ${skin.towerIcon} ${isPlayingRadio ? 'animate-pulse' : ''}`} />
              </div>

              <div className="flex-1 min-w-0 text-left">
                <span className="text-[8px] sm:text-[9px] font-chakra block uppercase">
                  {isDjPlaying && isPlayingRadio ? (
                    <span className="text-green-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping inline-block" />
                      ● MUSIK SEDANG MENGUDARA (ON AIR)
                    </span>
                  ) : !isDjPlaying ? (
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      ⏸️ MUSIK DI STUDIO SEDANG STANDBY / PAUSE
                    </span>
                  ) : (
                    <span className="text-gray-400">○ SIAP DIPUTAR</span>
                  )}
                </span>
                <p className={`font-chakra text-xs sm:text-sm font-bold truncate transition-colors ${skin.trackTitle}`}>
                  {liveTrack.artist} - {liveTrack.title}
                </p>
              </div>

              <span className="text-[9px] sm:text-[10px] font-orbitron text-purple-400 border border-purple-500/40 px-2 py-0.5 rounded bg-purple-950/40 shrink-0 hidden sm:inline">
                {liveTrack.kbps || '320 KBPS'}
              </span>
            </div>

            {/* Warning / Notice: Music is not played yet in studio */}
            {!isDjPlaying && (
              <div className="w-full bg-amber-950/80 border border-amber-500/70 p-2.5 sm:p-3 rounded-xl flex items-center justify-between gap-2.5 shadow-lg shadow-amber-900/20">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center shrink-0">
                    <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-left">
                    <span className="font-orbitron font-bold text-[11px] sm:text-xs text-amber-200 tracking-wide block">
                      MUSIK STUDIO BELUM DIPUTAR / DIJEDA
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-chakra text-amber-300/80 line-clamp-1 sm:line-clamp-none">
                      Penyiar belum memutar lagu. Namun siaran mikrofon penyiar tetap aktif!
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-orbitron font-bold bg-amber-500 text-black shrink-0">
                  STANDBY
                </span>
              </div>
            )}

            {/* Live DJ Mic Alert */}
            {djMicActive && (
              <div className="w-full bg-rose-950/80 border border-rose-500/70 p-2 sm:p-2.5 rounded-xl flex items-center justify-between gap-2.5 shadow-lg shadow-rose-900/30 animate-pulse">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center animate-bounce shrink-0">
                    <Mic className="w-3.5 h-3.5 text-black" />
                  </div>
                  <div className="text-left">
                    <span className="font-orbitron font-bold text-[11px] sm:text-xs text-rose-200 tracking-wider block">
                      🎙️ PENYIAR SEDANG BERBICARA (MIC ON AIR)
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-chakra text-rose-300/80 hidden sm:block">
                      Suara penyiar terdengar langsung di siaran radio
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-orbitron font-bold bg-rose-600 text-white shrink-0">
                  LIVE
                </span>
              </div>
            )}

            {/* Jingle Alert */}
            {activeJingle && (
              <div className="w-full bg-cyan-950/80 border border-cyan-500/70 p-2 sm:p-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-cyan-900/30">
                <Sparkles className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                <span className="font-chakra font-bold text-xs text-cyan-200 truncate">
                  🔔 Efek Suara: <span className="text-white underline">{activeJingle}</span>
                </span>
              </div>
            )}

            {/* Big Action Controls (Optimized for Mobile Touch) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-2.5 sm:gap-4 pt-1 sm:pt-2 w-full">
              {/* Giant Play / Pause Button */}
              <button
                onClick={handleTogglePlay}
                className={`w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-orbitron font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-xl transition-all transform hover:scale-105 active:scale-95 cursor-pointer touch-tap ${
                  !isTunedIn
                    ? skin.btnPlayReady
                    : isDjPlaying && isPlayingRadio
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-black shadow-amber-500/30'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white shadow-purple-500/30'
                }`}
              >
                {!isTunedIn ? (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    <span>DENGARKAN SIARAN RADIO</span>
                  </>
                ) : isDjPlaying && isPlayingRadio ? (
                  <>
                    <Pause className="w-5 h-5 fill-current" />
                    <span>JEDA RADIO</span>
                  </>
                ) : (
                  <>
                    <Radio className="w-5 h-5 animate-pulse" />
                    <span>TERHUBUNG (STANDBY)</span>
                  </>
                )}
              </button>

              {/* Volume & Share Controls Row */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Volume Slider */}
                <div className="flex-1 sm:flex-initial flex items-center justify-between sm:justify-start gap-2 bg-[#0d1017] border border-[#232b3a] px-3 py-2 rounded-xl">
                  <button onClick={toggleMute} className="text-gray-400 hover:text-white touch-tap" title="Mute/Unmute">
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className={`w-4 h-4 ${skin.volIcon}`} />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={handleVolume}
                    className="winamp-slider w-full sm:w-28"
                    title="Volume Suara Radio"
                  />
                  <span className={`font-lcd text-xs w-8 text-right shrink-0 ${skin.volText}`}>
                    {Math.round(volume * 100)}%
                  </span>
                </div>

                {/* Share Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={shareWhatsApp}
                    className="winamp-btn px-2.5 sm:px-3 py-2 rounded-xl text-xs font-chakra text-green-400 hover:text-white flex items-center justify-center gap-1.5 border-green-500/40 touch-tap"
                    title="Bagikan ke WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4 text-green-400" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </button>

                  <button
                    onClick={copyShareLink}
                    className="winamp-btn px-2.5 sm:px-3 py-2 rounded-xl text-xs font-chakra text-cyan-300 hover:text-white flex items-center justify-center gap-1.5 border-cyan-500/40 touch-tap"
                    title="Salin Link Radio"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="hidden sm:inline">{copiedLink ? 'Tersalin!' : 'Bagikan'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MOBILE SCREEN NAVIGATION TABS (HP & Tablet: < lg)          */}
      {/* ========================================================= */}
      <div className={`flex lg:hidden items-center bg-[#0d1017] p-1 rounded-xl border gap-1 shadow-lg select-none transition-all ${skin.tabBorder}`}>
        <button
          type="button"
          onClick={() => setMobileTab('chat')}
          className={`flex-1 py-2 px-1.5 rounded-lg text-xs font-chakra font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer touch-tap ${
            mobileTab === 'chat'
              ? skin.tabActiveChat
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Shoutbox & Chat</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('visualizer')}
          className={`flex-1 py-2 px-1.5 rounded-lg text-xs font-chakra font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer touch-tap ${
            mobileTab === 'visualizer'
              ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/30'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Visualizer</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('schedule')}
          className={`flex-1 py-2 px-1.5 rounded-lg text-xs font-chakra font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer touch-tap ${
            mobileTab === 'schedule'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-black shadow-md shadow-emerald-500/30'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Jadwal</span>
        </button>
      </div>

      {/* MOBILE TAB CONTENT (< lg) */}
      <div className="flex flex-col gap-4 lg:hidden">
        {mobileTab === 'chat' && (
          <div className="w-full">
            <ListenerChat />
          </div>
        )}

        {mobileTab === 'visualizer' && (
          <div className="w-full flex flex-col gap-3">
            <Visualizer theme={theme} />
          </div>
        )}

        {mobileTab === 'schedule' && (
          <div className="winamp-chassis rounded-xl p-3.5 flex flex-col gap-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#2d3748] pb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <span className="font-chakra text-xs font-bold text-gray-200 uppercase">
                  JADWAL PROGRAM SIARAN HARI INI
                </span>
              </div>
              <span className="text-[10px] font-chakra text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                24 JAM LIVE
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {programSchedule.map((prog) => {
                const active = isSlotActive(prog.startTime, prog.endTime);
                return (
                <div
                  key={prog.id}
                  className={`p-2.5 rounded-lg flex items-center justify-between text-xs font-chakra border transition-all ${
                    active
                      ? skin.scheduleActiveBg
                      : 'bg-[#10141d] border-[#1d2432] text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`font-lcd text-xs shrink-0 ${active ? skin.scheduleActiveClock : 'text-gray-400'}`}>
                      {prog.startTime} - {prog.endTime}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-white flex items-center gap-1.5 truncate">
                        {prog.title}
                        {active && (
                          <span className={`px-1.5 py-0.2 rounded text-[8px] font-orbitron font-bold shrink-0 ${skin.scheduleBadge}`}>
                            SEKARANG
                          </span>
                        )}
                      </p>
                      <span className="text-[10px] text-gray-400">Penyiar: {prog.dj}</span>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* DESKTOP SCREEN 2-COLUMN GRID (>= lg: Widescreen Layout)    */}
      {/* ========================================================= */}
      <div className="hidden lg:grid grid-cols-2 gap-6 items-start">
        {/* Left Column: Visualizer & Program Info */}
        <div className="flex flex-col gap-4">
          <Visualizer theme={theme} />

          {/* Program Schedule Card */}
          <div className="winamp-chassis rounded-xl p-4 flex flex-col gap-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#2d3748] pb-2">
              <div className="flex items-center gap-2">
                <Calendar className={`w-4 h-4 ${skin.scheduleActiveClock}`} />
                <span className="font-chakra text-xs font-bold text-gray-200 uppercase">
                  JADWAL PROGRAM SIARAN HARI INI
                </span>
              </div>
              <span className="text-[10px] font-chakra text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                LIVE STREAM 24 JAM
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {programSchedule.map((prog) => {
                const active = isSlotActive(prog.startTime, prog.endTime);
                return (
                <div
                  key={prog.id}
                  className={`p-2.5 rounded-lg flex items-center justify-between text-xs font-chakra border transition-all ${
                    active
                      ? skin.scheduleActiveBg
                      : 'bg-[#10141d] border-[#1d2432] text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-lcd text-sm w-24 shrink-0 font-bold ${active ? skin.scheduleActiveClock : 'text-gray-400'}`}>
                      {prog.startTime} - {prog.endTime}
                    </span>
                    <div>
                      <p className="font-bold text-white flex items-center gap-1.5">
                        {prog.title}
                        {active && (
                          <span className={`px-1.5 py-0.2 rounded text-[8px] font-orbitron font-bold shrink-0 ${skin.scheduleBadge}`}>
                            SEKARANG
                          </span>
                        )}
                      </p>
                      <span className="text-[10px] text-gray-400">Penyiar: {prog.dj}</span>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Live Shoutbox & Listener Chat */}
        <div className="flex flex-col gap-4">
          <ListenerChat />
        </div>
      </div>

      {/* ========================================================= */}
      {/* FLOATING STICKY BOTTOM BAR PLAYER (HP / Smartphone Only)  */}
      {/* ========================================================= */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-[#090d14]/95 backdrop-blur-md border-t p-2 px-3 shadow-[0_-5px_25px_rgba(0,0,0,0.85)] flex items-center justify-between gap-2.5 transition-all ${skin.stickyBorder}`}>
        <div
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer touch-tap"
          title="Ketuk untuk kembali ke pemutar utama"
        >
          <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${skin.stickyVinyl} flex items-center justify-center shrink-0 border border-white/20 shadow-md ${
            isPlayingRadio ? 'animate-[spin_6s_linear_infinite]' : ''
          }`}>
            <Radio className="w-4 h-4 text-black stroke-[2.5]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`font-chakra text-xs font-bold truncate ${skin.stickyTitle}`}>
              {liveTrack.title || 'Khanza.NET Live'}
            </p>
            <div className="flex items-center gap-1.5 text-[9px] font-chakra text-gray-400 truncate">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isPlayingRadio ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
              }`} />
              <span className="truncate">
                {isPlayingRadio ? (isDjLive ? '🔴 DJ ON AIR' : '🟢 STREAMING') : '○ SIAP DIPUTAR'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={toggleMute}
            className="w-8 h-8 rounded-lg bg-[#141a24] border border-[#273244] flex items-center justify-center text-gray-300 hover:text-white touch-tap"
            title="Mute / Unmute"
          >
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className={`w-4 h-4 ${skin.volIcon}`} />}
          </button>
          <button
            onClick={handleTogglePlay}
            className={`px-3.5 py-1.5 rounded-lg text-black font-orbitron font-bold text-xs flex items-center gap-1.5 shadow-lg touch-tap transition-all ${skin.stickyPlayBtn}`}
          >
            {!isTunedIn ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>PLAY</span>
              </>
            ) : isDjPlaying && isPlayingRadio ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>PLAY</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
