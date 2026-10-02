import React, { useState, useRef } from 'react';
import {
  ListMusic,
  Plus,
  Trash2,
  Shuffle,
  Music,
  Radio,
  Search,
  Upload,
  PlayCircle
} from 'lucide-react';

export default function PlaylistWindow({
  playlist,
  currentIndex,
  onSelectTrack,
  onAddFiles,
  onAddUrl,
  onLoadDemos,
  onRemoveTrack,
  onClearPlaylist,
  onShufflePlaylist,
  onClose
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [streamUrl, setStreamUrl] = useState('');
  const [streamName, setStreamName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Filtered tracks
  const filteredPlaylist = playlist.filter(track => {
    const q = searchQuery.toLowerCase();
    return track.title.toLowerCase().includes(q) || (track.artist && track.artist.toLowerCase().includes(q));
  });

  // Calculate total duration
  const totalSeconds = playlist.reduce((acc, t) => acc + (t.duration || 0), 0);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalSecsRem = Math.floor(totalSeconds % 60);

  const formatTrackTime = (secs) => {
    if (!secs || isNaN(secs)) return 'LIVE';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(Array.from(e.target.files));
    }
  };

  const submitAddUrl = (e) => {
    e.preventDefault();
    if (!streamUrl.trim()) return;
    onAddUrl({
      id: `custom-url-${Date.now()}`,
      title: streamName.trim() || 'Custom Radio Stream',
      artist: 'Live Stream',
      album: 'Online Broadcast',
      url: streamUrl.trim(),
      isStream: true,
      kbps: '192 kbps',
      khz: '44.1 kHz'
    });
    setStreamUrl('');
    setStreamName('');
    setUrlModalOpen(false);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`winamp-chassis w-full max-w-xl mx-auto rounded-lg p-3 relative flex flex-col gap-2 shadow-2xl transition-all ${
        isDragging ? 'border-cyan-400 ring-2 ring-cyan-400/50' : ''
      }`}
    >
      {/* Title Bar */}
      <div className="flex items-center justify-between px-2 py-1 bg-gradient-to-r from-[#1c222d] via-[#2a3242] to-[#1c222d] rounded border border-[#3b4556]">
        <div className="flex items-center gap-2">
          <ListMusic className="w-3.5 h-3.5 text-purple-400" />
          <span className="font-orbitron text-[11px] font-bold tracking-wider text-gray-200 uppercase">
            WINAMP PLAYLIST MANAGER
          </span>
        </div>

        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-gray-700/60"
        >
          ✕
        </button>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex items-center justify-between gap-2 px-1">
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-gray-500" />
          <input
            type="text"
            placeholder="Cari lagu di playlist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#121620] border border-[#2d3748] rounded text-xs font-chakra pl-7 pr-2 py-1 text-gray-200 placeholder-gray-500 outline-none focus:border-cyan-400"
          />
        </div>

        {/* Load Demos */}
        <button
          onClick={onLoadDemos}
          className="winamp-btn px-2 py-1 rounded text-xs font-chakra text-cyan-300 hover:text-white flex items-center gap-1 shrink-0"
          title="Muat musik demo bawaan studio"
        >
          <PlayCircle className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">DEMO TRACKS</span>
        </button>
      </div>

      {/* Playlist Track List Viewport */}
      <div className="winamp-panel p-1 rounded h-56 overflow-y-auto flex flex-col gap-0.5 bg-[#06080c]">
        {filteredPlaylist.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs font-chakra gap-2 p-4 text-center">
            <Music className="w-8 h-8 text-gray-600 animate-pulse" />
            <p>Playlist masih kosong.</p>
            <p className="text-[11px] text-gray-600">
              Drag & Drop file lagu MP3 ke sini, atau klik tombol <strong className="text-cyan-400">+ FILE</strong> di bawah.
            </p>
          </div>
        ) : (
          filteredPlaylist.map((track, idx) => {
            const originalIndex = playlist.findIndex(t => t.id === track.id);
            const isCurrent = originalIndex === currentIndex;

            return (
              <div
                key={track.id}
                onClick={() => onSelectTrack(originalIndex)}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer text-xs font-chakra transition-colors select-none ${
                  isCurrent
                    ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/60 font-semibold'
                    : 'text-gray-300 hover:bg-[#151a24] hover:text-white'
                }`}
              >
                {/* Track Number & Title */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="font-lcd text-sm text-gray-500 w-5 text-right shrink-0">
                    {(originalIndex + 1).toString().padStart(2, '0')}.
                  </span>
                  {track.isStream ? (
                    <Radio className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <Music className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-cyan-400' : 'text-gray-500'}`} />
                  )}
                  <div className="truncate flex-1">
                    <span className="text-gray-100">{track.title}</span>
                    {track.artist && (
                      <span className="text-gray-500 text-[10px] ml-1.5">
                        - {track.artist}
                      </span>
                    )}
                  </div>
                </div>

                {/* Track Duration & Delete Button */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`font-lcd text-xs ${isCurrent ? 'glow-cyan' : 'text-gray-400'}`}>
                    {formatTrackTime(track.duration)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveTrack(originalIndex);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-rose-400 p-0.5 rounded transition-opacity"
                    title="Hapus lagu dari playlist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Action Controls */}
      <div className="flex items-center justify-between gap-1 pt-1 border-t border-[#262c38]">
        {/* Add Actions */}
        <div className="flex items-center gap-1">
          <input
            type="file"
            multiple
            accept="audio/*"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            className="winamp-btn px-2.5 py-1 rounded text-xs font-chakra text-green-300 hover:text-white flex items-center gap-1 font-bold"
            title="Tambah file MP3 / WAV dari komputer"
          >
            <Plus className="w-3.5 h-3.5 text-green-400" />
            <span>+ FILE</span>
          </button>

          <button
            onClick={() => setUrlModalOpen(true)}
            className="winamp-btn px-2 py-1 rounded text-xs font-chakra text-amber-300 hover:text-white flex items-center gap-1"
            title="Tambah link URL stream radio"
          >
            <Radio className="w-3.5 h-3.5 text-amber-400" />
            <span>+ URL</span>
          </button>

          <button
            onClick={onShufflePlaylist}
            disabled={playlist.length <= 1}
            className="winamp-btn px-2 py-1 rounded text-xs font-chakra text-gray-300 hover:text-white flex items-center gap-1"
            title="Acak urutan playlist"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ACAK</span>
          </button>

          <button
            onClick={onClearPlaylist}
            disabled={playlist.length === 0}
            className="winamp-btn px-2 py-1 rounded text-xs font-chakra text-rose-400 hover:text-rose-300 flex items-center gap-1"
            title="Bersihkan semua lagu di playlist"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CLEAR</span>
          </button>
        </div>

        {/* Playlist Summary Counter */}
        <div className="text-[10px] font-chakra text-gray-400 text-right pr-1">
          <span className="text-cyan-400 font-bold">{playlist.length}</span> TRACKS //{' '}
          <span className="text-gray-300 font-bold">{totalMinutes}:{totalSecsRem.toString().padStart(2, '0')}</span>
        </div>
      </div>

      {/* Add URL Modal */}
      {urlModalOpen && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 rounded-lg">
          <form
            onSubmit={submitAddUrl}
            className="winamp-panel p-4 rounded-lg w-full max-w-sm flex flex-col gap-3 border border-cyan-500/50 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#2d3748] pb-2">
              <h4 className="font-chakra text-sm font-bold text-cyan-300 flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-cyan-400" />
                TAMBAH STREAM RADIO
              </h4>
              <button
                type="button"
                onClick={() => setUrlModalOpen(false)}
                className="text-gray-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-chakra text-gray-400">Nama Stasiun / Judul:</label>
              <input
                type="text"
                placeholder="Contoh: My Favorite Radio Station"
                value={streamName}
                onChange={(e) => setStreamName(e.target.value)}
                className="bg-[#121620] border border-[#2d3748] rounded px-2.5 py-1 text-xs text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-chakra text-gray-400">Stream URL (Icecast / MP3):</label>
              <input
                type="url"
                required
                placeholder="http://server.example.com:8000/stream"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                className="bg-[#121620] border border-[#2d3748] rounded px-2.5 py-1 text-xs text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setUrlModalOpen(false)}
                className="winamp-btn px-3 py-1 rounded text-xs text-gray-400"
              >
                BATAL
              </button>
              <button
                type="submit"
                className="winamp-btn px-4 py-1 rounded text-xs font-bold text-green-400 border-green-500"
              >
                TAMBAHKAN
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
