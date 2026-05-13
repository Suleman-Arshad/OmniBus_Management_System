const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ─── DATABASE CONNECTION ──────────────────────────────────────────────────────
const conn = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 12639,
  ssl: {
    rejectUnauthorized: false // Aiven ke liye zaroori hai
  }
});

conn.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
    return;
  }
  console.log('Connected to Aiven MySQL as id ' + conn.threadId);
});

// Helper: reset AUTO_INCREMENT
function resetAutoIncrement(table, idColumn) {
  return new Promise((resolve) => {
    conn.query(`SELECT MAX(${idColumn}) as maxId FROM ${table}`, (err, rows) => {
      if (err || !rows[0] || !rows[0].maxId) return resolve();
      const nextId = parseInt(rows[0].maxId) + 1;
      conn.query(`ALTER TABLE ${table} AUTO_INCREMENT = ${nextId}`, () => resolve());
    });
  });
}

// ─── AUTHENTICATION ───────────────────────────────────────────────────────────
app.post('/api/auth/signup', (req, res) => {
  const { Username, Password } = req.body;
  if (!Username || !Password) return res.status(400).json({ error: 'Username and password required' });
  conn.query('INSERT INTO admin (Username, Password) VALUES (?, ?)', [Username, Password], (err, r) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Username already exists' });
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Signup successful' });
  });
});

app.post('/api/auth/login', (req, res) => {
  const { Username, Password } = req.body;
  if (!Username || !Password) return res.status(400).json({ error: 'Username and password required' });
  conn.query('SELECT * FROM admin WHERE Username = ? AND Password = ?', [Username, Password], (err, r) => {
    if (err) return res.status(500).json({ error: err.message });
    if (r.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ message: 'Login successful', username: Username });
  });
});

// ─── PASSENGERS ──────────────────────────────────────────────────────────────
app.get('/api/passengers', (req, res) => {
  conn.query('SELECT * FROM passenger', (err, r) => err ? res.status(500).json({ error: err.message }) : res.json(r));
});

app.post('/api/passengers', async (req, res) => {
  const { PassengerID, FirstName, LastName, Email, Phone, CNIC, DateOfBirth, Password } = req.body;
  conn.query('INSERT INTO passenger VALUES (?,?,?,?,?,?,?,?)', [PassengerID || null, FirstName, LastName, Email, Phone, CNIC, DateOfBirth, Password],
    async (err, r) => {
      if (err) return res.status(500).json({ error: err.message });
      await resetAutoIncrement('passenger', 'PassengerID');
      res.json({ message: 'Passenger created', id: r.insertId });
    });
});

// ─── BUSES & SEATS ───────────────────────────────────────────────────────────
app.get('/api/buses', (req, res) => {
  conn.query(`SELECT b.*, bc.Name as DriverName, hc.Name as HostessName 
              FROM bus b 
              LEFT JOIN buscrew bc ON b.OperatorID = bc.OperatorID 
              LEFT JOIN buscrew hc ON b.HostessID = hc.OperatorID`, (err, r) => err ? res.status(500).json({ error: err.message }) : res.json(r));
});

app.post('/api/buses', async (req, res) => {
  const { BusID, BusNumber, TotalSeats, OperatorID, HostessID } = req.body;
  conn.query('INSERT INTO bus (BusID, BusNumber, TotalSeats, OperatorID, HostessID) VALUES (?,?,?,?,?)', [BusID || null, BusNumber, TotalSeats, OperatorID || null, HostessID || null],
    async (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      const actualBusId = BusID || result.insertId;
      const totalSeats = parseInt(TotalSeats) || 0;
      if (totalSeats > 0) {
        const seatValues = [];
        for (let i = 1; i <= totalSeats; i++) {
          seatValues.push([null, actualBusId, `Seat-${i}`, 'Standard', 'Available']);
        }
        conn.query('INSERT INTO seat (SeatID, BusID, SeatNumber, SeatType, SeatStatus) VALUES ?', [seatValues]);
      }
      await resetAutoIncrement('bus', 'BusID');
      res.json({ message: 'Bus created', id: actualBusId });
    });
});

// ─── ROUTES & TRIPS ──────────────────────────────────────────────────────────
app.get('/api/routes', (req, res) => {
  conn.query('SELECT * FROM route', (err, r) => err ? res.status(500).json({ error: err.message }) : res.json(r));
});

app.get('/api/trips', (req, res) => {
  conn.query(`SELECT t.*, b.BusNumber, r.SourceCity, r.DestinationCity 
              FROM trip t 
              LEFT JOIN bus b ON t.BusID = b.BusID 
              LEFT JOIN route r ON t.RouteID = r.RouteID`, (err, r) => err ? res.status(500).json({ error: err.message }) : res.json(r));
});

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const queries = {
    passengers: 'SELECT COUNT(*) as count FROM passenger',
    buses: 'SELECT COUNT(*) as count FROM bus',
    trips: 'SELECT COUNT(*) as count FROM trip',
    bookings: 'SELECT COUNT(*) as count FROM booking',
    revenue: 'SELECT COALESCE(SUM(PaymentAmount),0) as total FROM payment WHERE PaymentStatus="Completed"',
    pendingBookings: 'SELECT COUNT(*) as count FROM booking WHERE BookingStatus="Pending"'
  };
  const results = {};
  let done = 0;
  const keys = Object.keys(queries);
  keys.forEach(key => {
    conn.query(queries[key], (err, r) => {
      if (!err && r.length > 0) results[key] = r[0].count ?? r[0].total;
      if (++done === keys.length) res.json(results);
    });
  });
});

// Server Listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});