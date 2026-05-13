const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const conn = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 12639,
  ssl: {
    rejectUnauthorized: false // Required for Aiven Cloud
  }
});

conn.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
    return;
  }
  console.log('Connected to Aiven MySQL as id ' + conn.threadId);
});

// Helper: reset AUTO_INCREMENT to MAX(id)+1 after manual ID inserts
function resetAutoIncrement(table, idColumn) {
  return new Promise((resolve) => {
    conn.query(`SELECT MAX(${idColumn}) as maxId FROM ${table}`, (err, rows) => {
      if (err || !rows[0].maxId) return resolve();
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
app.get('/api/passengers/:id', (req, res) => {
  conn.query('SELECT * FROM passenger WHERE PassengerID = ?', [req.params.id], (err, r) => err ? res.status(500).json({ error: err.message }) : res.json(r[0]));
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
app.put('/api/passengers/:id', (req, res) => {
  const { FirstName, LastName, Email, Phone, CNIC, DateOfBirth } = req.body;
  conn.query('UPDATE passenger SET FirstName=?, LastName=?, Email=?, Phone=?, CNIC=?, DateOfBirth=? WHERE PassengerID=?',
    [FirstName, LastName, Email, Phone, CNIC, DateOfBirth, req.params.id],
    (err) => err ? res.status(500).json({ error: err.message }) : res.json({ message: 'Updated' }));
});
app.delete('/api/passengers/:id', (req, res) => {
  conn.query('DELETE FROM passenger WHERE PassengerID=?', [req.params.id], (err) => err ? res.status(500).json({ error: err.message }) : res.json({ message: 'Deleted' }));
});

// ─── BUS TYPES ────────────────────────────────────────────────────────────────
app.post('/api/bustypes', (req, res) => {
  const { BusID, CategoryName } = req.body;
  conn.query('INSERT IGNORE INTO bustype VALUES (?,?)', [BusID, CategoryName],
    (err) => err ? res.status(500).json({ error: err.message }) : res.json({ message: 'BusType added' }));
});
app.delete('/api/bustypes/:busId', (req, res) => {
  conn.query('DELETE FROM bustype WHERE BusID=?', [req.params.busId],
    (err) => err ? res.status(500).json({ error: err.message }) : res.json({ message: 'BusTypes cleared' }));
});

// ─── BUSES ───────────────────────────────────────────────────────────────────
app.get('/api/buses', (req, res) => {
  conn.query(`SELECT b.*, bc.Name as DriverName, hc.Name as HostessName, GROUP_CONCAT(bt.CategoryName ORDER BY bt.CategoryName) as Types
              FROM bus b
              LEFT JOIN buscrew bc ON b.OperatorID = bc.OperatorID
              LEFT JOIN buscrew hc ON b.HostessID = hc.OperatorID
              LEFT JOIN bustype bt ON b.BusID = bt.BusID
              GROUP BY b.BusID`, (err, r) => err ? res.status(500).json({ error: err.message }) : res.json(r));
});
app.post('/api/buses', async (req, res) => {
  const { BusID, BusNumber, TotalSeats, OperatorID, HostessID, Types } = req.body;
  conn.query('INSERT INTO bus (BusID, BusNumber, TotalSeats, OperatorID, HostessID) VALUES (?,?,?,?,?)', [BusID || null, BusNumber, TotalSeats, OperatorID || null, HostessID || null],
    async (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      // FIX 3: Auto-generate Seat rows for the new bus
      const actualBusId = BusID || result.insertId;
      const totalSeats = parseInt(TotalSeats) || 0;
      if (totalSeats > 0) {
        const seatValues = [];
        const windowCount = Math.round(totalSeats * 0.2);
        const frontCount = Math.round(totalSeats * 0.2);
        const backCount = Math.round(totalSeats * 0.2);
        
        for (let i = 1; i <= totalSeats; i++) {
          let seatType = 'Standard';
          if (i <= frontCount) {
             seatType = 'Front Seat';
          } else if (i <= frontCount + windowCount) {
             seatType = 'Window Seat';
          } else if (i <= frontCount + windowCount + backCount) {
             seatType = 'Back Seat';
          }
          seatValues.push([null, actualBusId, `Seat-${i}`, seatType, 'Available']);
        }
        conn.query('INSERT INTO seat (SeatID, BusID, SeatNumber, SeatType, SeatStatus) VALUES ?',
          [seatValues], (seatErr) => {
            if (seatErr) console.error('Seat generation error:', seatErr.message);
          });
      }
      await resetAutoIncrement('bus', 'BusID');
      res.json({ message: 'Bus created', id: actualBusId });
    });
});
app.put('/api/buses/:id', (req, res) => {
  const { BusNumber, TotalSeats, OperatorID, HostessID } = req.body;
  conn.query('UPDATE bus SET BusNumber=?, TotalSeats=?, OperatorID=?, HostessID=? WHERE BusID=?',
    [BusNumber, TotalSeats, OperatorID || null, HostessID || null, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Updated' });
    });
});
app.delete('/api/buses/:id', (req, res) => {
  conn.query('DELETE FROM bus WHERE BusID=?', [req.params.id], (err) => err ? res.status(500).json({ error: err.message }) : res.json({ message: 'Deleted' }));
});

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.get('/api/routes', (req, res) => {
  conn.query('SELECT * FROM Route', (err, r) => err ? res.status(500).json({ error: err.message }) : res.json(r));
});
app.post('/api/routes', async (req, res) => {
  const { RouteID, SourceCity, DestinationCity, Distance, EstimatedDuration } = req.body;
  conn.query('INSERT INTO route VALUES (?,?,?,?,?)', [RouteID || null, SourceCity, DestinationCity, Distance, EstimatedDuration],
    async (err) => {
      if (err) return res.status(500).json({ error: err.message });
      await resetAutoIncrement('route', 'RouteID');
      res.json({ message: 'Route created' });
    });
});
app.put('/api/routes/:id', (req, res) => {
  const { SourceCity, DestinationCity, Distance, EstimatedDuration } = req.body;
  conn.query('UPDATE route SET SourceCity=?, DestinationCity=?, Distance=?, EstimatedDuration=? WHERE RouteID=?',
    [SourceCity, DestinationCity, Distance, EstimatedDuration, req.params.id],
    (err) => err ? res.status(500).json({ error: err.message }) : res.json({ message: 'Updated' }));
});
app.delete('/api/routes/:id', (req, res) => {
  conn.query('DELETE FROM route WHERE RouteID=?', [req.params.id], (err) => err ? res.status(500).json({ error: err.message }) : res.json({ message: 'Deleted' }));
});

// ─── TRIPS ───────────────────────────────────────────────────────────────────
app.get('/api/trips', (req, res) => {
  conn.query(`SELECT t.*, b.BusNumber, r.SourceCity, r.DestinationCity
              FROM Trip t
              LEFT JOIN bus b ON t.BusID = b.BusID
              LEFT JOIN route r ON t.RouteID = r.RouteID`, (err, r) => err ? res.status(500).json({ error: err.message }) : res.json(r));
});
app.post('/api/trips', async (req, res) => {
  const { TripID, BusID, RouteID, DepartureDate, DepartureTime, ArrivalTime, Fare } = req.body;
  conn.query('INSERT INTO trip VALUES (?,?,?,?,?,?,?)', [TripID || null, BusID, RouteID, DepartureDate, DepartureTime, ArrivalTime, Fare],
    async (err) => {
      if (err) return res.status(500).json({ error: err.message });
      await resetAutoIncrement('trip', 'TripID');
      res.json({ message: 'Trip created' });
    });
});
app.put('/api/trips/:id', (req, res) => {
  const { BusID, RouteID, DepartureDate, DepartureTime, ArrivalTime, Fare } = req.body;
  conn.query('UPDATE trip SET BusID=?, RouteID=?, DepartureDate=?, DepartureTime=?, ArrivalTime=?, Fare=? WHERE TripID=?',
    [BusID, RouteID, DepartureDate, DepartureTime, ArrivalTime, Fare, req.params.id],
    (err) => err ? res.status(500).json({ error: err.message }) : res.json({ message: 'Updated' }));
});
app.delete('/api/trips/:id', (req, res) => {
  conn.query('DELETE FROM trip WHERE TripID=?', [req.params.id], (err) => err ? res.status(500).json({ error: err.message }) : res.json({ message: 'Deleted' }));
});

// ─── PL/SQL: STORED PROCEDURE ENDPOINTS ──────────────────────────────────────
app.get('/api/trips/:id/revenue', (req, res) => {
  conn.query('CALL GetTripRevenue(?, @total)', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    conn.query('SELECT @total AS TotalRevenue', (err2, results) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ TripID: req.params.id, Revenue: results[0].TotalRevenue });
    });
  });
});

// ─── BOOKINGS ─────────────────────────────────────────────────────────────────
app.get('/api/bookings', (req, res) => {
  conn.query(`SELECT bk.*, CONCAT(p.FirstName,' ',p.LastName) as PassengerName,
              r.SourceCity, r.DestinationCity, t.DepartureDate
              FROM Booking bk
              LEFT JOIN passenger p ON bk.PassengerID = p.PassengerID
              LEFT JOIN trip t ON bk.TripID = t.TripID
              LEFT JOIN route r ON t.RouteID = r.RouteID`, (err, r) => err ? res.status(500).json({ error: err.message }) : res.json(r));
});
app.post('/api/bookings', async (req, res) => {
  const { BookingID, PassengerID, TripID, TotalAmount, BookingStatus } = req.body;
  conn.query('INSERT INTO booking (BookingID, PassengerID, TripID, TotalAmount, BookingStatus) VALUES (?,?,?,?,?)',
    [BookingID || null, PassengerID, TripID, TotalAmount, BookingStatus || 'Pending'],
    async (err) => {
      if (err) return res.status(500).json({ error: err.message });
      await resetAutoIncrement('booking', 'BookingID');
      res.json({ message: 'Booking created' });
    });
});
app.put('/api/bookings/:id', (req, res) => {
  const { PassengerID, TripID, TotalAmount, BookingStatus } = req.body;
  conn.query('UPDATE booking SET PassengerID=?, TripID=?, TotalAmount=?, BookingStatus=? WHERE BookingID=?',
    [PassengerID, TripID, TotalAmount, BookingStatus, req.params.id],
    (err) => err ? res.status(500).json({ error: err.message }) : res.json({ message: 'Updated' }));
});
app.delete('/api/bookings/:id', (req, res) => {
  conn.query('DELETE FROM booking WHERE BookingID=?', [req.params.id], (err) => err ? res.status(500).json({ error: err.message }) : res.json({ message: 'Deleted' }));
});

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────
app.get('/api/payments', (req, res) => {
  conn.query(`SELECT py.*, bk.TotalAmount, bk.BookingStatus,
              CONCAT(p.FirstName,' ',p.LastName) as PassengerName
              FROM payment py
              LEFT JOIN booking bk ON py.BookingID = bk.BookingID
              LEFT JOIN passenger p ON bk.PassengerID = p.PassengerID`, (err, r) => err ? res.status(500).json({ error: err.message }) : res.json(r));
});
app.post('/api/payments', async (req, res) => {
  const { PaymentID, BookingID, PaymentMethod, PaymentAmount, PaymentStatus } = req.body;
  conn.query('INSERT INTO payment (PaymentID, BookingID, PaymentMethod, PaymentAmount, PaymentStatus) VALUES (?,?,?,?,?)',
    [PaymentID || null, BookingID, PaymentMethod, PaymentAmount, PaymentStatus || 'Pending'],
    async (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Auto-update booking status based on payment status
      let bookingStatus = 'Pending';
      if (PaymentStatus === 'Completed') bookingStatus = 'Confirmed';
      else if (PaymentStatus === 'Failed') bookingStatus = 'Cancelled';
      
      conn.query('UPDATE booking SET BookingStatus = ? WHERE BookingID = ?', [bookingStatus, BookingID], (updErr) => {
        if (updErr) console.error('Booking status sync error:', updErr.message);
      });

      await resetAutoIncrement('payment', 'PaymentID');
      res.json({ message: 'Payment recorded' });
    });
});
app.put('/api/payments/:id', (req, res) => {
  const { PaymentMethod, PaymentAmount, PaymentStatus } = req.body;
  conn.query('UPDATE payment SET PaymentMethod=?, PaymentAmount=?, PaymentStatus=? WHERE PaymentID=?',
    [PaymentMethod, PaymentAmount, PaymentStatus, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Sync with Booking status
      conn.query('SELECT BookingID FROM payment WHERE PaymentID = ?', [req.params.id], (errB, rows) => {
        if (!errB && rows.length > 0) {
          const bId = rows[0].BookingID;
          let bStatus = 'Pending';
          if (PaymentStatus === 'Completed') bStatus = 'Confirmed';
          else if (PaymentStatus === 'Failed') bStatus = 'Cancelled';
          
          conn.query('UPDATE booking SET BookingStatus = ? WHERE BookingID = ?', [bStatus, bId]);
        }
      });

      res.json({ message: 'Updated' });
    });
});
app.delete('/api/payments/:id', (req, res) => {
  conn.query('DELETE FROM payment WHERE PaymentID=?', [req.params.id], (err) => err ? res.status(500).json({ error: err.message }) : res.json({ message: 'Deleted' }));
});

// ─── STAFF (BusCrew) ──────────────────────────────────────────────────────────
app.get('/api/staff', (req, res) => {
  conn.query(`SELECT bc.*,
    d.LicenseNumber as DriverLicense, d.ExperienceYears,
    ss.LicenseNumber as SecurityLicense,
    a.ServiceLevel,
    h.LanguagesKnown,
    CASE
      WHEN d.OperatorID IS NOT NULL THEN 'Driver'
      WHEN ss.OperatorID IS NOT NULL THEN 'Security'
      WHEN a.OperatorID IS NOT NULL THEN 'Attendant'
      WHEN h.OperatorID IS NOT NULL THEN 'Hostess'
      ELSE 'Staff'
    END as Role
    FROM buscrew bc
    LEFT JOIN driver d ON bc.OperatorID = d.OperatorID
    LEFT JOIN securitystaff ss ON bc.OperatorID = ss.OperatorID
    LEFT JOIN attendant a ON bc.OperatorID = a.OperatorID
    LEFT JOIN hostess h ON bc.OperatorID = h.OperatorID`, (err, r) => err ? res.status(500).json({ error: err.message }) : res.json(r));
});
// server.js mein Staff post route ko update karein
app.post('/api/staff', async (req, res) => {
  const { OperatorID, Name, PhoneNumber, Address, Role, LicenseNumber, SLicenseNumber, ExperienceYears, ServiceLevel, Languages } = req.body;

  conn.query('INSERT INTO buscrew (OperatorID, Name, PhoneNumber, Address) VALUES (?,?,?,?)',
    [OperatorID || null, Name, PhoneNumber, Address], async (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      await resetAutoIncrement('buscrew', 'OperatorID');
      const actualOpId = OperatorID || result.insertId;

      if (Role === 'Driver') {
        // Driver.LicenseNumber gets the driver license
        conn.query('INSERT INTO driver (OperatorID, LicenseNumber, ExperienceYears) VALUES (?,?,?)',
          [actualOpId, LicenseNumber, ExperienceYears],
          (err2) => { if (err2) return res.status(500).json({ error: err2.message }); res.json({ message: 'Staff added successfully' }); });

      } else if (Role === 'Hostess') {
        conn.query('INSERT INTO hostess (OperatorID, LanguagesKnown) VALUES (?,?)', [actualOpId, Languages || ''], (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ message: 'Staff added successfully' });
        });

      } else if (Role === 'Security') {
        // FIX 2: SecurityStaff.LicenseNumber gets SLicenseNumber (the security-specific field)
        conn.query('INSERT INTO securitystaff (OperatorID, LicenseNumber) VALUES (?,?)',
          [actualOpId, SLicenseNumber],
          (err2) => { if (err2) return res.status(500).json({ error: err2.message }); res.json({ message: 'Staff added successfully' }); });

      } else if (Role === 'Attendant') {
        conn.query('INSERT INTO attendant (OperatorID, ServiceLevel) VALUES (?,?)',
          [actualOpId, ServiceLevel],
          (err2) => { if (err2) return res.status(500).json({ error: err2.message }); res.json({ message: 'Staff added successfully' }); });

      } else {
        res.json({ message: 'Staff added successfully' });
      }
    });
});
app.put('/api/staff/:id', (req, res) => {
  const { Name, PhoneNumber, Address, Role, LicenseNumber, SLicenseNumber, ExperienceYears, ServiceLevel, Languages } = req.body;
  const operatorID = req.params.id;

  conn.query('UPDATE buscrew SET Name=?, PhoneNumber=?, Address=? WHERE OperatorID=?',
    [Name, PhoneNumber, Address, operatorID],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });

      if (Role === 'Driver') {
        conn.query('UPDATE driver SET LicenseNumber=?, ExperienceYears=? WHERE OperatorID=?', [LicenseNumber, ExperienceYears, operatorID], (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ message: 'Updated' });
        });
      } else if (Role === 'Hostess') {
        conn.query('UPDATE hostess SET LanguagesKnown=? WHERE OperatorID=?', [Languages || '', operatorID], (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ message: 'Updated' });
        });
      } else if (Role === 'Security') {
        conn.query('UPDATE securitystaff SET LicenseNumber=? WHERE OperatorID=?', [SLicenseNumber, operatorID], (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ message: 'Updated' });
        });
      } else if (Role === 'Attendant') {
        conn.query('UPDATE attendant SET ServiceLevel=? WHERE OperatorID=?', [ServiceLevel, operatorID], (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ message: 'Updated' });
        });
      } else {
        res.json({ message: 'Updated' });
      }
    });
});
app.delete('/api/staff/:id', (req, res) => {
  conn.query('DELETE FROM buscrew WHERE OperatorID=?', [req.params.id], (err) => err ? res.status(500).json({ error: err.message }) : res.json({ message: 'Deleted' }));
});

