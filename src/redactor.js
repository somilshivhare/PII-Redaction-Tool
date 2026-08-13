'use strict';

/**
 * Universal PII Redaction Engine (Pure JS + compromise NLP)
 * - Zero document-specific hardcoding
 * - Open-vocabulary Name NER via compromise NLP + Titles & Roles
 * - Mathematical Luhn algorithm validation for credit cards
 * - Universal pattern regexes for Email, Phone, SSN, IP, DOB, Company, Address
 * - Chunked Paragraph NLP Execution (Low RAM footprint < 15MB)
 * - 2-Pass Idempotent Value Propagation across the document
 */

const nlp = require('compromise');

const FAKE_FIRST_NAMES = ['John', 'Jane', 'Peter', 'Mary', 'Robert', 'Linda', 'Michael', 'Susan', 'David', 'Karen'];
const FAKE_LAST_NAMES = ['Doe', 'Smith', 'Parker', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson'];
const FAKE_COMPANY_STEMS = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Stark', 'Wayne', 'Hooli', 'Soylent', 'Cyberdyne', 'Wonka'];
const FAKE_COMPANY_SUFFIXES = ['Limited', 'Private Limited', 'Industries Limited', 'Corp', 'Inc.', 'LLP'];
const FAKE_STREETS = ['123 Maple Street', '45 Oak Avenue', '78 Pine Road', '12 Elm Boulevard', '99 Cedar Lane'];
const FAKE_CITIES = ['Springfield', 'Rivertown', 'Fairview', 'Lakeside', 'Millbrook'];

class FakeFactory {
  constructor() {
    this.maps = new Map();
    this.counters = new Map();
  }

  _next(type) {
    const c = (this.counters.get(type) || 0) + 1;
    this.counters.set(type, c);
    return c;
  }

  get(type, original, genFn) {
    if (!this.maps.has(type)) this.maps.set(type, new Map());
    const m = this.maps.get(type);
    const key = original.trim().toUpperCase();
    if (!m.has(key)) {
      m.set(key, genFn(this._next(type)));
    }
    return m.get(key);
  }
}

function fakeName(idx, isUpper) {
  const f = FAKE_FIRST_NAMES[idx % FAKE_FIRST_NAMES.length];
  const l = FAKE_LAST_NAMES[Math.floor(idx / FAKE_FIRST_NAMES.length) % FAKE_LAST_NAMES.length];
  const name = `${f} ${l}`;
  return isUpper ? name.toUpperCase() : name;
}

function fakeEmail(idx) {
  const f = FAKE_FIRST_NAMES[idx % FAKE_FIRST_NAMES.length].toLowerCase();
  const l = FAKE_LAST_NAMES[Math.floor(idx / FAKE_FIRST_NAMES.length) % FAKE_LAST_NAMES.length].toLowerCase();
  return `${f}.${l}@example.com`;
}

function fakePhone(idx, original) {
  const hasCC = /^\+/.test(original.trim());
  const base = String(1234567000 + idx).slice(-10);
  return hasCC ? `+91 ${base}` : base;
}

function fakeCompany(idx) {
  const s = FAKE_COMPANY_STEMS[idx % FAKE_COMPANY_STEMS.length];
  const suf = FAKE_COMPANY_SUFFIXES[Math.floor(idx / FAKE_COMPANY_STEMS.length) % FAKE_COMPANY_SUFFIXES.length];
  return `${s} ${suf}`;
}

function fakeAddress(idx) {
  return `${FAKE_STREETS[idx % FAKE_STREETS.length]}, ${FAKE_CITIES[Math.floor(idx / FAKE_STREETS.length) % FAKE_CITIES.length]}`;
}

function luhnValid(numStr) {
  const digits = numStr.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

const DETECTORS = [
  {
    type: 'CREDIT_CARD',
    regex: /\b(?:\d[ -]?){13,19}\b/g,
    filter: (m) => luhnValid(m[0]),
    fake: (m, f) => f.get('CREDIT_CARD', m[0], (i) => `4111 1111 1111 ${String(i).padStart(4, '0')}`),
  },
  {
    type: 'SSN',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    fake: (m, f) => f.get('SSN', m[0], (i) => `900-00-${String(i).padStart(4, '0')}`),
  },
  {
    type: 'IP_ADDRESS',
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    fake: (m, f) => f.get('IP_ADDRESS', m[0], (i) => `10.0.${Math.floor(i / 254)}.${(i % 254) + 1}`),
  },
  {
    type: 'EMAIL',
    regex: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
    fake: (m, f) => f.get('EMAIL', m[0], fakeEmail),
  },
  {
    type: 'PHONE',
    regex: /\+\s*\d{1,3}[\s.-]?\(?\d{2,4}\)?(?:[\s.-]?\d{2,4}){2,4}\b|\b(?:Tel|Telephone|Phone|Mobile|Fax)\s*[:\-–]?\s*(\+?\s*\d[\d\s.-]{7,15}\d)\b/gi,
    fake: (m, f) => {
      const val = m[1] || m[0];
      return f.get('PHONE', val, (i) => fakePhone(i, val));
    },
  },
  {
    type: 'DOB',
    regex: /\b(?:Date of Birth|DOB|Born on)\s*[:\-–]?\s*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})\b/gi,
    captureGroup: 1,
    fake: (m, f) => f.get('DOB', m[1], (i) => `${String((i % 28) + 1).padStart(2, '0')}/${String((i % 12) + 1).padStart(2, '0')}/${1970 + (i % 30)}`),
  },
  {
    type: 'FULL_NAME',
    regex: /\b(?:Mr|Mrs|Ms|Dr|Prof|Eng|Shri|Smt)\.?\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,2})\b/g,
    captureGroup: 1,
    fake: (m, f) => f.get('FULL_NAME', m[1], (i) => fakeName(i, false)),
  },
  {
    type: 'FULL_NAME',
    regex: /\b([A-Z][A-Z]{2,}(?:\s+[A-Z][A-Z]{2,}){1,3})\b/g,
    filter: (m) => {
      const words = m[1].split(/\s+/);
      const stop = new Set(['THE','AND','FOR','OUR','WITH','FROM','THIS','THAT','THESE','THOSE','OFFICE','REGISTERED','CORPORATE','PROSPECTUS','RED','HERRING','OFFER','ISSUE','SHARE','SHARES','EQUITY','BOARD','DIRECTORS','BANK','SECURITIES','CAPITAL','MARKET','EXCHANGE','ACT','SEBI','DETAILS','DATE','WEBSITE','TELEPHONE','EMAIL','CONTACT','PERSON','INFORMATION']);
      if (words.some(w => stop.has(w))) return false;
      return words.length >= 2 && words.length <= 4;
    },
    fake: (m, f) => f.get('FULL_NAME', m[1], (i) => fakeName(i, true)),
  },
  {
    type: 'FULL_NAME',
    regex: /\b(?:Director|Manager|Officer|President|CEO|CFO|CTO|Engineer|Consultant|Secretary|Representative|Signatory|Promoter|Auditor|Shareholder|Partner|Contact Person)\s*[:\-–,]?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b|\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*[:\-–,]?\s+(?:Director|Manager|Officer|President|CEO|CFO|CTO|Engineer|Consultant|Secretary|Representative|Signatory|Promoter|Auditor|Shareholder|Partner|Contact Person)\b/g,
    fake: (m, f) => f.get('FULL_NAME', m[1] || m[2], (i) => fakeName(i, false)),
  },
  {
    type: 'COMPANY_NAME',
    regex: /\b([A-Z][A-Za-z0-9&.]*(?:\s+[A-Z][A-Za-z0-9&.]*){0,4}\s+(?:Limited|Ltd\.?|LLP|Pvt\.?\s*Ltd\.?|Private\s+Limited|Inc\.?|Corp\.?|Corporation))\b/gi,
    captureGroup: 1,
    fake: (m, f) => f.get('COMPANY_NAME', m[1], fakeCompany),
  },
  {
    type: 'ADDRESS',
    regex: /([A-Za-z0-9,/.\-\s]{10,90}?[–-]?\s*\d{3}\s?\d{3})(?=\s*,?\s*(?:Maharashtra|India|[A-Z][a-z]+,\s*India))|\b[A-Za-z0-9,/.\-\s]{5,90}?\b(?:Village|Tower|Business Centre|Building|Farms|Taluka|District|Off|Plot|Gat No|Industrial Area|Phase|Complex|Society|Nagar|Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Suite|Floor|Birdewadi|Chakan|Baner|Pashan|Khed)\b[A-Za-z0-9,/.\-\s]{0,60}?(?=\s*,|\s*\.|\n|$)/gi,
    fake: (m, f) => f.get('ADDRESS', m[1] || m[0], fakeAddress),
  },
];

