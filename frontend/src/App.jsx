import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import HostPage from './pages/HostPage';
import ViewerPage from './pages/ViewerPage';
import './App.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function Navbar({ showBack }) {
  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">🎬 LiveStream</Link>
      <div className="navbar-links">
        {showBack
          ? <Link to="/"><button className="nav-btn">← Back</button></Link>
          : (
            <>
              <Link to="/watch"><button className="nav-btn">👁 Watch</button></Link>
              <Link to="/host"><button className="nav-btn primary">🎥 Go Live</button></Link>
            </>
          )
        }
      </div>
    </nav>
  );
}

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
    <>
      <Navbar />
      <div className="page">
        <div className="home-hero">
          <h1>Stream Live,<br />Watch Together</h1>
          <p>Start a broadcast instantly — no account needed.</p>
          <div className="hero-actions">
            <Link to="/host"><button className="btn btn-primary">🎥 Start Broadcasting</button></Link>
            <Link to="/watch"><button className="btn btn-secondary">👁 Watch a Stream</button></Link>
          </div>
        </div>

        <div style={{ marginTop: '2.5rem' }}>
          <p className="section-title">🔴 Live Right Now</p>
          {rooms.length === 0 ? (
            <div className="empty-rooms">No streams live right now. Be the first to go live!</div>
          ) : (
            <div className="rooms-grid">
              {rooms.map((r) => (
                <div key={r.name} className="room-card">
                  <div className="room-card-header">
                    <span className="pulse" />
                    <span className="room-card-name">{r.name}</span>
                  </div>
                  <div className="room-card-viewers">
                    👥 {r.numParticipants} viewer{r.numParticipants !== 1 ? 's' : ''} watching
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate(`/watch?room=${encodeURIComponent(r.name)}`)}
                  >
                    Watch Now →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
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

export { Navbar };
