import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Room, RoomEvent, Track } from 'livekit-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL;

export default function ViewerPage() {
  const [searchParams] = useSearchParams();
  const [roomName, setRoomName] = useState(searchParams.get('room') || '');
  const [viewerName, setViewerName] = useState(searchParams.get('name') || '');
  const [status, setStatus] = useState('idle'); // idle | connecting | watching | stopped
  const [error, setError] = useState('');
  const roomRef = useRef(null);
  const videoTrackRef = useRef(null);
  const audioElRef = useRef(null);

  // Auto-join when both room and name are provided via URL params
  useEffect(() => {
    const room = searchParams.get('room');
    const name = searchParams.get('name');
    if (room && name) {
      doJoin(room, name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Callback ref: attach video track as soon as the <video> element mounts
  const videoCallbackRef = useCallback((videoEl) => {
    if (videoEl && videoTrackRef.current) {
      videoTrackRef.current.attach(videoEl);
    }
  }, []);

  async function joinStream() {
    await doJoin(roomName.trim(), viewerName.trim());
  }

  async function doJoin(roomParam, nameParam) {
    if (!roomParam) { setError('Please enter a room name.'); return; }
    if (!nameParam) { setError('Please enter your name.'); return; }
    if (roomRef.current) return; // already connecting (guards StrictMode double-invoke)
    setError('');
    setStatus('connecting');

    try {
      const res = await fetch(`${BACKEND_URL}/api/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: roomParam,
          participantName: nameParam,
          isHost: false,
        }),
      });
      if (!res.ok) throw new Error('Failed to get token from server');
      const { token } = await res.json();

      const lkRoom = new Room();
      roomRef.current = lkRoom;

      // When host publishes a track, attach it
      lkRoom.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video) {
          videoTrackRef.current = track;
          setStatus('watching');
        } else if (track.kind === Track.Kind.Audio) {
          const audioEl = track.attach();
          audioElRef.current = audioEl;
          document.body.appendChild(audioEl);
        }
      });

      // When host stops a track
      lkRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Video) {
          track.detach();
          videoTrackRef.current = null;
          setError('The host ended the stream.');
          setStatus('stopped');
        } else if (track.kind === Track.Kind.Audio) {
          if (audioElRef.current) {
            audioElRef.current.remove();
            audioElRef.current = null;
          }
        }
      });

      lkRoom.on(RoomEvent.Disconnected, () => {
        if (audioElRef.current) {
          audioElRef.current.remove();
          audioElRef.current = null;
        }
        videoTrackRef.current = null;
        roomRef.current = null;
        setStatus('stopped');
      });

      await lkRoom.connect(LIVEKIT_URL, token);
      lkRoom.startAudio(); // satisfy browser autoplay policy

      // Host may already be streaming — check existing subscribed tracks
      for (const participant of lkRoom.remoteParticipants.values()) {
        for (const pub of participant.trackPublications.values()) {
          if (!pub.isSubscribed || !pub.track) continue;
          if (pub.track.kind === Track.Kind.Video) {
            videoTrackRef.current = pub.track;
            setStatus('watching');
          } else if (pub.track.kind === Track.Kind.Audio) {
            const audioEl = pub.track.attach();
            audioElRef.current = audioEl;
            document.body.appendChild(audioEl);
          }
        }
      }
      // If no video found yet, stay in 'connecting' (TrackSubscribed will fire later)

    } catch (err) {
      setError(err.message || 'Failed to join stream');
      setStatus('idle');
    }
  }

  function leaveStream() {
    if (videoTrackRef.current) {
      videoTrackRef.current.detach();
    }
    if (audioElRef.current) {
      audioElRef.current.remove();
      audioElRef.current = null;
    }
    if (roomRef.current) {
      roomRef.current.disconnect();
    }
  }

  return (
    <div className="page">
      <h1>👁️ Watch Stream</h1>

      {(status === 'idle' || status === 'stopped') && (
        <div className="form">
          <input
            type="text"
            placeholder="Room name (e.g. my-stream)"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
          />
          <input
            type="text"
            placeholder="Your name (e.g. viewer1)"
            value={viewerName}
            onChange={(e) => setViewerName(e.target.value)}
          />
          <button onClick={joinStream}>Watch</button>
          {status === 'stopped' && <p className="info">You left the stream.</p>}
        </div>
      )}

      {status === 'connecting' && (
        <p className="info">⏳ Waiting for the host to start streaming...</p>
      )}

      {error && <p className="error">{error}</p>}

      {status === 'watching' && (
        <div className="stream-container">
          <p className="live-badge">▶ LIVE — Room: <strong>{roomName}</strong></p>
          <video ref={videoCallbackRef} autoPlay playsInline className="video" />
          <button className="stop-btn" onClick={leaveStream}>Leave</button>
        </div>
      )}

      {(status === 'idle' || status === 'stopped') && (
        <div className="hint">
          <p>Ask the host for the room name to join their stream.</p>
        </div>
      )}
    </div>
  );
}
