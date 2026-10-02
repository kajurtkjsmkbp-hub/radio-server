# 📻 Khanza.NET RADIO — Radio Online Streaming & Winamp Broadcast Studio

Aplikasi website radio streaming online profesional dan pemutar musik ala **Winamp Classic / Modern Studio**, dilengkapi fitur siaran langsung (broadcasting), mikrofon penyiar remote melalui web dengan talkover auto-ducking, soundboard jingle, 10-band graphic equalizer, visualizer audio real-time, manajemen jadwal siaran otomatis, dan portal pendengar interaktif.

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

### 2. 🎙️ Studio Siaran Radio & Mic Remote (Broadcast Suite)
- **Siaran Jarak Jauh (Remote Broadcasting)**: Penyiar dapat membuka dashboard dari laptop mana saja melalui domain publik (HTTPS) dan langsung mengaktifkan mikrofon laptop tanpa perlu software tambahan.
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
- **Live Stream Server Relay**: Tautan streaming publik (`/api/stream`) untuk didengarkan oleh pengguna lain di seluruh dunia.

### 3. 📅 Penjadwalan Siaran & Auto-DJ (Schedule Manager)
- Atur slot program siaran otomatis 24 jam.
- Upload lagu langsung ke dalam slot program tertentu.
- Data tersimpan secara persisten di server (`uploads/schedule_data.json`).

### 4. 📚 Pustaka Musik Server (Server Media Library & Music Pool)
- **Zero File Duplication**: 1 file lagu MP3 yang tersimpan di Proxmox dapat digunakan di berbagai slot jadwal tanpa menduplikasi ruang harddisk.
- **Pemindai Otomatis Koleksi Server**: Memindai seluruh file MP3 di folder `uploads/` server secara otomatis. Jika Anda menyalin ratusan lagu via SFTP/FileZilla, lagu langsung otomatis muncul di dashboard.
- **Audio Preview Player**: Tombol Play/Pause untuk mendengarkan cuplikan audio langsung dari pustaka sebelum dimasukkan ke jadwal.
- **Batch Add (Pilih Banyak)**: Centang beberapa lagu sekaligus dan masukkan langsung ke slot acara yang dipilih dengan 1 klik.
- **Status Keterpakaian**: Indikator apakah sebuah lagu sudah terdaftar di slot tertentu atau masih bebas.
- **Pencegah Hapus Tak Sengaja**: Menampilkan peringatan proteksi jika file yang hendak dihapus masih terdaftar di jadwal siaran aktif.

### 5. 🌐 Direktori Stasiun Radio Online & Tuner
- Preset stasiun radio global berkualitas tinggi (ChillHop Lo-Fi, Synthwave 80s, Smooth Jazz, Club Dance EDM, Classic Rock, Acoustic Indie, Space Ambient).
- Opsi menambahkan stasiun radio streaming kustom sendiri (Icecast / Shoutcast / MP3 streams).
- Pencarian dan filter kategori stasiun.

### 5. 📊 Audio Visualizer Real-Time
- **Spectrum Analyzer**: Bar grafik frekuensi ala Winamp dengan titik peak yang jatuh perlahan.
- **Oscilloscope**: Tampilan bentuk gelombang gelombang suara neon glowing.
- **Stereo Analog VU Meters**: Jarum analog vintage Left & Right dengan lampu indikator beban puncak (Peak LED).
- Mode layar penuh (Fullscreen toggle).

### 6. 💬 Live Shoutbox & Interaksi Pendengar
- Kolom chat pendengar & request lagu secara real-time.
- Mode DJ untuk mengirim pengumuman siaran.
- Tombol reaksi emoji mengambang (❤️, 🔥, 👏, 📻, ⚡).

---

## 🛠️ PANDUAN LENGKAP INSTALASI DI LXC PROXMOX

Panduan ini ditujukan untuk deployment di Container LXC Proxmox VE (Ubuntu 22.04 / 24.04 LTS atau Debian 12).

### 1. Persiapan Container LXC di Proxmox
- **OS Template**: Ubuntu 22.04 / 24.04 atau Debian 12
- **Cores**: 1 - 2 vCPU
- **RAM**: 1024 MB - 2048 MB (1 - 2 GB)
- **Disk**: 15 GB - 50 GB (sesuaikan dengan perkiraan jumlah koleksi MP3 lagu siaran)
- **Network**: DHCP atau Static IP (Bridge `vmbr0`)

---

### 2. Update Sistem & Install Node.js
Buka console LXC Proxmox (sebagai `root`), lalu jalankan:

```bash
# 1. Update paket sistem
apt update && apt upgrade -y
apt install -y curl git build-essential

# 2. Install Node.js (v20 LTS disarankan)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 3. Cek versi instalasi
node -v
npm -v
```

