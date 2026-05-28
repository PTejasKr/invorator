/**
 * ocrParser.js — Intelligent OCR-to-Invoice Data Pipeline
 * 
 * Extracts structured invoice data from raw OCR/PDF text output.
 * Uses a multi-stage regex pipeline to identify:
 *   1. Vendor name (top-of-receipt heuristics)
 *   2. Dates (multiple format support)
 *   3. Invoice numbers
 *   4. Amounts, taxes, and totals
 *   5. Line items with quantity × rate decomposition
 * 
 * Returns both the parsed data AND parsing metadata for UI feedback.
 */

/**
 * @typedef {Object} ParseResult
 * @property {Object} data - The extracted invoice data fields
 * @property {Object} meta - Parsing statistics for UI feedback
 * @property {number} meta.itemCount - Number of line items extracted
 * @property {string} meta.confidence - "high" | "medium" | "low"
 * @property {string[]} meta.warnings - Human-readable parsing warnings
 */

/**
 * Main entry point. Parses raw OCR text into structured invoice data.
 * 
 * @param {string} rawText - The raw text output from Tesseract or pdf.js
 * @returns {ParseResult} Parsed data and metadata
 */
export function parseOCRText(rawText) {
  const data = {
    vendorName: "",
    vendorAddress: "",
    invoiceNumber: "",
    date: "",
    items: [],
    taxRate: 0,
    taxAmount: 0,
    subtotal: 0,
    total: 0,
    notes: "Auto-extracted from document scan."
  };

  // Metadata for the UI toast feedback loop
  const meta = {
    itemCount: 0,
    confidence: "low",
    warnings: []
  };

  if (!rawText) return { ...data, meta };

  const lines = rawText
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) return { ...data, meta };

  // ═══════════════════════════════════════════════════════
  // STAGE 1: VENDOR NAME EXTRACTION
  // Strategy: The vendor/company name is almost always in the
  // first 5 non-empty lines. We skip lines that look like
  // dates, phone numbers, or standard transaction headers.
  // ═══════════════════════════════════════════════════════
  const ignoreVendorKeywords = /invoice|receipt|bill|date|tel|phone|fax|mobile|web|www|email|http|cash|payment|welcome|tax|inv|gst|vat|no\.|order|slip|memo|quotation|estimate|proforma/i;
  
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const candidate = lines[i];
    // Must have at least 3 chars, contain letters, and not be 
    // a phone/date/invoice number line
    if (
      candidate.length > 2 &&
      !ignoreVendorKeywords.test(candidate) &&
      !/^\d{4,}/.test(candidate) &&        // skip pure number lines
      /[a-zA-Z]{2,}/.test(candidate)        // must have actual words
    ) {
      data.vendorName = candidate;
      break;
    }
  }
  
  if (!data.vendorName && lines.length > 0) {
    data.vendorName = lines[0];
    meta.warnings.push("Vendor name fallback: used first line of document.");
  }

  // ═══════════════════════════════════════════════════════
  // STAGE 2: DATE EXTRACTION
  // Supports: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, 
  //           "20 May 2026", "May 20, 2026"
  // ═══════════════════════════════════════════════════════
  const dateRegexes = [
    /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/,           // YYYY-MM-DD
    /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/,         // DD/MM/YYYY
    /\b(\d{1,2})?\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{1,2})?,?\s*(\d{2,4})\b/i  // Textual
  ];

  for (const line of lines) {
    let foundDate = false;
    for (const regex of dateRegexes) {
      const match = line.match(regex);
      if (match) {
        data.date = match[0];
        foundDate = true;
        break;
      }
    }
    if (foundDate) break;
  }
  
  if (!data.date) {
    data.date = new Date().toISOString().split("T")[0];
    meta.warnings.push("No date found — defaulted to today.");
  }

  // ═══════════════════════════════════════════════════════
  // STAGE 3: INVOICE NUMBER EXTRACTION
  // Looks for patterns like "Invoice No: INV-12345", 
  // "Bill # 789", "Receipt No. ABC-123"
  // ═══════════════════════════════════════════════════════
  const invRegexes = [
    /(?:invoice|inv|bill|receipt|doc|transaction|order)\s*(?:no|num|number|#)?[:\s#-]*([a-z0-9][\w-]{2,})/i,
    /#\s*([a-z0-9][\w-]{2,})/i
  ];

  for (const line of lines) {
    let foundInv = false;
    for (const regex of invRegexes) {
      const match = line.match(regex);
      if (match && match[1] && match[1].length > 2) {
        data.invoiceNumber = match[1].toUpperCase();
        foundInv = true;
        break;
      }
    }
    if (foundInv) break;
  }
  
  if (!data.invoiceNumber) {
    data.invoiceNumber = "INV-" + Math.floor(100000 + Math.random() * 900000);
    meta.warnings.push("No invoice number found — auto-generated.");
  }

  // ═══════════════════════════════════════════════════════
  // STAGE 4: AMOUNT, TAX & TOTAL EXTRACTION
  // Scans for currency-prefixed numbers and classifies them
  // as total, subtotal, or tax based on contextual keywords.
  // ═══════════════════════════════════════════════════════
  const allAmounts = [];

  for (const line of lines) {
    // Skip lines that are clearly not financial
    if (/^(Date|Tel|Phone|Fax|Email|Web)/i.test(line)) continue;
    
    // Match decimal amounts with optional currency symbols
    // Handles: $100.00, ₹1,200.50, 350.00, €99.99
    const matches = line.match(/(?:^|\s)[$€£₨₹]?\s*(\d{1,6}(?:[.,]\d{2}))(?:\s|$)/g);
    if (matches) {
      for (const m of matches) {
        const val = parseFloat(m.replace(/[^\d.]/g, ""));
        if (!isNaN(val) && val > 0) {
          allAmounts.push({ line, val });
        }
      }
    }
  }

  let rawTotal = 0;
  let rawSubtotal = 0;
  let rawTax = 0;

  for (const item of allAmounts) {
    const text = item.line.toLowerCase();
    const val = item.val;

    if (
      text.includes("grand total") ||
      text.includes("net payable") ||
      text.includes("amount payable") ||
      text.includes("invoice total") ||
      (text.includes("total") && !text.includes("sub") && !text.includes("tax") && !text.includes("gst") && !text.includes("vat"))
    ) {
      if (val > rawTotal) rawTotal = val;
    } else if (
      text.includes("subtotal") ||
      text.includes("sub total") ||
      text.includes("net amount") ||
      text.includes("taxable value") ||
      text.includes("base amount")
    ) {
      if (val > rawSubtotal) rawSubtotal = val;
    } else if (
      text.includes("tax") ||
      text.includes("gst") ||
      text.includes("vat") ||
      text.includes("cgst") ||
      text.includes("sgst") ||
      text.includes("igst") ||
      text.includes("cess")
    ) {
      rawTax += val;
    }
  }

  // Fallback: largest amount = total
  if (rawTotal === 0 && allAmounts.length > 0) {
    rawTotal = Math.max(...allAmounts.map(a => a.val));
  }

  if (rawSubtotal === 0 && rawTotal > 0) {
    rawSubtotal = rawTax > 0
      ? rawTotal - rawTax
      : Math.round(rawTotal * 0.85 * 100) / 100;
  }

  if (rawTax === 0 && rawTotal > 0 && rawSubtotal > 0 && rawTotal > rawSubtotal) {
    rawTax = Math.round((rawTotal - rawSubtotal) * 100) / 100;
  }

  data.total = Math.round(rawTotal * 100) / 100;
  data.subtotal = Math.round(rawSubtotal * 100) / 100;
  data.taxAmount = Math.round(rawTax * 100) / 100;

  if (data.subtotal > 0) {
    data.taxRate = Math.round((data.taxAmount / data.subtotal) * 100);
  }

  // ═══════════════════════════════════════════════════════
  // STAGE 5: LINE ITEM EXTRACTION — Multi-Strategy Engine
  // 
  // Strategy A: Tabulated data detection
  //   Looks for lines matching: [SlNo] [Description] [Qty] [Rate] [Amount]
  //   Common in structured invoices and PDF extractions.
  // 
  // Strategy B: Description + trailing price
  //   Handles informal receipts: "Coffee Latte  5.50"
  //   with optional "2 x 2.75" quantity decomposition.
  // ═══════════════════════════════════════════════════════
  const billingKeywords = /^(total|subtotal|sub\s*total|tax|gst|vat|balance|due|cash|change|payment|visa|mastercard|card|invoice|bill|date|inv|no\.|tel|phone|email|thank|www|http|amount\s*(in|payable)|grand|net|cgst|sgst|igst|cess|round)/i;

  // ─── Strategy A: Tabulated column data ───
  // Pattern: optional serial number, description text, quantity number,
  // rate number, and amount number — all separated by spaces or tabs.
  // Example: "1  Web Design Services  2  5000.00  10000.00"
  // Regex breakdown:
  //   ^\d{1,3}\s+          — Optional serial number (1-3 digits)
  //   (.+?[a-zA-Z].+?)     — Description (must contain letters)
  //   \s+(\d+(?:\.\d+)?)   — Quantity
  //   \s+(\d+(?:\.\d+)?)   — Unit rate
  //   \s+(\d+(?:\.\d+)?)$  — Line total
  const tabulatedPattern = /^(?:\d{1,3}[\s.)\-]+)?(.+?[a-zA-Z].+?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s*$/;

  for (const line of lines) {
    if (billingKeywords.test(line.trim())) continue;
    
    const tabMatch = line.match(tabulatedPattern);
    if (tabMatch) {
      const desc = tabMatch[1].trim();
      const qty = parseFloat(tabMatch[2]) || 1;
      const rate = parseFloat(tabMatch[3].replace(",", ".")) || 0;
      const amount = parseFloat(tabMatch[4].replace(",", ".")) || 0;
      
      // Validate: the amount should roughly equal qty × rate (within 10% tolerance)
      // This confirms we've correctly identified the columns
      const expectedAmount = qty * rate;
      const tolerance = Math.max(expectedAmount * 0.1, 1); // 10% or ₹1 minimum
      
      if (desc.length > 1 && amount > 0 && Math.abs(expectedAmount - amount) <= tolerance) {
        data.items.push({
          id: Math.floor(Math.random() * 10000000),
          description: desc,
          quantity: qty,
          rate: rate,
          taxRate: 0,
          total: amount
        });
      }
    }
  }

  // ─── Strategy B: Description + trailing price (fallback) ───
  // Only runs if Strategy A found zero items.
  // Pattern: "Description text  $123.45" or "Widget 2 x 50.00  100.00"
  if (data.items.length === 0) {
    for (const line of lines) {
      if (billingKeywords.test(line.trim())) continue;

      // Match: text with letters, followed by a price at end of line
      const itemMatch = line.match(
        /^(.+?[a-zA-Z].*?)\s+[$£€₹]?\s*(\d{1,6}(?:[.,]\d{3})*(?:[.,]\d{2}))[^\d]*$/i
      );
      
      if (itemMatch) {
        const desc = itemMatch[1].trim();
        const price = parseFloat(itemMatch[2].replace(",", "."));

        if (desc.length > 2 && price > 0 && price <= data.total) {
          let qty = 1;
          let rate = price;

          // ─── Quantity decomposition patterns ───
          // Handles: "2 x 5.00", "3 @ ₹250", "Qty: 5", "2 nos"
          const qtyPatterns = [
            /(\d+)\s*(?:x|×)\s*[$£€₹]?\s*(\d+[.,]\d{2})/i,    // "2 x 50.00"
            /(\d+)\s*@\s*[$£€₹]?\s*(\d+[.,]\d{2})/i,           // "3 @ 250.00"
            /qty[:\s]*(\d+)\s.*?rate[:\s]*[$£€₹]?\s*(\d+[.,]\d{2})/i,  // "Qty: 5 Rate: 100.00"
            /(\d+)\s*(?:nos?|pcs?|units?)\b/i                   // "2 nos" (quantity only)
          ];

          for (const pattern of qtyPatterns) {
            const qtyMatch = desc.match(pattern);
            if (qtyMatch) {
              qty = parseInt(qtyMatch[1]) || 1;
              if (qtyMatch[2]) {
                rate = parseFloat(qtyMatch[2].replace(",", ".")) || price;
              } else {
                rate = price / qty; // derive rate from total / qty
              }
              break;
            }
          }

          data.items.push({
            id: Math.floor(Math.random() * 10000000),
            description: desc
              .replace(/\d+\s*(?:x|×|@)\s*[$£€₹]?\s*\d+[.,]\d{2}/i, "")  // clean qty patterns
              .replace(/qty[:\s]*\d+/i, "")
              .trim() || desc,
            quantity: qty,
            rate: rate,
            taxRate: 0,
            total: price
          });
        }
      }
    }
  }

  // ─── Fallback: single item spanning the subtotal ───
  if (data.items.length === 0) {
    data.items.push({
      id: Math.floor(Math.random() * 10000000),
      description: "Transaction Items (Consulting/Services)",
      quantity: 1,
      rate: data.subtotal,
      taxRate: 0,
      total: data.subtotal
    });
    meta.warnings.push("No individual line items detected — created single aggregate item.");
  }

  // ═══════════════════════════════════════════════════════
  // STAGE 6: META COMPUTATION — Confidence & Statistics
  // ═══════════════════════════════════════════════════════
  meta.itemCount = data.items.length;

  // Confidence scoring based on extraction quality
  let confidenceScore = 0;
  if (data.vendorName && !meta.warnings.some(w => w.includes("Vendor"))) confidenceScore++;
  if (data.date && !meta.warnings.some(w => w.includes("date"))) confidenceScore++;
  if (data.invoiceNumber && !meta.warnings.some(w => w.includes("invoice"))) confidenceScore++;
  if (data.total > 0) confidenceScore++;
  if (data.items.length > 0 && !meta.warnings.some(w => w.includes("aggregate"))) confidenceScore++;

  if (confidenceScore >= 4) meta.confidence = "high";
  else if (confidenceScore >= 2) meta.confidence = "medium";
  else meta.confidence = "low";

  // Attach meta to the data return for backwards compatibility
  // The caller can access data.meta or destructure { meta } separately
  data.meta = meta;

  return data;
}
