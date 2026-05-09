DROP DATABASE IF EXISTS OmniBus_Management;
CREATE DATABASE OmniBus_Management;

USE OmniBus_Management;

-- Admin Users for Portal
CREATE TABLE Admin (
    AdminID INT AUTO_INCREMENT PRIMARY KEY,
    Username VARCHAR(50) UNIQUE NOT NULL,
    Password VARCHAR(255) NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Staff Hierarchy
CREATE TABLE BusCrew(
    OperatorID INT AUTO_INCREMENT PRIMARY KEY,
    Name VARCHAR(100),
    PhoneNumber VARCHAR(11) CHECK (PhoneNumber REGEXP '^[0-9]{11}$'),
    Address VARCHAR(100)
);

CREATE TABLE Driver(
    OperatorID INT,
    LicenseNumber VARCHAR(50),
    ExperienceYears INT,
    PRIMARY KEY (OperatorID),
    CONSTRAINT FK_Driver_BusCrew
    FOREIGN KEY (OperatorID) REFERENCES BusCrew(OperatorID)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE Hostess(
    OperatorID INT,
    LanguagesKnown VARCHAR(100),
    PRIMARY KEY (OperatorID),
    CONSTRAINT FK_Hostess_BusCrew
    FOREIGN KEY (OperatorID) REFERENCES BusCrew(OperatorID)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE SecurityStaff(
    OperatorID INT,
    PRIMARY KEY (OperatorID),
    LicenseNumber VARCHAR(50),
    CONSTRAINT FK_SecurityStaff_BusCrew
    FOREIGN KEY (OperatorID) REFERENCES BusCrew(OperatorID)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE Attendant(
    OperatorID INT,
    PRIMARY KEY (OperatorID),
    ServiceLevel ENUM('Trainee', 'Junior', 'Senior', 'Expert') DEFAULT 'Junior',
    CONSTRAINT FK_Attendant_BusCrew
    FOREIGN KEY (OperatorID) REFERENCES BusCrew(OperatorID)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- Vehicles and Assets
CREATE TABLE Bus (
    BusID INT AUTO_INCREMENT PRIMARY KEY,
    BusNumber VARCHAR(20) UNIQUE,
    TotalSeats INT,
    OperatorID INT,
    CONSTRAINT FK_Bus_BusCrew 
    FOREIGN KEY (OperatorID) REFERENCES BusCrew(OperatorID)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE TABLE BusType (
    BusID INT,
    CategoryName ENUM('Luxury', 'AC', 'Sleeper'),
    PRIMARY KEY (BusID, CategoryName),
    CONSTRAINT FK_BusType_Bus 
    FOREIGN KEY (BusID) REFERENCES Bus(BusID)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE Seat (
    SeatID INT AUTO_INCREMENT PRIMARY KEY,
    BusID INT,
    SeatNumber VARCHAR(10),
    SeatType VARCHAR(20),
    SeatStatus VARCHAR(20) DEFAULT 'Available', 
    CONSTRAINT FK_Seat_Bus 
    FOREIGN KEY (BusID) REFERENCES Bus(BusID)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- Operations and Scheduling
CREATE TABLE Route (
    RouteID INT AUTO_INCREMENT PRIMARY KEY,
    SourceCity VARCHAR(100) NOT NULL,
    DestinationCity VARCHAR(100) NOT NULL,
    Distance DECIMAL(6,2),
    EstimatedDuration TIME 
);

CREATE TABLE Trip (
    TripID INT AUTO_INCREMENT PRIMARY KEY,
    BusID INT,
    RouteID INT,
    DepartureDate DATE,
    DepartureTime TIME,
    ArrivalTime TIME,
    Fare DECIMAL(10,2),
    CONSTRAINT FK_Trip_Bus FOREIGN KEY (BusID) REFERENCES Bus(BusID) ON DELETE CASCADE,
    CONSTRAINT FK_Trip_Route FOREIGN KEY (RouteID) REFERENCES Route(RouteID) ON DELETE CASCADE
);

-- Transactional Entities
CREATE TABLE Passenger (
    PassengerID INT AUTO_INCREMENT PRIMARY KEY,
    FirstName VARCHAR(50),
    LastName VARCHAR(50),
    Email VARCHAR(100) UNIQUE,
    Phone VARCHAR(11) CHECK (Phone REGEXP '^[0-9]{11}$'),
    CNIC VARCHAR(13) CHECK (CNIC REGEXP '^[0-9]{13}$') UNIQUE, 
    DateOfBirth DATE,
    Password VARCHAR(255) 
);

CREATE TABLE Booking (
    BookingID INT AUTO_INCREMENT PRIMARY KEY,
    PassengerID INT,
    TripID INT,
    BookingDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    TotalAmount DECIMAL(10,2),
    BookingStatus ENUM('Pending', 'Confirmed', 'Cancelled') DEFAULT 'Pending',
    CONSTRAINT FK_Booking_Passenger FOREIGN KEY (PassengerID) REFERENCES Passenger(PassengerID) ON DELETE CASCADE,
    CONSTRAINT FK_Booking_Trip FOREIGN KEY (TripID) REFERENCES Trip(TripID) ON DELETE CASCADE
);

CREATE TABLE Payment (
    PaymentID INT AUTO_INCREMENT PRIMARY KEY,
    BookingID INT UNIQUE,
    PaymentMethod ENUM('Credit Card', 'Debit Card', 'JazzCash', 'EasyPaisa', 'Cash'),
    PaymentAmount DECIMAL(10,2),
    PaymentDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    PaymentStatus ENUM('Pending', 'Completed', 'Failed') DEFAULT 'Pending',
    CONSTRAINT FK_Payment_Booking FOREIGN KEY (BookingID) REFERENCES Booking(BookingID) ON DELETE CASCADE
);

CREATE TABLE Ticket (
    TicketID INT AUTO_INCREMENT PRIMARY KEY,
    BookingID INT,
    SeatID INT,
    TicketNumber VARCHAR(50) UNIQUE,
    QRCode VARCHAR(255),
    IssueDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Ticket_Booking FOREIGN KEY (BookingID) REFERENCES Booking(BookingID) ON DELETE CASCADE,
    CONSTRAINT FK_Ticket_Seat FOREIGN KEY (SeatID) REFERENCES Seat(SeatID) ON DELETE CASCADE
);

-- ─── PL/SQL: STORED PROCEDURES & TRIGGERS ──────────────────────────────────────
DELIMITER //

-- Procedure to calculate total revenue for a specific trip
CREATE PROCEDURE GetTripRevenue(IN p_TripID INT, OUT p_TotalRevenue DECIMAL(10,2))
BEGIN
    SELECT COALESCE(SUM(p.PaymentAmount), 0) INTO p_TotalRevenue
    FROM Payment p
    JOIN Booking b ON p.BookingID = b.BookingID
    WHERE b.TripID = p_TripID AND p.PaymentStatus = 'Completed';
END //

-- Trigger to mark seat as booked when a ticket is issued
CREATE TRIGGER AfterTicketInsert
AFTER INSERT ON Ticket
FOR EACH ROW
BEGIN
    UPDATE Seat 
    SET SeatStatus = 'Booked' 
    WHERE SeatID = NEW.SeatID;
END //

-- Trigger to mark seat as available when a ticket is cancelled/deleted
CREATE TRIGGER AfterTicketDelete
AFTER DELETE ON Ticket
FOR EACH ROW
BEGIN
    UPDATE Seat 
    SET SeatStatus = 'Available' 
    WHERE SeatID = OLD.SeatID;
END //

DELIMITER ;

-- Trigger to update Booking status when Payment status changes
DELIMITER //
CREATE TRIGGER AfterPaymentStatusUpdate
AFTER UPDATE ON Payment
FOR EACH ROW
BEGIN
   IF NEW.PaymentStatus <> OLD.PaymentStatus THEN
      IF NEW.PaymentStatus = 'Completed' THEN
         UPDATE Booking SET BookingStatus = 'Confirmed' WHERE BookingID = NEW.BookingID;
      ELSEIF NEW.PaymentStatus = 'Pending' THEN
         UPDATE Booking SET BookingStatus = 'Pending' WHERE BookingID = NEW.BookingID;
      ELSEIF NEW.PaymentStatus = 'Failed' THEN
         UPDATE Booking SET BookingStatus = 'Cancelled' WHERE BookingID = NEW.BookingID;
      END IF;
   END IF;
END //
DELIMITER ;

ALTER TABLE Bus ADD COLUMN HostessID INT NULL,
ADD CONSTRAINT FK_Bus_Hostess FOREIGN KEY (HostessID) REFERENCES BusCrew(OperatorID) ON DELETE SET NULL ON UPDATE CASCADE;