/**
 * Synthetic test set.
 *
 * The real assignment document (an Indian IPO Red Herring Prospectus)
 * naturally contains names, emails, phone numbers, addresses and company
 * names — but NOT SSNs, credit card numbers, raw IP addresses, or
 * "Date of Birth" fields (those aren't things that appear in a public
 * prospectus). To honestly evaluate every required category, we test
 * those four against hand-written synthetic sentences with known
 * ground truth, in addition to spot-checking the real document for the
 * categories it does contain (see EVALUATION_REPORT.md).
 *
 * Each case: { text, expected: [ {type, value} ] }
 * `expected` lists every PII span that SHOULD be redacted.
 */

module.exports = [
  { text: "Please contact Rashi Patil at rashi.patil@gmail.com or Rohan Dey at rohan.dey@gmail.com.",
    expected: [
      { type: 'FULL_NAME', value: 'Rashi Patil' },
      { type: 'EMAIL', value: 'rashi.patil@gmail.com' },
      { type: 'FULL_NAME', value: 'Rohan Dey' },
      { type: 'EMAIL', value: 'rohan.dey@gmail.com' },
    ] },

  { text: "You can reach the support desk at +91 9876543210 or the US office at +1 415-555-0132.",
    expected: [
      { type: 'PHONE', value: '+91 9876543210' },
      { type: 'PHONE', value: '+1 415-555-0132' },
    ] },

  { text: "Mr. Aditya Sharma and Ms. Priya Nair will be joining Dr. Kavita Rao for the review.",
    expected: [
      { type: 'FULL_NAME', value: 'Aditya Sharma' },
      { type: 'FULL_NAME', value: 'Priya Nair' },
      { type: 'FULL_NAME', value: 'Kavita Rao' },
    ] },

  { text: "OUR PROMOTERS: RAJESH KUMAR VERMA, SUNITA KUMAR VERMA AND ANIL JOSHI.",
    expected: [
      { type: 'FULL_NAME', value: 'RAJESH KUMAR VERMA' },
      { type: 'FULL_NAME', value: 'SUNITA KUMAR VERMA' },
      { type: 'FULL_NAME', value: 'ANIL JOSHI' },
    ] },

  { text: "The applicant's SSN is 512-34-9021 and should be verified before processing.",
    expected: [ { type: 'SSN', value: '512-34-9021' } ] },

  { text: "Card on file: 4539 1488 0343 6467, expires 09/27.",
    expected: [ { type: 'CREDIT_CARD', value: '4539 1488 0343 6467' } ] },

  { text: "Date of Birth: 14/03/1990 was recorded at intake.",
    expected: [ { type: 'DOB', value: '14/03/1990' } ] },

  { text: "The request originated from IP address 192.168.1.104 and was logged.",
    expected: [ { type: 'IP_ADDRESS', value: '192.168.1.104' } ] },

  { text: "She works at Globex Corporation, while he was previously at Initech Private Limited.",
    expected: [
      { type: 'COMPANY_NAME', value: 'Globex Corporation' },
      { type: 'COMPANY_NAME', value: 'Initech Private Limited' },
    ] },

  { text: "Registered office: 221B Baker Street, London – 411 045, Maharashtra, India.",
    expected: [ { type: 'ADDRESS', value: '221B Baker Street, London – 411 045' } ] },

  // negative controls — these must NOT be redacted (precision check)
  { text: "Order Number: 998877, Ticket ID: 44521, Invoice No: 2026-0091.",
    expected: [] },
  { text: "The Companies Act, 2013 governs SEBI ICDR Regulations for Indian firms.",
    expected: [] },
];
