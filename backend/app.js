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
import { create_new_user } from './help.js';
import { Server } from 'socket.io';
import {check_if_admin, get_user_id } from './help.js';

dotenv.config();

const options = { expiresIn: '5h' };

const app = express();

app.use(cookieParser());
app.use(express.json());
app.use(cors({ origin: '*', credentials: true }));
app.use(session({ secret: 'abechcha', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// Create HTTP server only once
const server = http.createServer(app);

// Setup Socket.IO with the same server
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

let accessToken = "";

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
}));

app.use('/', routes);
app.use('/', user_routes);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Function to send notification to all connected clients
function sendNotification(username, message) {
  console.log("send" , message);
  io.emit('notification', { username, message });
}


// const wss = new WebSocketServer({ server });

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  // For example, only handle upgrade requests on /ws path by ws:
  if (request.url === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    // Let socket.io handle other upgrade requests
    socket.destroy();
  }
});


passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

passport.use('42', new OAuth2Strategy({
  authorizationURL: 'https://api.intra.42.fr/oauth/authorize',
  tokenURL: 'https://api.intra.42.fr/oauth/token',
  clientID: process.env.UID,
  clientSecret: process.env.SECRET,
  callbackURL: process.env.CALLBACK,
}, function (accessToken, refreshToken, profile, cb) {
  cb(null, { accessToken, profile });
}));

app.get('/auth/42',
  passport.authenticate('42', {
    scope: 'public'
  })
);

app.get('/callback',
  passport.authenticate('42', {
    failureRedirect: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  }),
  async (req, res) => {
    let login;
    const accessToken = req.user.accessToken;
    try {
      const data = await axios.get('https://api.intra.42.fr/v2/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      });
      login = data.data.login;
      const img = data.data.image.link;
      const full_name = data.data.usual_full_name;

      await create_new_user(login, img, full_name);

    } catch (error) {
      console.error("Error fetching data:", error);
    }

    const payload = { login: login };
    const token = jwt.sign(payload, process.env.JWT_SECRET, options);

    const query = `
      UPDATE users
      SET access_token = ? 
      WHERE intra_login = ?
    `;

    try {
      await pool.query(query, [token, login]);
    } catch (err) {
      console.log(err);
      return;
    }
    res.redirect(`app0://auth/callback?token=${token}`);
  }
);



app.post('/events_finish', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: "Invalid token" });

  const { event_id } = req.body;
  if (!event_id) return res.status(400).json({ message: "Missing event ID" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userLogin = decoded.login;

    const message = "hello avatar";
    sendNotification(userLogin , message);
    const isAdmin = await check_if_admin(userLogin);
    if (!isAdmin) return res.status(403).json({ message: "Not allowed to finish event" });

    const userId = await get_user_id(userLogin);
    if (userId === -1) return res.status(500).json({ message: "Internal server error" });

    await pool.query('UPDATE event SET event_done = 1 WHERE event_id = ? AND user_id = ?', [event_id, userId]);

    return res.status(200).json({ message: "Finished successfully" });

  } catch (err) {
    console.error("Error finishing event:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


