import React, { useState, useRef, useEffect } from 'react';
import { createGlobalStyle, ThemeProvider } from 'styled-components';
import { styleReset } from 'react95';
import original from 'react95/dist/themes/original';
import io from 'socket.io-client';
import { RetroPlayer } from './components/RetroPlayer';
import Login from './components/Login';
import DashboardShell from './components/Dashboard';

const serverUrl = `http://${window.location.hostname}:3001`;
const socket = io(serverUrl);
const GlobalStyles = createGlobalStyle`${styleReset}`;

function App() {
  const [user, setUser] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const videoRef = useRef();

  useEffect(() => {
    if (!user) return;

    socket.emit('join', user);
    
    const handleSync = (data) => {
      const video = videoRef.current;
      if (!video) return;
      if (data.action === 'play' && video.paused) video.play().catch(e => console.warn(e));
      else if (data.action === 'pause' && !video.paused) video.pause();
      if (Math.abs(video.currentTime - data.time) > 1.0) video.currentTime = data.time;
    };

    socket.on('user-list', setActiveUsers);
    socket.on('chat-message', (msg) => setMessages(prev => [...prev, msg]));
    socket.on('sync-state', handleSync);

    return () => {
      socket.off('user-list');
      socket.off('chat-message');
      socket.off('sync-state', handleSync);
    };
  }, [user]);

  const emit = (action) => {
    socket.emit('playback-action', { action, time: videoRef.current ? videoRef.current.currentTime : 0 });
  };

  const sendMsg = (content) => {
    socket.emit('send-message', { content, username: user, time: new Date().toLocaleTimeString() });
  };

  if (!user) {
    return (
      <ThemeProvider theme={original}>
        <GlobalStyles />
        <Login onLogin={setUser} serverUrl={serverUrl}/>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={original}>
      <GlobalStyles />
      <DashboardShell
        activeUsers={activeUsers}
        messages={messages}
        onSendMessage={sendMsg}
        videoRef={videoRef}
        onPlay={() => emit('play')}
        onPause={() => emit('pause')}
        onSeeking={() => emit('seek')}
      />
    </ThemeProvider>
  );
}

export default App;
