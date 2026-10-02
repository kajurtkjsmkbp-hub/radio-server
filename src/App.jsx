import React, { useState, useEffect, useRef } from 'react';
import { audioEngine } from './utils/audioEngine';
import { INITIAL_DEMO_TRACKS } from './utils/stationData';
import Navbar from './components/Navbar';
import WinampPlayer from './components/WinampPlayer';
import Visualizer from './components/Visualizer';
import EqualizerWindow from './components/EqualizerWindow';
import PlaylistWindow from './components/PlaylistWindow';
import BroadcastConsole from './components/BroadcastConsole';
import RadioStations from './components/RadioStations';
import ListenerChat from './components/ListenerChat';
import ListenerPortal from './components/ListenerPortal';
import BroadcasterLiveBoard from './components/BroadcasterLiveBoard';
import ScheduleManager from './components/ScheduleManager';

export default function App() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('khanza_radio_skin') || 'classic';
    } catch (e) {
      return 'classic';
    }
  });

  const handleSetTheme = (newTheme) => {
    setTheme(newTheme);
    try {
      localStorage.setItem('khanza_radio_skin', newTheme);
    } catch (e) {}
  };

  // Page Routing: 'listener' (Halaman Pendengar: /pendengar) vs 'studio' (Studio Penyiar: /penyiar)
  const [currentPage, setCurrentPage] = useState(() => {
    const p = window.location.pathname.toLowerCase();
    return (p.startsWith('/penyiar') || p.startsWith('/studio')) ? 'studio' : 'listener';
  });

  // Studio PIN Auth state
  const [isStudioUnlocked, setIsStudioUnlocked] = useState(() => {
    return sessionStorage.getItem('khanza_dj_auth') === 'true';
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [copiedListenerLink, setCopiedListenerLink] = useState(false);

  // Studio Sub-view: 'all', 'winamp', 'broadcast'
  const [studioView, setStudioView] = useState('all');

  // Winamp Windows Toggle
  const [showEq, setShowEq] = useState(true);
  const [showPl, setShowPl] = useState(true);

  // Audio & Playlist State
  const [playlist, setPlaylist] = useState(INITIAL_DEMO_TRACKS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isOnAir, setIsOnAir] = useState(false);

  // Scheduled Playout Automation State
  const [autoScheduleEnabled, setAutoScheduleEnabled] = useState(true);
  const [activeScheduledSlotId, setActiveScheduledSlotId] = useState(null);
  const [scheduledSlotBanner, setScheduledSlotBanner] = useState(null);

  // Hidden file input ref
  const globalFilePickerRef = useRef(null);

  // Sync routing with browser URL (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname.toLowerCase();
      const page = (p.startsWith('/penyiar') || p.startsWith('/studio')) ? 'studio' : 'listener';
      setCurrentPage(page);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Navigation handler
  const handleNavigate = (page) => {
    setCurrentPage(page);
    const targetPath = page === 'studio' ? '/penyiar' : '/pendengar';
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStudioUnlock = (e) => {
    e.preventDefault();
    if (pinInput.trim() === '1234' || pinInput.trim().toLowerCase() === 'admin' || pinInput.trim() === '') {
      setIsStudioUnlocked(true);
      sessionStorage.setItem('khanza_dj_auth', 'true');
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  // Auto-play next track when current finishes
  useEffect(() => {
    audioEngine.onTrackEnded = () => {
      handleNextTrack();
    };
  }, [currentIndex, playlist]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          if (isPlaying) handlePause();
          else handlePlay();
          break;
        case 'z':
          handlePrevTrack();
          break;
        case 'x':
          handlePlay();
          break;
        case 'c':
          handlePause();
          break;
        case 'v':
          handleStop();
          break;
        case 'b':
          handleNextTrack();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentIndex, playlist]);

  // Global Broadcast Channel for 0ms tab-to-tab sync
  const syncChannel = useRef(
    typeof window !== 'undefined' && 'BroadcastChannel' in window
      ? new BroadcastChannel('khanza_radio_sync')
      : null
  );

  const currentTrack = playlist[currentIndex] || null;

  // Play current track
  const handlePlay = async () => {
    if (!currentTrack) {
      if (playlist.length > 0) {
        loadAndPlayTrack(playlist[0], 0);
      }
      return;
    }

    audioEngine.startLiveStreamRelay();
    fetch('/api/radio-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isPlaying: true,
        isOnAir: true,
        currentTrack: {
          title: currentTrack.title,
          artist: currentTrack.artist,
          audioUrl: currentTrack.audioUrl || (currentTrack.file ? '/api/current-audio' : null)
        }
      })
    }).catch(console.warn);

    if (syncChannel.current) {
      syncChannel.current.postMessage({ type: 'PLAY_STATE', isPlaying: true });
    }

    if (currentTrack.isStream) {
      audioEngine.playStreamUrl(currentTrack.url);
      setIsPlaying(true);
    } else if (currentTrack.isProcedural) {
      try {
        const buffer = await audioEngine.generateDemoTrack(currentTrack.style || 'synthwave');
        audioEngine.playAudioBuffer(buffer);
        setIsPlaying(true);
      } catch (err) {
        console.error('Error generating procedural track:', err);
      }
    } else if (currentTrack.audioBuffer) {
      audioEngine.playAudioBuffer(currentTrack.audioBuffer);
      setIsPlaying(true);
    } else if (currentTrack.url) {
      audioEngine.playStreamUrl(currentTrack.url);
      setIsPlaying(true);
    }
  };

  const handlePause = () => {
    audioEngine.pausePlayback();
    setIsPlaying(false);

    fetch('/api/radio-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPlaying: false })
    }).catch(console.warn);

    if (syncChannel.current) {
      syncChannel.current.postMessage({ type: 'PLAY_STATE', isPlaying: false });
    }
  };

  const handleStop = () => {
    audioEngine.stopPlayback();
    setIsPlaying(false);

    fetch('/api/radio-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPlaying: false })
    }).catch(console.warn);

    if (syncChannel.current) {
      syncChannel.current.postMessage({ type: 'PLAY_STATE', isPlaying: false });
    }
  };

  const handleSeekTrack = (newTime) => {
    if (currentTrack) {
      const effectiveStartedAt = Date.now() - (newTime * 1000);
      fetch('/api/radio-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentTrack: {
            ...currentTrack,
            startedAt: effectiveStartedAt
          }
        })
      }).catch(console.warn);
    }
  };

  const loadAndPlayTrack = async (track, index) => {
    setCurrentIndex(index);

    // Notify server of track change with exact start timestamp for listener synchronization
    const trackPayload = {
      id: track.id,
      title: track.title,
      artist: track.artist || 'Penyiar Khanza.NET',
      album: track.album || 'Siaran Langsung',
      duration: track.duration || 0,
      audioUrl: track.audioUrl || (track.file ? '/api/current-audio' : null),
      isStream: !!track.isStream,
      kbps: track.kbps || '320 kbps',
      khz: track.khz || '44.1 kHz',
      startedAt: Date.now()
    };

    fetch('/api/radio-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isPlaying: true,
        isOnAir: true,
        currentTrack: trackPayload
      })
    }).catch(console.warn);

    if (syncChannel.current) {
      syncChannel.current.postMessage({
        type: 'TRACK_CHANGED',
        track: trackPayload,
        isPlaying: true
      });
    }

    audioEngine.startLiveStreamRelay();

    if (track.isStream) {
      audioEngine.playStreamUrl(track.url);
      setIsPlaying(true);
    } else if (track.isProcedural) {
      try {
        const buffer = await audioEngine.generateDemoTrack(track.style || 'synthwave');
        audioEngine.playAudioBuffer(buffer);
        setIsPlaying(true);
      } catch (err) {
        console.error('Error generating procedural track:', err);
      }
    } else if (track.file) {
      // Decode user file
      try {
        const arrayBuffer = await track.file.arrayBuffer();
        audioEngine.init();
        const decodedBuffer = await audioEngine.ctx.decodeAudioData(arrayBuffer);
        track.audioBuffer = decodedBuffer;
        track.duration = decodedBuffer.duration;
        audioEngine.playAudioBuffer(decodedBuffer);
        setIsPlaying(true);
      } catch (err) {
        console.warn('Fallback to ObjectURL for file:', err);
        const objUrl = URL.createObjectURL(track.file);
        audioEngine.playStreamUrl(objUrl);
        setIsPlaying(true);
      }
    } else if (track.audioBuffer) {
      audioEngine.playAudioBuffer(track.audioBuffer);
      setIsPlaying(true);
    } else if (track.url) {
      audioEngine.playStreamUrl(track.url);
      setIsPlaying(true);
    }
  };

  const handleNextTrack = () => {
    if (playlist.length === 0) return;
    const nextIdx = (currentIndex + 1) % playlist.length;
    loadAndPlayTrack(playlist[nextIdx], nextIdx);
  };

  const handlePrevTrack = () => {
    if (playlist.length === 0) return;
    const prevIdx = (currentIndex - 1 + playlist.length) % playlist.length;
    loadAndPlayTrack(playlist[prevIdx], prevIdx);
  };

  // Load a schedule slot's uploaded songs directly into the Winamp Playout Deck
  const handleLoadSlotToPlaylist = (slot, autoPlay = true) => {
    if (!slot || !slot.tracks || slot.tracks.length === 0) return;

    const slotTracks = slot.tracks.map((t, idx) => ({
      id: t.id || `sched-${slot.id}-${idx}`,
      title: t.title || t.name,
      artist: t.artist || slot.dj || 'Penyiar Khanza.NET',
      album: slot.title,
      url: t.url,
      audioUrl: t.url,
      duration: t.duration || 210,
      kbps: '320 kbps',
      khz: '44.1 kHz',
      isStream: false
    }));

    setPlaylist(slotTracks);
    setActiveScheduledSlotId(slot.id);
    setScheduledSlotBanner({
      title: slot.title,
      time: `${slot.startTime} - ${slot.endTime}`,
      dj: slot.dj,
      count: slotTracks.length
    });

    console.log(`[Playout] Memuat ${slotTracks.length} lagu dari slot jadwal "${slot.title}"`);
    if (autoPlay && slotTracks.length > 0) {
      loadAndPlayTrack(slotTracks[0], 0);
    }
  };

  // Auto-Scheduler Watcher: Memantau jam siaran setiap 10 detik dan memutar otomatis lagu jadwal
  useEffect(() => {
    if (!autoScheduleEnabled) return;

    const checkAutoSchedule = async () => {
      try {
        const res = await fetch('/api/schedule');
        if (!res.ok) return;
        const data = await res.json();
        const scheduleList = data.schedule || [];

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // Cari slot program yang aktif saat jam ini
        const activeSlot = scheduleList.find(slot => {
          const [sh, sm] = slot.startTime.split(':').map(Number);
          const [eh, em] = slot.endTime.split(':').map(Number);
          const slotStart = sh * 60 + sm;
          let slotEnd = eh * 60 + em;
          if (slotEnd <= slotStart) slotEnd += 24 * 60;
          const adjustedNow = currentMinutes < slotStart && slotEnd > 24 * 60 ? currentMinutes + 24 * 60 : currentMinutes;
          return adjustedNow >= slotStart && adjustedNow < slotEnd;
        });

        // Jika ada slot aktif, memiliki lagu yang diinputkan, dan belum dimuat saat ini:
        if (activeSlot && activeSlot.tracks && activeSlot.tracks.length > 0) {
          if (activeScheduledSlotId !== activeSlot.id) {
            console.log(`[Auto-Scheduler] Jam siaran aktif: "${activeSlot.title}". Otomatis memutar ${activeSlot.tracks.length} lagu.`);
            handleLoadSlotToPlaylist(activeSlot, true);
          }
        }
      } catch (err) {
        console.warn('Auto-scheduler check error:', err);
      }
    };

    checkAutoSchedule();
    const interval = setInterval(checkAutoSchedule, 10000);
    return () => clearInterval(interval);
  }, [autoScheduleEnabled, activeScheduledSlotId]);

  // Add files from disk (Upload to server & add to playlist)
  const handleAddFiles = (files) => {
    if (!files || files.length === 0) return;

    // 1. Upload first file to server so listeners on the network can stream it
    const primaryFile = files[0];
    const cleanTitle = primaryFile.name.replace(/\.[^/.]+$/, '');
    const cleanArtist = 'Penyiar Khanza.NET';

    try {
      fetch('/api/upload-track', {
        method: 'POST',
        headers: {
          'x-title': encodeURIComponent(cleanTitle),
          'x-artist': encodeURIComponent(cleanArtist)
        },
        body: primaryFile
      }).catch(console.warn);
    } catch (e) {}

    const newItems = files.map((file, idx) => ({
      id: `file-${Date.now()}-${idx}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      artist: 'Penyiar Khanza.NET',
      album: 'Local Storage',
      file: file,
      audioUrl: '/api/current-audio',
      duration: 0,
      kbps: '320 kbps',
      khz: '44.1 kHz'
    }));

    setPlaylist(prev => [...prev, ...newItems]);

    // If added, play the newly uploaded track immediately!
    if (newItems.length > 0) {
      loadAndPlayTrack(newItems[0], playlist.length);
    }
  };

  const handleAddUrl = (trackObj) => {
    setPlaylist(prev => [...prev, trackObj]);
    loadAndPlayTrack(trackObj, playlist.length);
  };

  const handleLoadDemos = () => {
    setPlaylist(prev => [...prev, ...INITIAL_DEMO_TRACKS]);
  };

  const handleRemoveTrack = (index) => {
    setPlaylist(prev => prev.filter((_, i) => i !== index));
    if (index === currentIndex) {
      handleStop();
    } else if (index < currentIndex) {
      setCurrentIndex(c => c - 1);
    }
  };

  const handleClearPlaylist = () => {
    handleStop();
    setPlaylist([]);
    setCurrentIndex(0);
  };

  const handleShufflePlaylist = () => {
    const shuffled = [...playlist].sort(() => Math.random() - 0.5);
    setPlaylist(shuffled);
    setCurrentIndex(0);
  };

  // Radio station tuned
  const handleSelectRadioStation = (station) => {
    const stationTrack = {
      id: station.id,
      title: station.name,
      artist: `${station.genre} • ${station.location}`,
      album: 'Live Radio Broadcast',
      url: station.url,
      isStream: true,
      duration: 0,
      kbps: station.bitrate,
      khz: '44.1 kHz'
    };

    const existingIdx = playlist.findIndex(t => t.id === station.id);
    if (existingIdx !== -1) {
      loadAndPlayTrack(playlist[existingIdx], existingIdx);
    } else {
      setPlaylist(prev => [stationTrack, ...prev]);
      loadAndPlayTrack(stationTrack, 0);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col bg-[#080a0f] text-gray-100 ${
      theme === 'cyberpunk' ? 'theme-cyberpunk' : theme === 'amber' ? 'theme-amber' : ''
    }`}>
      {/* Hidden file input for Winamp Eject / Open */}
      <input
        type="file"
        multiple
        accept="audio/*"
        ref={globalFilePickerRef}
        onChange={(e) => e.target.files && handleAddFiles(Array.from(e.target.files))}
        className="hidden"
      />

      {/* Top Header Navbar */}
      <Navbar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        studioView={studioView}
        setStudioView={setStudioView}
        theme={theme}
        setTheme={handleSetTheme}
        isOnAir={isOnAir}
      />

      {/* Main Pages */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2 sm:p-6 flex flex-col gap-4 sm:gap-6">
        {/* ==================================================== */}
        {/* HALAMAN 1: PORTAL PENDENGAR RADIO (URL: /pendengar)  */}
        {/* ==================================================== */}
        {currentPage === 'listener' && (
          <ListenerPortal
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onPlay={handlePlay}
            onPause={handlePause}
            theme={theme}
            onSwitchToStudio={() => handleNavigate('studio')}
          />
        )}

        {/* ==================================================== */}
        {/* HALAMAN 2: STUDIO PENYIAR & WINAMP (URL: /penyiar)   */}
        {/* ==================================================== */}
        {currentPage === 'studio' && (
          !isStudioUnlocked ? (
            <div className="max-w-md mx-auto my-12 winamp-chassis p-6 rounded-2xl flex flex-col gap-4 text-center border-2 border-emerald-500/40 shadow-2xl">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-3xl">
                🎙️
              </div>
              <div>
                <h2 className="font-orbitron font-bold text-xl text-white">RUANG KHUSUS PENYIAR</h2>
                <p className="font-chakra text-xs text-gray-400 mt-1">
                  Halaman ini khusus untuk kru/penyiar radio Khanza.NET RADIO.
                </p>
              </div>

              <form onSubmit={handleStudioUnlock} className="flex flex-col gap-3 mt-2">
                <input
                  type="password"
                  placeholder="Masukkan PIN (Default: 1234)"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="bg-[#121620] border border-[#2d3748] rounded-xl px-4 py-2.5 text-center text-sm font-chakra text-white outline-none focus:border-emerald-400"
                  autoFocus
                />
                {pinError && (
                  <p className="text-xs text-rose-400 font-chakra">PIN salah! Gunakan PIN default: 1234</p>
                )}
                <button
                  type="submit"
                  className="winamp-btn py-2.5 rounded-xl font-chakra font-bold text-xs bg-emerald-500 text-black border-emerald-400 hover:bg-emerald-400 transition-colors"
                >
                  BUKA KONSOL SIARAN
                </button>
              </form>

              <div className="border-t border-gray-800 pt-3">
                <button
                  type="button"
                  onClick={() => handleNavigate('listener')}
                  className="text-xs font-chakra text-gray-500 hover:text-cyan-400"
                >
                  ← Saya Pendengar, Bawa Saya ke Halaman Pendengar (/pendengar)
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Studio Telemetry & Live Online Listener Monitor Board */}
              <BroadcasterLiveBoard
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                isOnAir={isOnAir}
              />

              {/* Scheduled Playout Active Banner */}
              {scheduledSlotBanner && (
                <div className="w-full bg-gradient-to-r from-cyan-950/90 via-emerald-950/80 to-[#0e1420] border-2 border-cyan-400/80 p-3 sm:p-4 rounded-2xl flex items-center justify-between gap-3 shadow-xl shadow-cyan-900/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-lg shrink-0">
                      📻
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-orbitron font-bold text-xs text-cyan-300">
                          PROGRAM TERJADWAL AKTIF
                        </span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-orbitron bg-emerald-400 text-black font-black">
                          AUTO-PLAY
                        </span>
                      </div>
                      <p className="font-chakra font-bold text-sm text-white mt-0.5">
                        [{scheduledSlotBanner.time}] {scheduledSlotBanner.title}
                        {scheduledSlotBanner.dj && <span className="text-gray-400 text-xs ml-2 font-normal">• Penyiar: {scheduledSlotBanner.dj}</span>}
                      </p>
                      <p className="text-[10px] font-chakra text-cyan-200/70">
                        Memutar otomatis {scheduledSlotBanner.count} lagu dari slot jadwal siaran ke deck Winamp & pendengar
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setScheduledSlotBanner(null)}
                    className="text-gray-400 hover:text-white p-1.5 text-xs rounded hover:bg-gray-800"
                    title="Tutup pemberitahuan"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Studio Sub-view: FULL STUDIO */}
              {studioView === 'all' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Left Column: Winamp Deck, EQ, Playlist & Visualizer */}
                <div className="flex flex-col gap-4">
                  <WinampPlayer
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onStop={handleStop}
                    onNext={handleNextTrack}
                    onPrev={handlePrevTrack}
                    onOpenFile={() => globalFilePickerRef.current && globalFilePickerRef.current.click()}
                    showEq={showEq}
                    setShowEq={setShowEq}
                    showPl={showPl}
                    setShowPl={setShowPl}
                    theme={theme}
                    onSeek={handleSeekTrack}
                  />

                  <Visualizer theme={theme} />

                  {showEq && (
                    <EqualizerWindow
                      onClose={() => setShowEq(false)}
                      theme={theme}
                    />
                  )}

                  {showPl && (
                    <PlaylistWindow
                      playlist={playlist}
                      currentIndex={currentIndex}
                      onSelectTrack={(idx) => loadAndPlayTrack(playlist[idx], idx)}
                      onAddFiles={handleAddFiles}
                      onAddUrl={handleAddUrl}
                      onLoadDemos={handleLoadDemos}
                      onRemoveTrack={handleRemoveTrack}
                      onClearPlaylist={handleClearPlaylist}
                      onShufflePlaylist={handleShufflePlaylist}
                      onClose={() => setShowPl(false)}
                    />
                  )}
                </div>

                {/* Right Column: Broadcast Console, Global Stations, & DJ Chat */}
                <div className="flex flex-col gap-4">
                  <BroadcastConsole theme={theme} />

                  <ScheduleManager
                    onLoadSlotToPlaylist={handleLoadSlotToPlaylist}
                    autoScheduleEnabled={autoScheduleEnabled}
                    onToggleAutoSchedule={() => setAutoScheduleEnabled(v => !v)}
                    currentPlayingSlotId={activeScheduledSlotId}
                  />

                  <RadioStations
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    onSelectStation={handleSelectRadioStation}
                    onAddCustomStation={(st) => handleSelectRadioStation(st)}
                  />

                  <ListenerChat />
                </div>
              </div>
            )}

            {/* Studio Sub-view: WINAMP ONLY */}
            {studioView === 'winamp' && (
              <div className="max-w-2xl mx-auto w-full flex flex-col gap-4">
                <WinampPlayer
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onStop={handleStop}
                  onNext={handleNextTrack}
                  onPrev={handlePrevTrack}
                  onOpenFile={() => globalFilePickerRef.current && globalFilePickerRef.current.click()}
                  showEq={showEq}
                  setShowEq={setShowEq}
                  showPl={showPl}
                  setShowPl={setShowPl}
                  theme={theme}
                  onSeek={handleSeekTrack}
                />

                <Visualizer theme={theme} />

                {showEq && (
                  <EqualizerWindow
                    onClose={() => setShowEq(false)}
                    theme={theme}
                  />
                )}

                {showPl && (
                  <PlaylistWindow
                    playlist={playlist}
                    currentIndex={currentIndex}
                    onSelectTrack={(idx) => loadAndPlayTrack(playlist[idx], idx)}
                    onAddFiles={handleAddFiles}
                    onAddUrl={handleAddUrl}
                    onLoadDemos={handleLoadDemos}
                    onRemoveTrack={handleRemoveTrack}
                    onClearPlaylist={handleClearPlaylist}
                    onShufflePlaylist={handleShufflePlaylist}
                    onClose={() => setShowPl(false)}
                  />
                )}
              </div>
            )}

            {/* Studio Sub-view: BROADCAST ONLY */}
            {studioView === 'broadcast' && (
              <div className="max-w-3xl mx-auto w-full flex flex-col gap-4">
                <BroadcastConsole theme={theme} />
                <Visualizer theme={theme} />
              </div>
            )}
          </div>
        )
      )}
      </main>

      {/* Footer Info & Shortcuts */}
      <footer className="border-t border-[#1c222e] py-3 px-4 bg-[#07090e] text-center text-xs font-chakra text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Khanza.NET RADIO &bull; {currentPage === 'studio' ? 'Broadcast Studio Mode' : 'Public Listener Portal'}</span>
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            {currentPage === 'studio' ? (
              <>
                <span>Shortcut: <kbd className="px-1 py-0.5 bg-gray-800 rounded text-cyan-400">Spasi</kbd> Play/Pause</span>
                <span><kbd className="px-1 py-0.5 bg-gray-800 rounded text-cyan-400">Z/B</kbd> Prev/Next</span>
                <span><kbd className="px-1 py-0.5 bg-gray-800 rounded text-cyan-400">1-8</kbd> Jingles</span>
              </>
            ) : (
              <span>Tekan tombol Putar Radio untuk mendengarkan siaran live</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
