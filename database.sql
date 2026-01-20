CREATE DATABASE booking_db;

USE booking_db;

-- 创建预约表
CREATE TABLE bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    phone VARCHAR(20),
    ip VARCHAR(50),
    city VARCHAR(50),
    timestamp DATETIME,
    userAgent TEXT,
    os VARCHAR(50),
    device VARCHAR(50),
    brand VARCHAR(50)
);
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(100) NOT NULL
);

