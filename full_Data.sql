

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
    Gender           ENUM('Male', 'Female', 'Other') NOT NULL,
    BloodGroupID     INT,
    Phone            VARCHAR(15) UNIQUE NOT NULL,
    City             VARCHAR(50) NOT NULL,
    LastDonationDate DATE,
    FOREIGN KEY (BloodGroupID) REFERENCES Blood_Group(BloodGroupID) ON DELETE SET NULL
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
    Role       ENUM('Admin', 'Hospital', 'Donor') NOT NULL DEFAULT 'Donor',
    HospitalID INT DEFAULT NULL,
    CreatedAt  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (HospitalID) REFERENCES Hospital(HospitalID) ON DELETE SET NULL
);

CREATE TABLE Request (
    RequestID      INT PRIMARY KEY AUTO_INCREMENT,
    PatientName    VARCHAR(100) NOT NULL,
    BloodGroupID   INT,
    UnitsRequired  INT NOT NULL,
    HospitalID     INT,
    RequestDate    DATE NOT NULL,
    EmergencyLevel ENUM('Low', 'Medium', 'High') NOT NULL,
    Status         ENUM('Pending', 'Completed', 'Cancelled') DEFAULT 'Pending',
    FOREIGN KEY (BloodGroupID) REFERENCES Blood_Group(BloodGroupID) ON DELETE CASCADE,
    FOREIGN KEY (HospitalID)   REFERENCES Hospital(HospitalID)      ON DELETE CASCADE
);

CREATE TABLE Donation (
    DonationID   INT PRIMARY KEY AUTO_INCREMENT,
    DonorID      INT,
    RequestID    INT,
    DonationDate DATE NOT NULL,
    UnitsDonated INT NOT NULL,
    FOREIGN KEY (DonorID)   REFERENCES Donor(DonorID)     ON DELETE CASCADE,
    FOREIGN KEY (RequestID) REFERENCES Request(RequestID) ON DELETE CASCADE
);



INSERT INTO Blood_Group (GroupName) VALUES ('A+'), ('B+'), ('O+'), ('AB+'), ('A-');

INSERT INTO Donor (Name, Age, Gender, BloodGroupID, Phone, City, LastDonationDate) VALUES
('Ravi Kumar',    28, 'Male',   1, '9848012345', 'Vijayawada',  '2023-12-15'),
('Sita Reddy',    34, 'Female', 2, '9848012346', 'Guntur',      '2024-01-10'),
('Rahul Das',     22, 'Male',   3, '9848012347', 'Mangalagiri', '2023-11-20'),
('Anjali Sharma', 29, 'Female', 4, '9848012348', 'Vijayawada',  '2024-02-05'),
('Karthik Rao',   45, 'Male',   1, '9848012349', 'Guntur',      '2023-10-12');

INSERT INTO Hospital (Name, City, Contact) VALUES
('City Hospital',    'Vijayawada',  '0866-2471234'),
('Apollo Hospital',  'Guntur',      '0863-2234567'),
('Care Hospital',    'Mangalagiri', '0864-5234890'),
('Sunrise Hospital', 'Vijayawada',  '0866-2559988'),
('Global Hospital',  'Guntur',      '0863-2221122');

INSERT INTO Request (PatientName, BloodGroupID, UnitsRequired, HospitalID, RequestDate, EmergencyLevel, Status) VALUES
('Venkatesh P',  1, 2, 1, '2024-04-20', 'High',   'Pending'),
('Mary Grace',   3, 1, 2, '2024-04-21', 'Medium', 'Pending'),
('Surya Teja',   2, 3, 3, '2024-04-22', 'High',   'Pending'),
('Lakshmi K',    1, 1, 4, '2024-04-18', 'Low',    'Completed'),
('Ibrahim Khan', 5, 2, 5, '2024-04-23', 'Medium', 'Pending');

INSERT INTO Donation (DonorID, RequestID, DonationDate, UnitsDonated) VALUES
(1, 4, '2024-04-18', 1),
(2, 4, '2024-04-18', 1),
(3, 4, '2024-04-18', 1),
(4, 4, '2024-04-18', 1),
(5, 4, '2024-04-18', 1);



CREATE VIEW vw_DonorSummary AS
SELECT d.DonorID, d.Name, d.Age, d.Gender,
       bg.GroupName AS BloodGroup,
       d.Phone, d.City, d.LastDonationDate
