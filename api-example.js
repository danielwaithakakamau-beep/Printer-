/**
 * Epson Connect API – Node.js backend skeleton (API v2)
 *
 * Prerequisites:
 * 1. Register at https://developer.epsonconnect.com and create an App
 * 2. Obtain Client ID, Client Secret, API Key
 * 3. Register your physical Epson printer with Epson Connect
 *
 * Install:
 *   npm init -y
 *   npm install express multer form-data node-fetch
 *
 * Run:
 *   node api-example.js
 *
 * Then POST a file to http://localhost:3000/api/print
 */

const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const fetch = require('node-fetch'); // or native fetch in Node 18+

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// ---------- CONFIG (use environment variables in production) ----------
const CONFIG = {
  clientId: process.env.EPSON_CLIENT_ID || 'YOUR_CLIENT_ID',
  clientSecret: process.env.EPSON_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
  apiKey: process.env.EPSON_API_KEY || 'YOUR_API_KEY',
  // Base URLs for API v2 (confirm current endpoints in the official docs)
  authUrl: 'https://auth.epsonconnect.com/auth/token',
  apiBase: 'https://api.epsonconnect.com/api/2',
};

/**
 * Step 1 – Authenticate and obtain a device token
 * (Simplified – real OAuth2 may involve authorization code + redirect for user consent)
 */
async function getDeviceToken(deviceIdOrEmail) {
  // For device authentication the exact grant type / parameters
  // are documented in the official Epson Connect API tutorial.
  // This is a placeholder showing the shape of the request.

  const body = new URLSearchParams({
    grant_type: 'client_credentials', // or the specific grant required by Epson
    client_id: CONFIG.clientId,
    client_secret: CONFIG.clientSecret,
    // subject / device identification may be required
  });

  const res = await fetch(CONFIG.authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-api-key': CONFIG.apiKey,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  // Expected fields: access_token, refresh_token, expires_in, device_id …
  return data;
}

/**
 * Step 2 – Create a print job
 */
async function createPrintJob(token, deviceId, settings = {}) {
  const payload = {
    jobName: `hub-${Date.now()}`,
    printMode: 'document', // or 'photo'
    printSettings: {
      paperSize: settings.paperSize || 'ps_a4',
      paperType: 'pt_plainpaper',
      borderless: settings.borderless || false,
      printQuality: settings.printQuality || 'normal',
      paperSource: 'auto',
      colorMode: settings.colorMode || 'color',
      copies: settings.copies || 1,
      // duplex settings depend on model capability
    },
  };

  const res = await fetch(`${CONFIG.apiBase}/printing/jobs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-api-key': CONFIG.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create job failed: ${res.status} ${text}`);
  }

  return res.json(); // contains jobId, uploadUri, etc.
}

/**
 * Step 3 – Upload the file
 */
async function uploadFile(uploadUri, fileBuffer, fileName) {
  const res = await fetch(uploadUri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/pdf', // adjust according to file type
      // Some endpoints expect a specific query param like &File=1.pdf
    },
    body: fileBuffer,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }

  return true;
}

/**
 * Step 4 – Execute the print job
 */
async function executePrint(token, jobId) {
  const res = await fetch(`${CONFIG.apiBase}/printing/jobs/${jobId}/print`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-api-key': CONFIG.apiKey,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Execute print failed: ${res.status} ${text}`);
  }

  return res.json();
}

// ---------- HTTP endpoint ----------
app.post('/api/print', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const deviceId = req.body.deviceId || process.env.EPSON_DEVICE_ID;
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId required' });
    }

    const settings = {
      paperSize: req.body.paperSize,
      colorMode: req.body.colorMode,
      printQuality: req.body.printQuality,
      copies: parseInt(req.body.copies, 10) || 1,
      borderless: req.body.borderless === 'true',
    };

    console.log('Authenticating…');
    const auth = await getDeviceToken(deviceId);
    const token = auth.access_token;

    console.log('Creating job…');
    const job = await createPrintJob(token, deviceId, settings);
    const { jobId, uploadUri } = job;

    console.log('Uploading file…');
    await uploadFile(uploadUri, req.file.buffer, req.file.originalname);

    console.log('Executing print…');
    const result = await executePrint(token, jobId);

    res.json({
      success: true,
      jobId,
      result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('Epson Connect API proxy is running. POST a file to /api/print');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Epson Connect proxy listening on http://localhost:${PORT}`);
  console.log('Remember to set EPSON_CLIENT_ID, EPSON_CLIENT_SECRET, EPSON_API_KEY');
});

/**
 * IMPORTANT
 * ----------
 * The exact authentication grant, endpoints, and field names can change.
 * Always consult the current official documentation:
 *   https://developer.epsonconnect.com
 *   https://docs.epsonconnect.com
 *
 * After April 2026 only API v2 is supported.
 */
