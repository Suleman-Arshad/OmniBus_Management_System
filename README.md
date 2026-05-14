# ⬡ OmniBus — Management System

OmniBus is a robust, full-stack management portal designed for bus transport operators. It streamlines fleet management, staff assignments, passenger bookings, and financial tracking into a single, responsive web interface.

## 🔗 Live Demo

**View the live application:** [omni-bus-management-system.vercel.app](https://omni-bus-management-system.vercel.app)

## 🚀 Features

- **Dynamic Dashboard**: Real-time statistics for passengers, buses, trips, and revenue.
- **Fleet Management**: Track buses, seat availability, and assign specific drivers and hostesses to vehicles.
- **Staff Administration**: Manage a diverse crew including Drivers, Hostesses, Security, and Attendants with role-specific details.
- **Booking & Ticketing**: Handle passenger reservations, issue digital tickets, and manage seat assignments.
- **Financial Tracking**: Record payments via multiple methods (Cash, Card, JazzCash, EasyPaisa) with automated booking status synchronization.
- **Responsive Design**: Fully optimized for Desktop, Tablet, and Mobile views.

## 🛠 Tech Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom Design System), JavaScript (ES6+).
- **Backend**: Node.js, Express.js.
- **Database**: MySQL (Relational Schema with Triggers and Stored Procedures).
- **Icons/Fonts**: Google Fonts (Syne, DM Mono).

## 📋 Prerequisites

Before running the project, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v14+)
- [MySQL Server](https://www.mysql.com/) (v8.0+)

## ⚙️ Setup Instructions

### 1. Database Configuration
1. Open your MySQL terminal or a tool like MySQL Workbench.
2. Run the script provided in `OmniBus_Management.sql` to create the database schema, tables, triggers, and procedures.
3. Update the database credentials in `server.js` (lines 9-15):
   ```javascript
   const conn = mysql.createConnection({
     host: '127.0.0.1',
     user: 'root',
     password: 'YOUR_PASSWORD',
     database: 'OmniBus_Management'
   });
   ```

### 2. Backend Installation
1. Navigate to the project directory.
2. Install dependencies:
   ```bash
   npm install
   ```

### 3. Running the Application
1. Start the server:
   ```bash
   node server.js
   ```
2. The server will run at `http://localhost:3000`.
3. Open `index.html` in your browser to access the portal.

## 📂 Project Structure

- `index.html`: Main entry point and UI structure.
- `style.css`: Custom design system and responsive layouts.
- `app.js`: Client-side logic for API interaction and UI state management.
- `server.js`: Express API server and database connectivity.
- `OmniBus_Management.sql`: Database initialization script.
- `sample_data.txt`: Useful testing data for populating the system.

## ⚖️ License

Distributed under the MIT License.
