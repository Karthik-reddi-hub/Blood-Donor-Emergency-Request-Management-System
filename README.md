# 🩸 BloodLink Pro | Premium Healthcare Network

A high-performance, full-stack medical platform for blood donor and emergency request management. Designed with a **Premium SaaS aesthetic** (Linear/Vercel inspired) to provide a clean, trustworthy, and professional user experience.

## 🚀 Key Features
- **Healthcare SaaS UI**: Built with a clean "Apple Health" inspired design system using Inter typography and neutral surfaces.
- **Matching Engine**: Sophisticated ranking for eligible donors based on location, blood group compatibility (O- universal fallback), and eligibility rules.
- **Audit Logging**: Every administrative action is recorded in a permanent MySQL audit log for compliance.
- **Hospital Inventory**: Direct management of blood bank stock per hospital, separate from global requests.
- **Role-Based Access**:
    - **Admin**: Full system control, analytics, and audit logs.
    - **Hospital**: Request management and stock tracking.
    - **Donor**: Profile impact, donation history, and "Help Now" portal.

## 🛠️ Tech Stack
- **Frontend**: Vanilla HTML5/CSS3/JS (No frameworks)
- **Backend**: Node.js & Express.js
- **Database**: MySQL 8.0
- **Auth**: JWT (JSON Web Tokens) & Bcrypt password hashing
- **Icons**: Minimalist SVG/Unicode system

## 🔐 Credentials (Demo)
| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@bloodlink.in` | `Admin@123` |
| **Donor** | `donor@bloodlink.in` | `Donor@789` |
| **Hospital** | `cityhospital@bloodlink.in` | `Hosp@1` |

## 📦 Setup & Installation
1.  **Database**: Create a MySQL database named `bloodlink` and run `schema.sql`.
2.  **Environment**: Update `.env` with your `DB_PASSWORD`.
3.  **Install**: `npm install`
4.  **Run**: `node server.js`
5.  **Access**: Open `index.html` in any modern browser.

---
*Created for the DBMS Lab Project - Professional Grade.*
