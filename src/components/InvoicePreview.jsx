import React from "react";

export default function InvoicePreview({ data, lang = "en", currency = "USD" }) {
  if (!data) return null;

  const {
    vendorName = "Vendor Name",
    invoiceNumber = "INV-000000",
    date = new Date().toISOString().split("T")[0],
    items = [],
    subtotal = 0,
    taxRate = 0,
    taxAmount = 0,
    total = 0,
    notes = "",
    // Indian GST expansions
    gstRegime = "standard", // "standard", "intrastate", "interstate"
    gstinSupplier = "",
    gstinBuyer = ""
  } = data;

  const formatCurrency = (val) => {
    if (currency === "INR" || data.currency === "INR") {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2
      }).format(val);
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2
    }).format(val);
  };

  // Determine if HSN/SAC codes exist in this invoice
  const showHSN = items.some(item => item.hsnCode) || gstRegime !== "standard";

  return (
    <div className="invoice-preview-wrapper" id="printable-invoice">
      {/* Invoice Header */}
      <div className="inv-header">
        <div className="inv-logo-box">
          <div className="inv-company-name">{vendorName}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "500" }}>
            {gstRegime !== "standard" ? "TAX INVOICE (GST REGULATED)" : "Tax Invoice / Official Bill Receipt"}
          </div>
        </div>
        <div className="inv-details">
          <div className="inv-title">INVOICE</div>
          <div className="inv-meta-grid">
            <div className="inv-meta-label">Invoice Number:</div>
            <div className="inv-meta-val">{invoiceNumber}</div>
            <div className="inv-meta-label">Date:</div>
            <div className="inv-meta-val">{date}</div>
          </div>
        </div>
      </div>

      {/* Bill To / From Block */}
      <div className="inv-billing-block">
        <div className="billing-col">
          <h4 style={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
            Issued By
          </h4>
          <div className="billing-address">
            <strong style={{ fontSize: "0.95rem", color: "var(--primary)" }}>{vendorName}</strong>
            <br />
            Corporate Office & Operations
            <br />
            Verified Invoice Vendor
            {gstinSupplier && (
              <div style={{ marginTop: "0.4rem", fontSize: "0.8rem" }}>
                <strong>GSTIN (Supplier):</strong> <span style={{ fontFamily: "monospace" }}>{gstinSupplier}</span>
              </div>
            )}
          </div>
        </div>
        <div className="billing-col">
          <h4 style={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
            Issued To
          </h4>
          <div className="billing-address">
            <strong style={{ fontSize: "0.95rem", color: "var(--primary)" }}>General Corporate Client</strong>
            <br />
            Business Operations Division
            <br />
            Internal Expenses Account
            {gstinBuyer && (
              <div style={{ marginTop: "0.4rem", fontSize: "0.8rem" }}>
                <strong>GSTIN (Buyer):</strong> <span style={{ fontFamily: "monospace" }}>{gstinBuyer}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Items Table */}
      <table className="inv-table">
        <thead>
          <tr>
            <th style={{ textAlign: "left", width: showHSN ? "40%" : "55%" }}>Description</th>
            {showHSN && <th style={{ textAlign: "center", width: "15%" }}>HSN/SAC</th>}
            <th style={{ textAlign: "center", width: "10%" }}>Qty</th>
            <th style={{ textAlign: "right", width: "15%" }}>Rate</th>
            <th style={{ textAlign: "right", width: "20%" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id || idx}>
              <td style={{ textAlign: "left" }}>
                <span style={{ fontWeight: "500" }}>{item.description || "Consulting Services"}</span>
              </td>
              {showHSN && (
                <td style={{ textAlign: "center", fontFamily: "monospace", fontSize: "0.8rem" }}>
                  {item.hsnCode || "—"}
                </td>
              )}
              <td style={{ textAlign: "center" }}>{item.quantity || 1}</td>
              <td style={{ textAlign: "right" }}>{formatCurrency(item.rate || 0)}</td>
              <td style={{ textAlign: "right", fontWeight: "600" }}>
                {formatCurrency(item.total || (item.quantity * item.rate) || 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer Totals Block */}
      <div className="inv-totals-block" style={{ position: "relative" }}>
        <div className="inv-notes-section">
          <h4 style={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
            Terms & Notes
          </h4>
          <div className="inv-notes-text">
            {notes || "Thank you for your business. Payment terms are net 30. Auto-processed and validated client-side."}
          </div>
        </div>
        
        <div className="inv-calculations" style={{ position: "relative" }}>
          <div className="calc-row">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>

          {/* Dynamic Indian GST split display rows */}
          {gstRegime === "intrastate" ? (
            <>
              <div className="calc-row">
                <span>CGST ({(taxRate / 2).toFixed(1)}%)</span>
                <span>{formatCurrency(taxAmount / 2)}</span>
              </div>
              <div className="calc-row">
                <span>SGST ({(taxRate / 2).toFixed(1)}%)</span>
                <span>{formatCurrency(taxAmount / 2)}</span>
              </div>
            </>
          ) : gstRegime === "interstate" ? (
            <div className="calc-row">
              <span>IGST ({taxRate}%)</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
          ) : (
            <div className="calc-row">
              <span>Tax/GST ({taxRate}%)</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
          )}

          <div className="calc-row grand-total" style={{ borderTop: "2px solid var(--primary)", paddingTop: "0.5rem" }}>
            <span>Amount Due</span>
            <span style={{ fontWeight: "700" }}>{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      {/* Official Sign-off */}
      <div className="inv-footer">
        <p>This is a computer-generated document. No physical signature required.</p>
        <p style={{ marginTop: "0.25rem", color: "var(--text-muted)", fontSize: "0.7rem" }}>
          Encrypted & Generated Securely by InvoSafe / invorator.
        </p>
      </div>
    </div>
  );
}
