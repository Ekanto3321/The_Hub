import React, { useState, useRef } from 'react';
import { Window, WindowHeader, WindowContent, Button, TextField } from 'react95';
import { RetroPlayer } from './RetroPlayer';

export default function DashboardShell({ activeUsers, messages, onSendMessage, videoRef, onPlay, onPause, onSeeking }) {
    const [msg, setMsg] = useState('');
    const chatEndRef = useRef(null);

    const handleKeyDown = (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
            e.preventDefault();
            if (msg.trim()) {
                onSendMessage(msg);
                setMsg('');
            }
        }
    };

    return (
        <div style={{ padding: '10px', width: '99%' }}>
            <Window style={{ width: '100%', height: '90px' }}>
                <WindowHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '60px', padding: '0 12px' }}>
                    <span style={{ fontSize: '24px' }}>THE HUB</span>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Button style={{ width: '120px', height: '40px', fontSize: '14px' }}>JOIN ROOM</Button>
                        <Button style={{ width: '120px', height: '40px', fontSize: '14px' }}>MAKE ROOM</Button>
                        <Button style={{ width: '100px', height: '40px', fontSize: '14px' }}>PROFILE</Button>
                    </div>
                </WindowHeader>
            </Window>

            <div style={{ margin: '20px 0 0 0', display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: '3px', alignItems: 'start', width: '100%', boxSizing: 'border-box' }}>
                <Window style={{ width: '100%' }}>
                    <WindowHeader>Room Info</WindowHeader>
                    <WindowContent>
                        <b>Watching:</b>
                        <ul>{activeUsers.map((u, i) => <li key={i}>{u}</li>)}</ul>
                        <hr />
                        <Button fullWidth>NEXT VIDEO</Button>
                    </WindowContent>
                </Window>

                <RetroPlayer videoRef={videoRef} onPlay={onPlay} onPause={onPause} onSeeking={onSeeking} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                    {/* <Window style={{ width: '100%' }}>
                        <WindowHeader>CHAT</WindowHeader>
                        <WindowContent style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '10px', background: '#fff', padding: '5px' }}>
                                {messages.map((m, i) => <div key={i}>[{m.time}] <b>{m.username}:</b> {m.content}</div>)}
                                <div ref={chatEndRef} />
                            </div>
                            <TextField 
                                value={msg} 
                                onChange={e => setMsg(e.target.value)} 
                                onKeyDown={handleKeyDown}
                            />
                            <Button onClick={() => { if (msg.trim()) { onSendMessage(msg); setMsg(''); } }}>Send</Button>
                        </WindowContent>
                    </Window>

                    <Window style={{ width: '100%' }}>
                        <WindowHeader>SOUNDBOARD</WindowHeader>
                        <WindowContent style={{ height: '180px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                <Button style={{ aspectRatio: '1 / 1', width: '100%' }}>Error</Button>
                                <Button style={{ aspectRatio: '1 / 1', width: '100%' }}>Alert</Button>
                                <Button style={{ aspectRatio: '1 / 1', width: '100%' }}>Ping</Button>
                                <Button style={{ aspectRatio: '1 / 1', width: '100%' }}>Chime</Button>
                                <Button style={{ aspectRatio: '1 / 1', width: '100%' }}>Buzz</Button>
                                <Button style={{ aspectRatio: '1 / 1', width: '100%' }}>Pop</Button>
                            </div>
                        </WindowContent>
                    </Window> */}
                </div>
            </div>
        </div>
    );
}