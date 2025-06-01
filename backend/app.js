import express, { response } from 'express';
import passport from 'passport';
import axios from 'axios';
import OAuth2Strategy from 'passport-oauth2'
import session from 'express-session';
import cors from 'cors';
import { pool } from './db.js';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import http from 'http';
import routes from './routes.js';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { access } from 'fs';
import { log } from 'console';
import { create_new_user } from './help.js'
import multer from 'multer';

const options = { expiresIn: '5h' };

dotenv.config();
const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(cors({ origin: '*', credentials: true }));
app.use(session({ secret: 'abechcha', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());
app.use('/api', routes);

let accessToken = "";


app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
}));


passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));


const server = http.createServer(app);
const wss = new WebSocketServer({ server });

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


function setAccessToken(token) {
  if (token) {
  } else {
    console.error('Access token is required.');
  }
}

app.get('/callback',
  passport.authenticate('42', {
    failureRedirect: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  }),
  async (req, res) => {
    var login;
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

      create_new_user(login, img, full_name);

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
      const res = await pool.query(query, [token, login]);
    } catch (err) {
      console.log(err);
      return;
    }
    res.redirect(`app0://auth/callback?token=${token}`);
  }
);



app.get('/user', async (req, res) => {


  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token)
    return res.status(401).json("invalid token ");

  try {

    const decoded = await jwt.verify(token, process.env.JWT_SECRET);


    const userLogin = decoded.login;

    const [userRows] = await pool.query('SELECT * FROM users WHERE intra_login = ?', [userLogin]);
    if (userRows.length === 0) return null;

    const result = userRows[0];

    if (result.role === 'admin' || result.role === 'organizer') {


      const [events] = await pool.query('SELECT * FROM event WHERE user_id = ?', [result.id]);

      for (const event of events) {

        const [locations] = await pool.query('SELECT * FROM location WHERE location_id = ?', [event.location_id]);
        event.location = locations.length > 0 ? locations[0] : null;


        const [feedbacks] = await pool.query('SELECT * FROM feedback WHERE event_id = ?', [event.event_id]);
        event.feedbacks = feedbacks;
      }

      result.events = events;
    }
    res.status(200).json(result);
    console.log(result);
  } catch (error) {
    res.status(500);
    console.error('Error fetching user with events:', error);
    throw error;
  }
})





const storage = multer.diskStorage({
  destination: './uploads/', // Make sure this directory exists
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });



app.post('/addevent', upload.single('image'), async (req, res) => {

  var user_id;
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token)
    return res.status(401).json("invalid token ");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userLogin = decoded.login;

    const q = 'SELECT user_id FROM users WHERE intra_login = ?';
    const [rows] = await pool.query(q, [userLogin]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user_id = rows[0].user_id;
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: "Invalid token" });
  }

  const {
    title,
    description,
    location,
    maxPlaces,
    date,
    time
  } = req.body;

  const image = req.file ? `/uploads/${req.file.filename}` : null;

  const [city, place_name] = location.split(' - ').map(part => part.trim());

  const eventDateTime = new Date(`${date}T${time}:00`);

  try {
    const conn = await pool.getConnection();


    const [locationRows] = await conn.execute(
      'SELECT location_id FROM location WHERE city = ? AND place_name = ?',
      [city, place_name]
    );

    let location_id;
    if (locationRows.length > 0) {
      location_id = locationRows[0].location_id;
    } else {
      const [insertLocation] = await conn.execute(
        'INSERT INTO location (city, place_name) VALUES (?, ?)',
        [city, place_name]
      );
      location_id = insertLocation.insertId;
    }

    const [insertEvent] = await conn.execute(
      `INSERT INTO event 
        (user_id, location_id, event_title, event_description, event_image, number_places_available, duration, time) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.user_id,
        location_id,
        title,
        description,
        image,
        maxPlaces,
        60,
        eventDateTime
      ]
    );

    conn.release();
    res.status(201).json({ message: 'Event created', event_id: insertEvent.insertId });

  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


server.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));
