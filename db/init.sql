CREATE DATABASE IF NOT EXISTS app;
USE app;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    image VARCHAR(255),
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'attendee',
    intra_login VARCHAR(50) UNIQUE,
    access_token VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS location (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    city VARCHAR(100),
    place_name VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS event (
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    location_id INT,
    event_title VARCHAR(255),
    event_description TEXT,
    event_image VARCHAR(255),
    number_places_available INT,
    duration INT,
    time DATETIME,
    event_done TINYINT(1) DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (location_id) REFERENCES location(location_id)
);

CREATE TABLE IF NOT EXISTS registration (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    event_id INT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (event_id) REFERENCES event(event_id)
);

CREATE TABLE IF NOT EXISTS saved (
    user_id INT,
    event_id INT,
    PRIMARY KEY (user_id, event_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (event_id) REFERENCES event(event_id)
);

CREATE TABLE IF NOT EXISTS feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT,
    user_id INT,
    content TEXT,
    rating INT,
    FOREIGN KEY (event_id) REFERENCES event(event_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
