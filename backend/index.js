import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

dotenv.config();

const app = express();
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
}));
app.use(express.json());

const PORT = process.env.PORT || 3001;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

const roomService = new RoomServiceClient(
  LIVEKIT_URL.replace('wss://', 'https://'),
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET
);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await roomService.listRooms();
    const active = rooms.map((r) => ({
      name: r.name,
      numParticipants: r.numParticipants,
    }));
    res.json({ rooms: active });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list rooms' });
  }
});

app.post('/api/token', async (req, res) => {
  const { roomName, participantName, isHost } = req.body;

  if (!roomName || !participantName) {
    return res.status(400).json({ error: 'roomName and participantName are required' });
  }

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: participantName,
    ttl: '2h',
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: !!isHost,
    canSubscribe: true,
  });

  const token = await at.toJwt();
  res.json({ token });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
