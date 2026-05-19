/**
 * Intelligent heuristics-based client-side OCR parser.
 * Extracts vendor name, invoice numbers, dates, taxes, totals, and line items from raw OCR text.
 */

export function parseOCRText(rawText) {
  const data = {
    vendorName: "",
    invoiceNumber: "",
    date: "",
    items: [],
    taxRate: 0,
    taxAmount: 0,
    subtotal: 0,
    total: 0,
    notes: "Auto-extracted from image scan."
  };

  if (!rawText) return data;

  const lines = rawText
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) return data;

  // 1. VENDOR NAME HEURISTICS
  // Usually the very first non-empty lines at the top of the receipt.
  // We'll skip lines that only contain dates, numbers, phone numbers, or standard transaction words.
  const ignoreVendorKeywords = /invoice|receipt|bill|date|tel|phone|fax|mobile|web|www|email|http|cash|payment|welcome|tax|inv|gst|vat|no\./i;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const candidate = lines[i];
    if (candidate.length > 2 && !ignoreVendorKeywords.test(candidate) && !/\d{4,}/.test(candidate)) {
      data.vendorName = candidate;
      break;
    }
  }
  // Fallback if top lines were skipped
  if (!data.vendorName && lines.length > 0) {
    data.vendorName = lines[0];
  }

  // 2. DATE HEURISTICS
  // Standard formats: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, or text like "20 May 2026"
  const dateRegexes = [
    // YYYY-MM-DD
    /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/,
    // DD/MM/YYYY or MM/DD/YYYY
    /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/,
    // Textual dates (e.g. May 20, 2026 or 20 May 2026)
    /\b(\d{1,2})?\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{1,2})?,?\s*(\d{2,4})\b/i
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
  // Fallback to today's date in YYYY-MM-DD
  if (!data.date) {
    data.date = new Date().toISOString().split("T")[0];
  }

  // 3. INVOICE NUMBER HEURISTICS
  const invRegexes = [
    /(?:invoice|inv|bill|receipt|doc|transaction)\s*(?:no|num|number|#)?\s*[:#-]?\s*([a-z0-9-]+)/i,
    /#\s*([a-z0-9-]+)/i
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
  // Fallback invoice number
  if (!data.invoiceNumber) {
    data.invoiceNumber = "INV-" + Math.floor(100000 + Math.random() * 900000);
  }

  // 4. AMOUNTS & TAXES HEURISTICS
  // We scan for numbers that look like currency (e.g. 10.00, 1,200.50, 350)
  const amountRegex = /(?:[$\u20AC\u00A3\u20A8\u20B9]\s*)?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))\b/;
  const allAmounts = [];

  // Match all decimal amounts in the receipt
  for (const line of lines) {
    // Avoid phone numbers, dates, invoice numbers for amounts
    if (line.includes("Date") || line.includes("Tel") || line.includes("Phone") || line.includes("Fax")) continue;
    const matches = line.match(/(?:^|\s)[$\u20AC\u00A3\u20A8\u20B9]?\s*(\d{1,6}(?:[.,]\d{2}))(?:\s|$)/g);
    if (matches) {
      for (const m of matches) {
        const val = parseFloat(m.replace(/[^\d.]/g, ""));
        if (!isNaN(val) && val > 0) {
          allAmounts.push({ line, val });
        }
      }
    }
  }

  // Identify Total, Subtotal, Tax by scanning line text
  let rawTotal = 0;
  let rawSubtotal = 0;
  let rawTax = 0;

  for (const item of allAmounts) {
    const text = item.line.toLowerCase();
    const val = item.val;

    if (text.includes("grand total") || text.includes("net payable") || (text.includes("total") && !text.includes("sub") && !text.includes("tax") && !text.includes("gst") && !text.includes("vat"))) {
      if (val > rawTotal) rawTotal = val;
    } else if (text.includes("subtotal") || text.includes("sub total") || text.includes("net amount") || text.includes("taxable value")) {
      if (val > rawSubtotal) rawSubtotal = val;
    } else if (text.includes("tax") || text.includes("gst") || text.includes("vat") || text.includes("cgst") || text.includes("sgst")) {
      rawTax += val; // sum up CGST, SGST, etc.
    }
  }

  // Fallbacks if structured amounts are missing
  if (rawTotal === 0 && allAmounts.length > 0) {
    // Take the absolute maximum value found as Total (usually at bottom)
    rawTotal = Math.max(...allAmounts.map(a => a.val));
  }

  if (rawSubtotal === 0 && rawTotal > 0) {
    rawSubtotal = rawTax > 0 ? rawTotal - rawTax : Math.round(rawTotal * 0.85 * 100) / 100;
  }

  if (rawTax === 0 && rawTotal > 0 && rawSubtotal > 0 && rawTotal > rawSubtotal) {
    rawTax = Math.round((rawTotal - rawSubtotal) * 100) / 100;
  }

  data.total = Math.round(rawTotal * 100) / 100;
  data.subtotal = Math.round(rawSubtotal * 100) / 100;
  data.taxAmount = Math.round(rawTax * 100) / 100;

  // Calculate tax rate
  if (data.subtotal > 0) {
    data.taxRate = Math.round((data.taxAmount / data.subtotal) * 100);
  }

  // 5. LINE ITEMS HEURISTICS
  // Look for lines that contain an item description and a price.
  // Usually these contain standard nouns/items and are positioned in the middle, and their value sum equals Subtotal.
  const billingKeywords = /total|subtotal|tax|gst|vat|balance|due|cash|change|payment|visa|mastercard|card|invoice|bill|date|inv|no\.|tel/i;

  for (const line of lines) {
    if (billingKeywords.test(line)) continue;

    // Look for: [Text Description] followed by a price towards the end
    const itemMatch = line.match(/^(.+?)\s+(\d{1,4}[\.,]\d{2})$/);
    if (itemMatch) {
      const desc = itemMatch[1].trim();
      const price = parseFloat(itemMatch[2].replace(",", "."));

      if (desc.length > 2 && price > 0 && price < data.total) {
        // Double check if there's a quantity indicator (e.g. "2 x 5.00" or "3 @ 10")
        let qty = 1;
        let rate = price;
        const qtyMatch = desc.match(/(\d+)\s*(?:x|@)\s*(\d{1,4}[\.,]\d{2})/i);
        if (qtyMatch) {
          qty = parseInt(qtyMatch[1]);
          rate = parseFloat(qtyMatch[2].replace(",", "."));
        }

        data.items.push({
          id: Math.floor(Math.random() * 10000000),
          description: desc.replace(/[\d\s]+(x|@)\s*\d+[\.,]\d{2}/i, "").trim(), // clean description
          quantity: qty,
          rate: rate,
          taxRate: 0,
          total: price
        });
      }
    }
  }

  // If no items were detected, create a single default item spanning the subtotal
  if (data.items.length === 0) {
    data.items.push({
      id: Math.floor(Math.random() * 10000000),
      description: "Transaction Items (Consulting/Services)",
      quantity: 1,
      rate: data.subtotal,
      taxRate: 0,
      total: data.subtotal
    });
  }

  return data;
}
