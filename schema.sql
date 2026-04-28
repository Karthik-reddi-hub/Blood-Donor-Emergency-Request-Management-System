DROP DATABASE IF EXISTS bloodlink;
CREATE DATABASE bloodlink;
USE bloodlink;

CREATE TABLE Blood_Group (
  BloodGroupID INT PRIMARY KEY AUTO_INCREMENT,
  GroupName VARCHAR(5) UNIQUE NOT NULL
);

CREATE TABLE Donor (
  DonorID          INT PRIMARY KEY AUTO_INCREMENT,
  Name             VARCHAR(100) NOT NULL,
  Age              INT NOT NULL,
  Gender           ENUM('Male','Female','Other') NOT NULL,
  BloodGroupID     INT,
  Phone            VARCHAR(15) UNIQUE NOT NULL,
  City             VARCHAR(50) NOT NULL,
  LastDonationDate DATE,
  IsAvailable      TINYINT(1) DEFAULT 1,
  TotalDonations   INT DEFAULT 0,
  FOREIGN KEY (BloodGroupID) 
    REFERENCES Blood_Group(BloodGroupID) ON DELETE SET NULL
);

CREATE TABLE Hospital (
  HospitalID INT PRIMARY KEY AUTO_INCREMENT,
  Name       VARCHAR(100) NOT NULL,
  City       VARCHAR(50) NOT NULL,
  Contact    VARCHAR(15) UNIQUE NOT NULL
);

CREATE TABLE Users (
  UserID     INT PRIMARY KEY AUTO_INCREMENT,
  FullName   VARCHAR(100) NOT NULL,
  Email      VARCHAR(150) UNIQUE NOT NULL,
  Password   VARCHAR(255) NOT NULL,
  Role       ENUM('Admin','Hospital','Donor') 
             NOT NULL DEFAULT 'Donor',
  HospitalID INT DEFAULT NULL,
  DonorID    INT DEFAULT NULL,
  CreatedAt  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (HospitalID) 
    REFERENCES Hospital(HospitalID) ON DELETE SET NULL,
  FOREIGN KEY (DonorID) 
    REFERENCES Donor(DonorID) ON DELETE SET NULL
);

CREATE TABLE Request (
  RequestID      INT PRIMARY KEY AUTO_INCREMENT,
  PatientName    VARCHAR(100) NOT NULL,
  BloodGroupID   INT,
  UnitsRequired  INT NOT NULL,
  HospitalID     INT,
  RequestDate    DATE NOT NULL,
  EmergencyLevel ENUM('Low','Medium','High') NOT NULL,
  Status         ENUM('Pending','Completed','Cancelled') 
                 DEFAULT 'Pending',
  CreatedAt      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (BloodGroupID) 
    REFERENCES Blood_Group(BloodGroupID) ON DELETE CASCADE,
  FOREIGN KEY (HospitalID) 
    REFERENCES Hospital(HospitalID) ON DELETE CASCADE
);

CREATE TABLE Donation (
  DonationID   INT PRIMARY KEY AUTO_INCREMENT,
  DonorID      INT,
  RequestID    INT,
  DonationDate DATE NOT NULL,
  UnitsDonated INT NOT NULL,
  FOREIGN KEY (DonorID) 
    REFERENCES Donor(DonorID) ON DELETE CASCADE,
  FOREIGN KEY (RequestID) 
    REFERENCES Request(RequestID) ON DELETE CASCADE
);

CREATE TABLE AuditLog (
  LogID          INT PRIMARY KEY AUTO_INCREMENT,
  UserID         INT,
  Action         VARCHAR(255) NOT NULL,
  TableAffected  VARCHAR(50),
  RecordID       INT,
  Timestamp      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (UserID) 
    REFERENCES Users(UserID) ON DELETE SET NULL
);

CREATE TABLE BloodStock (
  StockID        INT PRIMARY KEY AUTO_INCREMENT,
  HospitalID     INT,
  BloodGroupID   INT,
  UnitsAvailable INT DEFAULT 0,
  LastUpdated    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (HospitalID) 
    REFERENCES Hospital(HospitalID) ON DELETE CASCADE,
  FOREIGN KEY (BloodGroupID) 
    REFERENCES Blood_Group(BloodGroupID) ON DELETE CASCADE,
  UNIQUE KEY unique_hosp_bg (HospitalID, BloodGroupID)
);

-- SEED DATA
INSERT INTO Blood_Group (GroupName) VALUES ('A+'),('B+'),('O+'),('AB+'),('A-');

INSERT INTO Donor (Name,Age,Gender,BloodGroupID,Phone,City,LastDonationDate,IsAvailable,TotalDonations) VALUES
('Ravi Kumar',28,'Male',1,'9848012345','Vijayawada','2023-12-15',1,3),
('Sita Reddy',34,'Female',2,'9848012346','Guntur','2024-01-10',1,5),
('Rahul Das',22,'Male',3,'9848012347','Mangalagiri','2023-11-20',1,1),
('Anjali Sharma',29,'Female',4,'9848012348','Vijayawada','2025-02-05',1,2),
('Karthik Rao',45,'Male',1,'9848012349','Guntur','2023-10-12',0,7);

INSERT INTO Hospital (Name,City,Contact) VALUES
('City Hospital','Vijayawada','0866-2471234'),
('Apollo Hospital','Guntur','0863-2234567'),
('Care Hospital','Mangalagiri','0864-5234890'),
('Sunrise Hospital','Vijayawada','0866-2559988'),
('Global Hospital','Guntur','0863-2221122');

INSERT INTO Request (PatientName,BloodGroupID,UnitsRequired,HospitalID,RequestDate,EmergencyLevel,Status) VALUES
('Venkatesh P',1,2,1,'2024-04-20','High','Pending'),
('Mary Grace',3,1,2,'2024-04-21','Medium','Pending'),
('Surya Teja',2,3,3,'2024-04-22','High','Pending'),
('Lakshmi K',1,1,4,'2024-04-18','Low','Completed'),
('Ibrahim Khan',5,2,5,'2024-04-23','Medium','Pending');

INSERT INTO Donation (DonorID,RequestID,DonationDate,UnitsDonated) VALUES
(1,4,'2024-04-18',1),(2,4,'2024-04-18',1),
(3,4,'2024-04-18',1),(4,4,'2024-04-18',1),
(5,4,'2024-04-18',1);