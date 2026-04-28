const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'bloodlink_secret_key_2024';

let db;

async function connectDB() {
    try {
        db = await mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
        console.log('✅ MySQL Connected Successfully - BloodLink Pro Production');
        await seedUsers();
    } catch (err) {
        console.error('❌ MySQL Connection Failed:', err.message);
        process.exit(1);
    }
}

async function auditLog(userId, action, table, recordId) {
    try {
        await db.execute(
            'INSERT INTO AuditLog (UserID, Action, TableAffected, RecordID) VALUES (?, ?, ?, ?)',
            [userId || null, action, table, recordId || null]
        );
    } catch (err) {
        console.error('Audit Log Error:', err);
    }
}

async function seedUsers() {
    const users = [
        { name: 'Admin User', email: 'admin@bloodlink.in', pass: 'Admin@123', role: 'Admin' },
        { name: 'Donor User', email: 'donor@bloodlink.in', pass: 'Donor@789', role: 'Donor' },
        { name: 'Hospital User', email: 'cityhospital@bloodlink.in', pass: 'Hosp@1', role: 'Hospital' }
    ];

    for (const u of users) {
        const [rows] = await db.execute('SELECT * FROM Users WHERE Email = ?', [u.email]);
        if (rows.length === 0) {
            const hashed = await bcrypt.hash(u.pass, 10);
            await db.execute(
                'INSERT INTO Users (FullName, Email, Password, Role) VALUES (?, ?, ?, ?)',
                [u.name, u.email, hashed, u.role]
            );
            console.log(`👤 Seeded User: ${u.email}`);
        }
    }

    // Seed unique accounts for every donor in the registry
    const [donors] = await db.execute('SELECT DonorID, Name FROM Donor');
    for (const d of donors) {
        const email = d.Name.toLowerCase().replace(/\s+/g, '.') + '@bloodlink.in';
        const [existing] = await db.execute('SELECT * FROM Users WHERE Email = ?', [email]);
        if (existing.length === 0) {
            const hashed = await bcrypt.hash('Donor@123', 10);
            await db.execute(
                'INSERT INTO Users (FullName, Email, Password, Role, DonorID) VALUES (?, ?, ?, ?, ?)',
                [d.Name, email, hashed, 'Donor', d.DonorID]
            );
            console.log(`👤 Seeded Unique Donor Account: ${email}`);
        }
    }

    // Seed unique accounts for every hospital in the network
    const [hospitals] = await db.execute('SELECT HospitalID, Name FROM Hospital');
    for (const h of hospitals) {
        const email = h.Name.toLowerCase().replace(/\s+/g, '.') + '@bloodlink.in';
        const [existing] = await db.execute('SELECT * FROM Users WHERE Email = ?', [email]);
        if (existing.length === 0) {
            const hashed = await bcrypt.hash('Hosp@123', 10);
            await db.execute(
                'INSERT INTO Users (FullName, Email, Password, Role, HospitalID) VALUES (?, ?, ?, ?, ?)',
                [h.Name, email, hashed, 'Hospital', h.HospitalID]
            );
            console.log(`👤 Seeded Unique Hospital Account: ${email}`);
        }
    }
}

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// --- AUTH ---
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await db.execute('SELECT * FROM Users WHERE Email = ?', [email]);
        if (rows.length === 0) return res.status(401).json({ error: 'User not found' });
        const user = rows[0];
        const match = await bcrypt.compare(password, user.Password);
        if (!match) return res.status(401).json({ error: 'Invalid password' });

        const token = jwt.sign({ 
            userId: user.UserID, 
            role: user.Role, 
            name: user.FullName, 
            hospitalId: user.HospitalID, 
            donorId: user.DonorID 
        }, JWT_SECRET);

        res.json({ token, role: user.Role, name: user.FullName, userId: user.UserID, hospitalId: user.HospitalID, donorId: user.DonorID });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/register', async (req, res) => {
    const { fullName, email, password, role, hospitalId, donorId } = req.body;
    try {
        const hashed = await bcrypt.hash(password, 10);
        const [reslt] = await db.execute(
            'INSERT INTO Users (FullName, Email, Password, Role, HospitalID, DonorID) VALUES (?, ?, ?, ?, ?, ?)',
            [fullName, email, hashed, role, hospitalId || null, donorId || null]
        );
        const token = jwt.sign({ userId: reslt.insertId, role, name: fullName, hospitalId, donorId }, JWT_SECRET);
        res.json({ token, role, name: fullName, userId: reslt.insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- STATS ---
app.get('/api/stats', async (req, res) => {
    try {
        const [[{ totalDonors }]] = await db.execute('SELECT COUNT(*) as totalDonors FROM Donor');
        const [[{ totalHospitals }]] = await db.execute('SELECT COUNT(*) as totalHospitals FROM Hospital');
        const [[{ pendingRequests }]] = await db.execute('SELECT COUNT(*) as pendingRequests FROM Request WHERE Status = "Pending"');
        const [[{ completedRequests }]] = await db.execute('SELECT COUNT(*) as completedRequests FROM Request WHERE Status = "Completed"');
        const [[{ totalDonations }]] = await db.execute('SELECT IFNULL(SUM(UnitsDonated), 0) as totalDonations FROM Donation');
        const [[{ availableDonors }]] = await db.execute('SELECT COUNT(*) as availableDonors FROM Donor WHERE IsAvailable = 1');
        const [[{ totalUsers }]] = await db.execute('SELECT COUNT(*) as totalUsers FROM Users');
        res.json({ totalDonors, totalHospitals, pendingRequests, completedRequests, totalDonations, availableDonors, totalUsers });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- BLOOD GROUPS ---
app.get('/api/bloodgroups', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM Blood_Group');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- DONORS ---
app.get('/api/donors', async (req, res) => {
    const { role } = req.query; // Passed from frontend based on currentUser.role
    try {
        let sql = 'SELECT d.*, bg.GroupName FROM Donor d JOIN Blood_Group bg ON d.BloodGroupID = bg.BloodGroupID ORDER BY d.DonorID DESC';
        const [rows] = await db.execute(sql);
        
        // Privacy: Redact phone for non-admins
        if (role !== 'Admin') {
            rows.forEach(r => r.Phone = '***-***-****');
        }
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/donors', async (req, res) => {
    const { name, age, gender, bloodGroupId, phone, city, userId } = req.body;
    try {
        const [reslt] = await db.execute(
            'INSERT INTO Donor (Name, Age, Gender, BloodGroupID, Phone, City) VALUES (?, ?, ?, ?, ?, ?)',
            [name, age, gender, bloodGroupId, phone, city]
        );
        await auditLog(userId, `Registered donor: ${name}`, 'Donor', reslt.insertId);
        res.status(201).json({ message: 'Saved to MySQL', donorId: reslt.insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/donors/:id', async (req, res) => {
    const { name, age, gender, bloodGroupId, phone, city, userId } = req.body;
    try {
        await db.execute(
            'UPDATE Donor SET Name=?, Age=?, Gender=?, BloodGroupID=?, Phone=?, City=? WHERE DonorID=?',
            [name, age, gender, bloodGroupId, phone, city, req.params.id]
        );
        await auditLog(userId, `Updated donor record ID: ${req.params.id}`, 'Donor', req.params.id);
        res.json({ message: 'Saved to MySQL' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/donors/:id', async (req, res) => {
    const { userId } = req.query;
    try {
        await db.execute('DELETE FROM Donor WHERE DonorID = ?', [req.params.id]);
        await auditLog(userId, `Deleted donor record ID: ${req.params.id}`, 'Donor', req.params.id);
        res.json({ message: 'Saved to MySQL' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/donors/:id/availability', async (req, res) => {
    const { isAvailable, userId } = req.body;
    try {
        await db.execute('UPDATE Donor SET IsAvailable = ? WHERE DonorID = ?', [isAvailable, req.params.id]);
        await auditLog(userId, `Toggled availability to ${isAvailable} for donor ID: ${req.params.id}`, 'Donor', req.params.id);
        res.json({ message: 'Saved to MySQL', isAvailable });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/donors/match/:bloodGroupId/:city', async (req, res) => {
    const { bloodGroupId, city } = req.params;
    try {
        const [rows] = await db.execute(`
            SELECT d.*, bg.GroupName, DATEDIFF(CURDATE(), IFNULL(d.LastDonationDate, '2000-01-01')) as daysSinceDonation
            FROM Donor d
            JOIN Blood_Group bg ON d.BloodGroupID = bg.BloodGroupID
            WHERE d.IsAvailable = 1 
            AND (d.LastDonationDate IS NULL OR DATEDIFF(CURDATE(), d.LastDonationDate) >= 90)
            AND (d.BloodGroupID = ? OR bg.GroupName IN ('O+', 'O-'))
            ORDER BY 
                CASE WHEN d.City = ? AND d.BloodGroupID = ? THEN 1 
                     WHEN d.BloodGroupID = ? THEN 2
                     ELSE 3 END, 
                d.LastDonationDate ASC
        `, [bloodGroupId, city, bloodGroupId, bloodGroupId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- HOSPITALS ---
app.get('/api/hospitals', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM Hospital ORDER BY HospitalID DESC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/hospitals', async (req, res) => {
    const { name, city, contact, userId } = req.body;
    try {
        const [reslt] = await db.execute('INSERT INTO Hospital (Name, City, Contact) VALUES (?, ?, ?)', [name, city, contact]);
        await auditLog(userId, `Added hospital: ${name}`, 'Hospital', reslt.insertId);
        res.status(201).json({ message: 'Saved to MySQL' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/hospitals/:id', async (req, res) => {
    const { name, city, contact, userId } = req.body;
    try {
        await db.execute('UPDATE Hospital SET Name=?, City=?, Contact=? WHERE HospitalID=?', [name, city, contact, req.params.id]);
        await auditLog(userId, `Updated hospital ID: ${req.params.id}`, 'Hospital', req.params.id);
        res.json({ message: 'Saved to MySQL' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/hospitals/:id', async (req, res) => {
    const { userId } = req.query;
    try {
        await db.execute('DELETE FROM Hospital WHERE HospitalID = ?', [req.params.id]);
        await auditLog(userId, `Deleted hospital ID: ${req.params.id}`, 'Hospital', req.params.id);
        res.json({ message: 'Saved to MySQL' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- REQUESTS ---
app.get('/api/requests', async (req, res) => {
    const { hospitalId, donorBloodGroupId } = req.query;
    try {
        let sql = `
            SELECT r.*, bg.GroupName, h.Name as HospitalName, h.City as HospitalCity 
            FROM Request r 
            JOIN Blood_Group bg ON r.BloodGroupID = bg.BloodGroupID 
            JOIN Hospital h ON r.HospitalID = h.HospitalID
        `;
        const params = [];
        if (hospitalId) {
            sql += ' WHERE r.HospitalID = ?';
            params.push(hospitalId);
        } else if (donorBloodGroupId) {
            // For now, strict match as per user request: "Donor sees only requests that match their blood group"
            sql += ' WHERE r.BloodGroupID = ? AND r.Status = "Pending"';
            params.push(donorBloodGroupId);
        }
        sql += ' ORDER BY CASE EmergencyLevel WHEN "High" THEN 1 WHEN "Medium" THEN 2 ELSE 3 END, RequestDate DESC';
        const [rows] = await db.execute(sql, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/requests', async (req, res) => {
    const { patientName, bloodGroupId, unitsRequired, hospitalId, emergencyLevel, requestDate, userId } = req.body;
    try {
        const [reslt] = await db.execute(
            'INSERT INTO Request (PatientName, BloodGroupID, UnitsRequired, HospitalID, EmergencyLevel, RequestDate) VALUES (?, ?, ?, ?, ?, ?)',
            [patientName, bloodGroupId, unitsRequired, hospitalId, emergencyLevel, requestDate]
        );
        await auditLog(userId, `Created request for patient: ${patientName}`, 'Request', reslt.insertId);
        res.status(201).json({ message: 'Saved to MySQL' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/requests/:id/status', async (req, res) => {
    const { status, userId } = req.body;
    try {
        await db.execute('UPDATE Request SET Status = ? WHERE RequestID = ?', [status, req.params.id]);
        await auditLog(userId, `Updated request ID ${req.params.id} status to ${status}`, 'Request', req.params.id);
        res.json({ message: 'Saved to MySQL' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/requests/:id', async (req, res) => {
    const { userId } = req.query;
    try {
        await db.execute('DELETE FROM Request WHERE RequestID = ?', [req.params.id]);
        await auditLog(userId, `Deleted request ID: ${req.params.id}`, 'Request', req.params.id);
        res.json({ message: 'Saved to MySQL' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- DONATIONS ---
app.get('/api/donations', async (req, res) => {
    const { donorId, hospitalId } = req.query;
    try {
        let sql = `
            SELECT d.*, dr.Name as DonorName, r.PatientName, h.Name as HospitalName, bg.GroupName
            FROM Donation d
            JOIN Donor dr ON d.DonorID = dr.DonorID
            JOIN Request r ON d.RequestID = r.RequestID
            JOIN Hospital h ON r.HospitalID = h.HospitalID
            JOIN Blood_Group bg ON dr.BloodGroupID = bg.BloodGroupID
        `;
        const params = [];
        const whereClauses = [];
        if (donorId) {
            whereClauses.push('d.DonorID = ?');
            params.push(donorId);
        }
        if (hospitalId) {
            whereClauses.push('r.HospitalID = ?');
            params.push(hospitalId);
        }
        if (whereClauses.length > 0) {
            sql += ' WHERE ' + whereClauses.join(' AND ');
        }
        sql += ' ORDER BY DonationDate DESC';
        const [rows] = await db.execute(sql, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/donations/fulfill', async (req, res) => {
    const { donorId, requestId, units, userId } = req.body;
    try {
        const [donorRows] = await db.execute('SELECT * FROM Donor WHERE DonorID = ?', [donorId]);
        const donor = donorRows[0];

        if (!donor.IsAvailable) return res.status(400).json({ error: 'Donor is currently unavailable' });
        
        const lastDate = donor.LastDonationDate ? new Date(donor.LastDonationDate) : new Date(0);
        const diffDays = Math.ceil((new Date() - lastDate) / (1000 * 60 * 60 * 24));
        if (diffDays < 90) return res.status(400).json({ error: `Donor is on cooldown (${90 - diffDays} days left)` });

        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
            await connection.execute(
                'INSERT INTO Donation (DonorID, RequestID, DonationDate, UnitsDonated) VALUES (?, ?, CURDATE(), ?)',
                [donorId, requestId, units]
            );
            await connection.execute('UPDATE Request SET Status = "Completed" WHERE RequestID = ?', [requestId]);
            await connection.execute('UPDATE Donor SET LastDonationDate = CURDATE(), TotalDonations = TotalDonations + 1 WHERE DonorID = ?', [donorId]);
            
            await connection.commit();
            await auditLog(userId, `Fulfilled request ID ${requestId} with donor ID ${donorId}`, 'Donation', requestId);
            res.status(201).json({ message: 'Saved to MySQL' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/donors/:id/history', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT d.*, dr.Name as DonorName, r.PatientName, h.Name as HospitalName, bg.GroupName,
            DATEDIFF(CURDATE(), d.DonationDate) as daysSince
            FROM Donation d
            JOIN Donor dr ON d.DonorID = dr.DonorID
            JOIN Request r ON d.RequestID = r.RequestID
            JOIN Hospital h ON r.HospitalID = h.HospitalID
            JOIN Blood_Group bg ON dr.BloodGroupID = bg.BloodGroupID
            WHERE d.DonorID = ?
            ORDER BY DonationDate DESC
        `, [req.params.id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/donors/:id/nearby-hospitals', async (req, res) => {
    try {
        const [donor] = await db.execute('SELECT City FROM Donor WHERE DonorID = ?', [req.params.id]);
        if (donor.length === 0) return res.status(404).json({ error: 'Donor not found' });
        const city = donor[0].City;
        
        const [rows] = await db.execute(`
            SELECT h.*, COUNT(r.RequestID) as pendingCount,
            GROUP_CONCAT(DISTINCT bg.GroupName) as urgentGroups
            FROM Hospital h
            LEFT JOIN Request r ON h.HospitalID = r.HospitalID AND r.Status = 'Pending'
            LEFT JOIN Blood_Group bg ON r.BloodGroupID = bg.BloodGroupID
            WHERE h.City = ?
            GROUP BY h.HospitalID
            HAVING pendingCount > 0
        `, [city]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update Donor Profile (Basic Info)
app.put('/api/donors/:id/profile', async (req, res) => {
    const { name, city, phone, userId } = req.body;
    try {
        await db.execute(
            'UPDATE Donor SET Name=?, City=?, Phone=? WHERE DonorID=?',
            [name, city, phone, req.params.id]
        );
        
        await db.execute(
            'INSERT INTO AuditLog (UserID, Action, TableAffected, RecordID) VALUES (?, ?, ?, ?)',
            [userId, `Donor updated their own profile info`, 'Donor', req.params.id]
        );
        
        res.json({ message: 'Profile updated in MySQL' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- INVENTORY & STOCK ---
app.get('/api/inventory', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT bg.GroupName, 
            (SELECT IFNULL(SUM(UnitsRequired), 0) FROM Request WHERE BloodGroupID = bg.BloodGroupID AND Status = 'Pending') as Needed,
            (SELECT IFNULL(SUM(UnitsDonated), 0) FROM Donation d JOIN Donor dr ON d.DonorID = dr.DonorID WHERE dr.BloodGroupID = bg.BloodGroupID) as Available
            FROM Blood_Group bg
        `);
        const result = rows.map(r => {
            const ratio = r.Available / (r.Needed || 1);
            let status = 'Sufficient';
            if (ratio < 0.3) status = 'Critical';
            else if (ratio < 0.7) status = 'Low';
            return { ...r, Status: status };
        });
        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/stock/:hospitalId', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT bs.*, bg.GroupName FROM BloodStock bs JOIN Blood_Group bg ON bs.BloodGroupID = bg.BloodGroupID WHERE HospitalID = ?', [req.params.hospitalId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/stock', async (req, res) => {
    const { hospitalId, bloodGroupId, units, userId } = req.body;
    try {
        await db.execute(`
            INSERT INTO BloodStock (HospitalID, BloodGroupID, UnitsAvailable, LastUpdated) 
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE UnitsAvailable = VALUES(UnitsAvailable), LastUpdated = CURRENT_TIMESTAMP
        `, [hospitalId, bloodGroupId, units]);
        await auditLog(userId, `Updated stock for hospital ${hospitalId}, group ${bloodGroupId}`, 'BloodStock', hospitalId);
        res.json({ message: 'Saved to MySQL' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- AUDIT & USERS ---
app.get('/api/audit', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT a.*, u.FullName as UserName 
            FROM AuditLog a 
            LEFT JOIN Users u ON a.UserID = u.UserID 
            ORDER BY Timestamp DESC 
            LIMIT 100
        `);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/audit', async (req, res) => {
    const { userId, action, table, recordId } = req.body;
    try {
        await db.execute(
            'INSERT INTO AuditLog (UserID, Action, TableAffected, RecordID) VALUES (?, ?, ?, ?)',
            [userId || null, action, table || null, recordId || null]
        );
        res.json({ message: 'Saved to MySQL' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT UserID, FullName, Email, Role, CreatedAt FROM Users ORDER BY UserID DESC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
    const { userId } = req.query;
    try {
        await db.execute('DELETE FROM Users WHERE UserID = ?', [req.params.id]);
        await auditLog(userId, `Deleted user ID: ${req.params.id}`, 'Users', req.params.id);
        res.json({ message: 'Saved to MySQL' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
});
