import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "employee_tracking",
  });

  try {
    console.log("Altering attendance table status ENUM...");
    await connection.query(`
      ALTER TABLE attendance 
      MODIFY COLUMN status ENUM('Present', 'Half Day', 'Absent', 'Holiday', 'Leave', 'Leave (Pending)', 'Present (Overtime)') NOT NULL DEFAULT 'Present'
    `);
    
    console.log("Adding leave balance columns to users table...");
    try {
      await connection.query(`ALTER TABLE users ADD COLUMN total_leaves_allowed INT DEFAULT 2`);
      await connection.query(`ALTER TABLE users ADD COLUMN leaves_taken DECIMAL(5,2) DEFAULT 0`);
      await connection.query(`ALTER TABLE users ADD COLUMN leaves_carried_forward DECIMAL(5,2) DEFAULT 0`);
    } catch (e: any) {
      console.log("User leave columns might already exist: ", e.message);
    }
    
    console.log("Creating reminders table...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS reminders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        created_by INT NOT NULL,
        target_user_id INT NULL,
        is_global BOOLEAN DEFAULT FALSE,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        target_date DATE NOT NULL,
        target_time VARCHAR(10) NOT NULL,
        is_sent BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Creating credentials table...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS credentials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NULL,
        user_id INT NOT NULL,
        role VARCHAR(50) NOT NULL,
        live_link TEXT,
        demo_link TEXT,
        credentials_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Add columns to projects table
    console.log("Adding columns to projects table...");
    try {
      await connection.query(`ALTER TABLE projects ADD COLUMN sr_no INT DEFAULT 0`);
    } catch (e: any) {
      console.log("Project sr_no column might already exist: ", e.message);
    }
    try {
      await connection.query(`ALTER TABLE projects ADD COLUMN is_fast_track TINYINT(1) DEFAULT 0`);
      console.log("Added is_fast_track column to projects");
    } catch (e: any) {
      console.log("Project is_fast_track column might already exist: ", e.message);
    }

    console.log("Done!");
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

main();
