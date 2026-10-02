/**
 * Preset Radio Stations, Equalizer Presets, and Soundboard Carts
 */

export const PRESET_STATIONS = [
  {
    id: 'lofi-stream',
    name: 'ChillHop Lo-Fi Beats',
    genre: 'Lo-Fi / Study / Relax',
    bitrate: '192 kbps',
    location: 'Global',
    logo: '☕',
    description: 'Relaksasi santai, musik belajar & coding 24/7 tanpa henti.',
    url: 'https://ice5.somafm.com/groovesalad-128-mp3'
  },
  {
    id: 'synthwave-stream',
    name: 'Synthwave 80s Cyber Radio',
    genre: 'Retrowave / Synth / Cyberpunk',
    bitrate: '128 kbps',
    location: 'Neo Tokyo',
    logo: '🌆',
    description: 'Neon nostalgia 1980s, electronic retro & synth beats.',
    url: 'https://ice2.somafm.com/beatblender-128-mp3'
  },
  {
    id: 'jazz-lounge',
    name: 'Smooth Jazz & Cafe Lounge',
    genre: 'Jazz / Lounge / Sax',
    bitrate: '128 kbps',
    location: 'New Orleans',
    logo: '🎷',
    description: 'Petikan saxophone hangat, piano lembut & jazz akustik.',
    url: 'https://ice4.somafm.com/secretagent-128-mp3'
  },
  {
    id: 'dance-club-fm',
    name: 'Club Dance & EDM Festival',
    genre: 'EDM / Dance / House',
    bitrate: '128 kbps',
    location: 'Amsterdam',
    logo: '⚡',
    description: 'Dentuman bass energik, club hits & DJ remixes terpanas.',
    url: 'https://ice6.somafm.com/defcon-128-mp3'
  },
  {
    id: 'classic-rock',
    name: 'Golden Classic Rock 70s-90s',
    genre: 'Classic Rock / Hard Rock',
    bitrate: '128 kbps',
    location: 'London',
    logo: '🎸',
    description: 'Gitar distorsi legendaris, rock anthem abad ke-20.',
    url: 'https://ice2.somafm.com/indiepop-128-mp3'
  },
  {
    id: 'acoustic-indie',
    name: 'Indie Folk & Acoustic Sunset',
    genre: 'Acoustic / Indie Folk',
    bitrate: '128 kbps',
    location: 'Seattle',
    logo: '🌾',
    description: 'Petikan gitar kayu syahdu untuk menenangkan pikiran.',
    url: 'https://ice4.somafm.com/folkfwd-128-mp3'
  },
  {
    id: 'ambient-drone',
    name: 'Deep Space Drone & Ambient',
    genre: 'Space Ambient / Meditation',
    bitrate: '128 kbps',
    location: 'Earth Orbit',
    logo: '🌌',
    description: 'Lanskap suara kosmik, meditasi mendalam & fokus maksimal.',
    url: 'https://ice6.somafm.com/dronezone-128-mp3'
  }
];

export const EQ_PRESETS = {
  'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Rock': [5.5, 3.5, -1.5, -3.0, -1.0, 2.5, 5.0, 7.0, 7.5, 8.0],
  'Pop': [-1.5, 1.0, 4.0, 5.5, 4.0, -1.0, -2.0, -2.0, -1.0, -1.0],
  'Club / Dance': [4.0, 5.5, 2.5, 0, 0, 0, 2.5, 4.0, 4.0, 3.0],
  'Bass Boost': [9.0, 7.5, 6.0, 3.0, 1.0, 0, 0, 0, 0, 0],
  'Voice / Radio DJ': [-4.0, -2.0, 0, 2.5, 6.0, 5.0, 4.0, 2.0, 0, -2.0],
  'Techno': [6.0, 4.5, 0, -3.0, -2.5, 0, 5.5, 7.0, 7.0, 6.5],
  'Acoustic': [3.5, 3.0, 2.0, 1.0, 2.0, 2.5, 3.5, 4.0, 3.0, 2.0],
  'Reggae': [0, 0, -1.0, -3.5, 0, 4.0, 4.5, 2.0, 0, 0]
};

export const SOUNDBOARD_EFFECTS = [
  { id: 'airhorn', name: 'AIR HORN', key: '1', icon: '📢', color: 'bg-amber-600 hover:bg-amber-500', category: 'DJ FX' },
  { id: 'station_id', name: 'STATION ID', key: '2', icon: '📻', color: 'bg-emerald-600 hover:bg-emerald-500', category: 'Jingle' },
  { id: 'scratch', name: 'SCRATCH', key: '3', icon: '💿', color: 'bg-cyan-600 hover:bg-cyan-500', category: 'DJ FX' },
  { id: 'applause', name: 'REAL APPLAUSE', key: '4', icon: '👏', color: 'bg-purple-600 hover:bg-purple-500', category: 'Crowd' },
  { id: 'badum_tss', name: 'BA-DUM-TSS', key: '5', icon: '🥁', color: 'bg-teal-600 hover:bg-teal-500', category: 'Stinger' },
  { id: 'drum_roll', name: 'DRUM ROLL', key: '6', icon: '🥁', color: 'bg-blue-600 hover:bg-blue-500', category: 'Stinger' },
  { id: 'news_flash', name: 'NEWS FLASH', key: '7', icon: '🚨', color: 'bg-red-600 hover:bg-red-500', category: 'Broadcast' },
  { id: 'bleep', name: 'CENSOR BLEEP', key: '8', icon: '🤬', color: 'bg-yellow-600 hover:bg-yellow-500', category: 'Utility' },
  { id: 'impact_boom', name: 'SUB BOOM', key: '9', icon: '💥', color: 'bg-rose-600 hover:bg-rose-500', category: 'Stinger' },
  { id: 'laser', name: 'LASER PEW', key: '0', icon: '⚡', color: 'bg-indigo-600 hover:bg-indigo-500', category: 'Retro' },
  { id: 'cash_register', name: 'KA-CHING', key: 'Q', icon: '💰', color: 'bg-green-600 hover:bg-green-500', category: 'Kuis' },
  { id: 'fanfare', name: 'VICTORY TADA', key: 'W', icon: '🎺', color: 'bg-orange-600 hover:bg-orange-500', category: 'Kuis' },
  { id: 'boo', name: 'BOO CROWD', key: 'E', icon: '👎', color: 'bg-pink-600 hover:bg-pink-500', category: 'Crowd' },
  { id: 'wrong_buzzer', name: 'WRONG BUZZ', key: 'R', icon: '❌', color: 'bg-sky-600 hover:bg-sky-500', category: 'Kuis' },
  { id: 'gasp', name: 'SHOCK GASP', key: 'T', icon: '😱', category: 'Crowd' },
  { id: 'laugh_track', name: 'LAUGH', key: 'Y', icon: '😂', color: 'bg-lime-600 hover:bg-lime-500', category: 'Crowd' }
];

export const INITIAL_DEMO_TRACKS = [
  {
    id: 'demo-1',
    title: 'Neon Horizon (Synthwave Overdrive)',
    artist: 'Khanza.NET Studio Orchestra',
    album: 'Cyber Radiance 2026',
    duration: 38,
    isProcedural: true,
    style: 'synthwave',
    kbps: '320 kbps',
    khz: '48.0 kHz'
  },
  {
    id: 'demo-2',
    title: 'Midnight Coffee & Rainy Window',
    artist: 'Lo-Fi Chill Collective',
    album: 'Study Session Vol. 4',
    duration: 38,
    isProcedural: true,
    style: 'lofi',
    kbps: '320 kbps',
    khz: '44.1 kHz'
  }
];
