# 📻 Khanza.NET RADIO — Radio Online Streaming & Winamp Broadcast Studio

Aplikasi website radio streaming online profesional dan pemutar musik ala **Winamp Classic / Modern Studio**, dilengkapi fitur siaran langsung (broadcasting), talkover auto-ducking, soundboard jingle, 10-band graphic equalizer, dan visualizer audio real-time.

---

## ⚡ Fitur Utama

### 1. 🎛️ Pemutar Lagu ala Winamp (Winamp Audio Deck)
- **Desain & Interface Winamp**: Chassis bertingkat, layar LCD digital font retro phosphor green/amber, marquee text scrolling judul lagu, indikator bitrate (kbps), sample rate (kHz), dan lampu stereo.
- **Equalizer 10-Band**: Pengatur frekuensi grafis (32Hz, 64Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz) + Preamp Slider + Presets (Rock, Pop, Techno, Bass Boost, Club, Vocal, dll.).
- **Manajemen Playlist Fleksibel**:
  - Drag & Drop file audio (MP3, WAV, FLAC, OGG, AAC) langsung ke jendela playlist.
  - Tambah file lokal via tombol `+ FILE`.
  - Tambah link URL streaming via tombol `+ URL`.
  - Mode Shuffle (Acak), Repeat (Ulangi Satu / Semua), dan filter pencarian lagu.
  - Dilengkapi musik demo bawaan (*Procedural Synthwave & Lo-Fi*) yang bisa langsung dites tanpa perlu file eksternal.
- **DJ Pitch & Speed Slider**: Ubah tempo dan nada lagu (-20% s/d +20%).
- **Balance & Master Volume**: Pengaturan panning Left/Right dan level volume presisi.

### 2. 🎙️ Studio Siaran Radio (Broadcast Suite)
- **Lampu "ON AIR"**: Saklar siaran langsung menyala dengan timer durasi siaran (HH:MM:SS).
- **Mikrofon DJ Langsung**: Input mic dari browser dengan meteran VU level input (RMS & Peak) dan pengatur Mic Gain.
- **Auto-Ducking (Talkover Otomatis)**: Fitur khas radio profesional di mana volume musik otomatis mengecil saat DJ berbicara di mic, dan naik kembali secara halus saat hening.
- **Voice FX Processor**: Efek suara vokal DJ:
  - *Clean Studio* (Suara jernih)
  - *Radio AM/FM* (Efek suara radio vintage / telepon)
  - *Warm Vocal* (Kompresor vokal hangat)
  - *DJ Echo* (Delay gema khas DJ)
  - *Robot RingMod* (Efek suara robot)
- **Soundboard / Jingle Cart (Hotkeys 1 - 8)**:
  - Tombol instan efek suara: Air Horn, Station ID Chime, DJ Vinyl Scratch, Tepuk Tangan (Applause), Laser Pew, Drum Roll, Breaking News Flash, dan Censor Bleep.
- **Perekam Siaran (Broadcast Recorder)**: Rekam seluruh sesi siaran langsung (Musik + Suara Mic DJ + Jingle) dan unduh hasilnya menjadi file audio resolusi tinggi.
- **Live Stream Server Relay**: Tautan streaming publik lokal (`http://localhost:3000/api/stream`) untuk didengarkan oleh pengguna lain di jaringan.

### 3. 🌐 Direktori Stasiun Radio Online & Tuner
- Preset stasiun radio global berkualitas tinggi (ChillHop Lo-Fi, Synthwave 80s, Smooth Jazz, Club Dance EDM, Classic Rock, Acoustic Indie, Space Ambient).
- Opsi menambahkan stasiun radio streaming kustom sendiri (Icecast / Shoutcast / MP3 streams).
- Pencarian dan filter kategori stasiun.

### 4. 📊 Audio Visualizer Real-Time
- **Spectrum Analyzer**: Bar grafik frekuensi ala Winamp dengan titik peak yang jatuh perlahan.
- **Oscilloscope**: Tampilan bentuk gelombang gelombang suara neon glowing.
- **Stereo Analog VU Meters**: Jarum analog vintage Left & Right dengan lampu indikator beban puncak (Peak LED).
- Mode layar penuh (Fullscreen toggle).

### 5. 💬 Live Shoutbox & Interaksi Pendengar
- Kolom chat pendengar & request lagu secara real-time.
- Mode DJ untuk mengirim pengumuman siaran.
- Tombol reaksi emoji mengambang (❤️, 🔥, 👏, 📻, ⚡).

---

## 🚀 Cara Menjalankan

### Cara Cepat (Windows)
Cukup klik ganda file:
```
start-radio.bat
```
Lalu buka browser di **`http://localhost:3000`**.

### Atau Menggunakan Terminal
1. Buka folder proyek di terminal / PowerShell:
```bash
cmd /c "npm start"
```
2. Untuk mode pengembangan aktif (Vite HMR):
```bash
cmd /c "npm run dev"
```
Buka browser di **`http://localhost:5173`**.

---

## ⌨️ Tombol Pintas (Keyboard Shortcuts)
| Tombol | Fungsi |
|---|---|
| **Spasi** | Play / Pause |
| **Z** | Lagu Sebelumnya (Previous) |
| **X** | Play |
| **C** | Pause |
| **V** | Stop |
| **B** | Lagu Selanjutnya (Next) |
| **1 - 8** | Efek Suara Soundboard / Jingle Carts |
