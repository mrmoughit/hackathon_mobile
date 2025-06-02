import express from 'express';
import passport from 'passport';
import axios from 'axios';
import OAuth2Strategy from 'passport-oauth2';
import session from 'express-session';
import cors from 'cors';
import { pool } from './db.js';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import http from 'http';
import routes from './event_routes.js';
import user_routes from './user_routes.js';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { create_new_user, check_if_admin, get_user_id } from './help.js';
import { Server } from 'socket.io';

dotenv.config();

const options = { expiresIn: '5h' };

const app = express();

app.use(cookieParser());
app.use(express.json());
app.use(cors({ origin: '*', credentials: true }));
app.use(session({ secret: 'abechcha', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// Single HTTP server instance
const server = http.createServer(app);

// Socket.IO setup (handles all upgrade requests except /ws)
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// Raw WebSocket server, only for /ws path
const wss = new WebSocketServer({ noServer: true });

// Handle HTTP upgrade to WS
server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    // Let Socket.IO handle upgrade on other URLs
    // If not socket.io URL, destroy socket
    socket.destroy();
  }
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// WebSocket (ws) connection handler (if you use ws clients)
wss.on('connection', (ws) => {
  console.log('Raw WebSocket client connected');

  ws.on('message', (message) => {
    console.log('Received WS message:', message);
    // Echo example or handle messages from ws clients here
    ws.send(`Server received: ${message}`);
  });

  ws.on('close', () => {
    console.log('Raw WebSocket client disconnected');
  });
});

// Send notification to all connected Socket.IO clients
export function sendNotification(username, message) {
  console.log("Sending notification:", { username, message });
  io.emit('notification', { username, message });
}

// Passport config (unchanged)
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

passport.use('42', new OAuth2Strategy({
  authorizationURL: 'https://api.intra.42.fr/oauth/authorize',
  tokenURL: 'https://api.intra.42.fr/oauth/token',
  clientID: process.env.UID,
  clientSecret: process.env.SECRET,
  callbackURL: process.env.CALLBACK,
}, (accessToken, refreshToken, profile, cb) => {
  cb(null, { accessToken, profile });
}));

app.get('/auth/42',
  passport.authenticate('42', { scope: 'public' })
);

app.get('/callback',
  passport.authenticate('42', {
    failureRedirect: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  }),
  async (req, res) => {
    let login;
    try {
      const accessToken = req.user.accessToken;
      const data = await axios.get('https://api.intra.42.fr/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      login = data.data.login;
      const img = data.data.image.link;
      const full_name = data.data.usual_full_name;

      await create_new_user(login, img, full_name);

      const payload = { login };
      const token = jwt.sign(payload, process.env.JWT_SECRET, options);

      const query = `UPDATE users SET access_token = ? WHERE intra_login = ?`;
      await pool.query(query, [token, login]);

      res.redirect(`app0://auth/callback?token=${token}`);
    } catch (error) {
      console.error("Error in callback:", error);
      res.status(500).send("Authentication failed");
    }
  }
);

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
}));

app.use('/', routes);
app.use('/', user_routes);

app.post('/events_finish', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Invalid token" });

  const { event_id } = req.body;
  if (!event_id) return res.status(400).json({ message: "Missing event ID" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userLogin = decoded.login;

    
    await sendNotification(userLogin, "hello avatar");

    const isAdmin = await check_if_admin(userLogin);
    if (!isAdmin) return res.status(403).json({ message: "Not allowed to finish event" });

    const userId = await get_user_id(userLogin);
    if (userId === -1) return res.status(500).json({ message: "Internal server error" });

    await pool.query('UPDATE event SET event_done = 1 WHERE event_id = ? AND user_id = ?', [event_id, userId]);

    res.status(200).json({ message: "Finished successfully" });
  } catch (err) {
    console.error("Error finishing event:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
