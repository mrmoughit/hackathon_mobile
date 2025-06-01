import { Router } from 'express';
import { getAccessToken, fetchData } from './oauth.js';

const router = Router();


router.get('/user', async (req, res) => {

    const token = req.headers['authorization'];
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
      } catch (error) {
        res.status(500);
        console.error('Error fetching user with events:', error);
        throw error;
      }
})


export default router;