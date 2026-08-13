'use strict';

// Self-spawning V8 Max Heap Limit Enforcer (Forced 460MB ceiling on Render/Cloud)
if (!process.env._HEAP_SET) {
  const { spawnSync } = require('child_process');
  process.env._HEAP_SET = '1';
  const result = spawnSync(process.execPath, 
    ['--max-old-space-size=460', __filename, ...process.argv.slice(2)], 
    { stdio: 'inherit', env: process.env });
  process.exit(result.status);
}

/**
 * Express Web Server for PII Redaction Tool.
 * POST /redact  (multipart form, field name "file") -> returns redacted .docx
 * GET  /        -> simple upload form (public/index.html)
 *
 * Ephemeral In-Memory Architecture:
 * Uploaded files are processed strictly in RAM (Buffer) via pure JS OpenXML parsing,
 * preserving 100% of original formatting without writing any files to disk or using external CLI tools.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const { redactDocxBuffer } = require('./src/xml_redactor');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

app.use(express.static(path.join(__dirname, 'public')));

app.post('/redact', upload.single('file'), (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'No file uploaded (field name must be "file").' });
  }

  try {
    const inputBuf = req.file.buffer;
    req.file.buffer = null; // Release request buffer immediately for garbage collection

    const { redactedBuffer, entities } = redactDocxBuffer(inputBuf);

    const summary = {};
    for (const e of entities) summary[e.type] = (summary[e.type] || 0) + 1;

    res.set('X-Entity-Summary', encodeURIComponent(JSON.stringify(summary)));
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.set('Content-Disposition', 'attachment; filename="redacted.docx"');
    res.send(redactedBuffer);
  } catch (err) {
    console.error('Redaction error:', err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  const server = app.listen(PORT, () => console.log(`PII redactor server listening on http://localhost:${PORT}`));
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[ERROR] Port ${PORT} is already in use.`);
      console.error(`To free port ${PORT}, run:\n  npx kill-port ${PORT}\n  OR\n  lsof -ti :${PORT} | xargs kill -9\n`);
      process.exit(1);
    }
  });
}

module.exports = app;