// ─── SEATS ───────────────────────────────────────────────────────────────────
app.get('/api/seats', (req, res) => {
  const { bookingId } = req.query;
  if (bookingId) {
    const q = `
      SELECT s.*, b.BusNumber 
      FROM seat s 
      JOIN bus b ON s.BusID = b.BusID 
      JOIN trip t ON b.BusID = t.BusID 
      JOIN booking bk ON t.TripID = bk.TripID 
      WHERE bk.BookingID = ? AND s.SeatStatus = 'Available'`;
    conn.query(q, [bookingId], (err, r) => err ? res.status(500).json({ error: err.message }) : res.json(r));
  } else {
    conn.query(`SELECT s.*, b.BusNumber FROM seat s LEFT JOIN bus b ON s.BusID = b.BusID WHERE s.SeatStatus = 'Available'`, (err, r) => err ? res.status(500).json({ error: err.message }) : res.json(r));
  }
});

// ─── TICKETS ─────────────────────────────────────────────────────────────────
app.get('/api/tickets', (req, res) => {
  conn.query(`SELECT tk.*, s.SeatNumber, b.BusNumber,
              CONCAT(p.FirstName,' ',p.LastName) as PassengerName,
              r.SourceCity, r.DestinationCity
              FROM ticket tk
              LEFT JOIN booking bk ON tk.BookingID = bk.BookingID
              LEFT JOIN seat s ON tk.SeatID = s.SeatID
              LEFT JOIN passenger p ON bk.PassengerID = p.PassengerID
              LEFT JOIN trip t ON bk.TripID = t.TripID
              LEFT JOIN bus b ON t.BusID = b.BusID
              LEFT JOIN route r ON t.RouteID = r.RouteID`, (err, r) => err ? res.status(500).json({ error: err.message }) : res.json(r));
});
app.post('/api/tickets', async (req, res) => {
  const { TicketID, BookingID, SeatID, TicketNumber, QRCode } = req.body;
  conn.query('SELECT TicketID FROM ticket WHERE TicketNumber = ?', [TicketNumber], (checkErr, existing) => {
    if (checkErr) return res.status(500).json({ error: checkErr.message });
    if (existing.length > 0) {
      return res.status(409).json({ error: `Ticket number "${TicketNumber}" already exists. Please use a unique ticket number.` });
    }
    conn.query('INSERT INTO ticket (TicketID, BookingID, SeatID, TicketNumber, QRCode) VALUES (?,?,?,?,?)',
      [TicketID || null, BookingID, SeatID, TicketNumber, QRCode || null],
      async (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        await resetAutoIncrement('ticket', 'TicketID');
        res.json({ message: 'Ticket issued', TicketID: result.insertId || TicketID });
      });
  });
});
app.delete('/api/tickets/:id', (req, res) => {
  conn.query('DELETE FROM ticket WHERE TicketID=?', [req.params.id], (err) => err ? res.status(500).json({ error: err.message }) : res.json({ message: 'Deleted' }));
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
      if (!err) results[key] = r[0].count ?? r[0].total;
      if (++done === keys.length) res.json(results);
    });
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});