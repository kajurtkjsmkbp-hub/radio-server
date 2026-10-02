import React, { useState, useEffect, useRef } from 'react';
import {
  Library,
  Search,
  Plus,
  Play,
  Pause,
  Trash2,
  Check,
  CheckSquare,
  Square,
  Upload,
  Clock,
  HardDrive,
  Filter,
  X,
  RefreshCw,
  Layers,
  ArrowRight,
  Music,
  AlertTriangle,
  Radio,
  CheckCircle,
  Zap
} from 'lucide-react';
import { uploadFileWithProgress } from '../utils/uploader';

export default function MediaLibraryModal({
  isOpen,
  onClose,
  targetSlotId = null,
  schedule = [],
  onTracksAdded,
  onLoadTrackToWinamp
}) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState(targetSlotId || (schedule[0]?.id || 1));
  const [selectedTrackIds, setSelectedTrackIds] = useState(new Set());
  const [previewTrackUrl, setPreviewTrackUrl] = useState(null);
  const [filterUsage, setFilterUsage] = useState('all'); // 'all', 'unused', 'used'
  const [sortBy, setSortBy] = useState('date_desc');
  const [uploading, setUploading] = useState(false);
  const [uploadProgressData, setUploadProgressData] = useState(null);
  const [successUploadSummary, setSuccessUploadSummary] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [largeFileWarningModal, setLargeFileWarningModal] = useState(null);
  const [deleteConfirmFile, setDeleteConfirmFile] = useState(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeInput, setPurgeInput] = useState('');

  const previewAudioRef = useRef(null);
  const fileInputRef = useRef(null);

  // Update selectedSlotId if targetSlotId changes
  useEffect(() => {
    if (targetSlotId) {
      setSelectedSlotId(targetSlotId);
    } else if (schedule.length > 0 && !selectedSlotId) {
      setSelectedSlotId(schedule[0].id);
    }
  }, [targetSlotId, schedule]);

  // Fetch library tracks whenever modal opens
  useEffect(() => {
    if (isOpen) {
      fetchLibraryTracks();
      setSelectedTrackIds(new Set());
      setActionMessage(null);
    } else {
      stopPreview();
    }
  }, [isOpen]);

  const fetchLibraryTracks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/library');
      const data = await res.json();
      if (data.tracks) {
        setTracks(data.tracks);
      }
    } catch (err) {
      console.error('Error fetching media library:', err);
    } finally {
      setLoading(false);
    }
  };

  // Preview Audio Player Handlers
  const handleTogglePreview = (trackUrl) => {
    if (previewTrackUrl === trackUrl) {
      stopPreview();
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(trackUrl);
      previewAudioRef.current = audio;
      setPreviewTrackUrl(trackUrl);
      audio.play().catch(e => console.warn('Audio preview play error:', e));
      audio.onended = () => {
        setPreviewTrackUrl(null);
      };
    }
  };

  const stopPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setPreviewTrackUrl(null);
  };

  // Format Helper
  const formatSeconds = (sec) => {
    if (!sec || isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  // Upload new MP3s directly to the central library with real-time speed & progress
  const handleUploadToLibrary = (files) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);

    // Check if any file exceeds ~95 MB
    const oversizedFiles = fileList.filter(f => f.size > 95 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setLargeFileWarningModal({
        file: oversizedFiles[0],
        totalOversized: oversizedFiles.length,
        onConfirm: () => executeUploadToLibrary(fileList),
        onCancel: () => {
          setLargeFileWarningModal(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      });
      return;
    }

    executeUploadToLibrary(fileList);
  };

  const executeUploadToLibrary = async (fileList) => {
    setUploading(true);
    setUploadError(null);
    setSuccessUploadSummary(null);

    let successCount = 0;
    let totalUploadedBytes = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '');

      setUploadProgressData({
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
        await uploadFileWithProgress({
          url: '/api/library/upload',
          headers: {
            'x-title': encodeURIComponent(cleanTitle),
            'x-filename': encodeURIComponent(file.name)
          },
          file,
          onProgress: (prog) => {
            setUploadProgressData({
              current: i + 1,
              total: fileList.length,
              name: cleanTitle,
              ...prog
            });
          }
        });
        successCount++;
        totalUploadedBytes += file.size;
      } catch (err) {
        console.error('Error uploading file to library:', err);
        setUploadError(`Gagal mengunggah "${file.name}": ${err.message}`);
        break;
      }
    }

    setUploading(false);
    setUploadProgressData(null);
    fetchLibraryTracks();

    if (fileInputRef.current) fileInputRef.current.value = '';

    if (successCount > 0) {
      const summary = {
        count: successCount,
        totalMB: (totalUploadedBytes / (1024 * 1024)).toFixed(1)
      };
      setSuccessUploadSummary(summary);
      showActionToast(`Berhasil menambahkan ${successCount} lagu (${summary.totalMB} MB) ke Pustaka Server`);
      setTimeout(() => {
        setSuccessUploadSummary(null);
      }, 8000);
    }
  };

  // Add tracks to slot (single or batch)
  const handleAddTracksToSlot = async (tracksToAdd, targetId) => {
    const slotId = targetId || selectedSlotId;
    if (!slotId) {
      alert('Pilih slot tujuan terlebih dahulu');
      return;
    }

    try {
      const res = await fetch(`/api/schedule/${slotId}/add-library-tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: tracksToAdd })
      });
      const data = await res.json();
      if (data.success) {
        if (onTracksAdded && data.schedule) {
          onTracksAdded(data.schedule);
        }
        showActionToast(`Berhasil memasukkan ${tracksToAdd.length} lagu ke slot jadwal!`);
        setSelectedTrackIds(new Set());
        fetchLibraryTracks(); // refresh usage indicator
      }
    } catch (err) {
      console.error('Error adding tracks to slot:', err);
    }
  };

  // Unlink/remove track from a specific slot (keeps physical file in library intact)
  const handleUnlinkTrackFromSlot = async (slotId, track) => {
    try {
      const res = await fetch(`/api/schedule/${slotId}/unlink-track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: track.url, fileName: track.fileName })
      });
      const data = await res.json();
      if (data.success) {
        if (onTracksAdded && data.schedule) {
          onTracksAdded(data.schedule);
        }
        showActionToast(`Lagu dilepaskan dari slot jadwal.`);
        fetchLibraryTracks(); // refresh status
      }
    } catch (err) {
      console.error('Error unlinking track from slot:', err);
    }
  };

  // Delete file permanently from server
  const handleDeleteFile = async (track, force = false) => {
    try {
      const res = await fetch('/api/library/file', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: track.fileName, force })
      });
      const data = await res.json();
      if (res.status === 409) {
        // File is in use -> show confirmation modal
        setDeleteConfirmFile({ ...track, inUseSlots: data.usedSlots });
        return;
      }
      if (data.success) {
        showActionToast(`File "${track.title}" berhasil dihapus dari Proxmox.`);
        setDeleteConfirmFile(null);
        fetchLibraryTracks();
      }
    } catch (err) {
      console.error('Error deleting file:', err);
    }
  };

  // Batch delete selected tracks from harddisk
  const handleConfirmBatchDelete = async () => {
    const selectedTracks = tracks.filter(t => selectedTrackIds.has(t.id));
    const fileNames = selectedTracks.map(t => t.fileName);
    try {
      const res = await fetch('/api/library/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileNames, force: true })
      });
      const data = await res.json();
      if (data.success) {
        if (onTracksAdded && data.schedule) {
          onTracksAdded(data.schedule);
        }
        showActionToast(`${data.deletedCount} file berhasil dihapus permanen dari harddisk.`);
        setSelectedTrackIds(new Set());
        setShowBatchDeleteModal(false);
        fetchLibraryTracks();
      }
    } catch (err) {
      console.error('Error batch deleting files:', err);
    }
  };

  // Purge/clean all audio files from Proxmox harddisk
  const handleConfirmPurgeAll = async () => {
    if (purgeInput !== 'HAPUS_SEMUA') return;
    try {
      const res = await fetch('/api/library/purge-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'HAPUS_SEMUA' })
      });
      const data = await res.json();
      if (data.success) {
        if (onTracksAdded && data.schedule) {
          onTracksAdded(data.schedule);
        }
        showActionToast(`Seluruh (${data.deletedCount}) file audio berhasil dihapus bersih dari harddisk.`);
        setSelectedTrackIds(new Set());
        setShowPurgeModal(false);
        setPurgeInput('');
        fetchLibraryTracks();
      }
    } catch (err) {
      console.error('Error purging all files:', err);
    }
  };

  const showActionToast = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
  };

  // Toggle selection
  const toggleSelectTrack = (trackId) => {
    const next = new Set(selectedTrackIds);
    if (next.has(trackId)) next.delete(trackId);
    else next.add(trackId);
    setSelectedTrackIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedTrackIds.size === filteredTracks.length) {
      setSelectedTrackIds(new Set());
    } else {
      setSelectedTrackIds(new Set(filteredTracks.map(t => t.id)));
    }
  };

  // Filter & Sort
  const filteredTracks = tracks
    .filter(t => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title?.toLowerCase().includes(q);
        const matchesFile = t.fileName?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesFile) return false;
      }
      // Usage filter
      if (filterUsage === 'unused') return !t.usedInSlots || t.usedInSlots.length === 0;
      if (filterUsage === 'used') return t.usedInSlots && t.usedInSlots.length > 0;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date_desc') return (b.mtime || 0) - (a.mtime || 0);
      if (sortBy === 'date_asc') return (a.mtime || 0) - (b.mtime || 0);
      if (sortBy === 'title_asc') return (a.title || '').localeCompare(b.title || '');
      if (sortBy === 'duration_desc') return (b.duration || 0) - (a.duration || 0);
      if (sortBy === 'size_desc') return (b.size || 0) - (a.size || 0);
      return 0;
    });

  if (!isOpen) return null;

  const targetSlotObj = schedule.find(s => s.id === parseInt(selectedSlotId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#080c15] border border-cyan-500/40 rounded-2xl w-full max-w-5xl h-[92vh] max-h-[850px] flex flex-col shadow-2xl shadow-cyan-950/50 overflow-hidden font-chakra">
        
        {/* MODAL HEADER */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#0d1527] via-[#090e1a] to-[#0d1527] border-b border-[#1f2b42] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
              <Library className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                  PUSTAKA MUSIK SERVER PROXMOX
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                  {tracks.length} Lagu Tersimpan
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Pilih atau masukkan lagu dari koleksi server ke slot jadwal siaran tanpa perlu upload ulang
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchLibraryTracks}
              className="p-2 rounded-lg bg-[#0e1626] border border-[#21304d] text-gray-400 hover:text-cyan-300 hover:border-cyan-500/50 transition-colors"
              title="Refresh daftar lagu"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-[#0e1626] border border-[#21304d] text-gray-400 hover:text-rose-400 hover:border-rose-500/50 transition-colors"
              title="Tutup Pustaka"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TOAST / ACTION NOTIFICATION */}
        {actionMessage && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/50 px-5 py-2 text-xs text-emerald-300 flex items-center gap-2 animate-in slide-in-from-top-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{actionMessage}</span>
          </div>
        )}

        {/* TOOLBAR & CONTROLS */}
        <div className="p-4 bg-[#0a0f1d] border-b border-[#172236] flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shrink-0">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul lagu, artis, atau nama file..."
              className="w-full bg-[#060a12] border border-[#1e2a42] rounded-xl pl-9 pr-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter & Sort */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-[#060a12] border border-[#1e2a42] rounded-xl px-2.5 py-1.5 text-xs text-gray-300">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              <select
                value={filterUsage}
                onChange={(e) => setFilterUsage(e.target.value)}
                className="bg-transparent text-xs text-gray-300 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-[#0b101c]">Semua Status</option>
                <option value="unused" className="bg-[#0b101c]">Belum Masuk Jadwal</option>
                <option value="used" className="bg-[#0b101c]">Sudah Dipakai di Jadwal</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-[#060a12] border border-[#1e2a42] rounded-xl px-2.5 py-1.5 text-xs text-gray-300">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-xs text-gray-300 focus:outline-none cursor-pointer"
              >
                <option value="date_desc" className="bg-[#0b101c]">Terbaru Ditambahkan</option>
                <option value="date_asc" className="bg-[#0b101c]">Paling Lama</option>
                <option value="title_asc" className="bg-[#0b101c]">Judul (A - Z)</option>
                <option value="duration_desc" className="bg-[#0b101c]">Durasi Terpanjang</option>
                <option value="size_desc" className="bg-[#0b101c]">Ukuran Terbesar</option>
              </select>
            </div>

            {/* Upload to Library Button */}
            <input
              type="file"
              multiple
              accept="audio/*"
              ref={fileInputRef}
              onChange={(e) => handleUploadToLibrary(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="winamp-btn px-3 py-1.5 rounded-xl text-xs font-bold text-amber-300 hover:text-white border-amber-500/40 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Upload MP3 langsung ke koleksi pustaka Proxmox"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{uploading ? 'Mengunggah...' : '+ UPLOAD MP3'}</span>
            </button>

            {/* Purge All Files Button */}
            {tracks.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setPurgeInput('');
                  setShowPurgeModal(true);
                }}
                className="winamp-btn px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-200 border-rose-500/30 hover:border-rose-500/60 flex items-center gap-1.5 cursor-pointer"
                title="Hapus bersih seluruh file audio dari harddisk Proxmox"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">KOSONGKAN SEMUA ({tracks.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* REAL-TIME UPLOAD PROGRESS CARD (PROMINENT & LARGE) */}
        {uploading && uploadProgressData && (
          <div className="bg-gradient-to-r from-[#0d1f36] via-[#081322] to-[#0d1f36] border-b-2 border-cyan-500/70 p-4 sm:p-5 shadow-2xl animate-in slide-in-from-top-2">
            <div className="flex flex-col gap-3 max-w-4xl mx-auto">
              {/* Header row: file name + badges */}
              <div className="flex items-center justify-between text-xs sm:text-sm flex-wrap gap-2">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 shrink-0">
                    <Upload className="w-5 h-5 text-cyan-400 animate-bounce" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                        File {uploadProgressData.current} dari {uploadProgressData.total}
                      </span>
                      {uploadProgressData.chunk && uploadProgressData.totalChunks > 1 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-950 border border-purple-500/40 text-purple-300">
                          Bagian {uploadProgressData.chunk}/{uploadProgressData.totalChunks}
                        </span>
                      )}
                    </div>
                    <span className="font-extrabold text-white truncate text-sm sm:text-base block mt-0.5">
                      &ldquo;{uploadProgressData.name}&rdquo;
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="px-3 py-1.5 rounded-xl bg-cyan-950/90 border border-cyan-500/50 text-amber-300 font-lcd font-bold text-sm sm:text-base flex items-center gap-1.5 shadow-lg shadow-cyan-950/60">
                    <Zap className="w-4 h-4 fill-current text-amber-400" />
                    {uploadProgressData.speedMBs} MB/s
                  </span>
                  <span className="font-lcd text-2xl sm:text-3xl font-black text-emerald-400 min-w-[65px] text-right drop-shadow-[0_0_12px_rgba(52,211,153,0.4)]">
                    {uploadProgressData.percent}%
                  </span>
                </div>
              </div>

              {/* Progress Bar with glowing pulse */}
              <div className="w-full bg-[#040810] h-4 rounded-full overflow-hidden border border-cyan-500/40 p-[2px] shadow-inner">
                <div
                  className="bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400 h-full rounded-full transition-all duration-150 relative overflow-hidden"
                  style={{ width: `${uploadProgressData.percent}%` }}
                >
                  <div className="absolute inset-0 bg-white/25 animate-pulse" />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-300 font-chakra">
                <span>
                  Ukuran Terkirim: <strong className="text-white font-mono text-sm">{uploadProgressData.uploadedMB} MB</strong> dari{' '}
                  <strong className="text-cyan-300 font-mono text-sm">{uploadProgressData.fileSizeMB} MB</strong>
                </span>
                <span>
                  {uploadProgressData.etaSeconds > 0 ? (
                    <>
                      Estimasi sisa waktu:{' '}
                      <strong className="text-amber-300 font-mono text-sm">~{uploadProgressData.etaSeconds} detik</strong>
                    </>
                  ) : uploadProgressData.percent === 100 ? (
                    <span className="text-emerald-400 font-bold animate-pulse text-sm">Menyimpan ke harddisk server...</span>
                  ) : (
                    <span className="text-gray-400">Mengirim data audio...</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* UPLOAD SUCCESS BANNER */}
        {successUploadSummary && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/60 p-3 px-5 flex items-center justify-between gap-3 text-xs text-emerald-200 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="font-bold text-emerald-300 text-sm">
                  Upload Berhasil! ({successUploadSummary.count} Lagu)
                </div>
                <div className="text-[11px] text-emerald-400/80">
                  Total data {successUploadSummary.totalMB} MB telah tersimpan di harddisk Proxmox dan siap digunakan di playlist jadwal.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSuccessUploadSummary(null)}
              className="p-1 rounded text-emerald-400 hover:text-emerald-100 hover:bg-emerald-900/50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* UPLOAD ERROR BANNER */}
        {uploadError && (
          <div className="bg-rose-950/90 border-b border-rose-500/60 p-3 px-5 flex items-center justify-between gap-3 text-xs text-rose-200 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <div className="font-bold text-rose-300 text-sm">Upload Terganggu / Gagal</div>
                <div className="text-[11px] text-rose-300/80">{uploadError}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="p-1 rounded text-rose-400 hover:text-rose-100 hover:bg-rose-900/50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* BATCH ACTION BAR (IF ITEMS SELECTED) */}
        {selectedTrackIds.size > 0 && (
          <div className="bg-gradient-to-r from-cyan-950/90 via-[#0d2238] to-cyan-950/90 border-b border-cyan-500/60 px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-cyan-400 text-black font-bold text-xs flex items-center justify-center">
                {selectedTrackIds.size}
              </span>
              <span className="text-xs font-bold text-cyan-200">
                Lagu Terpilih
              </span>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-300">Target:</span>
                <select
                  value={selectedSlotId}
                  onChange={(e) => setSelectedSlotId(e.target.value)}
                  className="bg-[#060a12] border border-cyan-500/50 rounded-lg px-2.5 py-1 text-xs text-cyan-200 font-bold focus:outline-none"
                >
                  {schedule.map(s => (
                    <option key={s.id} value={s.id} className="bg-[#080d1a]">
                      [{s.startTime}-{s.endTime}] {s.title}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  const selectedTracks = tracks.filter(t => selectedTrackIds.has(t.id));
                  handleAddTracksToSlot(selectedTracks, selectedSlotId);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ MASUKKAN KE SLOT ({selectedTrackIds.size})</span>
              </button>

              <button
                type="button"
                onClick={() => setShowBatchDeleteModal(true)}
                className="bg-rose-950/90 hover:bg-rose-900 border border-rose-500/60 text-rose-300 hover:text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
                title="Hapus file-file terpilih dari harddisk Proxmox secara permanen"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>HAPUS DARI HARDDISK ({selectedTrackIds.size})</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTrackIds(new Set())}
                className="text-xs text-gray-400 hover:text-white underline ml-1"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {/* TRACK LISTING TABLE */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
          {/* Table Header Bar */}
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-[#060912] rounded-lg border border-[#141d2f]">
            <div className="col-span-1 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-gray-400 hover:text-cyan-300"
                title="Pilih semua"
              >
                {selectedTrackIds.size === filteredTracks.length && filteredTracks.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-cyan-400" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </button>
              <span>Play</span>
            </div>
            <div className="col-span-6 sm:col-span-5">Judul Lagu / File Audio</div>
            <div className="col-span-2 hidden sm:block">Status Slot Jadwal</div>
            <div className="col-span-2 text-right">Durasi / Size</div>
            <div className="col-span-3 sm:col-span-2 text-right">Aksi Cepat</div>
          </div>

          {loading && tracks.length > 0 && (
            <div className="h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse rounded-full" />
          )}

          {loading && tracks.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-cyan-400">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <span className="text-xs font-bold tracking-wider">MEMINDAI KOLEKSI AUDIO DARI SERVER PROXMOX...</span>
            </div>
          ) : filteredTracks.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-500">
              <Music className="w-10 h-10 text-gray-600" />
              <p className="text-sm font-bold text-gray-400">Tidak ada lagu yang sesuai filter.</p>
              <p className="text-xs text-gray-600 max-w-sm text-center">
                Klik tombol <strong className="text-amber-400">+ UPLOAD MP3 KE PUSTAKA</strong> di atas untuk menambahkan koleksi lagu baru ke server.
              </p>
            </div>
          ) : (
            filteredTracks.map((track) => {
              const isSelected = selectedTrackIds.has(track.id);
              const isPlaying = previewTrackUrl === track.url;
              const hasSlots = track.usedInSlots && track.usedInSlots.length > 0;

              return (
                <div
                  key={track.id}
                  className={`grid grid-cols-12 gap-2 px-3 py-2.5 rounded-xl border items-center transition-all ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-500/50 shadow-md shadow-cyan-950/30'
                      : 'bg-[#090e1b] border-[#152033] hover:bg-[#0c1324] hover:border-[#21304c]'
                  }`}
                >
                  {/* Select & Play Preview */}
                  <div className="col-span-1 flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSelectTrack(track.id)}
                      className="text-gray-400 hover:text-cyan-300 cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTogglePreview(track.url)}
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                        isPlaying
                          ? 'bg-cyan-500 text-black border-cyan-400 animate-pulse'
                          : 'bg-[#060a14] border-[#1e2a42] text-gray-400 hover:text-cyan-300 hover:border-cyan-500/50'
                      }`}
                      title={isPlaying ? 'Hentikan Preview' : 'Putar Preview Audio'}
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                    </button>
                  </div>

                  {/* Title & Filename */}
                  <div className="col-span-6 sm:col-span-5 min-w-0 pr-2">
                    <div className="font-bold text-xs text-gray-100 truncate hover:text-cyan-300 transition-colors" title={track.title}>
                      {track.title}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
                      <span className="truncate">{track.fileName}</span>
                    </div>
                  </div>

                  {/* Slot Usage Badge */}
                  <div className="col-span-2 hidden sm:flex flex-col gap-1 min-w-0">
                    {hasSlots ? (
                      <div className="flex flex-wrap gap-1">
                        {track.usedInSlots.map(s => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-950/80 border border-purple-500/40 text-purple-200 group/badge hover:border-purple-400 transition-colors max-w-[140px]"
                            title={`Aktif di: [${s.startTime}-${s.endTime}] ${s.title} — Klik ✕ untuk menghapus dari slot ini`}
                          >
                            <span className="truncate">{s.title}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnlinkTrackFromSlot(s.id, track);
                              }}
                              className="text-gray-400 hover:text-rose-400 hover:bg-rose-950/60 p-0.5 rounded transition-colors cursor-pointer shrink-0"
                              title={`Hapus lagu ini dari jadwal "${s.title}"`}
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-600 italic">Belum terjadwal</span>
                    )}
                  </div>

                  {/* Duration & Size */}
                  <div className="col-span-2 text-right">
                    <div className="font-lcd text-xs text-cyan-300 font-bold">
                      {formatSeconds(track.duration)}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {formatFileSize(track.size)}
                    </div>
                  </div>

                  {/* Quick Action Button */}
                  <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-1.5">
                    {/* Add to specific selected slot */}
                    <button
                      type="button"
                      onClick={() => handleAddTracksToSlot([track], selectedSlotId)}
                      className="px-2.5 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 hover:text-white text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow"
                      title={`Masukkan lagu ini ke slot "${targetSlotObj?.title || 'terpilih'}"`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden lg:inline">Ke Slot</span>
                    </button>

                    {/* Test in Winamp Player */}
                    {onLoadTrackToWinamp && (
                      <button
                        type="button"
                        onClick={() => onLoadTrackToWinamp(track)}
                        className="p-1.5 rounded-lg bg-[#0c1221] hover:bg-purple-950 border border-purple-500/30 text-purple-400 hover:text-purple-200 transition-colors"
                        title="Putar langsung di pemutar Winamp"
                      >
                        <Radio className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete File */}
                    <button
                      type="button"
                      onClick={() => handleDeleteFile(track, false)}
                      className="p-1.5 rounded-lg bg-[#0c1221] hover:bg-rose-950/50 border border-rose-500/20 text-gray-500 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Hapus file audio ini dari harddisk server Proxmox"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3.5 bg-[#090e1a] border-t border-[#172236] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-gray-400 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-cyan-400" />
            <span>
              Total Ruang: <strong className="text-gray-200">{formatFileSize(tracks.reduce((acc, t) => acc + (t.size || 0), 0))}</strong> ({tracks.length} file di <code className="text-cyan-300 bg-[#04060c] px-1 py-0.5 rounded">/uploads/</code> Proxmox)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="winamp-btn px-4 py-1.5 rounded-xl text-xs font-bold text-gray-300 hover:text-white border-gray-700 cursor-pointer"
            >
              SELESAI / TUTUP
            </button>
          </div>
        </div>

      </div>

      {/* CONFIRMATION MODAL FOR DELETING IN-USE FILE */}
      {deleteConfirmFile && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 animate-in fade-in">
          <div className="bg-[#0f1422] border border-rose-500/50 rounded-2xl p-5 max-w-md w-full shadow-2xl text-chakra">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h4 className="font-bold text-base text-white">File Sedang Digunakan di Jadwal!</h4>
            </div>
            <p className="text-xs text-gray-300 mb-2">
              File <strong className="text-rose-300">&ldquo;{deleteConfirmFile.title}&rdquo;</strong> saat ini terdaftar di slot siaran:
            </p>
            <div className="bg-[#080b14] border border-[#212b40] rounded-lg p-2.5 mb-4 text-xs text-purple-300 space-y-1">
              {deleteConfirmFile.inUseSlots?.map((slotName, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  <span>{slotName}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mb-4">
              Jika Anda menghapus permanen, lagu ini akan otomatis terhapus dari seluruh slot di atas dan file fisik di server Proxmox akan dihapus.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmFile(null)}
                className="px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-300 hover:text-white"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeleteFile(deleteConfirmFile, true)}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
              >
                Hapus Permanen Dari Server
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR BATCH DELETING FILES */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 animate-in fade-in">
          <div className="bg-[#0f1422] border border-rose-500/50 rounded-2xl p-5 max-w-md w-full shadow-2xl text-chakra">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <Trash2 className="w-6 h-6 shrink-0" />
              <h4 className="font-bold text-base text-white">Hapus {selectedTrackIds.size} File Dari Harddisk?</h4>
            </div>
            <p className="text-xs text-gray-300 mb-3">
              Tindakan ini akan <strong>menghapus secara fisik {selectedTrackIds.size} file MP3 terpilih</strong> dari penyimpanan harddisk server Proxmox, dan otomatis melepaskannya dari jadwal siaran.
            </p>
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-[11px] text-rose-300 mb-4 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>File yang telah dihapus permanen dari harddisk tidak dapat dikembalikan.</span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBatchDeleteModal(false)}
                className="px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-300 hover:text-white cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchDelete}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-950/60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus {selectedTrackIds.size} File Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR PURGING ALL FILES */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/95 animate-in fade-in">
          <div className="bg-[#12080d] border border-rose-600/70 rounded-2xl p-6 max-w-md w-full shadow-2xl text-chakra">
            <div className="flex items-center gap-3 text-rose-500 mb-3">
              <AlertTriangle className="w-7 h-7 shrink-0 text-rose-400 animate-pulse" />
              <h4 className="font-bold text-lg text-white">KOSONGKAN SELURUH HARDDISK?</h4>
            </div>
            <p className="text-xs text-gray-300 mb-2 leading-relaxed">
              Anda akan <strong>menghapus seluruh {tracks.length} file audio MP3</strong> dari folder <code className="text-rose-400 bg-black/60 px-1 py-0.5 rounded">/uploads/</code> di server Proxmox dan mengosongkan seluruh antrian jadwal siaran.
            </p>
            <p className="text-[11px] text-gray-400 mb-3">
              Ketik kata <strong className="text-white bg-rose-950 border border-rose-500/50 px-1.5 py-0.5 rounded font-mono">HAPUS_SEMUA</strong> di bawah ini untuk mengonfirmasi:
            </p>
            <input
              type="text"
              value={purgeInput}
              onChange={(e) => setPurgeInput(e.target.value)}
              placeholder="Ketik HAPUS_SEMUA di sini..."
              className="w-full bg-black/80 border border-rose-500/50 rounded-xl px-3 py-2 text-xs text-rose-200 placeholder-gray-600 focus:outline-none focus:border-rose-400 font-mono mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPurgeModal(false);
                  setPurgeInput('');
                }}
                className="px-3.5 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-300 hover:text-white cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={purgeInput !== 'HAPUS_SEMUA'}
                onClick={handleConfirmPurgeAll}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-950/80"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Kosongkan Seluruh Lagu</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
                  KONFIRMASI UPLOAD AUDIO
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