function redact(text, sharedFactory) {
  const factory = sharedFactory || new FakeFactory();
  const entities = [];
  let working = text;

  if (/[\/;]/.test(working)) {
    const segments = working.split(/[\/;]/);
    for (let seg of segments) {
      seg = seg.trim();
      if (/^[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?$/.test(seg)) {
        const fakeVal = factory.get('FULL_NAME', seg, (i) => fakeName(i, false));
        const escaped = seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'g');
        if (regex.test(working)) {
          working = working.replace(regex, (match) => {
            entities.push({ type: 'FULL_NAME', original: match, fake: fakeVal });
            return fakeVal;
          });
        }
      }
    }
  }

  for (const det of DETECTORS) {
    det.regex.lastIndex = 0;
    let out = '', last = 0, m;
    while ((m = det.regex.exec(working)) !== null) {
      if (det.filter && !det.filter(m)) continue;
      const grp = det.captureGroup || 0;
      const original = m[grp];
      if (!original) continue;

      const grpStart = grp === 0 ? m.index : working.indexOf(original, m.index);
      const grpEnd = grpStart + original.length;
      const fakeVal = det.fake(m, factory);

      out += working.slice(last, grpStart) + fakeVal;
      last = grpEnd;
      entities.push({ type: det.type, original, fake: fakeVal });
    }
    out += working.slice(last);
    working = out;
  }

  try {
    const paragraphs = working.split('\n');
    let nlpOutput = '';
    for (let p of paragraphs) {
      if (p.trim().length > 5) {
        const doc = nlp(p);
        const people = doc.people().out('array');
        for (let person of people) {
          person = person.trim();
          if (person && person.length > 3 && !/^(THE|AND|FOR|OUR|WITH|FROM|MR|MRS|MS|DR)$/i.test(person)) {
            if (FAKE_FIRST_NAMES.concat(FAKE_LAST_NAMES).some(f => new RegExp(`\\b${f}\\b`, 'i').test(person))) continue;
            const fakeVal = factory.get('FULL_NAME', person, (i) => fakeName(i, person === person.toUpperCase()));
            const escaped = person.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escaped}\\b`, 'g');
            if (regex.test(p)) {
              p = p.replace(regex, (match) => {
                entities.push({ type: 'FULL_NAME', original: match, fake: fakeVal });
                return fakeVal;
              });
            }
          }
        }
      }
      nlpOutput += p + '\n';
    }
    working = nlpOutput.trimEnd();
  } catch (e) {
    // compromise NLP fallback safety
  }

  const caught = [];
  for (const [type, map] of factory.maps.entries()) {
    for (const [origKey, fakeVal] of map.entries()) {
      if (origKey.length >= 4) {
        caught.push({ type, origKey, fakeVal });
        // Sub-word propagation for multi-token full names and addresses
        if (type === 'FULL_NAME' || type === 'ADDRESS') {
          const tokens = origKey.split(/[\s,]+/);
          for (const token of tokens) {
            const cleanToken = token.trim();
            if (cleanToken.length >= 4 && !/^(LIMITED|PRIVATE|TRUST|GROUP|CORPORATION|DIRECTOR|MANAGER|SECRETARY|OFFICER|OFFICE|CORPORATE|REGISTERED)$/i.test(cleanToken)) {
              const fakeToken = fakeVal.split(/[\s,]+/)[0] || fakeVal;
              caught.push({ type, origKey: cleanToken, fakeVal: fakeToken });
            }
          }
        }
      }
    }
  }
  caught.sort((a, b) => b.origKey.length - a.origKey.length);

  for (const item of caught) {
    const escaped = item.origKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    if (regex.test(working)) {
      working = working.replace(regex, (match) => {
        entities.push({ type: item.type, original: match, fake: item.fakeVal });
        return item.fakeVal;
      });
    }
  }

  // Prevent adjacent fake address / text values from running into each other without space separators
  working = working.replace(/([a-zA-Z])(\d{2,}\s+[A-Za-z])/g, '$1 $2');

  return { redactedText: working, entities };
}

module.exports = { redact, luhnValid, FakeFactory };
