import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Heart, Flame, Radio, User, Sparkles, Trash2, Zap, ThumbsUp } from 'lucide-react';

const REACTION_LIST = [
  { emoji: '❤️', label: 'Love', id: 'love' },
  { emoji: '🔥', label: 'Fire', id: 'fire' },
  { emoji: '👏', label: 'Clap', id: 'clap' },
  { emoji: '📻', label: 'Radio', id: 'radio' },
  { emoji: '⚡', label: 'Electric', id: 'zap' }
];

const QUICK_CHIPS = [
  '👋 Halo DJ & Pendengar!',
  '🎵 Request lagu dong!',
  '📻 Suara siaran jernih!',
  '🔥 Mantap banget radionya!',
  '❤️ Sukses terus Khanza.NET!'
];

export default function ListenerChat({ defaultDjMode }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('khanza_chat_user') || ('Pendengar_' + Math.floor(100 + Math.random() * 900));
  });

  const [isDjMode, setIsDjMode] = useState(() => {
    if (defaultDjMode !== undefined) return defaultDjMode;
    const p = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
    return p.startsWith('/penyiar') || p.startsWith('/studio');
  });

  const [heartsCount, setHeartsCount] = useState(48);
  const [activeBtnId, setActiveBtnId] = useState(null);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const chatScrollRef = useRef(null);
  const wsRef = useRef(null);
  const channelRef = useRef(null);

  // Save username to local storage
  const handleUsernameChange = (e) => {
    const val = e.target.value;
    setUsername(val);
    localStorage.setItem('khanza_chat_user', val);
  };

  // Spawn visual floating emoji on the shoutbox
  const triggerFloatingEmoji = (emoji) => {
    const newId = Date.now() + '-' + Math.random();
    const left = Math.floor(15 + Math.random() * 70); // 15% - 85%
    setFloatingEmojis(prev => [...prev.slice(-12), { id: newId, emoji, left }]);

    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(item => item.id !== newId));
    }, 1800);
  };

  // Setup WebSocket & BroadcastChannel for real-time live sync
  useEffect(() => {
    // 1. Fetch initial chat history & reactions from REST API
    fetch('/api/chat')
      .then(res => res.json())
      .then(data => {
        if (data.messages && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
        if (data.reactionsCount !== undefined) {
          setHeartsCount(data.reactionsCount);
        }
      })
      .catch(console.warn);

    // 2. Setup BroadcastChannel for instantaneous same-machine tab sync
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('khanza_radio_chat');
        channelRef.current = bc;
        bc.onmessage = (e) => {
          const data = e.data;
          if (!data || !data.type) return;

          if (data.type === 'CHAT_MESSAGE' && data.message) {
            setMessages(prev => {
              if (prev.some(m => m.id === data.message.id)) return prev;
              return [...prev, data.message];
            });
          } else if (data.type === 'LIVE_REACTION') {
            setHeartsCount(c => c + 1);
            if (data.emoji) triggerFloatingEmoji(data.emoji);
          } else if (data.type === 'CLEAR_CHAT') {
            setMessages([]);
          }
        };
      } catch (err) {}
    }

    // 3. Setup WebSocket connection for cross-network real-time sync
    let ws = null;
    let reconnectTimeout = null;

    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const chatRole = isDjMode ? 'dj' : 'listener';
        let chatClientId = 'dj_chat';
        if (!isDjMode) {
          try {
            chatClientId = sessionStorage.getItem('khanza_listener_id') || 'listener_chat';
          } catch (e) {
            chatClientId = 'listener_chat';
          }
        }
        ws = new WebSocket(`${protocol}//${window.location.host}/ws?role=${chatRole}&clientId=${chatClientId}`);
        wsRef.current = ws;

        ws.onopen = () => {
          try {
            ws.send(JSON.stringify({ type: 'REGISTER_ROLE', role: chatRole }));
          } catch (e) {}
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'CHAT_INIT') {
              if (data.messages && Array.isArray(data.messages)) {
                setMessages(data.messages);
              }
              if (data.reactionsCount !== undefined) {
                setHeartsCount(data.reactionsCount);
              }
            } else if (data.type === 'CHAT_MESSAGE' && data.message) {
              setMessages(prev => {
                if (prev.some(m => m.id === data.message.id)) return prev;
                return [...prev, data.message];
              });
            } else if (data.type === 'LIVE_REACTION') {
              if (data.reactionsCount !== undefined) {
                setHeartsCount(data.reactionsCount);
              } else {
                setHeartsCount(c => c + 1);
              }
              if (data.emoji) triggerFloatingEmoji(data.emoji);
            } else if (data.type === 'CLEAR_CHAT') {
              setMessages([]);
            }
          } catch (e) {}
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = () => {
          try { ws.close(); } catch (e) {}
        };
      } catch (e) {
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (channelRef.current) {
        try { channelRef.current.close(); } catch (e) {}
      }
      if (ws) {
        try { ws.close(); } catch (e) {}
      }
    };
  }, []);

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Send Chat Message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const senderName = isDjMode ? 'DJ ON AIR' : (username.trim() || 'Pendengar');

    const newMsg = {
      id: Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      user: senderName,
      role: isDjMode ? 'dj' : 'listener',
      text: trimmed,
      time: timeStr
    };

    // Update state locally immediately
    setMessages(prev => [...prev, newMsg]);
    setInputText('');

    // Broadcast through BroadcastChannel
    if (channelRef.current) {
      try {
        channelRef.current.postMessage({ type: 'CHAT_MESSAGE', message: newMsg });
      } catch (err) {}
    }

    // Broadcast through WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'CHAT_MESSAGE', message: newMsg }));
      } catch (err) {}
    }

    // Persist via REST API
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: newMsg.user,
          text: newMsg.text,
          role: newMsg.role
        })
      });
    } catch (err) {}
  };

  // Send Live Reaction (Love, Fire, Clap, Radio, Zap)
  const sendReaction = (emoji, btnId) => {
    // 1. Button Pop Animation
    setActiveBtnId(btnId);
    setTimeout(() => setActiveBtnId(null), 300);

    // 2. Local Count & Floating Animation
    setHeartsCount(c => c + 1);
    triggerFloatingEmoji(emoji);

    // 3. Broadcast to Local Tabs via BroadcastChannel
    if (channelRef.current) {
      try {
        channelRef.current.postMessage({ type: 'LIVE_REACTION', emoji });
      } catch (err) {}
    }

    // 4. Broadcast to Network via WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'LIVE_REACTION', emoji }));
      } catch (err) {}
    }

    // 5. REST API fallback
    fetch('/api/reaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji })
    }).catch(() => {});
  };

  // Clear Chat (DJ Moderator)
  const handleClearChat = async () => {
    if (!window.confirm('Yakin ingin membersihkan semua riwayat pesan chat shoutbox?')) return;

    setMessages([]);

    if (channelRef.current) {
      try { channelRef.current.postMessage({ type: 'CLEAR_CHAT' }); } catch (e) {}
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try { wsRef.current.send(JSON.stringify({ type: 'CLEAR_CHAT' })); } catch (e) {}
    }

    try {
      await fetch('/api/chat/clear', { method: 'POST' });
    } catch (e) {}
  };

  return (
    <div className="winamp-chassis w-full max-w-xl mx-auto rounded-xl p-2.5 sm:p-3 relative flex flex-col gap-2 shadow-2xl">
      {/* Title Bar */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-gradient-to-r from-[#17202d] via-[#223042] to-[#17202d] rounded-lg border border-[#3b4b56]">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 shrink-0" />
          <span className="font-orbitron text-[10px] sm:text-[11px] font-bold tracking-wider text-cyan-200 uppercase truncate">
            SHOUTBOX & REQUEST PENDENGAR
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" title="Koneksi Real-time Aktif" />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isDjMode && (
            <button
              onClick={handleClearChat}
              className="winamp-btn px-2 py-0.5 rounded text-[10px] font-chakra text-rose-300 hover:text-white flex items-center gap-1 border-rose-500/40 touch-tap"
              title="Bersihkan Semua Pesan Chat"
            >
              <Trash2 className="w-3 h-3 text-rose-400" />
              <span className="hidden sm:inline">Hapus</span>
            </button>
          )}

          <button
            onClick={() => setIsDjMode(!isDjMode)}
            className={`winamp-btn px-2 sm:px-2.5 py-0.5 rounded text-[9px] sm:text-[10px] font-chakra font-bold cursor-pointer transition-colors touch-tap ${
              isDjMode ? 'active text-rose-400 border-rose-500 bg-rose-950/40' : 'text-gray-300 hover:text-white'
            }`}
            title="Klik untuk beralih mode DJ atau Pendengar"
          >
            {isDjMode ? '🎙️ DJ' : '🎧 PENDENGAR'}
          </button>
        </div>
      </div>

      {/* Floating Reaction Emojis Container */}
      <div className="relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden h-48 sm:h-52 z-30">
          {floatingEmojis.map(item => (
            <span
              key={item.id}
              className="absolute bottom-4 text-2xl sm:text-3xl floating-emoji select-none"
              style={{ left: `${item.left}%` }}
            >
              {item.emoji}
            </span>
          ))}
        </div>

        {/* Chat Messages Viewport */}
        <div
          ref={chatScrollRef}
          className="winamp-panel p-2 sm:p-2.5 rounded-lg h-52 sm:h-48 md:h-52 overflow-y-auto flex flex-col gap-1.5 bg-[#06080c] border border-[#1e2736]"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-500">
              <Sparkles className="w-6 h-6 text-cyan-400 mb-1 animate-pulse" />
              <p className="text-xs font-chakra">Belum ada pesan. Jadilah yang pertama mengirim salam!</p>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`p-1.5 rounded text-xs font-chakra leading-relaxed border transition-all ${
                  msg.role === 'dj'
                    ? 'bg-rose-950/40 border-rose-500/50 text-rose-200 shadow-[0_0_8px_rgba(244,63,94,0.15)]'
                    : 'bg-[#10141d] border-[#1d2432] text-gray-200'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] pb-0.5">
                  <span className={`font-bold flex items-center gap-1 truncate max-w-[180px] sm:max-w-none ${
                    msg.role === 'dj' ? 'text-rose-400' : 'text-cyan-400'
                  }`}>
                    {msg.role === 'dj' ? '🎙️ [DJ ON AIR]' : '👤'} {msg.user}
                  </span>
                  <span className="text-gray-500 font-lcd shrink-0">{msg.time}</span>
                </div>
                <p className="text-[11px] text-gray-300 break-words">{msg.text}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Request & Greetings Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar select-none touch-pan-x">
        <span className="text-[9px] font-chakra text-gray-400 shrink-0 uppercase">Pintasan:</span>
        {QUICK_CHIPS.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setInputText(chip)}
            className="winamp-btn px-2 py-1 rounded text-[10px] font-chakra text-gray-300 hover:text-cyan-300 shrink-0 whitespace-nowrap cursor-pointer transition-all border-[#2e3b4e] touch-tap"
            title={`Gunakan teks "${chip}"`}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Reaction Buttons & Send Form */}
      <div className="flex flex-col gap-2 pt-1 border-t border-[#262c38]">
        {/* Quick Reaction Emojis Row */}
        <div className="flex items-center justify-between text-xs font-chakra px-0.5">
          <span className="text-[9px] sm:text-[10px] text-gray-400 flex items-center gap-1 font-bold shrink-0">
            <Sparkles className="w-3 h-3 text-amber-400 animate-spin" />
            REAKSI:
          </span>

          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {REACTION_LIST.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => sendReaction(r.emoji, r.id)}
                className={`winamp-btn min-w-[32px] sm:min-w-[34px] min-h-[30px] sm:min-h-[32px] px-2 py-0.5 rounded text-sm sm:text-base cursor-pointer flex items-center justify-center transition-transform duration-150 hover:scale-125 active:scale-95 touch-tap ${
                  activeBtnId === r.id ? 'btn-pop-active bg-cyan-900/60 border-cyan-400' : ''
                }`}
                title={`Kirim ${r.label} ke Siaran!`}
              >
                {r.emoji}
              </button>
            ))}

            {/* Clickable Heart Counter Button */}
            <button
              type="button"
              onClick={() => sendReaction('❤️', 'heart-counter')}
              className={`winamp-btn min-h-[30px] sm:min-h-[32px] px-2 py-0.5 rounded text-[10px] font-lcd text-rose-400 font-bold cursor-pointer flex items-center gap-1 hover:border-rose-400 hover:scale-105 active:scale-95 transition-transform touch-tap shrink-0 ${
                activeBtnId === 'heart-counter' ? 'btn-pop-active bg-rose-950/70 border-rose-400' : ''
              }`}
              title="Klik untuk memberi Cinta pada Siaran!"
            >
              <span>❤️</span>
              <span>{heartsCount}</span>
            </button>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSendMessage} className="flex items-center gap-1.5 sm:gap-2">
          {!isDjMode && (
            <input
              type="text"
              value={username}
              onChange={handleUsernameChange}
              placeholder="Nama"
              maxLength={15}
              className="w-20 sm:w-28 bg-[#121620] border border-[#2d3748] rounded px-2 py-1.5 sm:py-2 text-xs font-chakra text-cyan-300 outline-none focus:border-cyan-400 shrink-0 placeholder-gray-500 font-bold"
              title="Nama Pengguna (Bisa Anda Ganti)"
            />
          )}

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isDjMode ? 'Pesan siaran DJ...' : 'Kirim salam / request lagu...'}
            maxLength={180}
            className="flex-1 bg-[#121620] border border-[#2d3748] rounded px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-chakra text-gray-100 placeholder-gray-500 outline-none focus:border-cyan-400 min-w-0"
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            className={`winamp-btn px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded text-xs font-chakra font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0 touch-tap ${
              inputText.trim()
                ? 'text-cyan-300 border-cyan-500 hover:bg-cyan-950/60 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                : 'text-gray-500 border-gray-700 opacity-60'
            }`}
            title="Kirim Pesan ke Shoutbox"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">KIRIM</span>
          </button>
        </form>
      </div>
    </div>
  );
}
