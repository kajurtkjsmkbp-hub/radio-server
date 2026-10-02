import React, { useState, useEffect } from 'react';
import { Radio, Mic, Clock, Palette, ExternalLink, Headphones, Sliders } from 'lucide-react';

export default function Navbar({
  currentPage,
  onNavigate,
  studioView,
  setStudioView,
  theme,
  setTheme,
  isOnAir
}) {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="winamp-chassis border-b border-[#2d3748] px-3 sm:px-6 py-2.5 sticky top-0 z-40 bg-[#0d1017]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('listener')}>
          <div className={`w-10 h-10 rounded-xl p-0.5 flex items-center justify-center transition-all ${
            theme === 'amber'
              ? 'bg-gradient-to-br from-amber-400 to-yellow-600 shadow-[0_0_15px_rgba(255,170,0,0.4)]'
              : theme === 'classic'
              ? 'bg-gradient-to-br from-emerald-400 to-teal-700 shadow-[0_0_15px_rgba(0,255,102,0.4)]'
              : 'bg-gradient-to-br from-cyan-500 to-blue-700 shadow-[0_0_15px_rgba(0,243,255,0.4)]'
          }`}>
            <Radio className="w-5 h-5 text-black stroke-[2.5]" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className={`font-orbitron font-black text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r ${
                theme === 'amber'
                  ? 'from-amber-400 via-yellow-300 to-orange-400'
                  : theme === 'classic'
                  ? 'from-emerald-400 via-teal-300 to-green-400'
                  : 'from-cyan-400 via-teal-300 to-purple-400'
              }`}>
                Khanza.NET RADIO
              </h1>
              {isOnAir ? (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-orbitron font-bold bg-rose-600 text-white on-air-active">
                  LIVE ON AIR
                </span>
              ) : (
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-orbitron font-bold text-white ${
                  theme === 'amber' ? 'bg-amber-600' : theme === 'classic' ? 'bg-emerald-600' : 'bg-cyan-600'
                }`}>
                  ONLINE
                </span>
              )}
            </div>
            <p className="font-chakra text-[10px] text-gray-400 uppercase tracking-widest">
              {currentPage === 'studio'
                ? '🎙️ RUANG STUDIO PENYIAR & WINAMP PLAYOUT DECK'
                : '🎧 PORTAL RESMI PENDENGAR RADIO STREAMING'}
            </p>
          </div>
        </div>

        {/* Center / Navigation Actions */}
        <div className="flex items-center gap-2">
          {/* If on Listener Page -> Pure listener branding */}
          {currentPage === 'listener' ? (
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#06080c] border text-xs font-chakra ${
                theme === 'amber'
                  ? 'border-amber-500/30 text-amber-300'
                  : theme === 'classic'
                  ? 'border-emerald-500/30 text-emerald-300'
                  : 'border-cyan-500/30 text-cyan-300'
              }`}>
                <span className={`w-2 h-2 rounded-full animate-ping ${
                  theme === 'amber' ? 'bg-amber-400' : theme === 'classic' ? 'bg-emerald-400' : 'bg-cyan-400'
                }`} />
                <span className="font-semibold">Halaman Khusus Pendengar</span>
              </div>
            </div>
          ) : (
            /* If on Studio Page -> Show Studio Sub-views & Link to open /pendengar */
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {/* Studio Sub-views */}
              <div className="flex items-center gap-1 bg-[#06080c] p-1 rounded-lg border border-[#1f2533]">
                <button
                  onClick={() => setStudioView('all')}
                  className={`px-2.5 py-1 rounded text-xs font-chakra font-bold ${
                    studioView === 'all' ? 'text-cyan-300 bg-cyan-950/80 border border-cyan-500/60' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Full Studio
                </button>
                <button
                  onClick={() => setStudioView('winamp')}
                  className={`px-2.5 py-1 rounded text-xs font-chakra font-bold ${
                    studioView === 'winamp' ? 'text-green-300 bg-green-950/80 border border-green-500/60' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Winamp Saja
                </button>
                <button
                  onClick={() => setStudioView('broadcast')}
                  className={`px-2.5 py-1 rounded text-xs font-chakra font-bold ${
                    studioView === 'broadcast' ? 'text-rose-300 bg-rose-950/80 border border-rose-500/60' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Mic & Siaran
                </button>
              </div>

              {/* Link to open /pendengar in new tab or navigate */}
              <a
                href="/pendengar"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg font-chakra font-bold text-xs bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black shadow-md flex items-center gap-1.5 transition-all"
                title="Buka Halaman Pendengar di tab baru"
              >
                <Headphones className="w-4 h-4" />
                <span>LIHAT /pendengar</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Studio Time & Theme Picker */}
        <div className="flex items-center gap-3">
          {/* Theme Dropdown */}
          <div className={`flex items-center gap-1.5 bg-[#06080c] px-2.5 py-1 rounded-lg border transition-all ${
            theme === 'amber'
              ? 'border-amber-500/50 shadow-sm shadow-amber-950/40 text-amber-300'
              : theme === 'classic'
              ? 'border-emerald-500/50 shadow-sm shadow-emerald-950/40 text-emerald-300'
              : 'border-cyan-500/50 shadow-sm shadow-cyan-950/40 text-cyan-300'
          }`}>
            <Palette className="w-3.5 h-3.5 shrink-0" />
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="bg-transparent text-[11px] font-chakra font-bold outline-none cursor-pointer"
            >
              <option value="classic" className="bg-[#121620] text-emerald-300">Skin: Winamp Titanium</option>
              <option value="cyberpunk" className="bg-[#121620] text-cyan-300">Skin: Cyberpunk Neon</option>
              <option value="amber" className="bg-[#121620] text-amber-300">Skin: Retro Amber CRT</option>
            </select>
          </div>

          {/* Studio Clock */}
          <div className={`flex items-center gap-1.5 bg-[#06080c] px-2.5 py-1 rounded-lg border ${
            theme === 'amber'
              ? 'border-amber-500/30 text-amber-400'
              : theme === 'classic'
              ? 'border-emerald-500/30 text-emerald-400'
              : 'border-cyan-500/30 text-cyan-400'
          }`}>
            <Clock className="w-3.5 h-3.5" />
            <span className={`font-lcd text-sm tracking-wider font-bold ${
              theme === 'amber' ? 'text-amber-300' : theme === 'classic' ? 'text-emerald-300' : 'text-cyan-300'
            }`}>
              {timeStr}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