---

### 3. Clone Repository & Setup Aplikasi
Letakkan aplikasi pada folder `/opt/radio-server`:

```bash
# 1. Clone repository
git clone https://github.com/kajurtkjsmkbp-hub/radio-server.git /opt/radio-server

# 2. Masuk ke folder proyek
cd /opt/radio-server

# 3. Install paket dependensi
npm install

# 4. Build frontend (Vite)
npm run build

# 5. Pastikan folder uploads tersedia dan memiliki izin tulis
mkdir -p uploads
chmod -R 755 uploads
```

---

### 4. Konfigurasi Systemd (Berjalan 24/7 di Background)
Agar server otomatis berjalan di latar belakang dan otomatis menyala saat container reboot:

Buat file unit service:
```bash
nano /etc/systemd/system/radio.service
```

Salin konfigurasi berikut ke dalam file:
```ini
[Unit]
Description=Khanza.NET Radio & Winamp Broadcast Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/radio-server
ExecStart=/usr/bin/node /opt/radio-server/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

Simpan file (`Ctrl + O`, lalu `Enter`, lalu `Ctrl + X`).

Aktifkan service:
```bash
# Reload systemd
systemctl daemon-reload

# Aktifkan saat boot
systemctl enable radio

# Jalankan service sekarang
systemctl start radio

# Periksa status service
systemctl status radio
```

---

### 5. Integrasi Cloudflare Tunnel (Akses Remote & Siaran Jarak Jauh)

Agar website bisa diakses dari internet dan **fitur mikrofon penyiar bisa aktif dari laptop jarak jauh**, gunakan Cloudflare Tunnel (gratis & aman dengan sertifikat SSL/HTTPS otomatis).

1. Buka dashboard [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) -> **Networks** -> **Tunnels**.
2. Pilih Tunnel yang sudah ada atau buat tunnel baru.
3. Masuk ke tab **Public Hostname** -> klik **Add a public hostname**:
   - **Subdomain**: `radio2` (atau sesuai keinginan)
   - **Domain**: `iphoenkz.my.id`
   - **Service Type**: `HTTP`
   - **URL**: `localhost:3000` *(atau IP lokal LXC jika cloudflared dipasang di server/host terpisah)*
4. Klik **Save Hostname**.
5. **PENTING**: Di dashboard Cloudflare utama pada domain Anda, buka menu **Network** dan pastikan opsi **WebSockets** berada dalam posisi **ON**.

Buka di browser:
- 🎧 **Halaman Pendengar**: `https://radio2.iphoenkz.my.id/pendengar`
- 🎙️ **Halaman Penyiar**: `https://radio2.iphoenkz.my.id/penyiar` *(PIN default: `1234`)*
- 📻 **Direct Stream Audio**: `https://radio2.iphoenkz.my.id/api/stream`

---

## 🔒 PANDUAN UPDATE KODE (AMAN TANPA MERUSAK/MENGHAPUS DATABASE)

Aplikasi menyimpan database dan koleksi lagu secara lokal di folder `uploads/`:
- `uploads/schedule_data.json` *(Database slot jadwal siaran & metadata)*
- `uploads/*.mp3` *(File lagu-lagu siaran yang telah diupload penyiar)*

Folder `uploads/*` sudah dimasukkan ke `.gitignore`, sehingga saat Anda melakukan `git pull` dari GitHub, **data siaran dan file MP3 tidak akan terhapus atau tertimpa oleh Git**.

### Langkah Melakukan Update di LXC Proxmox:

#### Langkah A (Opsional): Backup Data Terlebih Dahulu
Untuk keamanan ekstra sebelum update:
```bash
mkdir -p /root/radio-backups
cp -r /opt/radio-server/uploads /root/radio-backups/backup-$(date +%Y%m%d-%H%M%S)
```

#### Langkah B: Tarik Update & Rebuild
```bash
cd /opt/radio-server

# 1. Tarik pembaruan kode terbaru dari GitHub
git pull origin main

# 2. Install dependensi baru (jika ada)
npm install

# 3. Build ulang file frontend
npm run build

# 4. Restart service agar pembaruan langsung aktif
systemctl restart radio
```

#### Langkah C: Cek Status
```bash
systemctl status radio
```

Setelah update selesai, seluruh lagu di `uploads/` dan jadwal `schedule_data.json` tetap utuh 100%!

---

## 💻 Menjalankan di Lokal (Windows Dev Mode)

### Cara Cepat
Klik ganda file:
```
start-radio.bat
```
Lalu buka browser di **`http://localhost:3000`**.

### Mode Pengembangan (Vite HMR)
```bash
npm run dev
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
