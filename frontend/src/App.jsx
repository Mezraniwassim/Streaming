import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import HostPage from './pages/HostPage';
import ViewerPage from './pages/ViewerPage';
import './App.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function Home() {
  const [rooms, setRooms] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchRooms() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/rooms`);
        const data = await res.json();
        setRooms(data.rooms || []);
      } catch {
        // backend may not be reachable yet
      }
    }
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="page center">
      <h1>🎬 Live Streaming App</h1>
      <div className="nav-buttons">
        <Link to="/host"><button>🎥 Start Streaming (Host)</button></Link>
        <Link to="/watch"><button>👁️ Watch Stream (Viewer)</button></Link>
      </div>

      <div className="rooms-section">
        <h2>🔴 Live Now</h2>
        {rooms.length === 0 ? (
          <p className="info">No streams running right now.</p>
        ) : (
          <ul className="rooms-list">
            {rooms.map((r) => (
              <li key={r.name} className="room-item">
                <span className="room-name">{r.name}</span>
                <span className="room-viewers">{r.numParticipants} viewer{r.numParticipants !== 1 ? 's' : ''}</span>
                <button onClick={() => navigate(`/watch?room=${encodeURIComponent(r.name)}`)}>
                  Watch
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/host" element={<HostPage />} />
        <Route path="/watch" element={<ViewerPage />} />
      </Routes>
    </BrowserRouter>
  );
}
