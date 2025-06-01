import {pool} from './db.js'

export async function create_new_user(login, img, full_name) {
    try {
      const [rows] = await pool.query('SELECT * FROM users WHERE intra_login = ?', [login]);
  
      if (rows.length === 0) {
        const query = 'INSERT INTO users (image, full_name, role, intra_login) VALUES (?, ?, ?, ?)';
        const role = 'attendee';
        await pool.query(query, [img, full_name, role, login]);
      }
    } catch (error) {
      console.error('Error checking or adding user:', error);
    }
  }



 export function convert_houre(time12h) {
    const [time, modifier] = time12h.split(' '); 
    let [hours, minutes] = time.split(':').map(Number);
  
    if (modifier.toUpperCase() === 'PM' && hours !== 12) {
      hours += 12;
    }
    if (modifier.toUpperCase() === 'AM' && hours === 12) {
      hours = 0;
    }
  
    const hoursStr = hours.toString().padStart(2, '0');
    const minutesStr = minutes.toString().padStart(2, '0');
  
    return `${hoursStr}:${minutesStr}:00`;
  }
  