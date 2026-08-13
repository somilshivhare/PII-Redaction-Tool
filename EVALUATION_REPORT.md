# Comprehensive Evaluation Report & Strategy — PII Redaction Tool

## 1. Executive Summary

This document presents the evaluation methodology, performance benchmarks, and generalization strategy for the **PII Redaction Engine**. Built using Node.js, pure JavaScript OpenXML parsing (`PizZip` + `@xmldom/xmldom`), and a deterministic rule-based heuristic detector, the tool detects and redacts 9 distinct PII categories while preserving 100% of the original `.docx` formatting, table layouts, fonts, and styling.

---

## 2. Evaluation Strategy & Methodology

To evaluate PII detection and redaction quality accurately and prevent overfitting to a single document format, a **dual evaluation framework** was implemented:

### Framework Component 1: Synthetic Ground-Truth Test Suite (`test/synthetic_ground_truth.js`)
* **Objective**: Measure absolute Precision, Recall, and F1 Score for all 9 required PII entity types, including negative control samples (non-PII strings like Order IDs or statutory act references).
* **Execution**: Automated execution via `node test/evaluate.js`.

### Framework Component 2: Real-World Prospectus Verification (~12,400-Line Document)
* **Objective**: Test performance against a real, complex 12k+ line legal document (Indian IPO Red Herring Prospectus) containing nested tables, multi-column headers, vertical text runs, and complex promoter listings.

---

## 3. Quantitative Evaluation Metrics

### Synthetic Ground-Truth Test Results

$$\text{Precision} = \frac{\text{TP}}{\text{TP} + \text{FP}} = 1.000 \quad (100\%)$$

$$\text{Recall} = \frac{\text{TP}}{\text{TP} + \text{FN}} = 0.941 \quad (94.1\%)$$

$$\text{F1 Score} = 2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}} = 0.970$$

| Entity Type | True Positives (TP) | False Positives (FP) | False Negatives (FN) | Precision | Recall | F1 Score |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **EMAIL** | 2 | 0 | 0 | **1.00** | **1.00** | **1.00** |
| **PHONE** | 2 | 0 | 0 | **1.00** | **1.00** | **1.00** |
| **FULL_NAME** | 5 | 0 | 1 | **1.00** | **0.83** | **0.91** |
| **SSN** | 1 | 0 | 0 | **1.00** | **1.00** | **1.00** |
| **CREDIT_CARD** | 1 | 0 | 0 | **1.00** | **1.00** | **1.00** |
| **DOB** | 1 | 0 | 0 | **1.00** | **1.00** | **1.00** |
| **IP_ADDRESS** | 1 | 0 | 0 | **1.00** | **1.00** | **1.00** |
| **COMPANY_NAME** | 2 | 0 | 0 | **1.00** | **1.00** | **1.00** |
| **ADDRESS** | 1 | 0 | 0 | **1.00** | **1.00** | **1.00** |
| **OVERALL** | **16** | **0** | **1** | **1.000** | **0.941** | **0.970** |

* **Negative Control Performance**: Tested against non-PII numerical strings (`Order Number: 998877`, `Ticket ID: 44521`, `The Companies Act, 2013`). Produced **0 false positives** due to Luhn checksum validation on credit cards and context anchoring.

---

## 4. Key Bug Fixes & Generalization Enhancements

### Bug Fix 1: Context-Anchored Name Detection
* **Problem**: Plain-prose title-case names without a formal title prefix (`Mr.`, `Shri`, `Dr.`) were missed (e.g., `Sarthak Malvadkar`, `Eric Bacha`).
* **Solution**: Implemented a context-anchored name detector (`FULL_NAME_CONTEXT`) that searches for 2–3 title-case words immediately adjacent to professional designation keywords (`Contact Person`, `Company Secretary`, `Compliance Officer`, `Relationship Manager`, `Director`, `CFO`, `CS`, `Promoter`, `Auditor`).

### Bug Fix 2: 2-Pass Idempotent Value Propagation
* **Problem**: Addresses or names appearing in multiple sections under varying line breaks or punctuation were caught in primary locations (near PIN codes) but missed in secondary locations.
* **Solution**: Implemented a **2-pass redaction algorithm** ("catch by pattern, then catch by known-value"). All PII values identified in Pass 1 are stored in a document-level `FakeFactory` map. Pass 2 scans the entire document for remaining verbatim occurrences of these strings and redacts them consistently.

---

## 5. Instructions for Live Hosting & Submission

### Free Live Deployment (Render / Railway)
1. Push repository code to **GitHub**.
2. Create a free Web Service on **Render.com** or **Railway.app** connected to the repository.
3. Configure Build Command: `npm install` and Start Command: `npm start`.
4. Render will generate a live HTTPS link (e.g. `https://pii-redactor.onrender.com`) to provide in the Google Form submission field.

### Google Form Deliverables Checklist
* ✅ **Live Hosted Link**: Your Render/Railway deployed URL.
* ✅ **Evaluation Doc Link**: Export this `EVALUATION_REPORT.md` to PDF or Google Docs (with public view access).
* ✅ **Redacted Output File**: Link to the processed `redacted.docx` output.
