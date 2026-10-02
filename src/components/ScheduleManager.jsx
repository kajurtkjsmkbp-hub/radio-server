import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit3,
  Music,
  Upload,
  Save,
  X,
  FileAudio,
  Timer,
  Users,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertCircle,
  Play,
  Radio,
  Zap,
  ListMusic,
  Library
} from 'lucide-react';
import MediaLibraryModal from './MediaLibraryModal';
import { uploadFileWithProgress } from '../utils/uploader';

export default function ScheduleManager({
  onLoadSlotToPlaylist,
  autoScheduleEnabled = true,
  onToggleAutoSchedule,
  currentPlayingSlotId
}) {
  const [schedule, setSchedule] = useState([]);
  const [editSlot, setEditSlot] = useState(null); // null = closed, object = editing
  const [isAdding, setIsAdding] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [expandedSlot, setExpandedSlot] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null); // { slotId, current, total, name, percent, speedMBs, uploadedMB, fileSizeMB, etaSeconds }
  const [slotActionMessage, setSlotActionMessage] = useState(null);
  const [largeFileWarningModal, setLargeFileWarningModal] = useState(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryTargetSlotId, setLibraryTargetSlotId] = useState(null);
  const fileInputRefs = useRef({});

  const openLibraryModalForSlot = (slotId) => {
    setLibraryTargetSlotId(slotId);
    setIsLibraryOpen(true);
  };

  // Clock tick every 10 seconds for real-time active slot detection
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Fetch schedule on mount
  useEffect(() => {
    fetch('/api/schedule')
      .then(r => r.json())
      .then(data => {
        if (data.schedule) setSchedule(data.schedule);
      })
      .catch(() => {});

    // Listen for real-time updates via WebSocket
    let ws;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/ws?role=dj&clientId=schedule_mgr`);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'SCHEDULE_UPDATE' || msg.type === 'SCHEDULE_INIT') {
            if (msg.schedule) setSchedule(msg.schedule);
          }
        } catch (err) {}
      };
    } catch (err) {}

    return () => { if (ws) ws.close(); };
  }, []);

  // Check if a slot is currently active based on real time
  const isSlotActive = (startTime, endTime) => {
    const now = currentTime;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const slotStart = sh * 60 + sm;
    let slotEnd = eh * 60 + em;
    if (slotEnd <= slotStart) slotEnd += 24 * 60;
    const adjustedNow = currentMinutes < slotStart && slotEnd > 24 * 60 ? currentMinutes + 24 * 60 : currentMinutes;
    return adjustedNow >= slotStart && adjustedNow < slotEnd;
  };

  // Calculate slot duration in minutes
  const getSlotDuration = (startTime, endTime) => {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    let startMin = sh * 60 + sm;
    let endMin = eh * 60 + em;
    if (endMin <= startMin) endMin += 24 * 60;
    return endMin - startMin;
  };

  // Estimate tracks needed
  const estimateTracksNeeded = (slotDurationMinutes, avgTrackDuration = 210) => {
    return Math.ceil((slotDurationMinutes * 60) / avgTrackDuration);
  };

  // Save slot (add or update)
  const handleSaveSlot = async (slotData) => {
    try {
      const res = await fetch('/api/schedule/slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot: slotData })
      });
      const data = await res.json();
      if (data.schedule) setSchedule(data.schedule);
    } catch (e) {
      console.warn('Error saving slot:', e);
    }
    setEditSlot(null);
    setIsAdding(false);
  };

  // Delete slot
  const handleDeleteSlot = async (id) => {
    try {
      const res = await fetch(`/api/schedule/slot/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.schedule) setSchedule(data.schedule);
    } catch (e) {
      console.warn('Error deleting slot:', e);
    }
  };

  // Handle uploading actual audio MP3 files to the server for a specific schedule slot with real-time progress
  const handleTrackUpload = (slotId, files) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);

    // Warning if any file exceeds ~95 MB (Cloudflare Tunnel Free limit)
    const oversizedFiles = fileList.filter(f => f.size > 95 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setLargeFileWarningModal({
        file: oversizedFiles[0],
        slotId,
        onConfirm: () => executeTrackUpload(slotId, fileList),
        onCancel: () => {
          setLargeFileWarningModal(null);
          if (fileInputRefs.current[slotId]) fileInputRefs.current[slotId].value = '';
        }
      });
      return;
    }

    executeTrackUpload(slotId, fileList);
  };

  const executeTrackUpload = async (slotId, fileList) => {
    let successCount = 0;
    let totalUploadedBytes = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '');
      setUploadProgress({
        slotId,
        current: i + 1,
        total: fileList.length,
        name: cleanTitle,
        percent: 0,
        speedMBs: '0.00',
        uploadedMB: '0.0',
        fileSizeMB: (file.size / (1024 * 1024)).toFixed(1),
        etaSeconds: 0
      });

      try {
        const data = await uploadFileWithProgress({
          url: `/api/schedule/${slotId}/upload-track`,
          headers: {
            'x-title': encodeURIComponent(cleanTitle),
            'x-filename': encodeURIComponent(file.name)
          },
          file,
          onProgress: (prog) => {
            setUploadProgress({
              slotId,
              current: i + 1,
              total: fileList.length,
              name: cleanTitle,
              ...prog
            });
          }
        });

        if (data.schedule) {
          setSchedule(data.schedule);
        }
        successCount++;
        totalUploadedBytes += file.size;
      } catch (err) {
        console.error('Error uploading track to slot:', err);
        alert(`Gagal mengunggah "${file.name}": ${err.message}`);
        break;
      }
    }
    setUploadProgress(null);

    if (fileInputRefs.current[slotId]) fileInputRefs.current[slotId].value = '';

    if (successCount > 0) {
      const mb = (totalUploadedBytes / (1024 * 1024)).toFixed(1);
      setSlotActionMessage(`Berhasil mengunggah ${successCount} lagu (${mb} MB) ke slot jadwal!`);
      setTimeout(() => setSlotActionMessage(null), 6000);
    }
  };

  // Remove track from slot on server and disk
  const handleRemoveTrack = async (slotId, trackId) => {
    try {
      const res = await fetch(`/api/schedule/${slotId}/track/${trackId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.schedule) setSchedule(data.schedule);
    } catch (e) {
      console.warn('Error deleting track from slot:', e);
    }
  };

  // Format time display
  const formatDuration = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h} jam ${m} mnt`;
    if (h > 0) return `${h} jam`;
    return `${m} mnt`;
  };

  // Format seconds to mm:ss
  const formatSeconds = (sec) => {
    if (!sec || isNaN(sec)) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  // Total stats
  const totalSlots = schedule.length;
  const totalHours = schedule.reduce((acc, s) => acc + getSlotDuration(s.startTime, s.endTime), 0) / 60;
  const totalTracks = schedule.reduce((acc, s) => acc + (s.tracks?.length || 0), 0);
  const totalNeeded = schedule.reduce((acc, s) => {
    const dur = getSlotDuration(s.startTime, s.endTime);
    return acc + estimateTracksNeeded(dur, s.avgTrackDuration || 210);
  }, 0);

  return (
    <div className="winamp-chassis rounded-xl p-3 sm:p-4 flex flex-col gap-3 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#2d3748] pb-2.5 gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <span className="font-orbitron text-[11px] font-bold tracking-wider text-gray-200 uppercase block">
              JADWAL PROGRAM SIARAN & AUTO-PLAY
            </span>
            <span className="text-[9px] font-chakra text-gray-400">
              Lagu yang diinputkan akan otomatis memutar siaran sesuai jamnya
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
          {/* Auto-Play Toggle */}
          <button
            type="button"
            onClick={onToggleAutoSchedule}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-chakra font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
              autoScheduleEnabled
                ? 'bg-emerald-950/80 border-emerald-400 text-emerald-300 shadow-sm shadow-emerald-500/20'
                : 'bg-gray-800/80 border-gray-600 text-gray-400'
            }`}
            title="Saklar otomatis memutar playlist jadwal saat jam mulai program siaran tiba"
          >
            <Zap className={`w-3 h-3 ${autoScheduleEnabled ? 'text-emerald-400 fill-current' : 'text-gray-500'}`} />
            <span>AUTO-PLAY: {autoScheduleEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Real-time Clock */}
          <span className="text-[10px] font-lcd text-cyan-400 px-2 py-0.5 rounded bg-[#0a0d14] border border-cyan-500/30">
            {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
          </span>

          {/* Open Media Library Button */}
          <button
            type="button"
            onClick={() => {
              setLibraryTargetSlotId(null);
              setIsLibraryOpen(true);
            }}
            className="winamp-btn px-2.5 py-1 rounded text-[10px] font-chakra text-amber-300 hover:text-white flex items-center gap-1.5 font-bold border-amber-500/50 shadow-sm shadow-amber-500/10 cursor-pointer"
            title="Buka Pustaka Musik Server Proxmox untuk melihat dan memilih koleksi MP3"
          >
            <Library className="w-3 h-3 text-amber-400" />
            <span>PUSTAKA SERVER</span>
          </button>

          {/* Add Slot Button */}
          <button
            onClick={() => {
              setIsAdding(true);
              setEditSlot({
                id: null,
                startTime: '07:00',
                endTime: '08:00',
                title: '',
                dj: '',
                tracks: [],
                avgTrackDuration: 210
              });
            }}
            className="winamp-btn px-2.5 py-1 rounded text-[10px] font-chakra text-emerald-300 hover:text-white flex items-center gap-1 font-bold border-emerald-500/50"
          >
            <Plus className="w-3 h-3" />
            TAMBAH
          </button>
        </div>
      </div>

      {/* TOAST / ACTION NOTIFICATION */}
      {slotActionMessage && (
        <div className="bg-emerald-950/90 border border-emerald-500/60 rounded-xl px-4 py-2.5 text-xs text-emerald-200 flex items-center justify-between shadow-lg shadow-emerald-950/50 animate-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold text-emerald-300">{slotActionMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSlotActionMessage(null)}
            className="p-1 rounded text-emerald-400 hover:text-emerald-100 hover:bg-emerald-900/50"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Schedule Slot List */}
      <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto pr-0.5">
        {schedule.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-xs font-chakra">
            <Calendar className="w-8 h-8 mx-auto text-gray-600 mb-2" />
            <p>Belum ada jadwal program siaran.</p>
            <p className="text-[10px] text-gray-600">Klik + TAMBAH untuk membuat slot siaran dan mengunggah lagunya.</p>
          </div>
        ) : (
          schedule.map((slot) => {
            const active = isSlotActive(slot.startTime, slot.endTime);
            const duration = getSlotDuration(slot.startTime, slot.endTime);
            const needed = estimateTracksNeeded(duration, slot.avgTrackDuration || 210);
            const uploaded = slot.tracks?.length || 0;
            const progress = needed > 0 ? Math.min((uploaded / needed) * 100, 100) : 0;
            const isExpanded = expandedSlot === slot.id;
            const isCurrentlyBroadcastingThisSlot = currentPlayingSlotId === slot.id;

            return (
              <div key={slot.id} className={`rounded-xl border transition-all overflow-hidden ${
                isCurrentlyBroadcastingThisSlot
                  ? 'bg-[#091522] border-cyan-400 shadow-xl shadow-cyan-950/60 ring-1 ring-cyan-400/60'
                  : active
                  ? 'bg-[#081714] border-emerald-500/80 shadow-lg shadow-emerald-950/50'
                  : 'bg-[#0a0e17] border-[#1d2536] hover:border-[#2a364d]'
              }`}>
                {/* Slot Header */}
                <div
                  className="p-3 flex items-center justify-between cursor-pointer select-none transition-colors hover:bg-white/[0.02]"
                  onClick={() => setExpandedSlot(isExpanded ? null : slot.id)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Time Box */}
                    <div className={`flex flex-col items-center justify-center px-2 py-1.5 rounded-lg shrink-0 w-[74px] border shadow-inner ${
                      isCurrentlyBroadcastingThisSlot
                        ? 'bg-[#05111c] border-cyan-400/60 text-cyan-300'
                        : active
                        ? 'bg-[#051710] border-emerald-500/60 text-emerald-300'
                        : 'bg-[#060910] border-[#1f283a] text-cyan-400'
                    }`}>
                      <span className="font-lcd text-xs sm:text-[13px] font-bold leading-none tracking-wider">{slot.startTime}</span>
                      <span className="text-[8px] text-gray-500 uppercase my-0.5 tracking-wider font-semibold">s/d</span>
                      <span className="font-lcd text-xs sm:text-[13px] font-bold leading-none tracking-wider opacity-90">{slot.endTime}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-chakra font-bold text-xs sm:text-sm text-white tracking-wide truncate">{slot.title}</p>
                        {isCurrentlyBroadcastingThisSlot ? (
                          <span className="px-2 py-0.5 rounded text-[8px] font-orbitron bg-cyan-400 text-black font-black shrink-0 animate-pulse flex items-center gap-1 shadow-sm shadow-cyan-400/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                            SEDANG MENGUDARA
                          </span>
                        ) : active ? (
                          <span className="px-2 py-0.5 rounded text-[8px] font-orbitron bg-emerald-500 text-black font-bold shrink-0 animate-pulse flex items-center gap-1 shadow-sm shadow-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-black" />
                            JAM SIARAN AKTIF
                          </span>
                        ) : null}
                      </div>

                      {/* Meta Tags */}
                      <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#121824] border border-[#1e2738] text-[10px] font-chakra text-gray-300">
                          <Users className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                          <span className="text-gray-400">DJ:</span>
                          <strong className="text-gray-200 font-medium">{slot.dj || 'Studio Auto'}</strong>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#121824] border border-[#1e2738] text-[10px] font-chakra text-gray-300">
                          <Timer className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                          <span>{formatDuration(duration)}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#121824] border border-[#1e2738] text-[10px] font-chakra text-gray-300">
                          <Music className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                          <strong className={uploaded >= needed ? 'text-emerald-400' : 'text-cyan-300'}>{uploaded}</strong>
                          <span className="text-gray-400">/ ~{needed} lagu</span>
                        </span>
                      </div>

                      {/* Progress Bar of Songs Available */}
                      <div className="flex items-center gap-2 mt-2 max-w-sm">
                        <div className="flex-1 h-1.5 bg-[#080d16] border border-[#1c2436] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              progress >= 100
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                : progress >= 50
                                ? 'bg-gradient-to-r from-cyan-500 to-blue-400'
                                : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className={`text-[8px] font-chakra font-bold shrink-0 ${
                          progress >= 100 ? 'text-emerald-400' : 'text-gray-400'
                        }`}>
                          {Math.round(progress)}% terisi
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Right */}
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {/* Play Slot Now Button */}
                    {slot.tracks && slot.tracks.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onLoadSlotToPlaylist) onLoadSlotToPlaylist(slot, true);
                        }}
                        className={`h-7 px-2.5 rounded-lg text-[10px] font-chakra font-bold flex items-center gap-1.5 transition-all border ${
                          isCurrentlyBroadcastingThisSlot
                            ? 'bg-cyan-400 text-black border-cyan-300 shadow-sm shadow-cyan-400/40 ring-1 ring-cyan-300'
                            : 'bg-[#101726] text-cyan-300 border-cyan-500/40 hover:bg-cyan-500 hover:text-black'
                        }`}
                        title="Putar semua lagu di jadwal ini ke pemutar Winamp sekarang"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span className="hidden sm:inline">
                          {isCurrentlyBroadcastingThisSlot ? 'SEDANG DIPUTAR' : 'PUTAR JADWAL'}
                        </span>
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditSlot({ ...slot });
                        setIsAdding(false);
                      }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#1f283a] bg-[#101522] text-gray-400 hover:text-cyan-300 hover:border-cyan-500/40 hover:bg-[#141c2c] transition-colors"
                      title="Edit slot jadwal"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Hapus slot program "${slot.title}"?`)) {
                          handleDeleteSlot(slot.id);
                        }
                      }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#1f283a] bg-[#101522] text-gray-400 hover:text-rose-400 hover:border-rose-500/40 hover:bg-[#1b1219] transition-colors"
                      title="Hapus slot jadwal"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#1f283a] bg-[#101522] text-gray-400">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Content: Track List & Real Upload Engine */}
                {isExpanded && (
                  <div className="border-t border-[#1d2536] p-3 sm:p-4 flex flex-col gap-3 bg-[#060911]/90">
                    {/* Estimation & Slot Insights Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-chakra">
                      <div className="bg-[#0b101b] border border-[#1d273a] rounded-lg p-2.5 flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                          <Timer className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">Durasi Program</div>
                          <div className="font-bold text-cyan-300 truncate">{formatDuration(duration)}</div>
                        </div>
                      </div>

                      <div className="bg-[#0b101b] border border-[#1d273a] rounded-lg p-2.5 flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-purple-950/70 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                          <Music className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">Target / Rata-rata</div>
                          <div className="font-bold text-gray-200">
                            ~{needed} lagu <span className="text-[10px] text-gray-400 font-normal">(@{Math.round((slot.avgTrackDuration || 210) / 60 * 10) / 10}m)</span>
                          </div>
                        </div>
                      </div>

                      <div className={`border rounded-lg p-2.5 flex items-center gap-2.5 ${
                        progress >= 100
                          ? 'bg-emerald-950/30 border-emerald-500/40'
                          : 'bg-amber-950/30 border-amber-500/40'
                      }`}>
                        <div className={`w-7 h-7 rounded-md border flex items-center justify-center shrink-0 ${
                          progress >= 100
                            ? 'bg-emerald-900/50 border-emerald-400/50 text-emerald-400'
                            : 'bg-amber-900/50 border-amber-400/50 text-amber-400'
                        }`}>
                          {progress >= 100 ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[9px] uppercase tracking-wider font-semibold text-gray-400">Kesiapan Siaran</div>
                          <div className={`font-bold truncate ${progress >= 100 ? 'text-emerald-300' : 'text-amber-300'}`}>
                            {progress >= 100 ? 'Kuota Lagu Cukup' : `Kurang ~${needed - uploaded} lagu`}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Upload & Management Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[#090e18] border border-[#1a2334] p-2.5 rounded-xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="file"
                          multiple
                          accept="audio/*"
                          ref={el => fileInputRefs.current[slot.id] = el}
                          onChange={(e) => handleTrackUpload(slot.id, e.target.files)}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[slot.id]?.click()}
                          className="winamp-btn px-3 py-1.5 rounded-lg text-xs font-chakra font-bold text-emerald-300 hover:text-white flex items-center gap-1.5 border-emerald-500/50 transition-all cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          UPLOAD FILE MUSIK (MP3)
                        </button>

                        <button
                          type="button"
                          onClick={() => openLibraryModalForSlot(slot.id)}
                          className="winamp-btn px-3 py-1.5 rounded-lg text-xs font-chakra font-bold text-amber-300 hover:text-white flex items-center gap-1.5 border-amber-500/50 transition-all cursor-pointer"
                          title="Pilih lagu dari koleksi server Proxmox tanpa perlu upload ulang"
                        >
                          <Library className="w-3.5 h-3.5" />
                          PILIH DARI PUSTAKA
                        </button>

                        {slot.tracks && slot.tracks.length > 0 && (
                          <button
                            type="button"
                            onClick={() => onLoadSlotToPlaylist && onLoadSlotToPlaylist(slot, false)}
                            className="winamp-btn px-3 py-1.5 rounded-lg text-xs font-chakra font-bold text-cyan-300 hover:text-white flex items-center gap-1.5 border-cyan-500/40 transition-all cursor-pointer"
                            title="Tambahkan lagu slot ini ke antrian Winamp tanpa langsung memotong lagu yang sedang jalan"
                          >
                            <ListMusic className="w-3.5 h-3.5" />
                            Ke Playlist Winamp
                          </button>
                        )}
                      </div>

                      <span className="text-[10px] font-chakra text-gray-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                        Tersimpan di server & otomatis jalan saat jam siaran
                      </span>
                    </div>

                    {/* Upload Progress Indicator with Speed, % & ETA (Prominent) */}
                    {uploadProgress && uploadProgress.slotId === slot.id && (
                      <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-[#0d1f36] via-[#091524] to-[#0d1f36] border-2 border-cyan-500/60 flex flex-col gap-2.5 shadow-xl shadow-cyan-950/50 animate-in slide-in-from-top-1">
                        <div className="flex items-center justify-between text-xs sm:text-sm flex-wrap gap-2">
                          <div className="flex items-center gap-2 truncate mr-2 font-bold text-gray-200 flex-1 min-w-0">
                            <Upload className="w-4 h-4 text-cyan-400 animate-bounce shrink-0" />
                            <div className="truncate">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-cyan-300">
                                  File {uploadProgress.current}/{uploadProgress.total}
                                </span>
                                {uploadProgress.chunk && uploadProgress.totalChunks > 1 && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-950 border border-purple-500/40 text-purple-300">
                                    Bagian {uploadProgress.chunk}/{uploadProgress.totalChunks}
                                  </span>
                                )}
                              </div>
                              <span className="truncate text-white font-semibold text-xs sm:text-sm block">
                                &ldquo;{uploadProgress.name}&rdquo;
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className="px-2.5 py-1 rounded-lg bg-cyan-950 border border-cyan-500/40 text-amber-300 font-lcd text-xs sm:text-sm font-bold flex items-center gap-1 shadow-sm">
                              <Zap className="w-3.5 h-3.5 fill-current text-amber-400" />
                              {uploadProgress.speedMBs} MB/s
                            </span>
                            <span className="font-lcd text-xl sm:text-2xl font-black text-emerald-400 min-w-[50px] text-right drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">
                              {uploadProgress.percent}%
                            </span>
                          </div>
                        </div>

                        {/* Animated Progress Bar */}
                        <div className="w-full bg-[#040810] h-3.5 rounded-full overflow-hidden border border-cyan-500/30 p-[1px] shadow-inner">
                          <div
                            className="bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400 h-full rounded-full transition-all duration-150 relative overflow-hidden"
                            style={{ width: `${uploadProgress.percent}%` }}
                          >
                            <div className="absolute inset-0 bg-white/20 animate-pulse" />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-300 font-chakra">
                          <span>
                            Ukuran: <strong className="text-white font-mono">{uploadProgress.uploadedMB} MB</strong> dari{' '}
                            <strong className="text-cyan-300 font-mono">{uploadProgress.fileSizeMB} MB</strong>
                          </span>
                          <span>
                            {uploadProgress.etaSeconds > 0 ? (
                              <>
                                Sisa waktu:{' '}
                                <strong className="text-amber-300 font-mono">~{uploadProgress.etaSeconds} detik</strong>
                              </>
                            ) : uploadProgress.percent === 100 ? (
                              <span className="text-emerald-400 font-bold animate-pulse text-xs">Menyimpan ke server...</span>
                            ) : (
                              <span className="text-gray-400">Mengirim audio...</span>
                            )}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Track List */}
                    {slot.tracks && slot.tracks.length > 0 ? (
                      <div className="flex flex-col gap-1.5 mt-0.5">
                        <div className="flex items-center justify-between text-[11px] font-chakra text-gray-400 px-1">
                          <span className="font-bold text-gray-300 flex items-center gap-1.5">
                            <Music className="w-3 h-3 text-cyan-400" />
                            Daftar File Lagu ({slot.tracks.length} lagu)
                          </span>
                          <span className="text-[10px] text-gray-400">
                            Total Durasi: <strong className="text-cyan-300 font-lcd font-bold text-xs">{formatSeconds(slot.tracks.reduce((acc, t) => acc + (t.duration || 0), 0))}</strong>
                          </span>
                        </div>

                        <div className="flex flex-col gap-1 max-h-52 overflow-y-auto pr-1">
                          {slot.tracks.map((track, idx) => {
                            const cleanName = track.title || (track.fileName ? track.fileName.replace(/\.[^/.]+$/, '') : `Lagu ${idx + 1}`);
                            const formattedTime = formatSeconds(track.duration);
                            const fileSize = formatFileSize(track.size);

                            return (
                              <div
                                key={track.id || idx}
                                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-chakra bg-[#0c111a] hover:bg-[#131b28] border border-[#1b2332] group transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                                  <span className="font-lcd text-xs text-cyan-500/70 w-5 text-right shrink-0">
                                    {(idx + 1).toString().padStart(2, '0')}.
                                  </span>
                                  <FileAudio className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                  <div className="truncate flex-1">
                                    <span className="text-gray-200 font-semibold">{cleanName}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {fileSize && (
                                    <span className="text-[10px] text-gray-500 font-mono hidden md:inline">
                                      {fileSize}
                                    </span>
                                  )}
                                  <span className="font-lcd text-[11px] text-cyan-300 px-2 py-0.5 rounded bg-[#060910] border border-cyan-950">
                                    {formattedTime}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTrack(slot.id, track.id)}
                                    className="p-1 text-gray-500 hover:text-rose-400 hover:bg-rose-950/30 rounded transition-colors"
                                    title="Hapus lagu ini dari slot jadwal"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-5 bg-[#090d16] rounded-xl border border-dashed border-gray-800 text-gray-400 text-xs font-chakra flex flex-col items-center gap-2">
                        <Music className="w-5 h-5 text-gray-500" />
                        <p>Belum ada file musik untuk slot ini.</p>
                        <div className="flex items-center gap-2 flex-wrap justify-center mt-1">
                          <button
                            type="button"
                            onClick={() => openLibraryModalForSlot(slot.id)}
                            className="winamp-btn px-3 py-1 rounded-lg text-xs font-bold text-amber-300 border-amber-500/50 flex items-center gap-1.5 cursor-pointer shadow-sm shadow-amber-950"
                          >
                            <Library className="w-3.5 h-3.5" />
                            PILIH DARI PUSTAKA SERVER
                          </button>
                          <span className="text-[10px] text-gray-500">atau</span>
                          <button
                            type="button"
                            onClick={() => fileInputRefs.current[slot.id]?.click()}
                            className="winamp-btn px-3 py-1 rounded-lg text-xs font-bold text-emerald-300 border-emerald-500/50 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Upload MP3 Baru
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Summary Bar */}
      {schedule.length > 0 && (
        <div className="flex items-center justify-between text-[10px] font-chakra text-gray-400 border-t border-[#1d2432] pt-2 px-1 flex-wrap gap-2">
          <span>
            Total: <strong className="text-cyan-400 font-bold">{totalSlots}</strong> program siaran (
            <strong className="text-cyan-400 font-bold">{Math.round(totalHours * 10) / 10}</strong> jam siaran 24-jam)
          </span>
          <span>
            Total Lagu Siap: <strong className={totalTracks >= totalNeeded ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>{totalTracks}</strong> / ~{totalNeeded} lagu
          </span>
        </div>
      )}

      {/* Edit / Add Slot Modal */}
      {editSlot && (
        <SlotEditModal
          slot={editSlot}
          isNew={isAdding}
          onSave={handleSaveSlot}
          onCancel={() => { setEditSlot(null); setIsAdding(false); }}
          getSlotDuration={getSlotDuration}
          estimateTracksNeeded={estimateTracksNeeded}
          formatDuration={formatDuration}
        />
      )}

      {/* Server Media Library Modal */}
      <MediaLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        targetSlotId={libraryTargetSlotId}
        schedule={schedule}
        onTracksAdded={(updatedSchedule) => setSchedule(updatedSchedule)}
        onLoadTrackToWinamp={(track) => {
          if (onLoadSlotToPlaylist) {
            onLoadSlotToPlaylist({ title: 'Pustaka Proxmox', tracks: [track] }, false);
          }
        }}
      />

      {/* CUSTOM LARGE FILE WARNING CONFIRMATION MODAL */}
      {largeFileWarningModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0c1221] border-2 border-amber-500/80 shadow-[0_0_60px_rgba(245,158,11,0.3)] rounded-2xl max-w-lg w-full p-6 text-gray-200 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/50 text-amber-400 shrink-0 shadow-lg shadow-amber-950/50">
                <AlertTriangle className="w-8 h-8 animate-pulse text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-950/80 border border-amber-500/60 text-amber-300">
                  PERINGATAN UKURAN FILE BESAR
                </span>
                <h3 className="text-lg font-extrabold text-white mt-1 tracking-wide font-orbitron">
                  KONFIRMASI UPLOAD JADWAL
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  File audio yang Anda pilih berukuran di atas batas standar Cloudflare.
                </p>
              </div>
            </div>

            {/* File Info Box */}
            <div className="bg-[#060a12] border border-[#1e2a42] rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2.5 text-xs text-gray-200 font-semibold truncate">
                <Music className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="truncate text-white text-sm font-bold">{largeFileWarningModal.file.name}</span>
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t border-[#172236]">
                <span className="text-xs text-gray-400">Ukuran File:</span>
                <span className="font-lcd text-xl font-bold text-amber-300 px-3 py-0.5 rounded-lg bg-[#0b1526] border border-amber-500/40 shadow-inner">
                  {(largeFileWarningModal.file.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                <span>Teknologi Transfer:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  Auto Multi-Chunk (Aman dari Limit Cloudflare 100MB)
                </span>
              </div>
            </div>

            {/* Info Message */}
            <div className="text-xs text-gray-300 bg-amber-950/25 border border-amber-500/30 rounded-xl p-3.5 leading-relaxed">
              💡 <strong>Info Sistem:</strong> File ini akan otomatis dipecah menjadi bagian-bagian kecil (chunk 25 MB) saat diunggah sehingga <strong>tidak akan terputus atau terkena error 413</strong> dari Cloudflare Tunnel. Proses ini membutuhkan waktu sekitar 1–2 menit tergantung kecepatan uplink internet Anda.
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  const cb = largeFileWarningModal.onConfirm;
                  setLargeFileWarningModal(null);
                  if (cb) cb();
                }}
                className="w-full sm:flex-1 py-3 px-5 rounded-xl font-bold text-xs sm:text-sm text-black bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all transform active:scale-95"
              >
                <Upload className="w-4 h-4 text-black" />
                <span>LANJUTKAN UPLOAD ({(largeFileWarningModal.file.size / (1024 * 1024)).toFixed(1)} MB)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const cb = largeFileWarningModal.onCancel;
                  setLargeFileWarningModal(null);
                  if (cb) cb();
                }}
                className="w-full sm:w-auto py-3 px-5 rounded-xl font-semibold text-xs sm:text-sm text-gray-300 hover:text-white bg-[#141d2e] hover:bg-[#1a263c] border border-gray-700/60 cursor-pointer transition-all"
              >
                BATALKAN
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// =============================================
// Sub-component: Slot Edit/Add Modal
// =============================================
function SlotEditModal({ slot, isNew, onSave, onCancel, getSlotDuration, estimateTracksNeeded, formatDuration }) {
  const [formData, setFormData] = useState({
    id: slot.id,
    startTime: slot.startTime || '07:00',
    endTime: slot.endTime || '08:00',
    title: slot.title || '',
    dj: slot.dj || '',
    tracks: slot.tracks || [],
    avgTrackDuration: slot.avgTrackDuration || 210
  });

  const duration = getSlotDuration(formData.startTime, formData.endTime);
  const estimated = estimateTracksNeeded(duration, formData.avgTrackDuration);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <form
        onSubmit={handleSubmit}
        className="winamp-chassis p-4 sm:p-5 rounded-2xl w-full max-w-md flex flex-col gap-3.5 border border-emerald-500/50 shadow-2xl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#2d3748] pb-2.5">
          <h4 className="font-orbitron text-sm font-bold text-emerald-300 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            {isNew ? 'TAMBAH SLOT PROGRAM SIARAN' : 'EDIT SLOT PROGRAM SIARAN'}
          </h4>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-white p-1 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Time Range */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-chakra text-gray-400">Jam Mulai (WIB):</label>
            <input
              type="time"
              value={formData.startTime}
              onChange={(e) => setFormData(p => ({ ...p, startTime: e.target.value }))}
              className="bg-[#121620] border border-[#2d3748] rounded-lg px-3 py-2 text-sm font-lcd text-cyan-300 outline-none focus:border-emerald-400"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-chakra text-gray-400">Jam Selesai (WIB):</label>
            <input
              type="time"
              value={formData.endTime}
              onChange={(e) => setFormData(p => ({ ...p, endTime: e.target.value }))}
              className="bg-[#121620] border border-[#2d3748] rounded-lg px-3 py-2 text-sm font-lcd text-cyan-300 outline-none focus:border-emerald-400"
              required
            />
          </div>
        </div>

        {/* Program Title */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-chakra text-gray-400">Nama / Tema Program Siaran:</label>
          <input
            type="text"
            placeholder="Contoh: Musik Pop Malaysia & Nostalgia"
            value={formData.title}
            onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
            className="bg-[#121620] border border-[#2d3748] rounded-lg px-3 py-2 text-xs font-chakra text-white outline-none focus:border-emerald-400"
            required
          />
        </div>

        {/* DJ Name */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-chakra text-gray-400">Nama Penyiar / Host:</label>
          <input
            type="text"
            placeholder="Contoh: DJ Rian"
            value={formData.dj}
            onChange={(e) => setFormData(p => ({ ...p, dj: e.target.value }))}
            className="bg-[#121620] border border-[#2d3748] rounded-lg px-3 py-2 text-xs font-chakra text-white outline-none focus:border-emerald-400"
          />
        </div>

        {/* Average Track Duration Slider */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] font-chakra">
            <span className="text-gray-400">Rata-rata Durasi Tiap Lagu:</span>
            <strong className="text-cyan-300">{Math.round(formData.avgTrackDuration / 60 * 10) / 10} menit</strong>
          </div>
          <input
            type="range"
            min="120"
            max="420"
            step="15"
            value={formData.avgTrackDuration}
            onChange={(e) => setFormData(p => ({ ...p, avgTrackDuration: parseInt(e.target.value) }))}
            className="winamp-slider w-full"
          />
          <div className="flex justify-between text-[8px] font-chakra text-gray-500">
            <span>2 mnt</span>
            <span>3.5 mnt (Standar Pop)</span>
            <span>5 mnt</span>
            <span>7 mnt</span>
          </div>
        </div>

        {/* Estimation Display */}
        <div className="bg-[#080b12] rounded-xl p-3 flex flex-col gap-1.5 border border-cyan-500/30">
          <div className="flex items-center justify-between text-xs font-chakra">
            <span className="text-gray-400 flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-cyan-400" />
              Durasi Program Siaran:
            </span>
            <span className="font-lcd text-sm text-cyan-300 font-bold">{formatDuration(duration)}</span>
          </div>
          <div className="flex items-center justify-between text-xs font-chakra">
            <span className="text-gray-400 flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-purple-400" />
              Estimasi Lagu yang Dibutuhkan:
            </span>
            <span className="font-lcd text-sm text-emerald-300 font-bold">~{estimated} lagu</span>
          </div>
          <p className="text-[9px] text-gray-400 font-chakra mt-1 border-t border-gray-800/80 pt-1">
            💡 Setelah disimpan, Anda dapat mengunggah file MP3 langsung ke slot ini, dan sistem akan memutarnya otomatis saat jam siaran tiba.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="winamp-btn px-4 py-2 rounded-lg text-xs font-chakra text-gray-400 hover:text-white"
          >
            BATAL
          </button>
          <button
            type="submit"
            className="winamp-btn px-5 py-2 rounded-lg text-xs font-chakra font-bold text-emerald-400 border-emerald-500/60 hover:text-white flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            SIMPAN JADWAL
          </button>
        </div>
      </form>
    </div>
  );
}
