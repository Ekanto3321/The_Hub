// ...existing code...
import React, { useState, useRef, useEffect } from 'react';
import { Window, WindowHeader, WindowContent, Button, TextField, Select } from 'react95';
import { RetroPlayer } from './RetroPlayer';


const getNameColor = (name = '') => {
  const colors = [
    '#FF4500', '#1E90FF', '#FF69B4', '#9ACD32',
    '#FFB90F', '#BA55D3', '#00CED1', '#FF6347',
    '#7B68EE', '#00FA9A'
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};

export default function DashboardShell({ 
  userRooms = [], currentRoom, activeUsers = [], messages = [], 
  
  roomMedia = [], activeMedia, onUploadMedia, onSelectMedia, serverUrl, // NEW PROPS
  onSendMessage, onMakeRoom, onJoinRoom, onPlaySound, onLogout,
  videoRef, onPlay, onPause, onSeeking 
}) {
  const [msg, setMsg] = useState('');
  const chatEndRef = useRef(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      if (msg.trim() && currentRoom) {
        onSendMessage(msg);
        setMsg('');
      }
    }
  };

  const promptMakeRoom = () => {
    const name = prompt("Enter new room name:");
    if (name) onMakeRoom(name);
  };

  const promptJoinRoom = () => {
    const code = prompt("Enter 6-character room code:");
    if (code) onJoinRoom(code.toUpperCase());
  };

  const roomOptions = [
    { value: '', label: 'My Rooms...' },
    ...userRooms.map(r => ({ value: r.code, label: r.name }))
  ];

  const handleRoomSelect = (selected) => {
    const code = selected.value;
    if (code) {
      onJoinRoom(code);
    }
  };

  return (
    <div style={{ padding: '10px', width: '99%', height: '99%' }}>
      <Window style={{ width: '100%', height: '90px' }}>
        <WindowHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '60px', padding: '0 12px' }}>
          <span style={{ fontSize: '24px' }}>THE HUB</span>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Select
              defaultValue=""
              options={roomOptions}
              onChange={handleRoomSelect}
              style={{ width: '180px' }}
              menuMaxHeight={160}
            />
            <Button onClick={promptJoinRoom} style={{ width: '120px', height: '40px', fontSize: '14px' }}>JOIN ROOM</Button>
            <Button onClick={promptMakeRoom} style={{ width: '120px', height: '40px', fontSize: '14px' }}>MAKE ROOM</Button>
            <Button onClick={onLogout} style={{ width: '100px', height: '40px', fontSize: '14px', fontWeight: 'bold' }}>LOGOUT</Button>
          </div>
        </WindowHeader>
      </Window>

      <div style={{ margin: '5px 0 0 0', display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: '3px', alignItems: 'start', width: '100%', boxSizing: 'border-box' }}>
        
        {/* ADDED WRAPPER FOR LEFT COLUMN TO STACK ROOM INFO & MEDIA LIBRARY */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
          <Window style={{ width: '100%' }}>
            <WindowHeader>Room Info</WindowHeader>
            <WindowContent>
              {currentRoom ? (
                <div style={{ marginBottom: '15px', background: '#e0e0e0', padding: '8px', border: '2px inset #fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px' }}>Code: <b>{currentRoom.code}</b></span>
                  <Button 
                    onClick={() => navigator.clipboard.writeText(currentRoom.code)} 
                    style={{ height: '25px', fontSize: '12px' }}
                  >
                    Copy
                  </Button>
                </div>
              ) : (
                <div style={{ marginBottom: '15px', color: '#666', textAlign: 'center', padding: '10px', border: '2px inset #fff', background: '#e0e0e0' }}>
                  Join a room to sync up!
                </div>
              )}

              <b>Watching:</b>
              <ul style={{ minHeight: '100px', marginTop: '5px' }}>
                {activeUsers.map((u, i) => (
                  <li key={i}>- {typeof u === 'string' ? u : u.username}</li>
                ))}
              </ul>
              <hr style={{ margin: '15px 0' }} />
              
            </WindowContent>
          </Window>

          {/* NEW MEDIA LIBRARY WINDOW */}
          <Window style={{ width: '100%' }}>
            <WindowHeader>Media Library</WindowHeader>
            <WindowContent>
              <Select
                defaultValue=""
                options={[
                  { value: '', label: 'Select Media...' },
                  ...roomMedia.map(m => ({ value: m.filePath, label: m.title }))
                ]}
                onChange={(selected) => selected.value && onSelectMedia(selected.value)}
                disabled={!currentRoom}
                style={{ width: '100%', marginBottom: '10px' }}
              />
              <div style={{ display: 'flex', gap: '5px' }}>
                <input 
                  type="file" 
                  id="media-upload" 
                  style={{ display: 'none' }} 
                  onChange={(e) => {
                    if(e.target.files[0]) onUploadMedia(e.target.files[0]);
                    e.target.value = ''; // reset input
                  }} 
                  accept="video/mp4,video/webm"
                />
                <Button fullWidth disabled={!currentRoom}>NEXT VIDEO</Button>
                <Button 
                  fullWidth 
                  disabled={!currentRoom} 
                  onClick={() => document.getElementById('media-upload').click()}
                >
                  UPLOAD MEDIA
                </Button>
              </div>
            </WindowContent>
          </Window>
        </div>

        <Window>
          {/* PASSED SRC TO RETROPLAYER */}
          <RetroPlayer 
            key={`player-${currentRoom?.id || 'none'}-${activeMedia || 'no-media'}`} 
            videoRef={videoRef} 
            onPlay={onPlay} 
            onPause={onPause} 
            onSeeking={onSeeking} 
            src={activeMedia ? `${serverUrl}${activeMedia}` : null}
          />
        </Window>

        {/* ... Rest of your Dashboard is completely untouched */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
          
        <Window style={{ width: '100%' }}>
  <WindowHeader>CHAT</WindowHeader>
  <WindowContent style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        marginBottom: '10px',
        background: '#fff',
        padding: '5px',
        border: '2px inset #dfdfdf'
      }}
    >
      {messages.map((m, i) => (
        <div key={i} style={{ marginBottom: 4 }}>
          <span style={{ color: '#555', marginRight: 6 }}>{m.time}</span>
          <span
            style={{
              fontWeight: 'bold',
              color: getNameColor(m.username),
              marginRight: 6
            }}
          >
            {m.username}
          </span>
          <span>{m.content}</span>
        </div>
      ))}
      <div ref={chatEndRef} />
    </div>

    <div style={{ display: 'flex', gap: '5px' }}>
      <TextField
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        onKeyDown={handleKeyDown}
        fullWidth
        disabled={!currentRoom}
        placeholder={currentRoom ? 'Type a message...' : 'Join a room first...'}
      />
      <Button
        disabled={!currentRoom}
        onClick={() => {
          if (msg.trim()) {
            onSendMessage(msg);
            setMsg('');
          }
        }}
      >
        Send
      </Button>
    </div>
  </WindowContent>
