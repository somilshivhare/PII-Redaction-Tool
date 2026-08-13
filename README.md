# PII Redaction Tool

## Approach

**Pure JavaScript, Ephemeral In-Memory Architecture**:
Processes `.docx` files **entirely in RAM memory (Buffers)** by directly parsing `word/document.xml` using `pizzip` and `@xmldom/xmldom`. 

- **100% Formatting Preserved**: Unlike text-extraction tools that strip document styling, this tool edits text runs in-place inside `word/document.xml`, preserving original fonts, headings, tables, borders, and margins.
- **Zero Disk/Cloud Storage**: Files are held transiently in RAM (`Buffer`) during HTTP request execution and never written to server disk or external cloud storage ("Privacy by Design").
- **Zero CLI Dependencies**: Fully self-contained pure JavaScript — no external CLI binaries (`pandoc`) or python setups required.

**Pipeline** (`redact_document.js` / `server.js`):
1. `input.docx` Buffer → parsed directly into XML DOM via `pizzip` + `@xmldom/xmldom`
2. Paragraph XML text → redacted text + entity list via `src/redactor.js`
3. Updated XML DOM → serialized back into `.docx` Buffer

**Avoiding double-redaction:** detectors run in order of specificity
(credit card → SSN → IP → email → phone → DOB → titled name → ALL-CAPS name →
company → address). Each match is swapped out immediately, so looser
downstream detectors can never re-match text a stricter detector already redacted.

**Consistency:** the same original value always maps to the same fake value
throughout the document (a `Map` inside `FakeFactory`), matching the
assignment's example (`Rashi Patil` → always `John Doe`, never a different
fake name each time).

## Detectors

| Type | Method |
|---|---|
| Credit card | 13–19 digit sequence + **Luhn checksum** validation (avoids flagging random long numbers) |
| SSN | `XXX-XX-XXXX` |
| IP address | IPv4 dotted-quad |
| Email | standard email regex |
| Phone | `+CC ...` international-format numbers |
| Date of birth | date pattern **only** when preceded by "Date of Birth"/"DOB" |
| Full name | (a) "Mr./Mrs./Ms./Dr./Shri/Smt. Firstname Lastname", or (b) 2–4 consecutive ALL-CAPS words, filtered against an English function-word list + domain boilerplate stoplist |
| Company name | Title-Case phrase ending in a legal suffix (Limited, LLP, Pvt Ltd, Inc, Corp, ...) |
| Address | text segment ending in a 6-digit Indian PIN code, immediately followed by "Maharashtra"/"India"/"City, India" |

## Running it

```bash
npm install
npm start                      # Starts Express server on http://localhost:3000
node redact_document.js <input.docx> <output.docx> [entities.json] # CLI tool
node test/evaluate.js          # Precision/Recall/F1 evaluation suite
```

