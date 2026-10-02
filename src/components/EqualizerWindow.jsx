import React, { useState, useEffect } from 'react';
import { audioEngine } from '../utils/audioEngine';
import { EQ_PRESETS } from '../utils/stationData';
import { Sliders, RotateCcw, Power } from 'lucide-react';

export default function EqualizerWindow({ onClose, theme = 'classic' }) {
  const [eqEnabled, setEqEnabled] = useState(true);
  const [preamp, setPreamp] = useState(0);
  const [bands, setBands] = useState([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [currentPreset, setCurrentPreset] = useState('Flat');

  const frequencies = ['32', '64', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'];

  const handleBandChange = (index, value) => {
    const val = parseFloat(value);
    const newBands = [...bands];
    newBands[index] = val;
    setBands(newBands);
    setCurrentPreset('Custom');
    audioEngine.setEqBand(index, val);
  };

  const handlePreampChange = (value) => {
    const val = parseFloat(value);
    setPreamp(val);
    audioEngine.setPreamp(val);
  };

  const applyPreset = (presetName) => {
    const presetValues = EQ_PRESETS[presetName];
    if (presetValues) {
      setBands(presetValues);
      setCurrentPreset(presetName);
      presetValues.forEach((val, i) => {
        audioEngine.setEqBand(i, val);
      });
    }
  };

  const toggleEq = () => {
    const next = !eqEnabled;
    setEqEnabled(next);
    audioEngine.setEqEnabled(next, bands);
  };

  const resetEq = () => {
    applyPreset('Flat');
    setPreamp(0);
    audioEngine.setPreamp(0);
  };

  return (
    <div className="winamp-chassis w-full max-w-xl mx-auto rounded-lg p-3 relative flex flex-col gap-2 shadow-2xl">
      {/* Title Bar */}
      <div className="flex items-center justify-between px-2 py-1 bg-gradient-to-r from-[#1c222d] via-[#2a3242] to-[#1c222d] rounded border border-[#3b4556]">
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-orbitron text-[11px] font-bold tracking-wider text-gray-200 uppercase">
            WINAMP 10-BAND GRAPHIC EQUALIZER
          </span>
        </div>

        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-gray-700/60"
        >
          ✕
        </button>
      </div>

      {/* Top Controls: EQ On/Off, Presets, Reset */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleEq}
            className={`winamp-btn px-2.5 py-1 rounded text-xs font-chakra font-bold flex items-center gap-1.5 ${
              eqEnabled ? 'active text-green-300 border-green-500' : 'text-gray-500 border-gray-700'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>EQ {eqEnabled ? 'ON' : 'BYPASS'}</span>
          </button>

          <button
            onClick={resetEq}
            className="winamp-btn px-2 py-1 rounded text-xs font-chakra text-gray-300 hover:text-white flex items-center gap-1"
            title="Reset to 0 dB Flat"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">RESET</span>
          </button>
        </div>

        {/* Preset Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-chakra text-gray-400">PRESET:</span>
          <select
            value={currentPreset}
            onChange={(e) => applyPreset(e.target.value)}
            className="bg-[#121620] border border-[#2d3748] text-cyan-300 text-xs font-chakra rounded px-2 py-1 outline-none cursor-pointer"
          >
            {Object.keys(EQ_PRESETS).map(name => (
              <option key={name} value={name} className="bg-[#121620] text-gray-200">
                {name}
              </option>
            ))}
            {currentPreset === 'Custom' && (
              <option value="Custom" className="bg-[#121620] text-amber-300">
                Custom User EQ
              </option>
            )}
          </select>
        </div>
      </div>

      {/* EQ Sliders Panel */}
      <div className="winamp-panel p-3 rounded flex flex-col gap-2 bg-[#090b10]">
        <div className="flex justify-between items-center text-[9px] font-chakra text-gray-500 px-1 border-b border-[#1f2533] pb-1">
          <span>+12 dB</span>
          <span>0 dB (FLAT)</span>
          <span>-12 dB</span>
        </div>

        <div className="flex items-center justify-between gap-1 sm:gap-2 pt-2">
          {/* Preamp Slider */}
          <div className="flex flex-col items-center gap-1.5 border-r border-[#1f2533] pr-2">
            <span className="text-[9px] font-chakra text-cyan-400 font-bold">PREAMP</span>
            <div className="h-32 flex items-center justify-center">
              <input
                type="range"
                min="-12"
                max="12"
                step="0.5"
                value={preamp}
                onChange={(e) => handlePreampChange(e.target.value)}
                className="winamp-slider-vert h-28"
                title={`Preamp: ${preamp > 0 ? `+${preamp}` : preamp} dB`}
              />
            </div>
            <span className="text-[9px] font-lcd text-cyan-300">
              {preamp > 0 ? `+${preamp}` : preamp}
            </span>
          </div>

          {/* 10 Frequency Sliders */}
          <div className="flex-1 flex justify-between gap-1">
            {frequencies.map((freq, i) => (
              <div key={freq} className="flex flex-col items-center gap-1.5 flex-1">
                <span className="text-[9px] font-chakra text-gray-400 font-bold">{freq}</span>
                <div className="h-32 flex items-center justify-center">
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="0.5"
                    value={bands[i]}
                    onChange={(e) => handleBandChange(i, e.target.value)}
                    disabled={!eqEnabled}
                    className="winamp-slider-vert h-28"
                    title={`${freq}Hz: ${bands[i] > 0 ? `+${bands[i]}` : bands[i]} dB`}
                  />
                </div>
                <span className={`text-[9px] font-lcd ${
                  bands[i] > 0 ? 'text-green-400' : bands[i] < 0 ? 'text-rose-400' : 'text-gray-400'
                }`}>
                  {bands[i] > 0 ? `+${bands[i]}` : bands[i]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
