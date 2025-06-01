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
import { create_new_user  , convert_houre , check_if_admin , get_user_id} from './help.js'
import multer from 'multer';
import path from 'path';

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





// const storage = multer.diskStorage({
//   destination: './uploads/',
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + path.extname(file.originalname));
//   }
// });


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/var/www/html/uploads');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });



app.post('/addevent', upload.single('image'), async (req, res) => {
  let user_id;
  let userLogin;
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token)
    return res.status(401).json("invalid token ");
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userLogin = decoded.login;
    
    const user_id = get_user_id(userLogin);
    if (user_id === 0)
      return res.status(500).json({ error: "internal server error" });
    
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: "Invalid token" });
  }


  if (!check_if_admin(userLogin))
      return res.status(401).json("not allowed to add event");
  const {
    title,
    description,
    location,
    max_places,
    date,
    time
  } = req.body;

  if (
    event_id == null || title == null || description == null || location == null ||
    max_places == null || date == null || time == null
  ) {
    return res.status(400).json("Missing required data");
  }
  const image = req.file ? `/uploads/${req.file.filename}` : null;
  
  const time24h = convert_houre(time);
  const eventDateTime = new Date(`${date}T${time24h}`);


  try {
    const conn = await pool.getConnection();

    const [locationRows] = await conn.execute(
      'SELECT location_id FROM location WHERE place_name = ?',
      [location]
    );

    let location_id;
    if (locationRows.length > 0) {
      location_id = locationRows[0].location_id;
    } else {
      const [insertLocation] = await conn.execute(
        'INSERT INTO location (place_name) VALUES (?)',
        [location]
      );
      location_id = insertLocation.insertId;
    }

    const [insertEvent] = await conn.execute(
      `INSERT INTO event 
        (user_id, location_id, event_title, event_description, event_image, number_places_available, duration, time) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        location_id,
        title,
        description,
        image,
        max_places,
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





app.get('/events', async (req, res) => {

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token)
    return res.status(401).json("invalid token");
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const login = decoded.login;
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
      const [rows] = await pool.query(`
          SELECT 
              e.event_id,
              e.user_id,
              e.event_title,
              e.time,
              e.number_places_available,
              e.duration,
              e.event_description,
              e.event_image,
              l.location_id,
              l.city,
              l.place_name,
              COUNT(r.id) AS number_of_registrations
          FROM event e
          LEFT JOIN location l ON e.location_id = l.location_id
          LEFT JOIN registration r ON e.event_id = r.event_id
          GROUP BY e.event_id
      `);

      const events = rows.map(row => ({
          event_id: row.event_id,
          user_id: row.user_id,
          event_title: row.event_title,
          time: row.time,
          number_places_available: row.number_places_available,
          duration: row.duration,
          event_description: row.event_description,
          event_image: row.event_image,
          location: {
              location_id: row.location_id,
              city: row.city,
              place_name: row.place_name
          },
          number_of_registrations: row.number_of_registrations
      }));

      res.json(events);
  } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/events/Edit', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token)
    return res.status(401).json("invalid token ");

  const {
    title,
    description,
    location,
    max_places,
    date,
    time
  } = req.body;
  if (
    event_id == null || title == null || description == null || location == null ||
    max_places == null || date == null || time == null
  ) {
    return res.status(400).json("Missing required data");
  }
  try {

    const decoded = await jwt.verify(token, process.env.JWT_SECRET);
    const userLogin = decoded.login;
    if(!check_if_admin(userLogin))
      return res.status(401).json("not allowed to edit event");

    const id = get_user_id(userLogin);
    if (id == -1)
      return res.status(500).json("internal server error");
  
    const query = `
    UPDATE event
    SET event_title = ?, event_description = ?, location_id = ?, number_places_available = ?, time = ?, date = ?
    WHERE event_id = ? AND user_id = ?
  `;

  await pool.query(query, [
    title,
    description,
    location,
    max_places,
    time,
    date,
    event_id,
    userId
  ]);

  res.status(200).json("Event updated successfully");

  }catch(err){
    res.status(500).json("internal server error");
  }
});


app.delete('/events/Delete', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token)
    return res.status(401).json("Invalid token");
  const {event_id} = req.body;
  if (event_id == null)
      return res.status(400).json("missing data");
  try{

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userLogin = decoded.login;

    const isAdmin = await check_if_admin(userLogin);
    if (!isAdmin)
      return res.status(403).json("Not allowed to edit event");

    const userId = await get_user_id(userLogin);
    if (userId === -1)
      return res.status(500).json("Internal server error");


  }catch(err){

  }


});


server.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));
