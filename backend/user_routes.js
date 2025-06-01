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
        // console.log(result);
    } catch (error) {
        res.status(500);
        console.error('Error fetching user with events:', error);
        throw error;
    }
})




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
            return res.status(500).json({ error: "User not found" });
        }

        const [events] = await pool.query('SELECT * FROM event WHERE user_id = ?', [id]);
        res.status(200).json(events);

    } catch (error) {
        console.error("Error in /get/saved/event:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});




user_router.post('/add/saved/event', async (req, res) => {
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


user_router.post('/add_registration', async (req, res) => {
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


user_router.get('/get_registration', async (req, res) => {
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





user_router.get('/is_resgiter', async (req, res) => {
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

        return res.status(200).json({ registered: result.length < 0 });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal server error" });
    }
});



user_router.delete('/delete_register', async (req, res) => {

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



export default user_router;
