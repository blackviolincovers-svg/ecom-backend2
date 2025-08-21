const mysql = require('mysql2/promise');

// MySQL database configuration
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'sweetbite_cakes',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create a connection pool
const pool = mysql.createPool(dbConfig);

// Function to initialize the database with tables
async function initializeDatabase() {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Create customer table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS customer (
        id INT AUTO_INCREMENT PRIMARY KEY,
        firstName VARCHAR(255) NOT NULL,
        lastName VARCHAR(255),
        email VARCHAR(255) NOT NULL,
        whatsapp VARCHAR(20),
        address TEXT,
        city VARCHAR(100),
        password TEXT NOT NULL,
        role VARCHAR(20) DEFAULT 'customer',
        UNIQUE(email)
      )
    `);

    // Insert sample customer if table was just created
    const [customerRows] = await connection.execute('SELECT COUNT(*) AS count FROM customer');
    if (customerRows[0].count === 0) {
      await connection.execute(
        `INSERT INTO customer (firstName, lastName, email, whatsapp, address, city, password, role) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ["customer1", "lastname", "testmail@gmail.com", "0761111111", "john street NY", "NY", "testpassword", "customer"]
      );
    }

    // Create cakes table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS cakes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        flavor VARCHAR(100),
        size VARCHAR(50),
        price DECIMAL(10, 2),
        imageUrl TEXT,
        available BOOLEAN DEFAULT TRUE
      )
    `);

    // Insert sample cake if table was just created
    const [cakeRows] = await connection.execute('SELECT COUNT(*) AS count FROM cakes');
    if (cakeRows[0].count === 0) {
      await connection.execute(
        `INSERT INTO cakes (name, description, flavor, size, price, imageUrl, available) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ["choco", "optional description", "choco", "1kg", 1000.00, "img.jpg", 1]
      );
    }

    // Create orders table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customerId INT,
        cakeId INT,
        quantity INT DEFAULT 1,
        status VARCHAR(50),
        FOREIGN KEY (customerId) REFERENCES customer(id) ON DELETE CASCADE,
        FOREIGN KEY (cakeId) REFERENCES cakes(id) ON DELETE CASCADE
      )
    `);

    // Insert sample order if table was just created
    const [orderRows] = await connection.execute('SELECT COUNT(*) AS count FROM orders');
    if (orderRows[0].count === 0) {
      await connection.execute(
        `INSERT INTO orders (customerId, cakeId, quantity, status) 
         VALUES (?, ?, ?, ?)`,
        [1, 1, 2, 'delivered']
      );
    }

    console.log('Database tables initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err.message);
  } finally {
    if (connection) connection.release();
  }
}

// Initialize the database when this module is loaded
initializeDatabase();

// Export the connection pool
module.exports = pool;