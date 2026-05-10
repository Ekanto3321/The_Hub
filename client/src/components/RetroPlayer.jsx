import React, { useState, useEffect } from 'react';
import { Window, WindowHeader, WindowContent, Button, Slider, Frame } from 'react95';

const formatTime = (seconds) => {
    if (!isFinite(seconds) || seconds < 0) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    // Conditionally format as HH:MM:SS or MM:SS
    const timeStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return h > 0 ? `${String(h).padStart(2, '0')}:${timeStr}` : timeStr;
  };

export const RetroPlayer = ({ videoRef, onPlay, onPause, onSeeking }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const update = () => { setCurrentTime(video.currentTime); setDuration(video.duration || 0); setIsPlaying(!video.paused); };
    video.addEventListener('timeupdate', update);
    video.addEventListener('loadedmetadata', update);
    
    const handleKeyDown = (e) => {
        if (e.code === 'Space') {
          e.preventDefault();
          togglePlay();
        }
        if (e.key.toLowerCase() === 'f') {
            if (!document.fullscreenElement) {
              videoRef.current.requestFullscreen();
            } else {
              document.exitFullscreen();
            }
          }
      };
      window.addEventListener('keydown', handleKeyDown);

    
    return () => { video.removeEventListener('timeupdate', update); video.removeEventListener('loadedmetadata', update);  window.removeEventListener('keydown', handleKeyDown); };

}, [videoRef]);




  const togglePlay = () => {
    if (videoRef.current.paused) { videoRef.current.play(); onPlay(); } 
    else { videoRef.current.pause(); onPause(); }
  };

  const skip = (secs) => { videoRef.current.currentTime += secs; onSeeking(); };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <Window style={{ width: '53vw', margin:'0 10px 0 10px' }}>
        <WindowHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>the_hub_v1.0.exe</span>
          <div style={{ display: 'flex', gap: '2px' }}>
            <Button size='sm' square>_</Button><Button size='sm' square>□</Button><Button size='sm' square>x</Button>
          </div>
        </WindowHeader>
        <WindowContent>
          <Frame variant="field" style={{ background: '#000', padding: '5px', marginBottom: '10px' }}>
            <video ref={videoRef} src="/test-video.mp4" onClick={togglePlay} style={{ width: '100%', display: 'block', cursor: 'pointer' }} />
          </Frame>

          {/* Main Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#c0c0c0', padding: '8px', border: '2px outset #fff', marginBottom: '5px' }}>
            
            <Button onClick={togglePlay} style={{ margin:'0 0 20px 0', height: '60px', width: '80px' }}>{isPlaying ? '⏸' : '▶'}</Button>
            <Button style={{ margin:'0 0 20px 0'}} onClick={() => skip(-5)}>◀</Button>
            <Button style={{ margin:'0 0 20px 0'}} onClick={() => skip(5)}>▶</Button>

            <Slider style={{ flexGrow: 1 }} value={Math.floor(currentTime)} min={0} max={Math.floor(duration)} onChange={(v) => { videoRef.current.currentTime = v; onSeeking(); }} />
            <Button  style={{ margin:'0 0 20px 0' }} onClick={() => setIsMuted(!isMuted) || (videoRef.current.muted = !isMuted)}>{isMuted ? '🔇' : '🔈'}</Button>
            <Slider style={{ width: 100 }} value={isMuted ? 0 : volume * 100} min={0} max={100} onChange={(v) => { videoRef.current.volume = v / 100; setVolume(v / 100); setIsMuted(v === 0); }} />
            
            <Button onClick={() => videoRef.current.requestFullscreen()} style={{ margin:'0 0 20px 20px', height: '50px', width: '50px' }}>⛶</Button>
          </div>

          {/* Secondary Layer */}
          <div style={{ display: 'flex', gap: '5px', background: '#c0c0c0', padding: '8px', border: '2px outset #fff', justifyContent: 'center' }}>
          <div style={{ flexGrow: 1, textAlign: 'center', fontFamily: "'Courier New', Courier, monospace", fontSize: '14px', background: '#e0e0e0', padding: '5px', border: '1px inset #777' }}>
                PLAYING: {videoRef.current ? videoRef.current.src.split('/').pop() : 'NO FILE'}
          </div>
        
          <div style={{ margin: '5px 0 0 0', width: '300px', extAlign: 'center',  fontFamily: "'Courier New', Courier, monospace", fontSize: '16px'}}>
                {formatTime(currentTime)} / {formatTime(duration)}</div>
          </div>
        </WindowContent>
      </Window>
    </div>
  );
};