const result = require('dotenv').config({path:'I:/ServersideWebDevelopments/PracticeProjects/project_5/ecommerce-1-backend-mysql/.env'});
const axios = require('axios');
const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise'); // Changed to mysql2
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const JWT_SECRET = 'yourSecretKey';
const nodemailer = require('nodemailer');
const path = require('path');

// MySQL connection pool setup
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER ,
  password: '' || process.env.DB_PASSWORD, // Use empty string if DB_PASSWORD is not set
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

//ENV chacking------------------




if (result.error) {
  console.error("⚠️ Error loading .env:", result.error); // Log errors
} else {
  console.log("✅ .env loaded:", Object.keys(result.parsed)); // List loaded vars
}

console.log("Key:", process.env.DEEPSEEK_API_KEY); // Should now show the key
//------------------------------

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const API_KEY = process.env.DEEPSEEK_API_KEY 

// Middleware setup
app.use(express.static(path.join(__dirname, 'dist/project-2-ecmz')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/project-2-ecmz/index.html'));
});
app.use(cors());
app.use(bodyParser.json());

const HTTP_PORT = process.env.PORT || 8000;
app.listen(HTTP_PORT, () => {
  console.log(`Server is running on ${HTTP_PORT}`);
});

// JWT Middleware (unchanged)
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token required' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid Token' });
    req.user = user;
    next();
  });
}

// Login route (converted to MySQL)
app.post('/login', async (req, res) => {
  const { whatsapp, password } = req.body;

  try {
    const [rows] = await pool.execute(`SELECT * FROM customer WHERE whatsapp = ?`, [whatsapp]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, whatsapp: user.whatsapp, role: user.role, name: user.firstName },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({ token });

  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: "Internal server error" });
  }
});


