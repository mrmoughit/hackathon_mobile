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



  export function convert_houre(timeString) {
    const amPmMatch = timeString.match(/\s?(AM|PM)$/i);

    if (amPmMatch) {
        const [time, modifier] = timeString.split(" ");

        let [hours, minutes] = time.split(":").map(Number);

        if (modifier.toUpperCase() === 'PM' && hours !== 12) {
            hours += 12;
        }
        if (modifier.toUpperCase() === 'AM' && hours === 12) {
            hours = 0;
        }

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    } else {

        const timeParts = timeString.split(":");
        if (timeParts.length !== 2) {
            throw new Error(`Invalid time format: "${timeString}"`);
        }

        let [hours, minutes] = timeParts.map(Number);

        if (
            isNaN(hours) || isNaN(minutes) ||
            hours < 0 || hours > 23 ||
            minutes < 0 || minutes > 59
        ) {
            throw new Error(`Invalid time format: "${timeString}"`);
        }

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
}




  export async function check_if_admin(login) {
    try {
      const query = "SELECT role FROM users WHERE intra_login = ?";
      const [rows] = await pool.query(query, [login]);
  
      if (rows.length === 0) {
        return false;
      }
  
      const role = rows[0].role;
      return role === "admin" || role === "organizer";
    } catch (error) {
      console.error("Error checking admin:", error);
      return false;
    }
  }



  export async function get_user_id(login) {
    try {
      const query = "SELECT id FROM users WHERE intra_login = ?";
      const [rows] = await pool.query(query, [login]);
  
      const id = rows[0].id;
  
      return id;
    } catch (error) {
      console.error("Error checking admin:", error);
      return -1;
    }
  }


