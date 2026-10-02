import React, { useState, useEffect, useRef } from 'react';
import { audioEngine } from '../utils/audioEngine';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  FolderOpen,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Sliders,
  ListMusic,
  Gauge
} from 'lucide-react';

export default function WinampPlayer({
  currentTrack,
  isPlaying,
  onPlay,
  onPause,
  onStop,
  onNext,
  onPrev,
  onOpenFile,
  showEq,
  setShowEq,
  showPl,
  setShowPl,
  theme = 'classic',
  onSeek
}) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [timeMode, setTimeMode] = useState('elapsed'); // 'elapsed' | 'remaining'
  const [volume, setVolume] = useState(0.85);
  const [balance, setBalance] = useState(0);
  const [pitch, setPitch] = useState(1.0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('all'); // 'off', 'all', 'one'
  const [isMuted, setIsMuted] = useState(false);
  const prevVolumeRef = useRef(0.85);

  // Poll current playback time
  useEffect(() => {
    const timer = setInterval(() => {
      const cur = audioEngine.getCurrentTime();
      const dur = audioEngine.getDuration();
      setCurrentTime(cur);
      if (dur > 0) setDuration(dur);
    }, 150);

    return () => clearInterval(timer);
  }, []);

  // Format seconds to MM:SS
  const formatTime = (secs) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const displayedTime = () => {
    if (timeMode === 'remaining' && duration > 0) {
      const rem = Math.max(0, duration - currentTime);
      return `-${formatTime(rem)}`;
    }
    return formatTime(currentTime);
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    audioEngine.seekPlayback(newTime);
    if (onSeek) onSeek(newTime);
  };

  const [isMonitorMuted, setIsMonitorMuted] = useState(false);

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    audioEngine.setMusicVolume(val);
  };

  // Mute ONLY local studio/laptop speaker (Broadcast to listeners keeps playing unaffected!)
  const toggleMonitorMute = () => {
    const next = !isMonitorMuted;
    setIsMonitorMuted(next);
    audioEngine.setStudioMonitorMute(next);
  };

  const handleBalanceChange = (e) => {
    const val = parseFloat(e.target.value);
    setBalance(val);
    audioEngine.setBalance(val);
  };

  const handlePitchChange = (e) => {
    const val = parseFloat(e.target.value);
    setPitch(val);
    audioEngine.setPlaybackRate(val);
  };

  return (
    <div className="winamp-chassis w-full max-w-xl mx-auto rounded-lg p-3 relative flex flex-col gap-2.5 shadow-2xl">
      {/* Winamp Title Bar */}
      <div className="flex items-center justify-between px-2 py-1 bg-gradient-to-r from-[#1c222d] via-[#2a3242] to-[#1c222d] rounded border border-[#3b4556]">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-cyan-500/80 border border-cyan-300 shadow-[0_0_8px_rgba(0,243,255,0.6)] flex items-center justify-center text-[8px] font-bold text-black">
            ⚡
          </div>
          <span className="font-orbitron text-[11px] font-bold tracking-wider text-gray-200 uppercase">
            WINAMP AUDIO DECK 2026 PRO
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-chakra text-gray-400">
          <span className="px-1.5 py-0.5 rounded bg-black/40 border border-gray-700 text-cyan-400">
            KHANZA.NET AUDIO
          </span>
        </div>
      </div>

      {/* Main Winamp LCD Display Panel */}
      <div className="winamp-panel p-2 rounded flex flex-col gap-1.5 relative overflow-hidden bg-[#07090e]">
        {/* Top Display Row: Time & Marquee Title */}
        <div className="flex items-center gap-3">
          {/* 7-Segment Digital Time Box (Click to toggle elapsed/remaining) */}
          <div
            onClick={() => setTimeMode(m => m === 'elapsed' ? 'remaining' : 'elapsed')}
            className="cursor-pointer bg-[#050608] border border-[#1b2230] px-2.5 py-1 rounded flex items-center gap-1 select-none hover:border-cyan-500/50 transition-colors"
            title="Klik untuk ubah: Waktu Berjalan / Sisa Waktu"
          >
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-chakra text-gray-500 leading-none">
                {timeMode === 'elapsed' ? 'ELAPSED' : 'REMAIN'}
              </span>
              <span className={`font-lcd text-3xl font-bold tracking-wider ${
                theme === 'amber' ? 'glow-amber' : theme === 'cyberpunk' ? 'glow-cyan' : 'glow-green'
              }`}>
                {displayedTime()}
              </span>
            </div>
          </div>

          {/* Marquee Ticker & Metadata Badges */}
          <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
            {/* Scrolling Track Title */}
            <div className="bg-[#050608] border border-[#1b2230] rounded px-2 py-1 overflow-hidden relative h-7 flex items-center">
              <div className={isPlaying ? 'animate-marquee' : 'truncate'}>
                <span className={`font-chakra text-sm font-semibold tracking-wide ${
                  theme === 'amber' ? 'text-amber-300' : theme === 'cyberpunk' ? 'text-cyan-300' : 'text-green-300'
                }`}>
                  {currentTrack ? `${currentTrack.artist} - ${currentTrack.title}` : 'KHANZA.NET RADIO READY // NO TRACK LOADED'}
                </span>
              </div>
            </div>

            {/* Badges: Bitrate, Khz, Stereo */}
            <div className="flex items-center justify-between text-[10px] font-orbitron px-1 pt-1 text-gray-400">
              <div className="flex items-center gap-2">
                <span className="text-cyan-400 font-bold">
                  {currentTrack?.kbps || '320'} <span className="text-[8px] text-gray-500">KBPS</span>
                </span>
                <span className="text-purple-400 font-bold">
                  {currentTrack?.khz || '44.1'} <span className="text-[8px] text-gray-500">KHZ</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5 font-chakra text-[9px]">
                <span className={`px-1 rounded border ${
                  isPlaying ? 'bg-green-950/80 border-green-500 text-green-400' : 'border-gray-800 text-gray-600'
                }`}>
                  STEREO
                </span>
                <span className={`px-1 rounded border ${
                  audioEngine.autoDuckingEnabled && audioEngine.isDucking
                    ? 'bg-amber-950/80 border-amber-500 text-amber-400 animate-pulse'
                    : 'border-gray-800 text-gray-600'
                }`}>
                  DUCKING
                </span>
                {isMonitorMuted && (
                  <span className="px-1 rounded border bg-amber-950/80 border-amber-400 text-amber-300 font-bold animate-pulse" title="Speaker penyiar senyap, siaran tetap mengudara!">
                    SPEAKER MUTE
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Track Position Scrubber / Seek Bar */}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px] font-lcd text-gray-400 w-9 text-right">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            disabled={duration === 0}
            className="winamp-slider flex-1"
            title="Seek audio track"
          />
          <span className="text-[10px] font-lcd text-gray-400 w-9 text-left">
            {duration > 0 ? formatTime(duration) : '--:--'}
          </span>
        </div>
      </div>

      {/* Primary Transport Controls */}
      <div className="flex items-center justify-between gap-1 px-1">
        {/* Playback Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={onPrev}
            className="winamp-btn p-2 rounded text-gray-300 hover:text-white"
            title="Previous Track (Z)"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={isPlaying ? onPause : onPlay}
            className={`winamp-btn px-4 py-2 rounded text-white font-bold flex items-center gap-1.5 ${
              isPlaying ? 'bg-cyan-900 border-cyan-400 active' : ''
            }`}
            title="Play / Pause (X / C)"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current text-amber-400" />
                <span className="text-xs font-chakra font-bold text-amber-400">PAUSE</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current text-green-400" />
                <span className="text-xs font-chakra font-bold text-green-400">PLAY</span>
              </>
            )}
          </button>

          <button
            onClick={onStop}
            className="winamp-btn p-2 rounded text-gray-300 hover:text-white"
            title="Stop Playback (V)"
          >
            <Square className="w-4 h-4 fill-current text-rose-400" />
          </button>

          <button
            onClick={onNext}
            className="winamp-btn p-2 rounded text-gray-300 hover:text-white"
            title="Next Track (B)"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={onOpenFile}
            className="winamp-btn p-2 rounded text-cyan-400 hover:text-cyan-300 ml-1"
            title="Open Audio File / URL (L)"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
        </div>

        {/* Shuffle & Repeat Toggles */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsShuffle(!isShuffle)}
            className={`winamp-btn p-1.5 rounded text-xs font-chakra flex items-center gap-1 ${
              isShuffle ? 'active text-cyan-300 border-cyan-500' : 'text-gray-400'
            }`}
            title="Toggle Shuffle"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[10px]">SHUF</span>
          </button>

          <button
            onClick={() => {
              const modes = ['all', 'one', 'off'];
              const next = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
              setRepeatMode(next);
            }}
            className={`winamp-btn p-1.5 rounded text-xs font-chakra flex items-center gap-1 ${
              repeatMode !== 'off' ? 'active text-green-300 border-green-500' : 'text-gray-400'
            }`}
            title={`Repeat Mode: ${repeatMode}`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[10px] uppercase">{repeatMode}</span>
          </button>
        </div>

        {/* Windows Toggle: EQ & PL */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowEq(!showEq)}
            className={`winamp-btn px-2 py-1 rounded text-xs font-chakra font-bold flex items-center gap-1 ${
              showEq ? 'active text-cyan-300 border-cyan-500' : 'text-gray-400'
            }`}
            title="Toggle Equalizer Window"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>EQ</span>
          </button>

          <button
            onClick={() => setShowPl(!showPl)}
            className={`winamp-btn px-2 py-1 rounded text-xs font-chakra font-bold flex items-center gap-1 ${
              showPl ? 'active text-purple-300 border-purple-500' : 'text-gray-400'
            }`}
            title="Toggle Playlist Window"
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span>PL</span>
          </button>
        </div>
      </div>

      {/* Sliders: Volume, Balance & DJ Pitch */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-[#262c38]">
        {/* Volume & Studio Monitor Speaker Mute */}
        <div className="flex items-center gap-2 bg-[#121620] px-2.5 py-1.5 rounded border border-[#232b3a]">
          {/* Dedicated Studio Monitor Mute Button */}
          <button
            type="button"
            onClick={toggleMonitorMute}
            className={`px-2 py-1 rounded text-[9px] font-chakra font-bold flex items-center gap-1.5 transition-all shrink-0 border select-none ${
              isMonitorMuted
                ? 'bg-amber-500/20 text-amber-300 border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)] animate-pulse'
                : 'bg-[#181d29] text-gray-300 border-[#2b3548] hover:text-white hover:border-cyan-500/60'
            }`}
            title="MUTE SPEAKER PENYIAR: Matikan speaker lokal laptop Anda agar hening, siaran keluar ke pendengar tetap berjalan 100%."
          >
            {isMonitorMuted ? (
              <>
                <VolumeX className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="tracking-wide">SPK MUTE</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="tracking-wide">MUTE SPK</span>
              </>
            )}
          </button>

          {/* Volume Slider Section */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex justify-between items-center text-[9px] font-chakra text-gray-400 pb-0.5">
              <span>VOLUME</span>
              <span className="text-cyan-400 font-bold font-mono">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="winamp-slider w-full"
            />
          </div>
        </div>

        {/* Balance / Pan Slider */}
        <div className="flex items-center gap-2 bg-[#121620] px-2 py-1 rounded border border-[#232b3a]">
          <div className="flex-1 flex flex-col">
            <div className="flex justify-between text-[9px] font-chakra text-gray-400">
              <span>BALANCE</span>
              <span className="text-gray-300 font-bold">
                {balance === 0 ? 'CENTER' : balance < 0 ? `L ${Math.abs(Math.round(balance * 100))}%` : `R ${Math.round(balance * 100)}%`}
              </span>
            </div>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.05"
              value={balance}
              onChange={handleBalanceChange}
              className="winamp-slider"
            />
          </div>
        </div>

        {/* DJ Pitch / Speed Slider */}
        <div className="flex items-center gap-2 bg-[#121620] px-2 py-1 rounded border border-[#232b3a]">
          <Gauge className="w-4 h-4 text-purple-400 shrink-0" />
          <div className="flex-1 flex flex-col">
            <div className="flex justify-between text-[9px] font-chakra text-gray-400">
              <span>DJ PITCH / SPEED</span>
              <span className="text-purple-400 font-bold">
                {pitch.toFixed(2)}x ({pitch > 1 ? `+${Math.round((pitch - 1) * 100)}%` : `${Math.round((pitch - 1) * 100)}%`})
              </span>
            </div>
            <input
              type="range"
              min="0.80"
              max="1.20"
              step="0.01"
              value={pitch}
              onChange={handlePitchChange}
              className="winamp-slider"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
