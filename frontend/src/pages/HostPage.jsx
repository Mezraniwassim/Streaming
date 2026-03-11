import { useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Room, RoomEvent, createLocalVideoTrack, createLocalAudioTrack } from 'livekit-client';
import { Navbar } from '../App';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL;

export default function HostPage() {
  const [searchParams] = useSearchParams();
  const [roomName, setRoomName] = useState(searchParams.get('room') || '');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [watcherCount, setWatcherCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const roomRef = useRef(null);
  const videoTrackRef = useRef(null);

  const videoCallbackRef = useCallback((videoEl) => {
    if (videoEl && videoTrackRef.current) {
      videoTrackRef.current.attach(videoEl);
    }
  }, []);

  async function startStream() {
    if (!roomName.trim()) { setError('Please enter a room name.'); return; }
    setError('');
    setStatus('connecting');

    try {
      const res = await fetch(`${BACKEND_URL}/api/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: roomName.trim(), participantName: 'host', isHost: true }),
      });
      if (!res.ok) throw new Error('Failed to get token from server');
      const { token } = await res.json();

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.Disconnected, () => {
        videoTrackRef.current = null;
        roomRef.current = null;
        setWatcherCount(0);
        setStatus('stopped');
      });
      room.on(RoomEvent.ParticipantConnected, () => setWatcherCount(room.remoteParticipants.size));
      room.on(RoomEvent.ParticipantDisconnected, () => setWatcherCount(room.remoteParticipants.size));

      await room.connect(LIVEKIT_URL, token);

      const [videoTrack, audioTrack] = await Promise.all([
        createLocalVideoTrack({ resolution: { width: 1280, height: 720 } }),
        createLocalAudioTrack(),
      ]);

      await room.localParticipant.publishTrack(videoTrack);
      await room.localParticipant.publishTrack(audioTrack);

      videoTrackRef.current = videoTrack;
      setStatus('live');
    } catch (err) {
      setError(err.message || 'Failed to start stream');
      setStatus('idle');
    }
  }

  function stopStream() {
    videoTrackRef.current?.stop();
    roomRef.current?.disconnect();
  }

  function copyLink() {
    const url = `${window.location.origin}/watch?room=${encodeURIComponent(roomName)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const shareUrl = `${window.location.origin}/watch?room=${encodeURIComponent(roomName)}`;

  return (
    <>
      <Navbar showBack />
      <div className="stream-page">

        {(status === 'idle' || status === 'stopped') && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
            <div className="card">
              <h1>🎥 Go Live</h1>
              <p className="card-subtitle">Create a room and start broadcasting to viewers.</p>
              {error && <div className="error-banner">{error}</div>}
              {status === 'stopped' && (
                <div style={{ marginBottom: '1rem', color: '#68d391', fontSize: '0.9rem' }}>
                  ✓ Stream ended successfully.
                </div>
              )}
              <div className="field">
                <label>Room Name</label>
                <input
                  type="text"
                  placeholder="e.g. my-stream"
                  value={roomName}
                  onChange={(e) => { setRoomName(e.target.value); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && startStream()}
                />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={startStream}>
                Start Broadcasting →
              </button>
              <p className="hint-text">Viewers can join by room name or shareable link.</p>
            </div>
          </div>
        )}

        {status === 'connecting' && (
          <div className="status-box">
            <div className="spinner" />
            <p>Starting your stream&hellip;</p>
          </div>
        )}

        {status === 'live' && (
          <>
            <div className="stream-header">
              <span className="live-pill"><span className="pulse" style={{ background: '#fff' }} />LIVE</span>
              <span className="stream-title">{roomName}</span>
              <span className="watcher-badge">👥 {watcherCount} viewer{watcherCount !== 1 ? 's' : ''}</span>
              <button className="btn btn-ghost btn-sm" onClick={stopStream}>■ Stop Stream</button>
            </div>

            <div className="video-wrapper">
              <video ref={videoCallbackRef} autoPlay muted playsInline className="video" />
            </div>

            <div className="stream-controls">
              <div className="share-box">
                <span className="share-url">{shareUrl}</span>
                <button className={`copy-btn${copied ? ' copied' : ''}`} onClick={copyLink}>
                  {copied ? '✓ Copied' : 'Copy Link'}
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    </>
  );
}
