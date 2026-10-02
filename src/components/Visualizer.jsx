import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../utils/audioEngine';
import { Activity, BarChart2, Radio, Maximize2, Minimize2 } from 'lucide-react';

export default function Visualizer({ theme = 'classic' }) {
  const canvasRef = useRef(null);
  const [visMode, setVisMode] = useState('spectrum'); // 'spectrum', 'oscilloscope', 'vu'
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  // Peak holds for spectrum
  const peaksRef = useRef(new Array(64).fill(0));
  const vuSmoothL = useRef(0);
  const vuSmoothR = useRef(0);

  useEffect(() => {
    let animId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      animId = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;

      // Clear with dark background
      ctx.fillStyle = '#080a0f';
      ctx.fillRect(0, 0, width, height);

      if (!audioEngine.analyser) {
        // Draw idle grid
        ctx.strokeStyle = '#1e2430';
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 20) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        return;
      }

      if (visMode === 'spectrum') {
        const bufferLength = audioEngine.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        audioEngine.analyser.getByteFrequencyData(dataArray);

        const barCount = 48;
        const barWidth = (width / barCount) - 2;

        for (let i = 0; i < barCount; i++) {
          // logarithmic-ish bin index
          const binIndex = Math.floor(Math.pow(i / barCount, 1.4) * (bufferLength * 0.75));
          const val = dataArray[binIndex] || 0;
          const barHeight = (val / 255) * (height - 8);

          // Update peak
          if (barHeight > peaksRef.current[i]) {
            peaksRef.current[i] = barHeight;
          } else {
            peaksRef.current[i] = Math.max(0, peaksRef.current[i] - 1.2);
          }

          const x = i * (barWidth + 2) + 2;
          const y = height - barHeight;

          // Theme based bar color gradient
          const gradient = ctx.createLinearGradient(0, height, 0, 0);
          if (theme === 'cyberpunk') {
            gradient.addColorStop(0, '#00f3ff');
            gradient.addColorStop(0.6, '#bd00ff');
            gradient.addColorStop(1, '#ff007f');
          } else if (theme === 'amber') {
            gradient.addColorStop(0, '#804000');
            gradient.addColorStop(0.7, '#ffaa00');
            gradient.addColorStop(1, '#ffea70');
          } else {
            // Winamp classic green-yellow-red
            gradient.addColorStop(0, '#00c853');
            gradient.addColorStop(0.65, '#ffd600');
            gradient.addColorStop(0.9, '#ff3d00');
            gradient.addColorStop(1, '#ff1744');
          }

          // Draw segmented bar (classic Winamp LED style)
          const segmentHeight = 4;
          const segmentGap = 1.5;
          const numSegments = Math.floor(barHeight / (segmentHeight + segmentGap));

          ctx.fillStyle = gradient;
          for (let s = 0; s < numSegments; s++) {
            const segY = height - (s * (segmentHeight + segmentGap)) - segmentHeight;
            ctx.fillRect(x, segY, barWidth, segmentHeight);
          }

          // Draw floating peak dot
          const peakY = height - peaksRef.current[i] - 2;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, Math.max(2, peakY), barWidth, 2);
        }

      } else if (visMode === 'oscilloscope') {
        const bufferLength = audioEngine.analyser.fftSize;
        const timeData = new Uint8Array(bufferLength);
        audioEngine.analyser.getByteTimeDomainData(timeData);

        // Draw grid
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        ctx.lineWidth = 2.5;
        if (theme === 'cyberpunk') {
          ctx.strokeStyle = '#00f3ff';
          ctx.shadowColor = '#00f3ff';
        } else if (theme === 'amber') {
          ctx.strokeStyle = '#ffaa00';
          ctx.shadowColor = '#ffaa00';
        } else {
          ctx.strokeStyle = '#00ff66';
          ctx.shadowColor = '#00ff66';
        }
        ctx.shadowBlur = 8;

        ctx.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = timeData[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.stroke();
        ctx.shadowBlur = 0; // reset

      } else if (visMode === 'vu') {
        // Dual Analog Stereo VU Meters
        let levelL = 0;
        let levelR = 0;

        if (audioEngine.leftAnalyser && audioEngine.rightAnalyser) {
          const dataL = new Uint8Array(64);
          const dataR = new Uint8Array(64);
          audioEngine.leftAnalyser.getByteTimeDomainData(dataL);
          audioEngine.rightAnalyser.getByteTimeDomainData(dataR);

          let sumL = 0;
          let sumR = 0;
          for (let i = 0; i < 64; i++) {
            const vL = (dataL[i] - 128) / 128;
            const vR = (dataR[i] - 128) / 128;
            sumL += vL * vL;
            sumR += vR * vR;
          }
          levelL = Math.sqrt(sumL / 64) * 3.5;
          levelR = Math.sqrt(sumR / 64) * 3.5;
        }

        vuSmoothL.current += (levelL - vuSmoothL.current) * 0.25;
        vuSmoothR.current += (levelR - vuSmoothR.current) * 0.25;

        // Draw Left and Right VU Meters
        const meterWidth = (width / 2) - 8;
        drawAnalogMeter(ctx, 4, 4, meterWidth, height - 8, vuSmoothL.current, 'LEFT CHANNEL (CH 1)');
        drawAnalogMeter(ctx, width / 2 + 4, 4, meterWidth, height - 8, vuSmoothR.current, 'RIGHT CHANNEL (CH 2)');
      }
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [visMode, theme]);

  const drawAnalogMeter = (ctx, x, y, w, h, level, label) => {
    // Face background
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    ctx.fillStyle = '#141822';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Scale Arc
    const cx = x + w / 2;
    const cy = y + h + 15;
    const radius = h * 0.88;

    const startAngle = Math.PI * 1.25;
    const endAngle = Math.PI * 1.75;

    // Normal zone arc (green)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, startAngle + (endAngle - startAngle) * 0.72);
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Warning / Red zone arc (red)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle + (endAngle - startAngle) * 0.72, endAngle);
    ctx.strokeStyle = '#ff3344';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Scale ticks and labels
    const ticks = [
      { pct: 0, text: '-20' },
      { pct: 0.25, text: '-10' },
      { pct: 0.5, text: '-5' },
      { pct: 0.72, text: '0 dB' },
      { pct: 0.88, text: '+3' },
      { pct: 1.0, text: '+6' }
    ];

    ctx.font = '9px Orbitron, monospace';
    ctx.textAlign = 'center';
    ticks.forEach(t => {
      const angle = startAngle + (endAngle - startAngle) * t.pct;
      const tx = cx + Math.cos(angle) * (radius - 12);
      const ty = cy + Math.sin(angle) * (radius - 12);
      ctx.fillStyle = t.pct >= 0.72 ? '#ff4455' : '#a0aec0';
      ctx.fillText(t.text, tx, ty);
    });

    // Label
    ctx.fillStyle = '#718096';
    ctx.font = '10px Chakra Petch, sans-serif';
    ctx.fillText(label, cx, y + h - 10);

    // Needle
    const clampedLevel = Math.max(0, Math.min(1.2, level));
    const needleAngle = startAngle + (endAngle - startAngle) * (clampedLevel / 1.0);

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const nx = cx + Math.cos(needleAngle) * radius;
    const ny = cy + Math.sin(needleAngle) * radius;
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = clampedLevel > 0.85 ? '#ff2233' : '#e2e8f0';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Center pivot knob
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#2d3748';
    ctx.fill();
    ctx.strokeStyle = '#4a5568';
    ctx.stroke();

    // Peak LED
    const ledX = x + w - 16;
    const ledY = y + 14;
    ctx.beginPath();
    ctx.arc(ledX, ledY, 4, 0, Math.PI * 2);
    ctx.fillStyle = clampedLevel > 0.85 ? '#ff0033' : '#4a111a';
    ctx.fill();
    if (clampedLevel > 0.85) {
      ctx.shadowColor = '#ff0033';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.warn);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(console.warn);
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="winamp-chassis p-2.5 rounded-lg flex flex-col gap-2 relative shadow-2xl"
    >
      {/* Visualizer Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="font-chakra text-xs font-bold tracking-wider text-gray-300 uppercase">
            Master Audio Visualizer & VU Monitor
          </span>
        </div>

        {/* Mode Selector Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setVisMode('spectrum')}
            className={`winamp-btn px-2 py-1 text-[11px] font-chakra flex items-center gap-1 rounded ${
              visMode === 'spectrum' ? 'active text-cyan-300' : 'text-gray-400'
            }`}
            title="Spectrum Analyzer"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Spectrum</span>
          </button>

          <button
            onClick={() => setVisMode('oscilloscope')}
            className={`winamp-btn px-2 py-1 text-[11px] font-chakra flex items-center gap-1 rounded ${
              visMode === 'oscilloscope' ? 'active text-green-300' : 'text-gray-400'
            }`}
            title="Oscilloscope Waveform"
          >
            <Radio className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Oscillo</span>
          </button>

          <button
            onClick={() => setVisMode('vu')}
            className={`winamp-btn px-2 py-1 text-[11px] font-chakra flex items-center gap-1 rounded ${
              visMode === 'vu' ? 'active text-amber-300' : 'text-gray-400'
            }`}
            title="Stereo Analog VU Meters"
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Analog VU</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="winamp-btn p-1 text-gray-400 hover:text-white rounded"
            title="Toggle Fullscreen Visualizer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div className="winamp-panel p-1 rounded overflow-hidden relative">
        <canvas
          ref={canvasRef}
          width={640}
          height={160}
          className="w-full h-36 md:h-40 rounded block bg-[#080a0f]"
        />

        {/* Mode Watermark Tag */}
        <div className="absolute bottom-2 right-3 font-orbitron text-[9px] text-gray-600 uppercase tracking-widest pointer-events-none">
          {visMode} / 256-FFT / 48kHz
        </div>
      </div>
    </div>
  );
}
