import React, { useState } from 'react';
import { PRESET_STATIONS } from '../utils/stationData';
import { Radio, Search, Play, Volume2, Globe, RadioTower, Plus } from 'lucide-react';

export default function RadioStations({
  currentTrack,
  isPlaying,
  onSelectStation,
  onAddCustomStation
}) {
  const [selectedGenre, setSelectedGenre] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [customModal, setCustomModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customGenre, setCustomGenre] = useState('Custom Stream');

  const genres = ['ALL', 'Lo-Fi', 'Retrowave', 'Jazz', 'EDM', 'Rock', 'Ambient'];

  const filteredStations = PRESET_STATIONS.filter(st => {
    const matchesSearch = st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          st.genre.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          st.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre = selectedGenre === 'ALL' || st.genre.toLowerCase().includes(selectedGenre.toLowerCase());
    return matchesSearch && matchesGenre;
  });

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customUrl.trim()) return;
    const newStation = {
      id: `custom-station-${Date.now()}`,
      name: customName.trim() || 'Stasiun Radio Custom',
      genre: customGenre.trim() || 'Online Stream',
      bitrate: '192 kbps',
      location: 'Custom',
      logo: '📻',
      description: 'Stream radio kustom pilihan pengguna.',
      url: customUrl.trim()
    };
    onAddCustomStation(newStation);
    setCustomName('');
    setCustomUrl('');
    setCustomModal(false);
  };

  return (
    <div className="winamp-chassis w-full max-w-xl mx-auto rounded-lg p-3 relative flex flex-col gap-2.5 shadow-2xl">
      {/* Title Bar */}
      <div className="flex items-center justify-between px-2 py-1 bg-gradient-to-r from-[#17222d] via-[#223642] to-[#17222d] rounded border border-[#3b5256]">
        <div className="flex items-center gap-2">
          <RadioTower className="w-4 h-4 text-cyan-400" />
          <span className="font-orbitron text-[11px] font-bold tracking-wider text-cyan-200 uppercase">
            GLOBAL ONLINE RADIO STATIONS & LIVE TUNER
          </span>
        </div>

        <button
          onClick={() => setCustomModal(true)}
          className="winamp-btn px-2 py-0.5 rounded text-[10px] font-chakra text-green-300 hover:text-white flex items-center gap-1 font-bold"
        >
          <Plus className="w-3 h-3 text-green-400" />
          <span>+ STASIUN SENDIRI</span>
        </button>
      </div>

      {/* Search & Genre Tabs */}
      <div className="flex flex-col gap-2 px-1">
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-500" />
          <input
            type="text"
            placeholder="Cari stasiun, genre, atau kota..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#121620] border border-[#2d3748] rounded text-xs font-chakra pl-8 pr-2 py-1.5 text-gray-200 placeholder-gray-500 outline-none focus:border-cyan-400"
          />
        </div>

        {/* Genre Pill Filters */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px] font-chakra">
          {genres.map(g => (
            <button
              key={g}
              onClick={() => setSelectedGenre(g)}
              className={`winamp-btn px-2.5 py-1 rounded whitespace-nowrap ${
                selectedGenre === g ? 'active text-cyan-300 border-cyan-400 font-bold' : 'text-gray-400'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Stations Grid / List */}
      <div className="winamp-panel p-2 rounded max-h-72 overflow-y-auto flex flex-col gap-1.5 bg-[#07090e]">
        {filteredStations.map(station => {
          const isCurrentlyPlaying = currentTrack?.url === station.url && isPlaying;

          return (
            <div
              key={station.id}
              onClick={() => onSelectStation(station)}
              className={`group flex items-center justify-between p-2 rounded cursor-pointer transition-all border ${
                isCurrentlyPlaying
                  ? 'bg-cyan-950/70 border-cyan-400/80 shadow-[0_0_10px_rgba(0,243,255,0.2)]'
                  : 'bg-[#11141c] border-[#1e2430] hover:border-gray-600 hover:bg-[#161a24]'
              }`}
            >
              {/* Station Info */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded bg-[#1c2230] border border-[#2e3748] flex items-center justify-center text-lg shrink-0">
                  {station.logo}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-chakra text-xs font-bold text-white truncate">
                      {station.name}
                    </span>
                    {isCurrentlyPlaying && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-orbitron font-bold bg-green-500 text-black animate-pulse">
                        LIVE
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] font-chakra text-gray-400 truncate">
                    {station.description}
                  </p>

                  <div className="flex items-center gap-3 text-[9px] font-chakra text-gray-500 pt-0.5">
                    <span className="text-cyan-400 font-semibold">{station.genre}</span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5">
                      <Globe className="w-2.5 h-2.5" />
                      {station.location}
                    </span>
                    <span>•</span>
                    <span className="text-purple-400">{station.bitrate}</span>
                  </div>
                </div>
              </div>

              {/* Play / Status Button */}
              <button
                className={`winamp-btn p-2 rounded-full shrink-0 ml-2 ${
                  isCurrentlyPlaying
                    ? 'active text-green-400 border-green-400'
                    : 'text-gray-300 group-hover:text-white'
                }`}
                title={isCurrentlyPlaying ? 'Sedang Diputar' : 'Putar Stasiun Ini'}
              >
                {isCurrentlyPlaying ? (
                  <Volume2 className="w-4 h-4 text-green-400 animate-pulse" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Custom Station Modal */}
      {customModal && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 rounded-lg">
          <form
            onSubmit={handleCustomSubmit}
            className="winamp-panel p-4 rounded-lg w-full max-w-sm flex flex-col gap-3 border border-cyan-500/50 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#2d3748] pb-2">
              <h4 className="font-chakra text-sm font-bold text-cyan-300 flex items-center gap-1.5">
                <RadioTower className="w-4 h-4 text-cyan-400" />
                TAMBAH STASIUN STREAMING SENDIRI
              </h4>
              <button
                type="button"
                onClick={() => setCustomModal(false)}
                className="text-gray-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-chakra text-gray-400">Nama Stasiun Radio:</label>
              <input
                type="text"
                required
                placeholder="Contoh: Radio Komunitas FM"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="bg-[#121620] border border-[#2d3748] rounded px-2.5 py-1 text-xs text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-chakra text-gray-400">Genre / Kategori:</label>
              <input
                type="text"
                placeholder="Contoh: Pop / Dangdut / News"
                value={customGenre}
                onChange={(e) => setCustomGenre(e.target.value)}
                className="bg-[#121620] border border-[#2d3748] rounded px-2.5 py-1 text-xs text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-chakra text-gray-400">Stream URL (Icecast / Shoutcast / MP3):</label>
              <input
                type="url"
                required
                placeholder="http://live.stream.com:8000/listen"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="bg-[#121620] border border-[#2d3748] rounded px-2.5 py-1 text-xs text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCustomModal(false)}
                className="winamp-btn px-3 py-1 rounded text-xs text-gray-400"
              >
                BATAL
              </button>
              <button
                type="submit"
                className="winamp-btn px-4 py-1 rounded text-xs font-bold text-green-400 border-green-500"
              >
                SIMPAN & PUTAR
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
