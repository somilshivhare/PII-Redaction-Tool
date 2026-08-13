#!/usr/bin/env node
/**
 * Usage:
 *   node redact_document.js <input.docx> <output.docx> [entities.json]
 *
 * In-Memory OpenXML Pipeline:
 *   1. Reads input.docx as Buffer into RAM.
 *   2. Parses word/document.xml and headers/footers directly in pure JS (src/xml_redactor.js).
 *   3. Redacts PII spans while preserving 100% of document styling, tables, images, and formatting.
 *   4. Writes output.docx Buffer to disk.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { redactDocxBuffer } = require('./src/xml_redactor');

function main() {
  const [, , inputPath, outputPath, entitiesJsonPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error('Usage: node redact_document.js <input.docx> <output.docx> [entities.json]');
    process.exit(1);
  }

  const absoluteInput = path.resolve(inputPath);
  const absoluteOutput = path.resolve(outputPath);

  if (!fs.existsSync(absoluteInput)) {
    console.error(`Error: File not found: ${absoluteInput}`);
    process.exit(1);
  }

  console.log(`[1/3] Reading ${absoluteInput} into memory ...`);
  const inputBuffer = fs.readFileSync(absoluteInput);

  console.log('[2/3] Running OpenXML PII redaction engine ...');
  const { redactedBuffer, entities } = redactDocxBuffer(inputBuffer);
  console.log(`      -> ${entities.length} PII spans redacted across ${new Set(entities.map(e => e.type)).size} categories`);

  console.log(`[3/3] Writing redacted docx to ${absoluteOutput} ...`);
  fs.writeFileSync(absoluteOutput, redactedBuffer);

  const jsonPath = entitiesJsonPath || absoluteOutput.replace(/\.docx$/, '.entities.json');
  const summary = {};
  for (const e of entities) summary[e.type] = (summary[e.type] || 0) + 1;
  fs.writeFileSync(jsonPath, JSON.stringify({ summary, entities }, null, 2));
  console.log(`      -> entity report written to ${jsonPath}`);
  console.log('\nSummary by type:');
  for (const [type, count] of Object.entries(summary)) console.log(`  ${type.padEnd(18)} ${count}`);
}

try {
  main();
} catch (err) {
  console.error('Redaction failed:', err);
  process.exit(1);
}