// Customer registration (converted to MySQL)
app.post('/api/customer/add', async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: 'No data provided' });
    }

    const {
      firstName,
      lastName,
      email,
      whatsapp,
      address,
      city,
      password
    } = req.body;

    // Role assignment
    const role = email === 'admin@example.com' ? 'admin' : 'customer';

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert query
    const sql = `
      INSERT INTO customer (firstName, lastName, email, whatsapp, address, city, password, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [firstName, lastName, email, whatsapp, address, city, hashedPassword, role];

    const [result] = await pool.execute(sql, params);

    res.status(201).json({
      message: 'Customer added successfully',
      id: result.insertId
    });

  } catch (err) {
    console.error('Add Customer Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all customers (converted)
//API Tested ✅ ,frontend connected✅
app.get('/api/customer/get',authenticateToken, async (req, res) => {
  
  if(req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const [rows] = await pool.execute('SELECT * FROM customer');
    res.json({ message: "success", data: rows });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get cakes (converted)
//API Tested ✅ ,frontend connected✅
app.get('/api/cakes/get',authenticateToken, async (req, res) => {
  if(req.user.role !== 'admin' &&  req.user.role !== 'customer') {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const [rows] = await pool.execute('SELECT * FROM cakes');
    res.json({ message: "success", data: rows });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Add cake (converted) //API Tested✅ ,frontend connected✅ 
app.post('/api/cakes/add',authenticateToken, async (req, res) => {
  if(req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const { name, description, flavor, size, price, imageUrl, available } = req.body;
    const [result] = await pool.execute(
      `INSERT INTO cakes (name, description, flavor, size, price, imageUrl, available) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, description, flavor, size, price, imageUrl, available]
    );

    res.status(201).json({
      message: "Cake added successfully",
      id: result.insertId
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete cake (converted) //API Tested✅,frontend connected✅
app.delete('/api/cakes/delete/:id',authenticateToken, async (req, res) => {
  if(req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const cakeId = parseInt(req.params.id);
    if (isNaN(cakeId)) return res.status(400).json({ error: 'Invalid cake ID' });

    const [result] = await pool.execute('DELETE FROM cakes WHERE id = ?', [cakeId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Cake not found or already deleted" });
    }

    res.status(200).json({
      message: "Cake deleted successfully",
      deletedId: cakeId
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});





// Get customer by ID //API Tested✅,frontend connected✅
app.get('/api/customer/get/:id',authenticateToken, async (req, res) => {
  if(req.user.role !== 'admin' && req.user.role !== 'customer') {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const customerId = parseInt(req.params.id);
    if (isNaN(customerId)) return res.status(400).json({ error: 'Invalid ID' });

    const [rows] = await pool.execute('SELECT * FROM customer WHERE id = ?', [customerId]);
    
    if (rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    
    res.json({ message: "success", data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get distinct flavors //API Tested✅,frontend connected✅
app.get('/api/cakes/flavors/get',authenticateToken, async (req, res) => {
  if(req.user.role !== 'admin' &&  req.user.role !== 'customer') {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const [rows] = await pool.execute('SELECT DISTINCT flavor FROM cakes');
    res.json({ message: "success", data: rows });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get cake by ID //API Tested✅,frontend connected✅
app.get('/api/cakes/get/:id',authenticateToken, async (req, res) => {
  if(req.user.role !== 'admin' &&  req.user.role !== 'customer') {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const cakeId = parseInt(req.params.id);
    if (isNaN(cakeId)) return res.status(400).json({ error: 'Invalid cake ID' });

    const [rows] = await pool.execute('SELECT * FROM cakes WHERE id = ?', [cakeId]);
    
    if (rows.length === 0) return res.status(404).json({ error: 'Cake not found' });
    
    res.json({ message: "success", data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Place order //API Tested✅,frontend connected✅
app.post('/api/order/add',authenticateToken, async (req, res) => {
  if(req.user.role !== 'customer') {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const { customerId, cakeId, quantity, status } = req.body;
    const [result] = await pool.execute(
      `INSERT INTO orders (customerId, cakeId, quantity, status) 
       VALUES (?, ?, ?, ?)`,
      [customerId, cakeId, quantity, status]
    );

    res.status(201).json({
      message: "Order added successfully",
      id: result.insertId
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all orders //API Tested✅,frontend connected✅
app.get('/api/order/get',authenticateToken, async (req, res) => {
  if(req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const [rows] = await pool.execute('SELECT * FROM orders');
    res.json({ message: "success", data: rows });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update customer //Error❌
app.patch('/api/customer/update/:id',authenticateToken, async (req, res) => {
  if(req.user.role !== 'admin' && req.user.role !== 'customer') {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const id = req.params.id;
    const updatedFields = req.body;
    const fields = Object.keys(updatedFields);
    
    if (fields.length === 0) return res.status(400).json({ message: 'No fields provided' });
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updatedFields[field]);
    values.push(id);
    
    const sql = `UPDATE customer SET ${setClause} WHERE id = ?`;
    const [result] = await pool.execute(sql, values);
    
    res.json({ message: 'Update successful', changes: result.affectedRows });
  } catch (err) {
    res.status(500).json({ message: 'Update failed' });
  }
});



//GET cake count //API Tested✅,frontend connected✅
app.get('/api/cake/count/get',authenticateToken, async (req, res) => {

  if(req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
    const sql = `SELECT COUNT(*) AS count FROM cakes`;

    try {
        const [results] = await pool.query(sql);
        res.json({
            message: "success",
            data: results
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//GET customer count //API Tested✅,frontend connected✅
app.get('/api/customer/count/get',authenticateToken, async (req, res) => {
  if(req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
    const sql = `SELECT COUNT(*) AS count FROM customer`;

    try {
        const [results] = await pool.query(sql);
        res.json({
            message: "success",
            data: results
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//GET order count //API Tested✅,frontend connected✅
app.get('/api/order/count/get',authenticateToken, async (req, res) => {
  if(req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
    const sql = `SELECT COUNT(*) AS count FROM orders`;

    try {
        const [results] = await pool.query(sql);
        res.json({
            message: "success",
            data: results
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//GET cakes by flavor //API Tested✅,frontend connected✅
app.get('/api/cake/flavored/get/:flavor',authenticateToken, async (req, res) => {
  if(req.user.role !== 'admin' &&  req.user.role !== 'customer') {
    return res.status(403).json({ message: 'Access denied' });

  }
    const flavor = req.params.flavor;

    if (!flavor) {
        return res.status(400).json({ error: 'Invalid flavor' });
    }

    try {
        const [rows] = await pool.query(`SELECT * FROM cakes WHERE flavor = ?`, [flavor]);

        res.json({
            message: "success",
            data: rows
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Place order //API Tested✅,frontend connected✅
app.post('/api/order/place',authenticateToken, async (req, res) => {
  if(req.user.role !== 'customer') {
    return res.status(403).json({ message: 'Access denied' });
  }
    const { customerId, cakeId } = req.body;

    const sql = `
        INSERT INTO orders (customerId, cakeId, quantity, status)
        VALUES (?, ?, 1, 'PENDING')
    `;

    try {
        const [result] = await pool.query(sql, [customerId, cakeId]);
        res.status(200).json({ message: 'Order created', orderId: result.insertId });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Error creating order', error: err.message });
    }
});

//GET order status
app.get('/api/order/get/:status', async (req, res) => {
    const status = req.params.status;

    try {
        // Fetch all orders with given status
        const [rows] = await pool.query(`SELECT * FROM orders WHERE status = ?`, [status]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'No orders found with the given status' });
        }

        res.json({
            message: "success",
            data: rows
        });

    } catch (err) {
        res.status(500).json({ error: "Database lookup error", details: err.message });
    }
});

//DELETE orders //API Tested✅,frontend connected✅
app.delete('/api/order/delete/:id',authenticateToken, async (req, res) => {
  if(req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
    const orderId = parseInt(req.params.id);

    if (isNaN(orderId)) {
        return res.status(400).json({ error: 'Invalid order ID' });
    }

    try {
        // Check if order exists
        const [orderCheck] = await pool.query(`SELECT * FROM orders WHERE id = ?`, [orderId]);

        if (orderCheck.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Delete the order
        const [deleteResult] = await pool.query(`DELETE FROM orders WHERE id = ?`, [orderId]);

        if (deleteResult.affectedRows === 0) {
            return res.status(404).json({ message: "Order not found or already deleted" });
        }

        res.status(200).json({
            message: "Order deleted successfully",
            deletedId: orderId
        });

    } catch (err) {
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

//UPDATE order status //API Tested✅,frontend connected✅
app.patch('/api/order/update/:id',authenticateToken, async (req, res) => {

  if(req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
    const orderId = parseInt(req.params.id);
    const { status } = req.body;

    if (isNaN(orderId)) {
        return res.status(400).json({ error: 'Invalid order ID' });
    }

    if (!status) {
        return res.status(400).json({ error: 'Status is required' });
    }

    const sql = `UPDATE orders SET status = ? WHERE id = ?`;

    try {
        const [result] = await pool.query(sql, [status, orderId]);

        res.json({
            message: 'Order updated successfully',
            changes: result.affectedRows
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Update failed', error: err.message });
    }
});

//get orders by customer //API Tested✅,frontend connected✅
app.get('/api/order/customer/get/:customerId',authenticateToken, async (req, res) => {
  if(req.user.role !== 'admin' && req.user.role !== 'customer') {
    return res.status(403).json({ message: 'Access denied' });
  }
    const customerId = parseInt(req.params.customerId);

    if (isNaN(customerId)) {
        return res.status(400).json({ error: 'Invalid customer ID' });
    }

    const sql = `SELECT * FROM orders WHERE customerId = ?`;

    try {
        const [results] = await pool.query(sql, [customerId]);
        res.json({
            message: 'success',
            data: results
        });
    } catch (err) {
        res.status(500).json({ error: 'Database lookup error', details: err.message });
    }
});

//------ AI Integrations -----------------------------------------
//Cake description generation using DeepSeek API //API Tested✅,frontend connected✅
app.post('/api/chat',authenticateToken, async (req, res) => {
  if(req.user.role !== 'admin'&& req.user.role !== 'customer') {
    return res.status(403).json({ message: 'Access denied' });
  }
  const userMessage = req.body.message;

  try {
    const response = await axios.post(DEEPSEEK_API_URL, {
      model: "deepseek-chat", // or your specific model
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: userMessage }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const botReply = response.data.choices[0].message.content;
    res.json({ reply: botReply });

  } catch (error) {
    console.error("DeepSeek API error:", error.response?.data || error.message);
    res.status(500).json({ error: 'Error fetching reply from DeepSeek API' });
  }
});