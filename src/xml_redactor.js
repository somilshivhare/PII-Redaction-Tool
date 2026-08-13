'use strict';

const PizZip = require('pizzip');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const { redact } = require('./redactor');

/**
 * Redacts PII in a Word document buffer (.docx) in-place without losing document formatting.
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
    const paragraphs = doc.getElementsByTagName('w:p');

    let fileModified = false;

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      const textNodes = p.getElementsByTagName('w:t');
      if (textNodes.length === 0) continue;

      // Extract full paragraph text across all <w:t> runs
      let originalParagraphText = '';
      for (let j = 0; j < textNodes.length; j++) {
        originalParagraphText += textNodes[j].textContent || '';
      }

      if (!originalParagraphText.trim()) continue;

      // Run core PII redaction engine with shared factory across document
      const { redactedText, entities } = redact(originalParagraphText, factory);

      if (entities.length > 0 && redactedText !== originalParagraphText) {
        allEntities.push(...entities);
        fileModified = true;

        // Place redacted text into the first <w:t> run and clear remaining runs
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
