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
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { WebSocketServer, WebSocket } from 'ws';
import multer from 'multer';

import { create_new_user  , convert_houre , check_if_admin , get_user_id} from './help.js'

dotenv.config();

const options = { expiresIn: '5h' };
const clients = new Set();

const app = express();
app.use('/', routes);
app.use('/', user_routes);




app.use(cookieParser());
app.use(express.json());
app.use(cors({ origin: '*', credentials: true }));
app.use(session({ secret: 'abechcha', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});


io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

wss.on('connection', (ws) => {
  console.log('Raw WebSocket client connected');
  clients.add(ws);  
  
  
  
  ws.on('close', () => {
    console.log('Raw WebSocket client disconnected');
    clients.delete(ws);  
  });
  
  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    clients.delete(ws);  
  });
});

function sendNotification(username, message) {
  const payload = JSON.stringify({ type: 'notification', username, message });
  console.log('Sending to clients:', payload);
  
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
      console.log('Sent to client');
    } else {
      console.log('Skipped client: not open');
    }
  });
}


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



app.post('/events_finish', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Invalid token" });

  const { event_id } = req.body;
  if (!event_id) return res.status(400).json({ message: "Missing event ID" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userLogin = decoded.login;

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













const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/var/www/html/uploads');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });


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








app.put('/events/Edit', upload.single('image'), async (req, res) => {
  let conn;
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Invalid token" });

    const {
      title,
      description,
      location,
      max_places,
      date, 
      time,  
      event_id
    } = req.body;

    if (
      event_id == null || title == null || description == null || location == null ||
      max_places == null || date == null || time == null
    ) {
      return res.status(400).json({ message: "Missing required data" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userLogin = decoded.login;

    const isAdmin = await check_if_admin(userLogin);
    if (!isAdmin) return res.status(403).json({ message: "Not allowed to edit event" });

    const userId = await get_user_id(userLogin);
    if (userId === -1) return res.status(500).json({ message: "Internal server error" });

    conn = await pool.getConnection();

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


    const time24h = convert_houre(time);
    const eventDateTime = new Date(`${date}T${time24h}`);

    if (isNaN(eventDateTime.getTime())) {
      return res.status(400).json({ message: "Invalid date or time format" });
    }


    const imageUrl = req.file ? `http://13.60.16.112/uploads/${req.file.filename}` : null;


    let query = `
      UPDATE event
      SET event_title = ?, event_description = ?, location_id = ?, number_places_available = ?, duration = ?, time = ?
    `;
    const params = [title, description, location_id, max_places, 60, eventDateTime];

    if (imageUrl) {
      query += `, event_image = ?`;
      params.push(imageUrl);
    }

    query += ` WHERE event_id = ? AND user_id = ?`;
    params.push(event_id, userId);

    await conn.execute(query, params);

    return res.status(200).json({ message: "Event updated successfully" });

  } catch (err) {
    console.error("Error editing event:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    if (conn) conn.release();
  }
});








app.delete('/delete/event', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Token missing or invalid" });
  }

  const event_id = req.body.event_id;
  if (!event_id) {
    return res.status(400).json({ error: "Missing event ID" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userLogin = decoded.login;

    const userId = await get_user_id(userLogin);
    if (userId === -1) {
      return res.status(404).json({ error: "User not found" });
    }


    await pool.query('DELETE FROM saved WHERE event_id = ?', [event_id]);


    const [result] = await pool.query('DELETE FROM event WHERE event_id = ?', [event_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    return res.status(200).json({ message: "Event and saved references deleted successfully" });

  } catch (error) {
    console.error("Error deleting event:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});





app.post('/addevent', upload.single('image'), async (req, res) => {
  let user_id;
  let userLogin;

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json("Invalid token");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userLogin = decoded.login;

    user_id = await get_user_id(userLogin); 
    if (!user_id || user_id === 0)
      return res.status(500).json({ error: "Internal server error: user not found" });

  } catch (err) {
    console.error("JWT or user_id error:", err);
    return res.status(401).json({ error: "Invalid token" });
  }

  const isAdmin = await check_if_admin(userLogin); 
  if (!isAdmin)
    return res.status(403).json("Not allowed to add event");


  const {
    title,
    description,
    location,
    max_places,
    date,
    time
  } = req.body;

  if (
    title == null || description == null || location == null ||
    max_places == null || date == null || time == null
  ) {
    return res.status(400).json("Missing required data");
  }

  const image = req.file ? `http://13.60.16.112/uploads/${req.file.filename}` : null;
  const time24h = convert_houre(time);
  const eventDateTime = new Date(`${date}T${time24h}`);

  let conn;

  try {
    conn = await pool.getConnection();

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
    await sendNotification(userLogin, "Hi everyone an event was added ");
    res.status(201).json({ message: 'Event created', event_id: insertEvent.insertId });

  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    if (conn) conn.release(); 
  }
});



app.delete('/delete/event', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Token missing or invalid" });
  }

  const event_id = req.body.event_id;
  
  if (!event_id) {
    return res.status(400).json({ error: "Missing event ID" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userLogin = decoded.login;

    const userId = await get_user_id(userLogin);
    if (userId === -1) {
      return res.status(404).json({ error: "User not found" });
    }

    const [eventRows] = await pool.query('SELECT user_id FROM event WHERE event_id = ?', [event_id]);
    if (eventRows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    if (eventRows[0].user_id !== userId) {

      return res.status(403).json({ error: "Not authorized to delete this event" });
    }


    await pool.query('DELETE FROM saved WHERE user_id = ? AND event_id = ?', [userId, event_id]);
    const [result] = await pool.query('DELETE FROM event WHERE event_id = ?', [event_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    return res.status(200).json({ message: "Event and saved references deleted successfully" });

  } catch (error) {
    console.error("Error deleting event:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});



app.delete('/delete/saved/event', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Token missing or invalid" });
  }

  console.log(req.body);
  const event_id = req.body.event_id;
  
  if (!event_id) {
    return res.status(400).json({ error: "Missing event ID" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userLogin = decoded.login;

    const userId = await get_user_id(userLogin);
    if (userId === -1) {
      return res.status(404).json({ error: "User not found" });
    }

    // Delete the saved event entry for this user and event
    const [result] = await pool.query(
      'DELETE FROM saved WHERE user_id = ? AND event_id = ?',
      [userId, event_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Saved event not found" });
    }

    return res.status(200).json({ message: "Saved event deleted successfully" });

  } catch (error) {
    console.error("Error deleting saved event:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});









app.post('/add/saved/event', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
      return res.status(401).json({ error: "Token missing or invalid" });
  }
  
  const event_id = req.body.event_id;
  if (!event_id) return res.status(400).json({ error: "Missing event ID" });

  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userLogin = decoded.login;

      const id = await get_user_id(userLogin);
      if (id === -1) {
          return res.status(404).json({ error: "User not found" });
      }

      await pool.query('INSERT INTO saved (user_id, event_id) VALUES (?, ?)', [id, event_id]);

      res.status(201).json({ message: "Event saved successfully" });

  } catch (error) {
      console.error("Error in /add/saved/event:", error);
      res.status(500).json({ error: "Internal server error" });
  }
});



app.post('/add_registration', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
      return res.status(401).json({ error: "Token missing or invalid" });
  }

  const event_id = req.body.event_id;
  if (!event_id) {
      return res.status(400).json({ error: "Missing event ID" });
  }

  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userLogin = decoded.login;
      
      const id = await get_user_id(userLogin);
      if (id === -1) {
          return res.status(404).json({ error: "User not found" });
      }

      await pool.query('INSERT INTO registration (user_id, event_id) VALUES (?, ?)', [id, event_id]);

      res.status(201).json({ message: "Registered successfully" });

  } catch (error) {
      res.status(500).json({ error: "Internal server error" });
  }
})


app.get('/get_registration', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
      return res.status(401).json({ error: "Token missing or invalid" });
  }

  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userLogin = decoded.login;

      const id = await get_user_id(userLogin);
      if (id === -1) {
          return res.status(404).json({ error: "User not found" });
      }

      const [result] = await pool.query('SELECT * FROM registration WHERE user_id = ?', [id]);

      res.status(200).json(result);

  } catch (error) {
      res.status(500).json({ error: "Internal server error" });
  }
});





app.get('/is_resgiter', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
      return res.status(401).json({ error: "Token missing or invalid" });
  }

  const event_id = req.query.event_id; 
  if (!event_id) {
      return res.status(400).json({ error: "Missing event ID" });
  }

  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userLogin = decoded.login;

      const id = await get_user_id(userLogin);
      if (id === -1) {
          return res.status(404).json({ error: "User not found" });
      }

      const [result] = await pool.query(
          'SELECT * FROM registration WHERE user_id = ? AND event_id = ?',
          [id, event_id]
      );

      return res.status(200).json({ registered: result.length > 0 });
  } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal server error" });
  }
});



app.delete('/delete_register', async (req, res) => {

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
      return res.status(401).json({ error: "Token missing or invalid" });
  }

  const event_id = req.query.event_id;
  if (!event_id) {
      return res.status(400).json({ error: "Missing event ID" });
  }

  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userLogin = decoded.login;

      const id = await get_user_id(userLogin);
      if (id === -1) {
          return res.status(404).json({ error: "User not found" });
      }

      const [result] = await pool.query(
          'DELETE FROM registration WHERE user_id = ? AND event_id = ?',
          [id, event_id]
      );

      if (result.affectedRows === 0) {
          return res.status(404).json({ error: "No registration found to delete" });
      }

      return res.status(200).json({ message: "Registration deleted successfully" });
  } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal server error" });
  }
})







router.delete('/events_delete', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Invalid token" });

  const { event_id } = req.body;
  if (!event_id) return res.status(400).json({ message: "Missing event ID" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userLogin = decoded.login;

    const isAdmin = await check_if_admin(userLogin);
    if (!isAdmin) return res.status(403).json({ message: "Not allowed to delete event" });

    const userId = await get_user_id(userLogin);
    if (userId === -1) return res.status(500).json({ message: "Internal server error" });

    await pool.query('DELETE FROM registration WHERE event_id = ?', [event_id]);

    const [result] = await pool.query(
      'DELETE FROM event WHERE event_id = ? AND user_id = ?',
      [event_id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Event not found or not owned by user" });
    }

    return res.status(200).json({ message: "Deleted successfully" });

  } catch (err) {
    console.error("Error deleting event:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});




app.post('/addevent', upload.single('image'), async (req, res) => {
  let user_id;
  let userLogin;

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json("Invalid token");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userLogin = decoded.login;

    user_id = await get_user_id(userLogin); 
    if (!user_id || user_id === 0)
      return res.status(500).json({ error: "Internal server error: user not found" });

  } catch (err) {
    console.error("JWT or user_id error:", err);
    return res.status(401).json({ error: "Invalid token" });
  }

  const isAdmin = await check_if_admin(userLogin); 
  if (!isAdmin)
    return res.status(403).json("Not allowed to add event");


  const {
    title,
    description,
    location,
    max_places,
    date,
    time
  } = req.body;

  if (
    title == null || description == null || location == null ||
    max_places == null || date == null || time == null
  ) {
    return res.status(400).json("Missing required data");
  }

  const image = req.file ? `http://13.60.16.112/uploads/${req.file.filename}` : null;
  const time24h = convert_houre(time);
  const eventDateTime = new Date(`${date}T${time24h}`);

  let conn;

  try {
    conn = await pool.getConnection();

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
    // await sendNotification(userLogin, "hello avatar");
    res.status(201).json({ message: 'Event created', event_id: insertEvent.insertId });

  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    if (conn) conn.release(); 
  }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});