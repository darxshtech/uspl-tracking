require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function migrate() {
  console.log('Running Document Vault database migration...');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    // 1. Create documents table if not exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        category VARCHAR(100) NOT NULL DEFAULT 'Project Document',
        file_url VARCHAR(1000) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(50) NULL,
        file_size BIGINT NULL DEFAULT 0,
        project_id INT NULL,
        is_public_all TINYINT(1) NOT NULL DEFAULT 0,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_doc_category (category),
        INDEX idx_doc_project (project_id),
        INDEX idx_doc_created_by (created_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure category column is VARCHAR(100) to support Quotation, Marketing, Admin, etc.
    await connection.query(`
      ALTER TABLE documents MODIFY COLUMN category VARCHAR(100) NOT NULL DEFAULT 'Project Document';
    `);
    console.log('✓ `documents` table & category column updated.');

    // 2. Create document_access table for granular access control
    await connection.query(`
      CREATE TABLE IF NOT EXISTS document_access (
        id INT AUTO_INCREMENT PRIMARY KEY,
        document_id INT NOT NULL,
        user_id INT NOT NULL,
        granted_by INT NOT NULL,
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_doc_user (document_id, user_id),
        INDEX idx_da_doc (document_id),
        INDEX idx_da_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ `document_access` table created / verified.');

    console.log('Migration completed successfully with 0 errors.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await connection.end();
  }
}

migrate();
