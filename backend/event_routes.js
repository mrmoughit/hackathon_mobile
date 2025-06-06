import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import {pool} from './db.js';
import jwt from 'jsonwebtoken';
import { create_new_user  , convert_houre , check_if_admin , get_user_id} from './help.js'
import { Server } from 'socket.io';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';


const router = Router();


// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, '/var/www/html/uploads');
//   },
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + '-' + file.originalname);
//   }
// });

// const upload = multer({ storage });


// router.get('/events', async (req, res) => {


//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1];

  
//   if (!token)
//     return res.status(401).json("invalid token");
//   try {
//       const decoded = jwt.verify(token, process.env.JWT_SECRET);
//       const login = decoded.login;
//   } catch (err) {
//     return res.status(401).json({ error: "Invalid token" });
//   }

//   try {
//       const [rows] = await pool.query(`
//           SELECT 
//               e.event_id,
//               e.user_id,
//               e.event_title,
//               e.time,
//               e.number_places_available,
//               e.duration,
//               e.event_description,
//               e.event_image,
//               l.location_id,
//               l.city,
//               l.place_name,
//               COUNT(r.id) AS number_of_registrations
//           FROM event e
//           LEFT JOIN location l ON e.location_id = l.location_id
//           LEFT JOIN registration r ON e.event_id = r.event_id
//           GROUP BY e.event_id
//       `);

//       const events = rows.map(row => ({
//           event_id: row.event_id,
//           user_id: row.user_id,
//           event_title: row.event_title,
//           time: row.time,
//           number_places_available: row.number_places_available,
//           duration: row.duration,
//           event_description: row.event_description,
//           event_image: row.event_image,
//           location: {
//               location_id: row.location_id,
//               city: row.city,
//               place_name: row.place_name
//           },
//           number_of_registrations: row.number_of_registrations
//       }));

//       res.json(events);
//   } catch (err) {
//       console.error(err);
//       res.status(500).json({ error: 'Internal server error' });
//   }
// });








// router.put('/events/Edit', upload.single('image'), async (req, res) => {
//   let conn;
//   try {
//     const authHeader = req.headers['authorization'];
//     const token = authHeader && authHeader.split(' ')[1];
//     if (!token) return res.status(401).json({ message: "Invalid token" });

//     const {
//       title,
//       description,
//       location,
//       max_places,
//       date, 
//       time,  
//       event_id
//     } = req.body;

//     if (
//       event_id == null || title == null || description == null || location == null ||
//       max_places == null || date == null || time == null
//     ) {
//       return res.status(400).json({ message: "Missing required data" });
//     }

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const userLogin = decoded.login;

//     const isAdmin = await check_if_admin(userLogin);
//     if (!isAdmin) return res.status(403).json({ message: "Not allowed to edit event" });

//     const userId = await get_user_id(userLogin);
//     if (userId === -1) return res.status(500).json({ message: "Internal server error" });

//     conn = await pool.getConnection();

//     const [locationRows] = await conn.execute(
//       'SELECT location_id FROM location WHERE place_name = ?',
//       [location]
//     );

//     let location_id;
//     if (locationRows.length > 0) {
//       location_id = locationRows[0].location_id;
//     } else {
//       const [insertLocation] = await conn.execute(
//         'INSERT INTO location (place_name) VALUES (?)',
//         [location]
//       );
//       location_id = insertLocation.insertId;
//     }


//     const time24h = convert_houre(time);
//     const eventDateTime = new Date(`${date}T${time24h}`);

//     if (isNaN(eventDateTime.getTime())) {
//       return res.status(400).json({ message: "Invalid date or time format" });
//     }


//     const imageUrl = req.file ? `http://13.60.16.112/uploads/${req.file.filename}` : null;


//     let query = `
//       UPDATE event
//       SET event_title = ?, event_description = ?, location_id = ?, number_places_available = ?, duration = ?, time = ?
//     `;
//     const params = [title, description, location_id, max_places, 60, eventDateTime];

//     if (imageUrl) {
//       query += `, event_image = ?`;
//       params.push(imageUrl);
//     }

//     query += ` WHERE event_id = ? AND user_id = ?`;
//     params.push(event_id, userId);

//     await conn.execute(query, params);

//     return res.status(200).json({ message: "Event updated successfully" });

//   } catch (err) {
//     console.error("Error editing event:", err);
//     return res.status(500).json({ message: "Internal server error" });
//   } finally {
//     if (conn) conn.release();
//   }
// });

















export default router;