</Window>

          <Window style={{ width: '100%' }}>
            <WindowHeader>SOUNDBOARD</WindowHeader>
            <WindowContent style={{ height: '180px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <Button disabled={!currentRoom} onClick={() => onPlaySound('Error')} style={{ aspectRatio: '1/1', width: '100%' }}>Error</Button>
                <Button disabled={!currentRoom} onClick={() => onPlaySound('Alert')} style={{ aspectRatio: '1/1', width: '100%' }}>Alert</Button>
                <Button disabled={!currentRoom} onClick={() => onPlaySound('Ping')} style={{ aspectRatio: '1/1', width: '100%' }}>Ping</Button>
                <Button disabled={!currentRoom} onClick={() => onPlaySound('Chime')} style={{ aspectRatio: '1/1', width: '100%' }}>Chime</Button>
                <Button disabled={!currentRoom} onClick={() => onPlaySound('Buzz')} style={{ aspectRatio: '1/1', width: '100%' }}>Buzz</Button>
                <Button disabled={!currentRoom} onClick={() => onPlaySound('Pop')} style={{ aspectRatio: '1/1', width: '100%' }}>Pop</Button>
              </div>
            </WindowContent>
          </Window>
          
        </div>
      </div>
    </div>
  );
}
// ...existing code...
