import React from "react";
import { translations } from "../utils/translations";

export default function InvoicePreviewDesign2({ data, lang = "en", currency = "USD" }) {
  const t = translations[lang] || translations["en"];
  const symbol = currency === "INR" ? "₹" : "$";

  const formatCurrency = (val) => {
    if (currency === "INR") {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(val);
    }
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(val);
  };

  return (
    <div id="printable-invoice" style={{
      width: "210mm", minHeight: "297mm", margin: "0 auto", padding: "40px", backgroundColor: "#fff",
      boxShadow: "0 10px 30px rgba(0,0,0,0.1)", borderRadius: "10px", fontFamily: "'Inter', sans-serif", color: "#1e293b"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "3px solid #3b82f6", paddingBottom: "20px", marginBottom: "30px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "2.5rem", color: "#3b82f6", fontWeight: "800" }}>INVOICE</h1>
          <p style={{ margin: "5px 0 0 0", color: "#64748b" }}>#{data.invoiceNumber || "INV-0000"}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "bold" }}>{data.vendorName || "Company Name"}</h2>
          <p style={{ margin: "5px 0", color: "#64748b", fontSize: "0.9rem" }}>{data.vendorAddress || "Company Address"}</p>
          <p style={{ margin: "2px 0", color: "#64748b", fontSize: "0.9rem" }}>GSTIN: {data.gstinSupplier || "N/A"}</p>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "40px" }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: "0 0 10px 0", color: "#94a3b8", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "1px" }}>Billed To</h3>
          <p style={{ margin: "0 0 5px 0", fontWeight: "bold", fontSize: "1.1rem" }}>{data.clientName || "Client Name"}</p>
          <p style={{ margin: "0 0 5px 0", color: "#475569" }}>{data.clientAddress || "Client Address"}</p>
          <p style={{ margin: "0", color: "#475569" }}>GSTIN: {data.gstinBuyer || "N/A"}</p>
        </div>
        <div style={{ flex: 1, textAlign: "right" }}>
          <h3 style={{ margin: "0 0 10px 0", color: "#94a3b8", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "1px" }}>Invoice Details</h3>
          <p style={{ margin: "0 0 5px 0", color: "#475569" }}><strong>Date:</strong> {data.date || new Date().toISOString().split("T")[0]}</p>
          <p style={{ margin: "0 0 5px 0", color: "#475569" }}><strong>Amount Due:</strong> <span style={{ fontWeight: "bold", color: "#3b82f6" }}>{formatCurrency(data.total)}</span></p>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "40px" }}>
        <thead>
          <tr style={{ backgroundColor: "#f1f5f9", color: "#334155", textAlign: "left" }}>
            <th style={{ padding: "12px 15px", borderRadius: "8px 0 0 8px" }}>Item Description</th>
            <th style={{ padding: "12px 15px", textAlign: "center" }}>Qty</th>
            <th style={{ padding: "12px 15px", textAlign: "right" }}>Rate</th>
            <th style={{ padding: "12px 15px", textAlign: "right", borderRadius: "0 8px 8px 0" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {(data.items && data.items.length > 0 ? data.items : [{ description: "Sample Service", quantity: 1, rate: 100 }]).map((item, idx) => (
            <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td style={{ padding: "15px", color: "#1e293b" }}>{item.description}</td>
              <td style={{ padding: "15px", textAlign: "center", color: "#475569" }}>{item.quantity} {item.unit || ""}</td>
              <td style={{ padding: "15px", textAlign: "right", color: "#475569" }}>{formatCurrency(item.rate)}</td>
              <td style={{ padding: "15px", textAlign: "right", fontWeight: "600", color: "#1e293b" }}>
                {formatCurrency(item.quantity * item.rate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: "50%", backgroundColor: "#f8fafc", padding: "20px", borderRadius: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ color: "#64748b" }}>Subtotal</span>
            <span style={{ fontWeight: "600" }}>{formatCurrency(data.subtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", paddingBottom: "15px", borderBottom: "1px solid #e2e8f0" }}>
            <span style={{ color: "#64748b" }}>Tax ({data.taxRate || 18}%)</span>
            <span style={{ fontWeight: "600" }}>{formatCurrency(data.taxAmount)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#3b82f6", fontSize: "1.2rem", fontWeight: "bold" }}>
            <span>Total</span>
            <span>{formatCurrency(data.total)}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "40px", paddingTop: "20px", borderTop: "1px solid #e2e8f0" }}>
        <h4 style={{ margin: "0 0 10px 0", color: "#334155" }}>Bank Details</h4>
        <p style={{ margin: "2px 0", color: "#475569", fontSize: "0.9rem" }}>Bank Name: {data.bankName || "N/A"}</p>
        <p style={{ margin: "2px 0", color: "#475569", fontSize: "0.9rem" }}>Account Name: {data.accountName || "N/A"}</p>
        <p style={{ margin: "2px 0", color: "#475569", fontSize: "0.9rem" }}>Account Number: {data.accountNumber || "N/A"}</p>
        <p style={{ margin: "2px 0", color: "#475569", fontSize: "0.9rem" }}>IFSC Code: {data.ifscCode || "N/A"}</p>
      </div>
    </div>
  );
}
