import React, { useState, useRef, useEffect } from 'react';
import { createGlobalStyle, ThemeProvider } from 'styled-components';
import { styleReset } from 'react95';
import original from 'react95/dist/themes/original';
import { io } from 'socket.io-client';

import { RetroPlayer } from './components/RetroPlayer';
import AuthPage from './components/Login';
import DashboardShell from './components/Dashboard';

// Use the hostname of the page you’re visiting, or override via env
const serverUrl =
  process.env.REACT_APP_SERVER_URL ||
  `http://${window.location.hostname}:3001`;

const socket = io(serverUrl, {
  transports: ['websocket'],
});

const GlobalStyles = createGlobalStyle`
${styleReset}
`;



function App() {

  const SOUND_MAP = {
    airhorn: 'airhorn.mp3',
    america_ya: 'america_ya.mp3',
    bahbuy: 'bahbuy.mp3',
    ello: 'ello.mp3',
    fah: 'fah.mp3',
    gya: 'gya.mp3',
    hahaha: 'hahaha.mp3',
    i: 'i.mp3',
    nasty_fart: 'nasty_fart.mp3',
    nou: 'nou.mp3',
    og_fart: 'og_fart.mp3',
    onou: 'onou.mp3'
  };

  const soundCacheRef = useRef({});

  // ...existing code...
  const playLocalSound = async (soundType) => {
    try {
      const filename = SOUND_MAP[soundType];
      if (!filename) {
        console.warn('Unknown sound type:', soundType);
        return;
      }

      const candidates = [
        `${serverUrl}/sounds/${filename}`,
        `${window.location.origin}/sounds/${filename}`
      ];

      let src = null;
      for (const c of candidates) {
        try {
          const res = await fetch(c, { method: 'HEAD' });
          if (res.ok) { src = c; break; }
        } catch (e) {
          // ignore, try next
        }
      }

      if (!src) {
        console.warn('[sound] file not found on candidates:', filename, candidates);
        return;
      }

      console.debug('[sound] playing from', src);
      let baseAudio = soundCacheRef.current[src];
      if (!baseAudio) {
        baseAudio = new Audio(src);
        baseAudio.preload = 'auto';
        soundCacheRef.current[src] = baseAudio;
      }

      const audio = baseAudio.cloneNode();
      audio.volume = 1.0;
      audio.play().catch((err) => {
        console.warn('playLocalSound play() failed', err);
      });
    } catch (err) {
      console.error('playLocalSound error', err);
    }
  };
  // ...existing code...

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('hub_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // ...existing code...
  const [currentRoom, setCurrentRoom] = useState(() => {
    const savedRoom = localStorage.getItem('hub_current_room');
    return savedRoom ? JSON.parse(savedRoom) : null;
  });

  // persist current room across reloads
  useEffect(() => {
    try {
      if (currentRoom) {
        localStorage.setItem('hub_current_room', JSON.stringify(currentRoom));
      } else {
        localStorage.removeItem('hub_current_room');
      }
    } catch (e) {
      console.warn('Could not persist currentRoom', e);
    }
  }, [currentRoom]);

  // ...existing code...

  const [activeUsers, setActiveUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const videoRef = useRef(null);

  const ignoreSyncRef = useRef(false); // NEW: Blocks the infinite echo loop



  // NEW MEDIA STATES
  const [roomMedia, setRoomMedia] = useState([]);
  const [activeMedia, setActiveMedia] = useState(null);

  // Suppression & recording to avoid echo loops when applying remote changes
  const remoteApplyingRef = useRef(false);
  const lastAppliedRef = useRef({ action: null, time: null, ts: 0 });




  // helper to set video time + play/pause reliably (uses videoRef above)
  // sourceAction: optional string 'play'|'pause'|'seek' to record intention precisely
  const applyPlaybackToVideo = (isPlaying, targetTime, sourceAction = null) => {
    const v = videoRef.current;
    if (!v) return;

    const recordApplied = (action, time) => {
      lastAppliedRef.current = {
        action,
        time: typeof time === 'number' ? Math.round(time * 10) / 10 : null,
        ts: Date.now(),
      };
    };

    remoteApplyingRef.current = true;

    const clearApplying = () => {
      setTimeout(() => {
        remoteApplyingRef.current = false;
      }, 350);
    };

    const doSet = () => {
      try {
        if (typeof targetTime === 'number' && !Number.isNaN(targetTime)) {
          const cur = typeof v.currentTime === 'number' ? v.currentTime : 0;
          if (Math.abs(cur - targetTime) > 1.0) {
            v.currentTime = Math.max(0, targetTime);
          }
        }
      } catch (e) {
        console.warn('failed to set currentTime', e);
      }

      const action = sourceAction || (isPlaying ? 'play' : 'pause');
      recordApplied(action, targetTime);

      if (sourceAction === 'seek') {
        clearApplying();
        return;
      }

      if (isPlaying) {
        v.play().catch((e) => {
          console.warn('play error', e);
        }).finally(clearApplying);
      } else {
        v.pause();
        clearApplying();
      }
    };

    if (v.readyState >= 1) doSet();
    else v.addEventListener('loadedmetadata', doSet, { once: true });
  };
  // ...existing code...
  // ...existing code below...


  useEffect(() => {
    if (!user || !currentRoom) return;

    const handlePlaySound = (data) => {
      if (!data) return;

      const msgRoomId = data.roomId ?? null;
      if (
        currentRoom &&
        currentRoom.id != null &&
        String(msgRoomId) !== String(currentRoom.id)
      ) {
        return;
      }

      const { soundType } = data;
      console.log(`[Soundboard] Remote triggered: ${soundType}`);
      playLocalSound(soundType);
    };

    socket.on('play-sound', handlePlaySound);

    return () => {
      socket.off('play-sound', handlePlaySound);
    };
  }, [user, currentRoom]);

  // Keep active users list in sync with room
  useEffect(() => {
    if (!user || !currentRoom) return;

    const handleRoomState = (users) => {
      const unique = Array.isArray(users)
        ? users.filter((u, i, arr) => u?.username && arr.findIndex(x => x.username === u.username) === i)
        : [];
      setActiveUsers(unique);
    };

    socket.on('room-state', handleRoomState);
    return () => {
      socket.off('room-state', handleRoomState);
    };
  }, [user, currentRoom]);


  // Attach listeners to the video element so native/fullscreen controls still sync
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // helper: treat native events that match our last applied remote action as duplicates
    const isDuplicateOfLastApplied = (action, time) => {
      const last = lastAppliedRef.current;
      if (!last || !last.action) return false;
      if (Date.now() - last.ts > 1500) return false; // stale
      if (last.action !== action) return false;
      if (typeof last.time !== 'number' || typeof time !== 'number') return true;
      // 1.0s tolerance so clients up to 1s behind won't be snapped
      return Math.abs(last.time - Math.round(time * 10) / 10) <= 1.0;
    };

    const emitIfAllowed = (action) => {
      if (remoteApplyingRef.current) return;
      if (!currentRoom?.id) return;
      const time = v.currentTime ?? 0;
      if (isDuplicateOfLastApplied(action, time)) return;
      socket.emit('playback-action', { roomId: currentRoom.id, action, time, isRemoteEvent: false });
    };

    const onPlay = () => emitIfAllowed('play');
    const onPause = () => emitIfAllowed('pause');
    const onSeeked = () => emitIfAllowed('seek');

    // NEW: clicking the video toggles play/pause (works in fullscreen)
    const onClick = () => {
      if (remoteApplyingRef.current) return;
      try {
        if (v.paused) {
          v.play().catch((e) => console.warn('play error on click', e));
        } else {
          v.pause();
        }
      } catch (e) {
        console.warn('click toggle error', e);
      }
    };

    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('seeked', onSeeked);
    v.addEventListener('click', onClick);

    const onFullscreenChange = () => {
      // no-op but kept so handlers remain attached; could re-check element if needed
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('seeked', onSeeked);
      v.removeEventListener('click', onClick);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [currentRoom, activeMedia]);
  // ...existing code...



  // ...existing code...
  // clock sync & ordering
  const serverOffsetRef = useRef(0); // serverClock - clientClock (ms)
  const lastSeqRef = useRef(0);

  // estimate server time offset (simple ping-pong). Call on connect and periodically.
  useEffect(() => {
    if (!socket) return;
    const syncOnce = () => {
      const t1 = Date.now();
      // server should reply with its own timestamp (ms) via ack
      socket.emit('request-server-time', t1, (serverTs) => {
        const t2 = Date.now();
        const rtt = t2 - t1;
        // offset ≈ serverTs - (t1 + rtt/2)
        serverOffsetRef.current = serverTs - (t1 + rtt / 2);
      });
    };
    // initial sync and periodic refresh
    syncOnce();
    const id = setInterval(syncOnce, 30_000); // refresh every 30s
    return () => clearInterval(id);
  }, [socket]);



  // Persist user in localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('hub_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('hub_user');
    }
  }, [user]);

  // Persist and restore currentRoom
  useEffect(() => {
    if (currentRoom) {
      localStorage.setItem('hub_current_room', JSON.stringify(currentRoom));
    } else {
      localStorage.removeItem('hub_current_room');
    }
  }, [currentRoom]);

  // If user loads the app and we have a saved room, try restoring it
  useEffect(() => {
    if (!user) return;
    const savedRoom = localStorage.getItem('hub_current_room');
    if (savedRoom) {
      const room = JSON.parse(savedRoom);
      if (room?.code) handleJoinRoom(room.code);
    }
  }, [user]);

  // Sync playback + chat + soundboard + joined users
  useEffect(() => {
    if (!user || !currentRoom) return;

    // ...inside the existing handleSync in your useEffect...
    const handleSync = (data) => {
      if (!data || data.roomId !== currentRoom?.id) return;
      const { action, time, mediaUrl, isRemoteEvent, init, ts: serverTs, seq } = data;

      if (typeof seq === 'number') {
        if (seq <= (lastSeqRef.current || 0)) return;
        lastSeqRef.current = seq;
      }

      if (mediaUrl && mediaUrl !== activeMedia) {
        setActiveMedia(mediaUrl);
      }

      if (action === 'change-media') return;

      const clientNow = Date.now();
      const offset = serverOffsetRef.current || 0;
      const serverNowApprox = clientNow + offset;
      const elapsedMs = serverNowApprox - (typeof serverTs === 'number' ? serverTs : serverNowApprox);
      const correctedTime = typeof time === 'number' ? time + (elapsedMs / 1000) : time;

      if (init) {
        applyPlaybackToVideo(action === 'play', correctedTime, action);
        return;
      }

      if (!isRemoteEvent) return;

      if (action === 'play') {
        applyPlaybackToVideo(true, correctedTime, 'play');
      } else if (action === 'pause') {
        applyPlaybackToVideo(false, correctedTime, 'pause');
      } else if (action === 'seek') {
        const playing = !(videoRef.current?.paused);
        applyPlaybackToVideo(playing, correctedTime, 'seek');
      }
    };

    const handleChatMessage = (msg) => {
      if (!msg) return;
      const msgRoomId = msg.roomId ?? (msg.room && msg.room.id) ?? null;
      if (currentRoom && currentRoom.id != null && String(msgRoomId) !== String(currentRoom.id)) return;

      const normalized = {
        username: msg.username || msg.user?.username || 'Unknown',
        content: msg.content ?? msg.message ?? '',
        time: msg.time || new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, normalized]);
    };

    const handlePlaySound = (data) => {
      if (!data) return;
      const msgRoomId = data.roomId ?? null;
      if (currentRoom && currentRoom.id != null && String(msgRoomId) !== String(currentRoom.id)) return;
      const { soundType } = data;
      console.log(`[Soundboard] Remote triggered: ${soundType}`);
    };

    const handleUserJoined = (data) => {
      if (!data) return;
      const msgRoomId = data.roomId ?? null;
      if (currentRoom && currentRoom.id != null && String(msgRoomId) !== String(currentRoom.id)) return;
      const { username } = data;
      setActiveUsers((prev) => {
        if (prev.find((u) => u.username === username)) return prev;
        return [...prev, { username }];
      });
    };

    socket.on('sync-state', handleSync);
    socket.on('chat-message', handleChatMessage);
    socket.on('play-sound', handlePlaySound);
    socket.on('user-joined', handleUserJoined);

    return () => {
      socket.off('sync-state', handleSync);
      socket.off('chat-message', handleChatMessage);
      socket.off('play-sound', handlePlaySound);
      socket.off('user-joined', handleUserJoined);
    };
  }, [user, currentRoom, activeMedia]);

  // ROOM CREATION
  const handleMakeRoom = async (name) => {
    try {
      if (!user || !user.id) throw new Error('Missing User ID. Please log out and log back in.');

      const res = await fetch(`${serverUrl}/rooms/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, userId: user.id }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Server Error ${res.status}: ${errorText}`);
      }

      const room = await res.json();
      setCurrentRoom(room);
      setActiveUsers([{ username: user.username }]);
      setMessages([]);
      setRoomMedia([]);
      setActiveMedia(null);

      socket.emit('join-room', room.id, user.username);

      setUser((prev) => ({
        ...prev,
        rooms: [...(prev?.rooms || []), room],
      }));
    } catch (err) {
      console.error('Make Room Failed:', err);
      alert('Failed to create room: ' + err.message);
    }
  };

  // ROOM JOIN
  const handleJoinRoom = async (code) => {
    try {
      if (!user || !user.id) {
        alert('Please log in first.');
        return;
      }

      const res = await fetch(`${serverUrl}/rooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, userId: user.id }),
      });

      if (!res.ok) {
        alert('Invalid Room Code!');
        return;
      }

      const room = await res.json();

      const historyRes = await fetch(`${serverUrl}/rooms/${room.id}`);
      const history = await historyRes.json();

      setCurrentRoom(history);
      setActiveUsers(
        (history.members || [])
          .map((m) => ({ username: m.user?.username }))
          .filter((u) => u.username)
      );

      const normalizedMessages = (history.messages || []).map((m) => ({
        username: m.user?.username || m.username || 'Unknown',
        content: m.content,
        time: m.time || new Date(m.createdAt).toLocaleTimeString(),
      }));

      setMessages(normalizedMessages);
      setRoomMedia(history.media ? history.media.map((rm) => rm.media) : []);

      // pick a media to set immediately
      let roomActiveMedia = null;
      if (history.activeMedia) {
        roomActiveMedia = history.activeMedia;
      } else if (history.currentMedia) {
        roomActiveMedia = history.currentMedia;
      } else if (history.media && history.media.length > 0) {
        const first = history.media[0];
        roomActiveMedia = first?.media?.filePath || first?.filePath || null;
      }
      setActiveMedia(roomActiveMedia);

      // join room on socket
      socket.emit('join-room', room.id, user.username);

      // request authoritative playback state and apply it immediately so the joining user is synced
      socket.emit('request-playback', room.id, (pb) => {
        if (!pb) return;
        if (pb.mediaUrl && pb.mediaUrl !== activeMedia) setActiveMedia(pb.mediaUrl);

        applyPlaybackToVideo(!!pb.isPlaying, typeof pb.time === 'number' ? pb.time : 0, pb.isPlaying ? 'play' : 'pause');
      });

      setUser((prev) => {
        const existingRooms = prev?.rooms || [];
        if (existingRooms.find((r) => r.code === room.code)) return prev;
        return { ...prev, rooms: [...existingRooms, room] };
      });
    } catch (err) {
      console.error('Join Room Failed:', err);
      alert('Failed to join room: ' + err.message);
    }
  };



  // UPLOAD MEDIA HANDLER
  const handleUploadMedia = async (file) => {
    if (!currentRoom || !file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${serverUrl}/rooms/${currentRoom.id}/media`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      const data = await res.json();
      setRoomMedia((prev) => [...prev, data.media]);
      alert('Media uploaded successfully!');
    } catch (err) {
      alert(err.message);
    }
  };

  // SELECT MEDIA HANDLER
  const handleSelectMedia = (mediaUrl) => {
    if (!currentRoom) return;
    setActiveMedia(mediaUrl);
    socket.emit('playback-action', {
      roomId: currentRoom.id,
      action: 'change-media',
      time: 0,
      mediaUrl,
      isRemoteEvent: false,
    });
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentRoom(null);
    window.location.reload();
  };

  // PLAYBACK SYNC EMITTER (used by UI buttons)
  const emitPlayback = (action) => {
    if (!currentRoom || remoteApplyingRef.current) return;
    const time = videoRef.current ? videoRef.current.currentTime : 0;
    socket.emit('playback-action', { roomId: currentRoom.id, action, time, isRemoteEvent: false });
  };

  const sendMsg = (content) => {
    if (!currentRoom) return;
    const payload = {
      roomId: currentRoom.id,
      userId: user.id,
      username: user.username,
      content,
      time: new Date().toLocaleTimeString(),
    };
    console.log('[client] emitting send-message', payload);
    socket.emit('send-message', payload, (ack) => {
      console.log('[client] send-message ack', ack);
      if (!ack || !ack.ok) {
        alert('Message failed: ' + (ack?.error || 'unknown'));
      }
    });
  };


  const playSound = (soundType) => {
    if (!currentRoom) return;

    console.log(`[Soundboard] Local trigger: ${soundType}`);
    playLocalSound(soundType);
    socket.emit('play-sound', { roomId: currentRoom.id, soundType });
  };


  // UNAUTHENTICATED VIEW
  if (!user) {
    return (
      <ThemeProvider theme={original}>
        <GlobalStyles />
        <AuthPage onLogin={setUser} serverUrl={serverUrl} />
      </ThemeProvider>
    );
  }

  // AUTHENTICATED VIEW
  return (
    <ThemeProvider theme={original}>
      <GlobalStyles />
      <DashboardShell
        userRooms={user.rooms || []}
        currentRoom={currentRoom}
        activeUsers={activeUsers}
        messages={messages}
        roomMedia={roomMedia}
        activeMedia={activeMedia}
        serverUrl={serverUrl}
        onSendMessage={sendMsg}
        onMakeRoom={handleMakeRoom}
        onJoinRoom={handleJoinRoom}
        onPlaySound={playSound}
        onLogout={handleLogout}
        onUploadMedia={handleUploadMedia}
        onSelectMedia={handleSelectMedia}
        videoRef={videoRef}
        onPlay={() => emitPlayback('play')}
        onPause={() => emitPlayback('pause')}
        onSeeking={() => emitPlayback('seek')}
      />
    </ThemeProvider>
  );
}

export default App;
