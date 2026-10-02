# 🧠 DOKUMEN INGATAN & ARSIP PROYEK
## Khanza.NET RADIO & Winamp Playout Broadcast Studio (Part 2)

Dokumen ini mencatat seluruh arsitektur sistem, riwayat pengembangan, perbaikan bug, keputusan teknis, dan panduan operasional proyek agar dapat diingat dan dilanjutkan kapan saja.

---

## 📌 1. Gambaran Umum Proyek (Project Overview)

* **Nama Aplikasi**: Khanza.NET RADIO - Online Streaming & Winamp Studio Playout Suite
* **Tujuan**: Aplikasi radio streaming real-time dengan antarmuka ganda (*Dual View*):
  1. **Studio Penyiar (`/penyiar`)**: Dilindungi PIN (`1234`), dilengkapi Playout Deck bergaya Winamp Classic, Equalizer 10-Band, Playlist Manager, Konsol Mikrofon Studio, 16-Pad Soundboard/Cart Wall jingle profesional, dan Papan Telemetri Status Pendengar Online.
  2. **Portal Pendengar (`/pendengar`)**: Antarmuka publik yang ramah pengguna PC maupun Ponsel (HP), piringan hitam vinyl spinning, visualizer audio, jadwal program, serta live shoutbox chat & reaksi emoji interaktif.
* **Tech Stack**:
  * **Frontend**: React 19, Vite 6, Tailwind CSS v4, Lucide React Icons.
  * **Audio Processing**: HTML5 Audio + Web Audio API (`AudioContext`, `AnalyserNode`, `BiquadFilterNode`, `GainNode`, `ScriptProcessorNode` / Audio Worklet).
  * **Backend & Streaming**: Node.js, Express, Native WebSockets (`ws`), BroadcastChannel API (untuk sinkronisasi 0ms antar-tab dalam satu perangkat).

---

## 🏗️ 2. Arsitektur Komponen & Peta File

```
RADIO-ONLINE-PART2/
├── server.js                          # Express server, WebSocket relay, stream ingester, chat & telemetry store, REST schedule API
├── index.html                         # Entry HTML dengan Google Fonts (Orbitron, Chakra Petch, VT323)
├── package.json                       # Dependencies & build scripts
├── uploads/                           # Penyimpanan audio MP3 & data persisten jadwal di disk lokal
│   ├── schedule_data.json             # Database JSON jadwal siaran & daftar lagu per slot
│   ├── slot_*.mp3                     # File audio MP3 asli yang diunggah per slot jadwal siaran
│   └── lib_*.mp3                      # File audio MP3 koleksi pustaka terpusat (server media library)
├── public/
│   ├── sfx/                           # File audio asli untuk soundboard / jingle cart wall
│   │   ├── applause.mp3               # Suara tepuk tangan nyata manusia (real human crowd)
│   │   ├── boo.mp3                    # Suara cemoohan penonton
│   │   ├── gasp.mp3                   # Suara kaget
│   │   ├── tada.mp3                   # Suara fanfare
│   │   ├── victory.mp3                # Suara kemenangan
│   │   └── wrong.mp3                  # Suara bel salah / buzzer
├── src/
│   ├── main.jsx                       # React entry point
│   ├── App.jsx                        # Master layout, routing (/penyiar vs /pendengar), auto-scheduler loop, global hotkeys
│   ├── styles/
│   │   └── index.css                  # Custom styling Winamp chassis, glow effects, tema skin CSS, utility HP
│   ├── components/
│   │   ├── BroadcasterLiveBoard.jsx   # Papan telemetri studio, LCD jumlah pendengar online, timer on-air, link copy
│   │   ├── BroadcastConsole.jsx       # Panel mik penyiar, volume jingle, saklar auto-ducking, soundboard 16 pads
│   │   ├── EqualizerWindow.jsx        # 10-band equalizer audio Winamp (+12dB s/d -12dB)
│   │   ├── ListenerChat.jsx           # Live shoutbox, pesan teks real-time, animasi emoji reaksi mengambang
│   │   ├── ListenerPortal.jsx         # Tampilan pendengar, full theme skin, vinyl player, tab HP, sticky dock
│   │   ├── MediaLibraryModal.jsx      # Modal manajemen pustaka musik server, filter status, preview, delete, batch assign
│   │   ├── Navbar.jsx                 # Header bar navigasi, status ON-AIR, selector skin tema, jam digital
│   │   ├── PlaylistWindow.jsx         # Manajemen lagu playlist Winamp
│   │   ├── RadioStations.jsx          # Daftar stasiun radio preset
│   │   ├── ScheduleManager.jsx        # Manajemen jadwal siaran dinamis, kalkulator estimasi lagu, upload MP3 per slot
│   │   ├── Visualizer.jsx             # Spectrum Analyzer, Oscilloscope Waveform, Analog Stereo VU Meters (skin-reactive)
│   │   └── WinampPlayer.jsx           # Deck utama Winamp (Play, Pause, Stop, Seekbar, seek sync, Mute Spk)
│   └── utils/
│       ├── audioEngine.js             # Jantung pemrosesan audio (Web Audio graph, seek sync, Mic relay, Auto-Ducking)
│       ├── stationData.js             # Data stasiun radio, 16 sound effect hotkeys (1-0, Q-Y), lagu demo awal
│       └── uploader.js                # Helper upload file berkemajuan (MB/s, ETA, %) & multi-chunk >25MB bypass Cloudflare
```

