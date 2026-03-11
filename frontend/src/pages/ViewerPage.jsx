import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Room, RoomEvent, Track } from 'livekit-client';
import { Navbar } from '../App';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL;

export default function ViewerPage() {
  const [searchParams] = useSearchParams();
  const [roomName, setRoomName] = useState(searchParams.get('room') || '');
  const [viewerName, setViewerName] = useState(searchParams.get('name') || '');
  const [status, setStatus] = useState('idle'); // idle | connecting | waiting | watching | stopped
  const [error, setError] = useState('');
  const roomRef = useRef(null);
  const videoTrackRef = useRef(null);
  const audioElRef = useRef(null);

  // Auto-join when both room and name are provided via URL params
  useEffect(() => {
    const room = searchParams.get('room');
    const name = searchParams.get('name');
    if (room && name) doJoin(room, name);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (roomRef.current) return; // guard StrictMode double-invoke
    setError('');
    setStatus('connecting');

    try {
      const res = await fetch(`${BACKEND_URL}/api/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: roomParam, participantName: nameParam, isHost: false }),
      });
      if (!res.ok) throw new Error('Failed to get token from server');
      const { token } = await res.json();

      const lkRoom = new Room();
      roomRef.current = lkRoom;

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

      lkRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Video) {
          track.detach();
          videoTrackRef.current = null;
          setError('The host ended the stream.');
          setStatus('stopped');
        } else if (track.kind === Track.Kind.Audio) {
          audioElRef.current?.remove();
          audioElRef.current = null;
        }
      });

      lkRoom.on(RoomEvent.Disconnected, () => {
        audioElRef.current?.remove();
        audioElRef.current = null;
        videoTrackRef.current = null;
        roomRef.current = null;
        setStatus('stopped');
      });

      await lkRoom.connect(LIVEKIT_URL, token);
      lkRoom.startAudio();

      // Check for host already streaming
      let foundVideo = false;
      for (const participant of lkRoom.remoteParticipants.values()) {
        for (const pub of participant.trackPublications.values()) {
          if (!pub.isSubscribed || !pub.track) continue;
          if (pub.track.kind === Track.Kind.Video) {
            videoTrackRef.current = pub.track;
            setStatus('watching');
            foundVideo = true;
          } else if (pub.track.kind === Track.Kind.Audio) {
            const audioEl = pub.track.attach();
            audioElRef.current = audioEl;
            document.body.appendChild(audioEl);
          }
        }
      }
      if (!foundVideo) setStatus('waiting');

    } catch (err) {
      roomRef.current = null;
      setError(err.message || 'Failed to join stream');
      setStatus('idle');
    }
  }

  function leaveStream() {
    videoTrackRef.current?.detach();
    audioElRef.current?.remove();
    audioElRef.current = null;
    roomRef.current?.disconnect();
  }

  return (
    <>
      <Navbar showBack />
      <div className="stream-page">

        {(status === 'idle' || status === 'stopped') && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
            <div className="card">
              <h1>👁 Watch Stream</h1>
              <p className="card-subtitle">Enter the room name to join a live stream.</p>
              {error && <div className="error-banner">{error}</div>}
              {status === 'stopped' && !error && (
                <div style={{ marginBottom: '1rem', color: '#a0aec0', fontSize: '0.9rem' }}>
                  You have left the stream.
                </div>
              )}
              <div className="field">
                <label>Room Name</label>
                <input
                  type="text"
                  placeholder="e.g. my-stream"
                  value={roomName}
                  onChange={(e) => { setRoomName(e.target.value); setError(''); }}
                />
              </div>
              <div className="field">
                <label>Your Name</label>
                <input
                  type="text"
                  placeholder="e.g. viewer1"
                  value={viewerName}
                  onChange={(e) => { setViewerName(e.target.value); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && joinStream()}
                />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={joinStream}>
                Join Stream →
              </button>
            </div>
          </div>
        )}

        {status === 'connecting' && (
          <div className="status-box">
            <div className="spinner" />
            <p>Connecting to stream&hellip;</p>
          </div>
        )}

        {status === 'waiting' && (
          <div className="status-box">
            <div className="spinner" />
            <p>Waiting for the host to start&hellip;</p>
            <button className="btn btn-ghost btn-sm" onClick={leaveStream}>Leave</button>
          </div>
        )}

        {status === 'watching' && (
          <>
            <div className="stream-header">
              <span className="live-pill"><span className="pulse" style={{ background: '#fff' }} />LIVE</span>
              <span className="stream-title">{roomName}</span>
              <button className="btn btn-ghost btn-sm" onClick={leaveStream}>Leave</button>
            </div>
            <div className="video-wrapper">
              <video ref={videoCallbackRef} autoPlay playsInline className="video" />
            </div>
          </>
        )}

      </div>
    </>
  );
}
