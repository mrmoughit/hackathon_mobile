import { Router, response } from 'express';
import multer from 'multer';
import path from 'path';
import { pool } from './db.js';
import jwt from 'jsonwebtoken';
import { create_new_user, convert_houre, check_if_admin, get_user_id } from './help.js'

const user_router = Router();

user_router.get('/user', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token)
        return res.status(401).json("invalid token");

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userLogin = decoded.login;

        const [userRows] = await pool.query('SELECT * FROM users WHERE intra_login = ?', [userLogin]);
        if (userRows.length === 0) return res.status(404).json("User not found");

        const result = userRows[0];

        if (result.role === 'admin' || result.role === 'organizer') {
            const [events] = await pool.query('SELECT * FROM event WHERE user_id = ?', [result.id]);

            for (const event of events) {
                const [locations] = await pool.query('SELECT * FROM location WHERE location_id = ?', [event.location_id]);
                event.location = locations.length > 0 ? locations[0] : null;


                const [feedbacks] = await pool.query('SELECT * FROM feedback WHERE event_id = ?', [event.event_id]);
                event.feedbacks = feedbacks;
                const [registrationCountRows] = await pool.query('SELECT COUNT(*) AS count FROM registration WHERE event_id = ?', [event.event_id]);
                event.registration_count = registrationCountRows[0].count;
            }

            result.events = events;
        }

        console.log(result);
        res.status(200).json(result);

    } catch (error) {
        console.error('Error fetching user with events:', error);
        res.status(500).json("Internal Server Error");
    }
});





user_router.get('/get/saved/event', async (req, res) => {
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

        const [rows] = await pool.query(`
            SELECT 
                e.event_id,
                e.event_title,
                e.time,
                e.number_places_available,
                e.duration,
                e.event_description,
                e.event_image,
                l.location_id,
                l.city,
                l.place_name
            FROM saved s
            JOIN event e ON s.event_id = e.event_id
            JOIN location l ON e.location_id = l.location_id
            WHERE s.user_id = ?
        `, [id]);

        // Format the result to embed location into each event object
        const events = rows.map(row => ({
            event_id: row.event_id,
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
            }
        }));

        res.status(200).json(events);

    } catch (error) {
        console.error("Error in /get/saved/event:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});





user_router.get('/is_saved', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Token missing or invalid" });
    }

    const event_id = req.query.event_id; 

    if (!event_id) return res.status(400).json({ error: "Missing event ID" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userLogin = decoded.login;

        const id = await get_user_id(userLogin);
        if (id === -1) {
            return res.status(404).json({ error: "User not found" });
        }

        const [rows] = await pool.query('SELECT 1 FROM saved WHERE user_id = ? AND event_id = ?', [id, event_id]);
        
        const is_registered = rows.length > 0;

        res.status(200).json({ is_registered });

    } catch (error) {
        console.error("Error in /check/registered/event:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


  











export default user_router;