---

## 📜 3. Riwayat Permintaan & Solusi Masalah Penting

### A. Kualitas Suara Mikrofon Penyiar di Sisi Pendengar
* **Masalah**: Suara mic penyiar terdengar kecil, berat, atau bergema di pendengar; dan jika pendengar mengatur volume, musik malah terputus.
* **Solusi**:
  1. Mengaktifkan filter penangkap suara berkualitas di `audioEngine.js` (`echoCancellation: true`, `noiseSuppression: true`, `autoGainControl: true`).
  2. Menambahkan Voice FX Chain dengan High-pass Filter (pemotongan frekuensi sub-bass di bawah 80Hz) dan Presence Boost (frekuensi 3kHz) agar suara mic jernih, renyah, dan tidak mendengung.
  3. Mengatur relai PCM float32 ke WebSocket pendengar sehingga suara mic di-mix di browser pendengar melalui `audioEngine.playPcmChunk` secara terpisah dari audio streaming musik.

### B. Musik Menyesuaikan Penyiar (Sinkronisasi & Resume)
* **Masalah**: Jika penyiar belum memutar lagu, musik di pendengar harus standby; dan jika dijeda, saat diputar lagi harus melanjutkan (bukan mulai dari awal).
* **Solusi**:
  1. `applyDjPlayState()` di `ListenerPortal.jsx` memantau `radioState.isPlaying`. Jika false, musik di pendengar ikut pause dan mencatat `pausedTimeRef.current`.
  2. Saat penyiar memutar kembali, lagu melanjutkan dari posisi terakhir.
  3. Banner peringatan ramah: "*MUSIK STUDIO BELUM DIPUTAR / SEDANG DIJEDA*" memberitahu pendengar bahwa penyiar belum memutar lagu, tetapi suara mic penyiar tetap bisa didengarkan.

