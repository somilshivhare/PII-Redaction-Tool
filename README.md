# 🛡️ PII Redaction Tool

A high-performance, stateless PII (Personally Identifiable Information) Redaction Engine built in pure Node.js and Express. It parses Microsoft Word (`.docx`) files **entirely in RAM memory** and replaces sensitive entities across 9 categories with format-consistent fake data while preserving 100% of document formatting, table layouts, fonts, and images.

---

## ✨ Key Features & Architecture

* 📄 **100% Formatting Preservation**: Edits text runs directly in-place inside `word/document.xml` using `PizZip` and `@xmldom/xmldom`. Original fonts, headings, tables, borders, and margins remain completely untouched.
* ⚡ **Ephemeral In-Memory Processing**: Holds uploaded files as byte buffers in RAM (`multer.memoryStorage()`) with **Zero Disk/Cloud Data Retention** ("Privacy by Design").
* 🧠 **Open-Vocabulary Name NER**: Integrates `compromise` NLP and context-anchored role/designation rules to detect person names dynamically across any company's document without fragile hardcoding.
* 💳 **Mathematical Luhn Validation**: Uses the Luhn algorithm for credit card validation, preventing false positives on order IDs, ticket numbers, or invoice IDs.
* 🔄 **2-Pass Idempotent Value Propagation**: Detects entities by pattern in Pass 1, then propagates caught values across all paragraphs/sections in Pass 2 for consistent mapping and zero leaks.
* 📱 **Mobile-Responsive Web UI**: Modern dark-mode interface supporting drag-and-drop uploads, processing spinners, and real-time category badge counts.

---

## 🔍 Supported PII Categories & Detectors

| Category | Detection Strategy |
| :--- | :--- |
| **CREDIT_CARD** | 13–19 digit sequence + **Luhn Checksum Algorithm** validation |
| **SSN** | Universal `XXX-XX-XXXX` pattern |
| **IP_ADDRESS** | Standard IPv4 dotted-quad regex |
| **EMAIL** | Standard RFC-compliant email regex |
| **PHONE** | International `+CC` and national format regexes |
| **DOB** | Context-gated date patterns (`Date of Birth`, `DOB`, `Born on`) |
| **FULL_NAME** | `compromise` NLP + Title prefixes (`Mr.`, `Dr.`) + Designation anchors (`Director`, `Manager`, `CFO`, `CS`, `Promoter`) + ALL-CAPS listings |
| **COMPANY_NAME** | Title-Case and ALL-CAPS phrases ending in legal suffixes (`Limited`, `LLP`, `Pvt Ltd`, `Inc`, `Corp`) |
| **ADDRESS** | Location/street anchors (`Village`, `Tower`, `Building`, `Road`, `Avenue`) + Postal PIN/ZIP code patterns + Pass 2 propagation |

---

## 🚀 Getting Started

### Prerequisites
* Node.js v18+ 
* npm v9+

### Installation
```bash
git clone https://github.com/<your-username>/pii-redaction-tool.git
cd pii-redaction-tool
npm install
```

### Running the Web Server
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser to access the drag-and-drop Web UI.

### Running the CLI Redactor
```bash
node redact_document.js <input.docx> <output.docx> [entities.json]
```

### Running the Benchmark Test Suite
```bash
node test/evaluate.js
```

---

## 📡 API Reference

### `POST /redact`
Accepts a `.docx` file and returns the redacted `.docx` buffer along with entity counts in headers.

* **Content-Type**: `multipart/form-data`
* **Form Field**: `file` (`.docx` document)
* **Response**: Binary `.docx` stream
* **Response Header**: `X-Entity-Summary` (JSON object of redacted entity counts)

---

## 🐳 Docker Deployment

```bash
# Build Docker image
docker build -t pii-redactor .

# Run Docker container
docker run -p 3000:3000 pii-redactor
```

---

## 📄 License
Licensed under the [MIT License](LICENSE).
