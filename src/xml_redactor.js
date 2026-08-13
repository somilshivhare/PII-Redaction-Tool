'use strict';

const PizZip = require('pizzip');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const { redact } = require('./redactor');

/**
 * Redacts PII in a Word document buffer (.docx) in-place without losing document formatting.
 * Processes both Table Cells (<w:tc>) and Top-Level Paragraphs (<w:p>) to handle wrapped cell text.
 *
 * @param {Buffer} docxBuffer - Input .docx file buffer
 * @returns {{ redactedBuffer: Buffer, entities: Array }}
 */
function redactDocxBuffer(docxBuffer) {
  const zip = new PizZip(docxBuffer);
  const domParser = new DOMParser();
  const xmlSerializer = new XMLSerializer();
  const { FakeFactory } = require('./redactor');
  const factory = new FakeFactory();

  const allEntities = [];

  // Identify all text-containing XML files in the word/ directory
  const xmlFiles = Object.keys(zip.files).filter((filename) =>
    /^word\/(document|header\d*|footer\d*)\.xml$/.test(filename)
  );

  for (const filename of xmlFiles) {
    const xmlRaw = zip.files[filename].asText();
    if (!xmlRaw) continue;

    const doc = domParser.parseFromString(xmlRaw, 'text/xml');
    let fileModified = false;

    // Pass A: Table Cell Level (<w:tc>) Concatenated Text Processing
    const tableCells = doc.getElementsByTagName('w:tc');
    for (let i = 0; i < tableCells.length; i++) {
      const tc = tableCells[i];
      const textNodes = tc.getElementsByTagName('w:t');
      if (textNodes.length === 0) continue;

      // Extract full concatenated cell text across all paragraphs and runs within the cell
      let cellTextParts = [];
      for (let j = 0; j < textNodes.length; j++) {
        const txt = (textNodes[j].textContent || '').trim();
        if (txt) cellTextParts.push(txt);
      }

      const fullCellText = cellTextParts.join(' ');
      if (!fullCellText.trim()) continue;

      const { redactedText, entities } = redact(fullCellText, factory);

      if (entities.length > 0) {
        allEntities.push(...entities);
        fileModified = true;

        // Place redacted text into the first <w:t> run in the cell and clear remaining runs
        textNodes[0].textContent = redactedText;
        if (textNodes[0].setAttribute) {
          textNodes[0].setAttribute('xml:space', 'preserve');
        }
        for (let j = 1; j < textNodes.length; j++) {
          textNodes[j].textContent = '';
        }
      }
    }

    // Pass B: Top-Level Paragraph Processing (<w:p>) for body text outside tables
    const paragraphs = doc.getElementsByTagName('w:p');
    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      // Skip paragraphs inside tables (already processed in Pass A)
      let parent = p.parentNode;
      let insideCell = false;
      while (parent) {
        if (parent.nodeName === 'w:tc') { insideCell = true; break; }
        parent = parent.parentNode;
      }
      if (insideCell) continue;

      const textNodes = p.getElementsByTagName('w:t');
      if (textNodes.length === 0) continue;

      let originalParagraphText = '';
      for (let j = 0; j < textNodes.length; j++) {
        originalParagraphText += textNodes[j].textContent || '';
      }

      if (!originalParagraphText.trim()) continue;

      const { redactedText, entities } = redact(originalParagraphText, factory);

      if (entities.length > 0 && redactedText !== originalParagraphText) {
        allEntities.push(...entities);
        fileModified = true;

        textNodes[0].textContent = redactedText;
        if (textNodes[0].setAttribute) {
          textNodes[0].setAttribute('xml:space', 'preserve');
        }
        for (let j = 1; j < textNodes.length; j++) {
          textNodes[j].textContent = '';
        }
      }
    }

    if (fileModified) {
      const updatedXml = xmlSerializer.serializeToString(doc);
      zip.file(filename, updatedXml);
    }
  }

  const redactedBuffer = zip.generate({ type: 'nodebuffer' });
  return { redactedBuffer, entities: allEntities };
}

module.exports = { redactDocxBuffer };