### C. Tombol "MUTE SPK" (Mute Speaker Monitor Studio)
* **Masalah**: Tombol mute speaker harus rapi dan tidak mematikan siaran ke pendengar.
* **Solusi**:
  1. Tombol `MUTE SPK` di [`WinampPlayer.jsx`](file:///C:/Users/iphoenkz/Music/RADIO-ONLINE-PART2/src/components/WinampPlayer.jsx) dihubungkan ke `audioEngine.toggleStudioMonitorMute()`.
  2. Node yang di-mute HANYA `this.monitorGain` (speaker laptop penyiar untuk menghindari feedback/suara gema saat penyiar berbicara di dekat speaker). Siaran ke pendengar (`this.broadcastGain` & stream server) tetap berjalan 100% normal.

### D. Soundboard / Cart Wall 16 Pad & Suara Applause Nyata
* **Masalah**: Suara tepuk tangan bawaan synthesizer tidak terdengar seperti tepuk tangan manusia asli, dan efek suara ingin diperbanyak seperti radio komersial profesional.
* **Solusi**:
  1. Memasang file audio MP3 asli rekaman manusia ke folder `public/sfx/`: `applause.mp3` (tepuk tangan riuh asli), `boo.mp3`, `gasp.mp3`, `tada.mp3`, `victory.mp3`, `wrong.mp3`.
  2. Menambahkan metode `audioEngine.playRealSfx(name)` yang memutar audio rekaman asli langsung ke stream siaran dan monitor studio.
  3. Memperluas grid soundboard menjadi 16 tombol (4x4) dengan shortcut keyboard angka `1 s/d 0` dan huruf `Q, W, E, R, T, Y`.

### E. Papan Informasi Telemetri & Pendengar Online (`BroadcasterLiveBoard.jsx`)
* **Masalah**: Di halaman penyiar ingin ada papan informasi yang estetik dan rapi untuk memantau berapa pendengar yang sedang online.
* **Solusi**:
  1. Membuat komponen [`BroadcasterLiveBoard.jsx`](file:///C:/Users/iphoenkz/Music/RADIO-ONLINE-PART2/src/components/BroadcasterLiveBoard.jsx) bergaya Rack Telemetry Cyberpunk.
  2. Menampilkan:
     * **👥 PENDENGAR ONLINE**: Angka LCD besar menyala (`glow-cyan`), status *ACTIVE LIVE*, dan *Peak Listeners*.
     * **🔴 STATUS PEMANCAR**: Badge berdenyut *LIVE ON AIR*, durasi jam siaran berjalan, dan bitrate 320 kbps.
     * **🎵 AUDIO SUMBER**: Judul lagu aktif atau status *MIC BROADCAST* jika lagu sedang jeda, lengkap dengan visualizer mini 7-bar.
     * **💬 INTERAKSI PENDENGAR**: Counter reaksi love/fire dan total pesan shoutbox.
     * **⏱️ JAM STUDIO DIGITAL & ⚡ SYNC AKTIF**: Jam real-time detik WIB dan status WebSocket 0ms delay.
     * **🔗 KOTAK LINK PENDENGAR**: Tombol *SALIN LINK* dan tombol *BUKA TAB PENDENGAR* untuk uji coba instan.

### F. Pelacakan Unik Pendengar (Deduplikasi Tab & Perangkat)
* **Solusi di `server.js`**:
  * Koneksi WebSocket mengirimkan query parameter `?role=dj` (untuk halaman penyiar) atau `?role=listener&clientId=...` (untuk halaman pendengar).
  * `sessionStorage` menyimpan `khanza_listener_id` sehingga jika 1 pendengar membuka portal radio dan shoutbox di tab yang sama, sistem secara cerdas menghitungnya sebagai **1 pendengar** (bukan dobel).
  * Saat tab ditutup, event `ws.on('close')` seketika memperbarui jumlah pendengar secara real-time.

### G. Perilaku Auto-Ducking (Talkover) yang Stabil
* **Masalah**:
  * Sebelumnya, saat tombol Mic dinyalakan, lagu langsung otomatis anjlok ke 16% volume meskipun penyiar belum berbicara atau auto-ducking dimatikan.
* **Solusi**:
  1. **Jika Auto-Ducking OFF**: Volume musik **100% stabil dan normal** (sama dengan volume musik aslinya, tidak ada penurunan volume sama sekali).
  2. **Jika Auto-Ducking ON**: Menyalakan mic tidak langsung mengecilkan lagu. Lagu baru mengecil secara halus saat ada suara berbicara dari penyiar, dan diturunkan ke **50%** (tingkat *background music* yang seimbang, tidak mati). Saat penyiar jeda bicara, lagu otomatis kembali naik ke 100%.
  3. Sinyal `MIC_STATUS` hanya berfungsi menampilkan indikator visual (*🎙️ PENYIAR SEDANG BERBICARA*), tidak memotong volume audio.

### H. Tampilan Responsif Khusus Ponsel / HP (`ListenerPortal.jsx`)
* **Masalah**: Di layar HP, antarmuka pendengar sebelumnya terlalu panjang ke bawah dan piringan vinyl terlalu besar.
* **Solusi**:
  1. **Vinyl Adaptif**: Di HP, piringan vinyl otomatis mengecil (`w-32 h-32` vs `w-56 h-56` di PC) sehingga tombol siaran tidak terdorong ke bawah layar.
  2. **Tombol Play Lebar Penuh (*Full-Width*)**: Sangat nyaman ditekan dengan satu jempol di layar sentuh.
  3. **Tab Navigasi Mobile Khusus HP (Segmented Switcher)**:
     * `[💬 Shoutbox & Chat]`
     * `[🎵 Visualizer]`
     * `[📅 Jadwal]`
     * Pendengar di HP tidak perlu scroll berkilo-kilo meter ke bawah, cukup ketuk tab untuk langsung berinteraksi.
     * Di PC/Desktop, tampilan tetap tampil 2 kolom lebar berdampingan.
  4. **Mini-Player Mengambang (*Sticky Bottom Bar*)**:
     * Saat pendengar di HP scroll ke bawah membaca chat atau jadwal, muncul bar mini player di bawah layar yang menampilkan judul lagu, status siaran, tombol *Play/Pause*, dan tombol *Mute*.

---

## 🚀 4. Panduan Menjalankan Aplikasi

1. **Jalankan Build Frontend (Vite)**:
   ```bash
   npm run build
   ```
2. **Jalankan Server Node.js**:
   ```bash
   node server.js
   ```
3. **Akses URL**:
   * 🎧 **Halaman Pendengar**: `http://localhost:3000/pendengar`
   * 🎙️ **Ruang Studio Penyiar**: `http://localhost:3000/penyiar` (PIN Default: `1234`)
   * 📻 **Stream Audio Relay**: `http://localhost:3000/api/stream`

---

### I. Manajemen Jadwal Program Siaran Dinamis (`ScheduleManager.jsx`)
* **Masalah**: Jadwal program siaran sebelumnya di-hardcode langsung di `ListenerPortal.jsx` dan tidak bisa diubah oleh penyiar.
* **Solusi**:
  1. **Komponen Baru [`ScheduleManager.jsx`](file:///C:/Users/iphoenkz/Music/RADIO-ONLINE-PART2/src/components/ScheduleManager.jsx)**: Panel manajemen jadwal di sisi penyiar (`/penyiar`).
     * Penyiar dapat **menambah, mengedit, dan menghapus** slot jadwal siaran (jam mulai, jam selesai, judul program, nama DJ).
     * Setiap slot memiliki **estimator otomatis** yang menghitung berapa file lagu dibutuhkan untuk mengisi durasi slot (misal: 1 jam ÷ 3.5 menit/lagu ≈ 17 lagu).
     * Slider rata-rata durasi per lagu (2-7 menit) untuk menyesuaikan estimasi.
     * **Upload musik manual** per slot jadwal, dengan progress bar menunjukkan berapa lagu sudah diupload vs yang dibutuhkan.
     * Deteksi slot aktif otomatis berdasarkan jam WIB real-time.
  2. **API Server** (`server.js`):
     * `GET /api/schedule` — mengambil jadwal aktif.
     * `POST /api/schedule` — mengganti seluruh jadwal.
     * `POST /api/schedule/slot` — tambah/edit satu slot jadwal.
     * `DELETE /api/schedule/slot/:id` — hapus satu slot.
     * WebSocket: `SCHEDULE_INIT` (saat koneksi) dan `SCHEDULE_UPDATE` (saat ada perubahan) untuk sinkronisasi real-time.
  3. **Sinkronisasi ke Pendengar**: `ListenerPortal.jsx` mengambil jadwal dari server (bukan hardcoded) dan otomatis ter-update secara real-time via WebSocket saat penyiar mengubah jadwal. Badge **SEKARANG** ditampilkan berdasarkan deteksi jam WIB real-time.
  4. **Otomatisasi Playout Sesuai Jam (Auto-Scheduler Engine)**:
     * File audio yang di-upload ke slot jadwal di-upload nyata ke server (`/uploads/`) dan disimpan permanen di file `uploads/schedule_data.json`.
     * Mesin pemantau jadwal (`Auto-Scheduler`) di `App.jsx` memeriksa waktu setiap 10 detik.
     * Saat jam siaran suatu program tiba (misal: 15:00 untuk program Malaysia), playlist Winamp **otomatis terisi oleh lagu-lagu yang diinputkan ke jadwal tersebut dan langsung berputar (Auto-Play ON)**.
     * Penyiar juga bisa menekan tombol **"PUTAR JADWAL INI"** kapan saja untuk memutar program secara instan tanpa menunggu jam tiba.
     * Terdapat banner notifikasi di studio saat lagu jadwal sedang mengudara otomatis.

---

### J. Sinkronisasi Durasi & Jam Tayang Live di Pendengar (Anti-Terpotong)
* **Masalah**: Pendengar mendengarkan lagu hanya 3 menit lalu tiba-tiba terputus dan berganti ke lagu berikutnya, meskipun lagu aslinya berdurasi 5-6 menit.
* **Penyebab**:
  1. *Desinkronisasi Waktu Mulai*: Studio penyiar sudah memutar lagu dari menit ke-0. Pendengar baru membuka/menekan "Play" 2 menit kemudian. Di versi sebelumnya, pendengar memutar MP3 dari 0:00 (bukan dari menit 2:00 siaran live). Akibatnya saat studio selesai memutar lagu di menit ke-5, studio berganti lagu ke trek berikutnya dan mengirim sinyal ganti lagu ke pendengar, sehingga lagu di pendengar terpotong di menit ke-3.
  2. *Re-trigger `audio.src`*: Pengecekan URL di WebSocket `ws.onmessage` membandingkan relative path dengan absolute URL (`audio.src !== nextTrack.audioUrl`), menyebabkan audio di pendengar me-reset ulang posisinya setiap ada pesan `RADIO_STATE`.
  3. *Durasi Default*: Durasi lagu sebelumnya di-hardcode 210 detik (3.5 menit) saat upload.
* **Solusi**:
  1. **Deteksi Durasi Otomatis Asli**: `server.js` memiliki parser frame MP3 (`getMp3Duration`) yang membaca durasi presisi tiap file saat diunggah (misal 376 detik / 6:16).
  2. **Timestamp `startedAt` Live Broadcast**: Broadcaster menyertakan `startedAt: Date.now()`.
  3. **Auto Time-Sync di Pendengar**: `ListenerPortal.jsx` otomatis menyelaraskan posisi putar (`audio.currentTime = elapsed`) saat pendengar masuk ke siaran yang sedang berjalan (layaknya radio siaran FM live), sehingga studio dan pendengar berada di detik yang persis sama dan lagu selesai bersamaan tanpa terpotong.
  4. **Pembersihan Logika Re-trigger**: Pengecekan URL dinormalisasi menggunakan `pathname`, mencegah pemotongan dan restart audio yang tidak diinginkan.

---

### K. Sinkronisasi Maju/Mundur Waktu Lagu (Live Seek Sync)
* **Masalah**: Saat penyiar menggeser slider waktu (seek bar / memajukan / memundurkan) di Winamp, lagu di sisi pendengar tidak terpengaruh dan tetap berjalan di posisi lama.
* **Penyebab**: Fungsi `seekPlayback` di `audioEngine.js` dan `WinampPlayer.jsx` hanya mengubah `audioElement.currentTime` lokal di laptop penyiar tanpa mengirimkan event relay ke WebSocket maupun `BroadcastChannel`.
* **Solusi**:
  1. `audioEngine.seekPlayback(time)` sekarang membroadcast sinyal `{ type: 'TRACK_SEEK', time }` secara instan.
  2. `App.jsx` memperbarui `currentTrack.startedAt = Date.now() - (time * 1000)` ke `/api/radio-state`.
  3. `ListenerPortal.jsx` menerima sinyal `TRACK_SEEK` dan langsung menyelaraskan `audio.currentTime = time`, sehingga saat penyiar memajukan/memundurkan lagu, seluruh pendengar ikut berpindah ke detik yang sama secara instan!

---

### L. Refinement & Polishing Tampilan Jadwal Program Siaran (`ScheduleManager.jsx`)
* **Perbaikan Tampilan & Kerapian**:
  1. **Perbaikan Teks Tombol Playlist**: Menghilangkan duplikasi tanda plus ganda (`+ + Ke Playlist Winamp` diperbaiki menjadi `Ke Playlist Winamp` dengan ikon `ListMusic`).
  2. **Grid Informasi Slot (Dashboard Insights)**: Menggantikan teks baris panjang yang bertumpuk dengan 3 kartu ringkasan terstruktur dan simetris:
     - Kartu 1: *Durasi Program* (dengan ikon Timer & format jam/menit yang rapi).
     - Kartu 2: *Target / Rata-rata* (jumlah target lagu & durasi rata-rata per lagu).
     - Kartu 3: *Kesiapan Siaran* (badge status kuota cukup / kurang X lagu dengan warna adaptif emerald/amber).
  3. **Penyelarasan Time-Box & Tombol Header**:
     - Kotak waktu jam siaran dirancang dengan font LCD tebal dan border kontras yang proporsional.
     - Tombol aksi di sisi kanan (*PUTAR JADWAL*, *Edit*, *Hapus*, dan *Expand*) kini memiliki ukuran tinggi seragam (`h-7`), sejajar rapi, dan responsif.
  4. **Pembersihan Judul & Detail Daftar Lagu**:
     - Menghilangkan redundansi tampilan nama file di dalam tanda kurung yang mengulang judul lagu (`1001 HARI - Sherly KDI Adella (1001 HARI - Sherly KDI Adella.mp3)` menjadi judul bersih `1001 HARI - Sherly KDI Adella`).
     - Menambahkan tampilan durasi riil MP3 dengan badge LCD neon (`06:16`), ukuran file dalam MB, nomor urut trek rapi, serta tombol hapus per lagu dengan efek hover rose.

---

### M. Full Theme Skinning Engine (`ListenerPortal.jsx`, `Navbar.jsx`, `App.jsx`, `index.css`)
* **Masalah**: Dropdown skin (*Winamp Titanium*, *Cyberpunk Neon*, *Retro Amber CRT*) sebelumnya terasa seperti *gimmick* di halaman pendengar karena hanya mengubah warna visualizer dan tidak tersimpan saat refresh.
* **Solusi & Implementasi**:
  1. **Persistensi State Skin**: State `theme` disimpan di `localStorage` (`khanza_radio_skin`). Pilihan skin pendengar tetap tersimpan walau halaman di-reload.
  2. **Full Visual Transformation**:
     - **Winamp Titanium (Classic)**: Aksen Hijau Zamrud / Emerald Winamp (`#00ff66`), piringan vinyl emas-hijau, ambient glow hijau lembut, tombol play hijau gradasi, jam digital LCD hijau, badge FM hijau.
     - **Cyberpunk Neon**: Aksen Cyan Neon (`#00f3ff`) & Magenta Fuchsia (`#bd00ff`), piringan vinyl cyan-pink, ambient glow ungu-fuchsia neon, tombol play cyan-magenta, jam digital LCD cyan.
     - **Retro Amber CRT**: Aksen Oranye Emas Vintage (`#ffaa00`), piringan vinyl amber-bronze, ambient glow oranye tabung CRT antik, tombol play oranye emas, jam digital LCD amber glow.
  3. **Komponen yang Mengikuti Skin**:
     - *Navbar*: Logo radio gradient, badge status online, teks brand, jam digital studio, dan dropdown select box.
     - *Listener Hero Card*: Glow ambient blur, border container, piringan vinyl, station badge, now playing box, tower icon, teks judul trek, tombol play raksasa, volume icon & label persentase.
     - *Mobile Nav Tabs*: Border container tab & warna tombol tab aktif.
     - *Program Schedule List*: Highlight baris siaran aktif (`SEKARANG`) di tampilan HP maupun desktop.
     - *Sticky Bottom Player*: Border sticky, avatar vinyl mini, teks judul lagu, dan tombol play mengambang.
     - *Audio Visualizer*: Spektrum bar LED (Hijau/Kuning/Merah vs Cyan/Magenta/Ungu vs Amber/Oranye CRT).

---

### N. Pustaka Media Server Terpusat & Kolam Musik (`MediaLibraryModal.jsx` & `/api/library`)
* **Masalah**: Sebelumnya lagu hanya bisa diunggah langsung ke slot jadwal tertentu. Jika satu lagu ingin dipakai di beberapa jadwal siaran berbeda, penyiar harus mengunggah ulang file yang sama berkali-kali sehingga terjadi pemborosan kapasitas harddisk server dan resiko inkonsistensi nama file.
* **Solusi & Implementasi**:
  1. **Sentralisasi Penyimpanan Audio (`/uploads`)**:
     * Seluruh lagu disimpan dalam satu kolam fisik tunggal di folder `uploads/` (`lib_*` untuk upload pustaka dan `slot_*` untuk upload slot).
     * Endpoint `GET /api/library` secara dinamis memindai seluruh file MP3 dan memeriksa referensi pemakaiannya di `schedule_data.json`.
  2. **Antarmuka Pustaka Musik Modern (`MediaLibraryModal.jsx`)**:
     * Dibuka lewat tombol *"PUSTAKA SERVER"* di panel navigasi atas atau di pengelola jadwal.
     * Dilengkapi fitur **Live Audio Preview**: penyiar dapat memutar, menjeda, dan mengecek isi lagu sebelum memasukkannya ke dalam jadwal siaran.
     * **Badge Status Jadwal & Tombol Unlink Cepat (`[X]`)**: Setiap lagu menampilkan badge slot mana saja yang sedang menggunakannya. Penyiar dapat langsung menekan tanda silang merah `[X]` pada badge tersebut untuk melepas lagu dari slot tanpa menghapus file fisiknya dari disk.
     * **Multi-Select & Batch Assign**: Penyiar dapat mencentang beberapa lagu sekaligus lalu memasukkannya ke slot siaran pilihan dalam 1 klik (*Zero-Duplication*).
     * **Filter & Pencarian**: Filter kategori (*Semua*, *Terpakai di Jadwal*, *Bebas / Belum Dipakai*) serta input pencarian real-time berdasarkan judul atau nama file.

---

### O. Penghapusan File dari Harddisk & Optimasi Performa Cache Durasi (`18cb5ce`, `dd37e28`)
* **Fitur Manajemen Penghapusan Fisik File**:
  1. **Hapus Tunggal**: Tombol tong sampah pada baris lagu menghapus file MP3 langsung dari harddisk server (`DELETE /api/library/file/:id`).
  2. **Hapus Terpilih (Batch Delete)**: Penyiar dapat mencentang banyak lagu lalu menekan tombol *"Hapus Terpilih"* (`POST /api/library/delete-batch`).
  3. **Bersihkan Seluruh Harddisk (Purge All)**: Tombol darurat untuk menghapus seluruh file audio dari disk server dengan dialog verifikasi ganda yang aman (`DELETE /api/library/purge-all`).
  4. **Sinkronisasi Otomatis ke Jadwal**: Saat file fisik dihapus dari disk, sistem di `server.js` otomatis membersihkan entri lagu tersebut dari seluruh slot program di `schedule_data.json` dan menyiarkan pembaruan via `broadcastScheduleUpdate()`.
* **Optimasi Kecepatan (In-Memory Duration Cache)**:
  * Pemindaian ribuan frame header MP3 (`getMp3Duration`) dari disk setiap kali endpoint library dipanggil menyebabkan lag/perlambatan.
  * Diimplementasikan `libraryDurationCache` berbasis memori (`fileName + mtime`). File yang sudah pernah dibaca durasinya tidak akan dibaca ulang dari disk, membuat response modal pustaka terbuka instan dalam hitungan milidetik.
  * Penanganan UI React dioptimalkan agar tabel daftar lagu tidak di-*unmount* saat melakukan sinkronisasi background, mencegah efek berkedip (*no flicker*).

---

### P. Sistem Upload Berkemajuan Real-time & Multi-Chunk Bypassing Cloudflare Tunnel (`uploader.js`, `7e345c4`, `f4c8a39`)
* **Masalah**:
  1. Upload file MP3 berukuran besar (seperti Full Album 50MB s/d 208MB+) melalui domain publik Cloudflare Tunnel (`radio2.iphoenkz.my.id`) selalu gagal dengan timeout / *HTTP 413 Payload Too Large* karena Cloudflare Free Tier membatasi *request body* maksimal 100MB per HTTP request.
  2. Browser native `fetch()` tidak mendukung callback pemantauan progress upload, sehingga pengguna tidak tahu berapa persen yang sudah terkirim, berapa kecepatan transfernya, dan berapa lama sisa waktunya.
* **Solusi & Implementasi**:
  1. **Modul Pengunggah Cerdas [`uploader.js`](file:///C:/Users/iphoenkz/Music/RADIO-ONLINE-PART2/src/utils/uploader.js)**:
     * Menggunakan `XMLHttpRequest` dengan hook `xhr.upload.onprogress`.
     * Menghitung kecepatan upload riil (`MB/s`), sisa waktu transfer (*ETA countdown*), dan persentase progress (0%–100%).
  2. **Teknologi Multi-Chunk Otomatis (>25MB)**:
     * File > 25MB otomatis diiris (*sliced*) menjadi potongan-potongan berukuran 25MB di sisi browser.
     * Potongan dikirim bertahap ke server membawa header `x-upload-id`, `x-chunk-index`, dan `x-chunk-total`.
     * Server mengumpulkan potongan ke dalam file sementara `temp_chunk_<uploadId>.part` via `fs.appendFileSync()`.
     * Saat potongan terakhir tiba, file sementara di-rename menjadi file final dan durasi MP3 dihitung dengan akurat.
     * Batas upload Express dinaikkan ke `500mb` (`express.raw({ limit: '500mb' })`).
     * Sukses menembus batasan 100MB Cloudflare Tunnel tanpa perlu konfigurasi berbayar.
  3. **Modal Konfirmasi File Besar (Custom React Modal)**:
     * Seluruh panggilan dialog native `window.confirm()` yang kaku dan usang diganti dengan modal React kustom bertema Winamp Amber Neon.
     * Memberikan rincian nama file, ukuran dalam MB, penjelasan teknologi multi-chunk 25MB, dan tombol aksi yang jelas (*Lanjutkan Unggah* / *Batal*).

---

### Q. Optimasi Latensi & Pengiriman Mikrofon Penyiar via Binary Int16 PCM (`40d28f3`)
* **Masalah**:
  * Suara mikrofon penyiar mengalami delay sangat parah di pendengar dan terkadang tersendat atau tidak terdengar sama sekali.
* **Akar Masalah (Root Cause)**:
  1. Data audio mic dari `ScriptProcessor` berupa array Float32 (2048 sample) sebelumnya diubah menjadi array JSON biasa (`Array.from(samples)`). Setiap 46 milidetik browser mengirim string JSON raksasa berukuran **~40 KB per chunk**.
  2. Server WebSocket harus melakukan `JSON.parse()` dan `JSON.stringify()` ulang untuk setiap paket audio mic sebelum meneruskannya ke pendengar. Hal ini menyebabkan penumpukan antrean (*buffer bloat*), konsumsi CPU tinggi, dan latensi jaringan membengkak hingga ratusan milidetik.
* **Solusi & Implementasi**:
  1. **Format Paket Binary Kompak**:
     * Pengiriman PCM diubah menjadi binary ArrayBuffer murni: 4-byte header (`[0xAA, 0x55]` magic bytes + 2-byte sample rate code) diikuti data raw Int16 PCM.
     * Ukuran payload turun drastis dari **~40 KB menjadi ~2 KB per chunk (10x lebih hemat bandwidth)**.
  2. **Zero-Overhead Forwarding di Server (`server.js`)**:
     * Handler WebSocket server mendeteksi paket binary (`data[0] === 0xAA && data[1] === 0x55`) dan langsung meneruskannya ke seluruh client yang terhubung via `client.send(data, { binary: true })` tanpa melalui proses `JSON.parse()`.
  3. **Pemangkasan Latensi Web Audio**:
     * Buffer `ScriptProcessor` diturunkan dari 2048 ke 1024 sample (durasi proses internal turun dari 46ms ke ~21ms).
     * Jitter buffer di pendengar dikurangi dari 70ms ke 30ms.
     * Di sisi pendengar (`ListenerPortal.jsx`), WebSocket diset `ws.binaryType = 'arraybuffer'`, langsung didecode ke Float32Array dan dialirkan ke `playPcmChunk`.

---

### R. Analisis & Catatan Penanganan Suara Mikrofon "Robot" / Audio Gap Playback
* **Gejala / Laporan**:
  * Setelah optimasi latensi biner, suara mic terdengar lebih cepat sampai namun terdengar bergetar / patah-patah layaknya suara "robot".
* **Diagnosa Teknis**:
  * Saat ini, setiap chunk 21ms dimainkan dengan membuat instance `AudioBufferSourceNode` baru yang dijadwalkan pada `this.nextPcmTime = now + targetJitter`.
  * Ketika koneksi internet mengalami fluktuasi kecil (jitter mikro beberapa milidetik), paket audio tiba terlambat dari waktu jadwal playout. Terjadi *buffer underflow* (jeda senyap mikro) yang berulang cepat puluhan kali per detik, menghasilkan distorsi modulasi frekuensi mirip efek *Ring Modulator* atau suara robot.
* **Arsitektur Solusi Ideal (VoIP Continuous Ring Buffer)**:
  * Mengganti pembuatan `AudioBufferSourceNode` per-chunk dengan **Circular Ring Buffer (Jitter Buffer Berkelanjutan)** menggunakan `ScriptProcessor` atau `AudioWorkletNode` di sisi pendengar:
    - Paket PCM biner yang masuk dimasukkan ke antrean ring buffer.
    - Loop audio output membaca data secara kontinyu dari ring buffer.
    - Jika terjadi jeda paket mikro, diterapkan interpolasi halus / fade-smoothing untuk mencegah bunyi klik atau nada robotik.

---

### S. Panduan Infrastruktur Proxmox LXC & Cloudflare Tunnel
* **Konfigurasi Produksi**:
  * Server berjalan di dalam kontainer Proxmox LXC Debian/Ubuntu pada path `/opt/radio-server`.
  * Node server dijalankan menggunakan process manager `pm2`:
    ```bash
    pm2 start server.js --name "radio-server"
    pm2 save
    ```
  * Dipublikasikan ke internet menggunakan Cloudflare Tunnel:
    * Domain: `radio2.iphoenkz.my.id`
    * Ingress Rule mengarah ke HTTP lokal: `http://localhost:3000`.
* **Akses Transfer File (WinSCP / SFTP)**:
  * **PENTING**: Cloudflare Tunnel hanya mendukung protokol HTTP/HTTPS. Upaya koneksi SFTP/SSH ke `radio2.iphoenkz.my.id:22` akan selalu mengalami *Connection timed out*.
  * Untuk menggunakan WinSCP/FileZilla, sambungkan langsung ke **IP Lokal Proxmox LXC** (contoh: `192.168.1.xxx:22`) melalui jaringan lokal / LAN yang sama.
* **Prosedur Pembaruan Aplikasi Tanpa Kehilangan Data (Zero Data-Loss Update)**:
  ```bash
  cd /opt/radio-server
  git pull origin main
  npm run build
  pm2 restart radio-server
  ```
  *(Folder `uploads/` berisi MP3 dan database jadwal `schedule_data.json` di-ignore oleh Git sehingga data siaran dan file lagu di harddisk tidak akan terhapus saat update).*

---

## 🔒 5. Catatan Kunci untuk Sesi Mendatang

* File [`server.js`](file:///C:/Users/iphoenkz/Music/RADIO-ONLINE-PART2/server.js) melayani baik file statis dari folder `dist/` maupun WebSocket endpoint di `/ws`.
* Selalu pastikan variabel `protocol` (`window.location.protocol === 'https:' ? 'wss:' : 'ws:'`) ada saat menginisialisasi WebSocket di sisi client.
* `audioEngine.js` adalah Singleton (`export const audioEngine = new AudioEngine()`). Semua komponen berbagi instance yang sama.
* Folder `public/sfx/` menyimpan aset audio soundboard asli yang disajikan secara statis oleh Express di root URL `/sfx/*`.
* **Jadwal program siaran & file MP3** disimpan secara permanen di server (`uploads/schedule_data.json` & `uploads/slot_*`), dikelola oleh penyiar via `ScheduleManager.jsx`, diputar otomatis via `Auto-Scheduler`, dan di-sync real-time ke pendengar via WebSocket.
* **Pustaka Media Server (`MediaLibraryModal.jsx`)**: Sentralisasi pool lagu di `uploads/`, preview lagu, batch assign ke slot jadwal siaran, unlink instan tanpa hapus file, serta penghapusan fisik tunggal/batch/purge-all dengan sinkronisasi ke jadwal.
* **Sistem Chunked Upload (`uploader.js`)**: Memotong file >25MB menjadi chunk 25MB untuk menembus limit 100MB Cloudflare Tunnel gratis, dilengkapi indikator kecepatan transfer (MB/s), ETA countdown, dan persentase real-time.
* **Mikrofon & Audio PCM Relay**: Menggunakan paket biner Int16 ber-header `[0xAA, 0x55]` untuk mengeliminasi overhead JSON. Untuk mengatasi efek suara robotik akibat network jitter di koneksi internet riil, langkah peningkatan berikutnya adalah continuous circular ring buffer pada sisi playback pendengar.
* **Skin Tema (Theme Engine)**: Pilihan skin disimpan di `localStorage` (`khanza_radio_skin`). Pilihan ini mengubah palet warna secara penuh pada *Listener Hero Card*, *Vinyl Record*, *Now Playing Bar*, *Tombol Play*, *Mobile Tabs*, *Jadwal*, *Sticky Player*, dan *Visualizer*.


