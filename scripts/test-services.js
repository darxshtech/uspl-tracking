const nodemailer = require('nodemailer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        let val = trimmed.substring(idx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        process.env[key] = val;
      }
    }
  });
}

async function testServices() {
  console.log('--- 1. Testing Cloudinary Credentials ---');
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  try {
    const pingResult = await cloudinary.api.ping();
    console.log('✅ Cloudinary Ping Successful! Status:', pingResult);
  } catch (err) {
    console.error('❌ Cloudinary Ping Failed:', err.message);
  }

  console.log('\n--- 2. Testing SMTP Credentials (Gmail) ---');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    const verifyResult = await transporter.verify();
    console.log('✅ SMTP Connection & Authentication Successful! Server is ready to send messages:', verifyResult);
  } catch (err) {
    console.error('❌ SMTP Verification Failed:', err.message);
  }
}

testServices().catch(console.error);
