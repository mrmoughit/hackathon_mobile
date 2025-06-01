import { Router } from 'express';
import multer from 'multer';
import path from 'path';
const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/var/www/html/uploads');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });



router.post('/addevent', upload.single('image'), async (req, res) => {
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

    res.status(201).json({ message: 'Event created', event_id: insertEvent.insertId });

  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    if (conn) conn.release(); 
  }
});


router.get('/events', async (req, res) => {

  // const authHeader = req.headers['authorization'];
  // const token = authHeader && authHeader.split(' ')[1];
  // if (!token)
  //   return res.status(401).json("invalid token");
  // try {
  //   const decoded = jwt.verify(token, process.env.JWT_SECRET);
  //   const login = decoded.login;
  // } catch (err) {
  //   return res.status(401).json({ error: "Invalid token" });
  // }

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


export default router;