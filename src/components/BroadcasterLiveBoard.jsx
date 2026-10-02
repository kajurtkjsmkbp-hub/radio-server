import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Radio, 
  Activity, 
  Wifi, 
  Clock, 
  Heart, 
  MessageSquare, 
  ExternalLink, 
  Copy, 
  Check, 
  Headphones, 
  Sparkles, 
  Music,
  Signal,
  Flame,
  Zap,
  RefreshCw,
  Share2
} from 'lucide-react';

export default function BroadcasterLiveBoard({ currentTrack, isPlaying, isOnAir }) {
  const [listenerCount, setListenerCount] = useState(0);
  const [peakListeners, setPeakListeners] = useState(0);
  const [streamClientsCount, setStreamClientsCount] = useState(0);
  const [reactionsCount, setReactionsCount] = useState(48);
  const [chatCount, setChatCount] = useState(4);
  const [copiedLink, setCopiedLink] = useState(false);
  const [clockTime, setClockTime] = useState('');
  const [onAirUptime, setOnAirUptime] = useState('00:00:00');
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [lastPingTime, setLastPingTime] = useState(Date.now());

  const startTimeRef = useRef(Date.now());
  const wsRef = useRef(null);

  // 1. Digital Studio Clock & Air-Time Timer
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hrs = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const secs = String(now.getSeconds()).padStart(2, '0');
      setClockTime(`${hrs}:${mins}:${secs} WIB`);

      // Calculate On-Air session duration
      const diffSecs = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const upH = String(Math.floor(diffSecs / 3600)).padStart(2, '0');
      const upM = String(Math.floor((diffSecs % 3600) / 60)).padStart(2, '0');
      const upS = String(diffSecs % 60).padStart(2, '0');
      setOnAirUptime(`${upH}:${upM}:${upS}`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Poll fallback and initial fetch
  const fetchTelemetry = async () => {
    try {
      const [resState, resChat] = await Promise.all([
        fetch('/api/radio-state'),
        fetch('/api/chat')
      ]);

      if (resState.ok) {
        const stateData = await resState.json();
        if (stateData.listeners !== undefined) {
          const count = Number(stateData.listeners) || 0;
          setListenerCount(count);
          setPeakListeners(prev => Math.max(prev, count));
        }
      }

      if (resChat.ok) {
        const chatData = await resChat.json();
        if (chatData.reactionsCount !== undefined) {
          setReactionsCount(chatData.reactionsCount);
        }
        if (chatData.messages && Array.isArray(chatData.messages)) {
          setChatCount(chatData.messages.length);
        }
      }
      setLastPingTime(Date.now());
    } catch (e) {
      console.warn('Telemetry fetch error:', e);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const pollInterval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(pollInterval);
  }, []);

  // 3. WebSocket Real-time Telemetry Sync
  useEffect(() => {
    let ws = null;
    let reconnectTimer = null;

    const connectWS = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}/ws?role=dj`);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsWsConnected(true);
          try {
            ws.send(JSON.stringify({ type: 'REGISTER_ROLE', role: 'dj' }));
          } catch (e) {}
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            setLastPingTime(Date.now());

            if (msg.type === 'RADIO_STATE' && msg.data) {
              if (msg.data.listeners !== undefined) {
                const count = Number(msg.data.listeners) || 0;
                setListenerCount(count);
                setPeakListeners(prev => Math.max(prev, count));
              }
              if (msg.data.streamClientsCount !== undefined) {
                setStreamClientsCount(msg.data.streamClientsCount);
              }
            } else if (msg.type === 'ONLINE_COUNT') {
              const count = Number(msg.count) || 0;
              setListenerCount(count);
              setPeakListeners(prev => Math.max(prev, count));
            } else if (msg.type === 'CHAT_INIT') {
              if (msg.reactionsCount !== undefined) setReactionsCount(msg.reactionsCount);
              if (msg.messages && Array.isArray(msg.messages)) setChatCount(msg.messages.length);
            } else if (msg.type === 'LIVE_REACTION') {
              if (msg.reactionsCount !== undefined) {
                setReactionsCount(msg.reactionsCount);
              } else {
                setReactionsCount(c => c + 1);
              }
            } else if (msg.type === 'CHAT_MESSAGE') {
              setChatCount(c => c + 1);
            }
          } catch (e) {}
        };

        ws.onclose = () => {
          setIsWsConnected(false);
          reconnectTimer = setTimeout(connectWS, 2500);
        };

        ws.onerror = () => {
          try { ws.close(); } catch (e) {}
        };
      } catch (e) {
        reconnectTimer = setTimeout(connectWS, 2500);
      }
    };

    connectWS();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  const listenerUrl = typeof window !== 'undefined' ? `${window.location.origin}/pendengar` : '/pendengar';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(listenerUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  const handleOpenListenerTab = () => {
    window.open('/pendengar', '_blank');
  };

  return (
    <div className="w-full winamp-chassis rounded-xl p-4 sm:p-5 border border-cyan-500/40 shadow-2xl relative overflow-hidden bg-gradient-to-b from-[#181d28] via-[#121620] to-[#0c0e14]">
      {/* Subtle background glow effect */}
      <div className="absolute top-0 right-1/4 w-96 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* TOP HEADER: Studio Info, Status, Digital Clock */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3.5 border-b border-gray-800/80 relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500" />
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-chakra text-base sm:text-lg font-bold tracking-wider text-white flex items-center gap-2">
                PAPAN TELEMETRI & STATUS SIARAN
              </h2>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                100% REALTIME
              </span>
            </div>
            <p className="text-xs font-chakra text-gray-400 flex items-center gap-2">
              <span>Monitoring Pendengar Aktif & Kualitas Emisi Radio Khanza.NET</span>
            </p>
          </div>
        </div>

        {/* Right Info: Live Indicator & Clock */}
        <div className="flex items-center gap-2.5 self-end md:self-auto">
          <div className="flex items-center gap-2 bg-black/60 border border-gray-800 px-3 py-1.5 rounded-lg shadow-inner">
            <span className={`w-2.5 h-2.5 rounded-full ${isWsConnected ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]' : 'bg-amber-400'}`} />
            <span className="font-mono text-xs text-gray-300">
              {isWsConnected ? 'SYNC AKTIF' : 'MENGHUBUNGKAN...'}
            </span>
          </div>

          <div className="bg-black/80 border border-cyan-500/30 px-3 py-1.5 rounded-lg shadow-inner">
            <div className="flex items-center gap-1.5 text-cyan-400 font-lcd text-lg sm:text-xl font-bold tracking-wider">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{clockTime || '00:00:00 WIB'}</span>
            </div>
          </div>

          <button
            onClick={fetchTelemetry}
            title="Muat Ulang Telemetri"
            className="p-1.5 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-cyan-400 border border-gray-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* MAIN 4-CARD TELEMETRY GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 my-4 relative z-10">
        
        {/* CARD 1: PENDENGAR ONLINE (FEATURED HERO CARD) */}
        <div className="winamp-panel p-4 rounded-xl border border-cyan-500/60 bg-gradient-to-br from-cyan-950/40 via-[#0e141f] to-[#0a0d13] relative overflow-hidden group shadow-[0_0_20px_rgba(6,182,212,0.15)] flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all pointer-events-none" />
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-chakra font-bold tracking-wider text-cyan-300 uppercase flex items-center gap-1.5">
                <Users className="w-4 h-4 text-cyan-400" />
                PENDENGAR ONLINE
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                listenerCount > 0 
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50' 
                  : 'bg-gray-800/80 text-gray-400 border border-gray-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${listenerCount > 0 ? 'bg-emerald-400 animate-ping' : 'bg-gray-500'}`} />
                {listenerCount > 0 ? 'ACTIVE LIVE' : 'STANDBY'}
              </span>
            </div>

            {/* BIG LCD LISTENER NUMBER */}
            <div className="flex items-baseline gap-2 my-2">
              <span className="font-lcd text-5xl sm:text-6xl font-bold tracking-tight text-cyan-300 glow-cyan leading-none drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]">
                {String(listenerCount).padStart(2, '0')}
              </span>
              <div className="flex flex-col">
                <span className="font-chakra text-xs font-bold text-gray-200">
                  {listenerCount === 1 ? 'PENDENGAR' : 'PENDENGAR'}
                </span>
                <span className="text-[10px] font-chakra text-cyan-400/80">
                  Terhubung ke Siaran
                </span>
              </div>
            </div>
          </div>

          {/* Sub metrics */}
          <div className="pt-2 mt-2 border-t border-cyan-500/20 flex items-center justify-between text-[11px] font-chakra">
            <span className="text-gray-400">Puncak Sesi: <strong className="text-cyan-200 font-mono">{peakListeners}</strong></span>
            <span className="text-emerald-400 font-mono text-[10px] flex items-center gap-1">
              <Headphones className="w-3 h-3" /> Live Audio
            </span>
          </div>
        </div>

        {/* CARD 2: STATUS ON-AIR & EMISI */}
        <div className="winamp-panel p-4 rounded-xl border border-red-500/40 bg-gradient-to-br from-red-950/30 via-[#130f14] to-[#0a0d13] relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-chakra font-bold tracking-wider text-red-300 uppercase flex items-center gap-1.5">
                <Signal className="w-4 h-4 text-red-400" />
                STATUS PEMANCAR
              </span>
              <span className="text-[10px] font-mono text-gray-400">CH-01 HD</span>
            </div>

            <div className="my-2">
              {isOnAir ? (
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 rounded-lg bg-red-600/30 border border-red-500 text-red-300 font-chakra font-black tracking-wider text-sm flex items-center gap-2 on-air-active shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    LIVE ON AIR
                  </div>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-1 rounded">
                    320 KBPS
                  </span>
                </div>
              ) : (
                <div className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/60 text-amber-300 font-chakra font-bold text-sm inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  STANDBY / OFF-AIR
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 mt-2 border-t border-gray-800 flex items-center justify-between text-[11px] font-chakra">
            <span className="text-gray-400">Durasi Mengudara:</span>
            <span className="font-mono text-xs font-bold text-red-300 bg-black/60 px-2 py-0.5 rounded border border-red-950">
              {onAirUptime}
            </span>
          </div>
        </div>

        {/* CARD 3: TRACK MENGUDARA (NOW STREAMING) */}
        <div className="winamp-panel p-4 rounded-xl border border-purple-500/40 bg-gradient-to-br from-purple-950/30 via-[#110e1a] to-[#0a0d13] relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-chakra font-bold tracking-wider text-purple-300 uppercase flex items-center gap-1.5">
                <Music className="w-4 h-4 text-purple-400" />
                AUDIO SUMBER
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-chakra font-bold ${
                isPlaying 
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50' 
                  : 'bg-blue-950/80 text-blue-300 border border-blue-500/50'
              }`}>
                {isPlaying ? 'MUSIK PLAYING' : 'MIC BROADCAST'}
              </span>
            </div>

            <div className="my-1.5">
              <div className="font-chakra text-sm font-bold text-white truncate max-w-full" title={currentTrack?.title || 'Audio Siaran Khanza.NET'}>
                {currentTrack?.title || 'Audio Siaran Khanza.NET'}
              </div>
              <div className="font-chakra text-xs text-purple-300/80 truncate">
                {currentTrack?.artist || 'Studio Penyiar Live'}
              </div>
            </div>
          </div>

          {/* Mini Equalizer Visualizer */}
          <div className="pt-2 mt-2 border-t border-gray-800 flex items-center justify-between">
            <div className="flex items-end gap-1 h-4">
              {[40, 75, 55, 95, 60, 85, 45].map((h, i) => (
                <span
                  key={i}
                  className="w-1 bg-gradient-to-t from-purple-500 to-cyan-400 rounded-sm"
                  style={{
                    height: isPlaying ? `${h}%` : '25%',
                    transition: 'height 0.2s ease'
                  }}
                />
              ))}
            </div>
            <span className="text-[10px] font-mono text-gray-400">
              48.0 kHz HD
            </span>
          </div>
        </div>

        {/* CARD 4: INTERAKSI & SHOUTBOX */}
        <div className="winamp-panel p-4 rounded-xl border border-pink-500/40 bg-gradient-to-br from-pink-950/30 via-[#160d16] to-[#0a0d13] relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-chakra font-bold tracking-wider text-pink-300 uppercase flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-pink-400 fill-pink-500/30" />
                INTERAKSI PENDENGAR
              </span>
              <span className="text-[10px] font-mono text-pink-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> LIVE
              </span>
            </div>

            <div className="flex items-center gap-4 my-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-pink-500/20 border border-pink-400/40 flex items-center justify-center text-pink-400">
                  <Flame className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="font-lcd text-2xl font-bold text-pink-300 glow-amber leading-none">
                    {reactionsCount}
                  </div>
                  <span className="text-[10px] font-chakra text-gray-400 uppercase">Reaksi Love/Fire</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400">
                  <MessageSquare className="w-5 h-5 text-cyan-300" />
                </div>
                <div>
                  <div className="font-lcd text-2xl font-bold text-cyan-300 glow-cyan leading-none">
                    {chatCount}
                  </div>
                  <span className="text-[10px] font-chakra text-gray-400 uppercase">Shoutbox</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 mt-2 border-t border-gray-800 flex items-center justify-between text-[11px] font-chakra">
            <span className="text-gray-400">Respon Pendengar:</span>
            <span className="text-pink-300 font-bold font-chakra text-[10px]">
              {reactionsCount > 10 ? '🔥 Sangat Ramai' : 'Aktif Berinteraksi'}
            </span>
          </div>
        </div>

      </div>

      {/* BOTTOM ACTION BAR: Shareable Listener Link & Controls */}
      <div className="bg-black/50 border border-cyan-500/30 rounded-lg p-2.5 sm:p-3 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 shrink-0">
            <Share2 className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1 sm:flex-initial">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-chakra font-bold text-gray-200">
                LINK SIARAN UNTUK PENDENGAR:
              </span>
              <code className="text-cyan-300 font-mono text-xs bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40 select-all truncate max-w-[260px] sm:max-w-none">
                {listenerUrl}
              </code>
            </div>
            <p className="text-[11px] font-chakra text-gray-400 truncate">
              Kirimkan link ini ke teman, grup WhatsApp, atau medsos agar mereka langsung terhubung.
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          <button
            onClick={handleCopyLink}
            className="winamp-btn px-3.5 py-1.5 rounded-lg text-xs font-chakra font-bold text-cyan-300 border-cyan-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">TERSALIN!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>SALIN LINK</span>
              </>
            )}
          </button>

          <button
            onClick={handleOpenListenerTab}
            title="Buka Halaman Pendengar di Tab Baru untuk Mengetes"
            className="winamp-btn px-3.5 py-1.5 rounded-lg text-xs font-chakra font-bold text-purple-300 border-purple-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>BUKA TAB PENDENGAR</span>
          </button>
        </div>
      </div>
    </div>
  );
}
