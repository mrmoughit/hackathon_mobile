import {pool} from './db.js'

export async function create_new_user(login, img, full_name) {
    try {
      const [rows] = await pool.query('SELECT * FROM users WHERE intra_login = ?', [login]);
  
      if (rows.length === 0) {
        const query = 'INSERT INTO users (img, full_name, role, intra_login) VALUES (?, ?, ?, ?)';
        const role = 'attendee';
        await pool.query(query, [img, full_name, role, login]);
      }
    } catch (error) {
      console.error('Error checking or adding user:', error);
    }
  }