FROM Donor d
JOIN Blood_Group bg ON d.BloodGroupID = bg.BloodGroupID;

CREATE VIEW vw_PendingRequests AS
SELECT r.RequestID, r.PatientName,
       bg.GroupName AS BloodGroup,
       r.UnitsRequired,
       h.Name AS HospitalName,
       h.City, r.RequestDate, r.EmergencyLevel
FROM Request r
JOIN Blood_Group bg ON r.BloodGroupID = bg.BloodGroupID
JOIN Hospital h     ON r.HospitalID   = h.HospitalID
WHERE r.Status = 'Pending'
ORDER BY CASE r.EmergencyLevel WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 3 END;

CREATE VIEW vw_DonationHistory AS
SELECT dn.DonationID,
       d.Name        AS DonorName,
       bg.GroupName  AS DonorBloodGroup,
       h.Name        AS HospitalName,
       r.PatientName,
       dn.DonationDate,
       dn.UnitsDonated
FROM Donation dn
JOIN Donor       d  ON dn.DonorID     = d.DonorID
JOIN Blood_Group bg ON d.BloodGroupID = bg.BloodGroupID
JOIN Request     r  ON dn.RequestID   = r.RequestID
JOIN Hospital    h  ON r.HospitalID   = h.HospitalID;



DELIMITER $$

CREATE PROCEDURE sp_RegisterDonor(
    IN p_Name         VARCHAR(100),
    IN p_Age          INT,
    IN p_Gender       VARCHAR(10),
    IN p_BloodGroupID INT,
    IN p_Phone        VARCHAR(15),
    IN p_City         VARCHAR(50)
)
BEGIN
    IF p_Age < 18 OR p_Age > 60 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Donor age must be between 18 and 60 years.';
    ELSE
        INSERT INTO Donor (Name, Age, Gender, BloodGroupID, Phone, City)
        VALUES (p_Name, p_Age, p_Gender, p_BloodGroupID, p_Phone, p_City);
    END IF;
END $$

CREATE PROCEDURE sp_FulfillRequest(
    IN p_DonorID   INT,
    IN p_RequestID INT,
    IN p_Units     INT,
    IN p_Date      DATE
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
        INSERT INTO Donation (DonorID, RequestID, DonationDate, UnitsDonated)
        VALUES (p_DonorID, p_RequestID, p_Date, p_Units);

        UPDATE Request SET Status = 'Completed' WHERE RequestID = p_RequestID;
        UPDATE Donor   SET LastDonationDate = p_Date WHERE DonorID = p_DonorID;
    COMMIT;
END $$

DELIMITER ;

SELECT 'Blood_Group' AS TableName, COUNT(*) AS Total FROM Blood_Group
UNION ALL SELECT 'Donor',    COUNT(*) FROM Donor
UNION ALL SELECT 'Hospital', COUNT(*) FROM Hospital
UNION ALL SELECT 'Request',  COUNT(*) FROM Request
UNION ALL SELECT 'Donation', COUNT(*) FROM Donation
UNION ALL SELECT 'Users',    COUNT(*) FROM Users;


SELECT * FROM Blood_Group;
SELECT * FROM Donor;
SELECT * FROM Hospital;

SELECT * FROM Request;

SELECT * FROM Donation;
SELECT * FROM Users;

-- 7. Donor Summary (View)
SELECT * FROM vw_DonorSummary;

-- 8. Pending Requests (View)
SELECT * FROM vw_PendingRequests;

-- 9. Donation History (View)
SELECT * FROM vw_DonationHistory;

-- 10. Stats Summary
SELECT 
    (SELECT COUNT(*) FROM Donor)              AS Total_Donors,
    (SELECT COUNT(*) FROM Hospital)           AS Total_Hospitals,
    (SELECT COUNT(*) FROM Request)            AS Total_Requests,
    (SELECT COUNT(*) FROM Request WHERE Status = 'Pending')   AS Pending_Requests,
    (SELECT COUNT(*) FROM Request WHERE Status = 'Completed') AS Completed_Requests,
    (SELECT COUNT(*) FROM Donation)           AS Total_Donations,
    (SELECT COUNT(*) FROM Users)              AS Total_Users;
