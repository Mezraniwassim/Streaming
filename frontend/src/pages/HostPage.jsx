import { useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Room, RoomEvent, createLocalVideoTrack, createLocalAudioTrack } from 'livekit-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL;

export default function HostPage() {
  const [searchParams] = useSearchParams();
  const [roomName, setRoomName] = useState(searchParams.get('room') || '');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [watcherCount, setWatcherCount] = useState(0);
  const roomRef = useRef(null);
  const videoTrackRef = useRef(null);

  // Callback ref: attaches the track as soon as the <video> element mounts
  const videoCallbackRef = useCallback((videoEl) => {
    if (videoEl && videoTrackRef.current) {
      videoTrackRef.current.attach(videoEl);
    }
  }, []);

  async function startStream() {
    if (!roomName.trim()) {
      setError('Please enter a room name.');
      return;
    }
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

      room.on(RoomEvent.ParticipantConnected, () => {
        setWatcherCount(room.remoteParticipants.size);
      });

      room.on(RoomEvent.ParticipantDisconnected, () => {
        setWatcherCount(room.remoteParticipants.size);
      });

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
    if (videoTrackRef.current) {
      videoTrackRef.current.stop();
    }
    if (roomRef.current) {
      roomRef.current.disconnect();
    }
  }

  return (
    <div className="page">
      <h1>🎥 Host — Go Live</h1>

      {(status === 'idle' || status === 'stopped') && (
        <div className="form">
          <input
            type="text"
            placeholder="Enter room name (e.g. my-stream)"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
          />
          <button onClick={startStream}>Go Live</button>
          {status === 'stopped' && <p className="info">Stream ended.</p>}
        </div>
      )}

      {status === 'connecting' && <p className="info">Connecting to LiveKit...</p>}

      {error && <p className="error">{error}</p>}

      {status === 'live' && (
        <div className="stream-container">
          <p className="live-badge">🔴 LIVE — Room: <strong>{roomName}</strong></p>
          <p className="watcher-count">👥 <strong>{watcherCount}</strong> viewer{watcherCount !== 1 ? 's' : ''} watching</p>
          <p className="share-link">Share link: <code>{window.location.origin}/watch?room={encodeURIComponent(roomName)}</code></p>
          <video ref={videoCallbackRef} autoPlay muted playsInline className="video" />
          <button className="stop-btn" onClick={stopStream}>Stop Stream</button>
        </div>
      )}

      {(status === 'idle' || status === 'stopped') && (
        <div className="hint">
          <p>Share the room name with viewers so they can watch your stream.</p>
        </div>
      )}
    </div>
  );
}
