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
export function sendNotification(username, message) {
  io.emit('notification', { username, message });
}

// Setup WebSocketServer from 'ws' package on same HTTP server
const wss = new WebSocketServer({ server });

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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


