import React from "react";
import { translations } from "../utils/translations";

export default function InvoicePreviewDesign3({ data, lang = "en", currency = "USD" }) {
  const t = translations[lang] || translations["en"];
  
  const formatCurrency = (val) => {
    if (currency === "INR") {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(val);
    }
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(val);
  };

  return (
    <div id="printable-invoice" style={{
      width: "210mm", minHeight: "297mm", margin: "0 auto", padding: "40px", backgroundColor: "#fff",
      border: "1px solid #ddd", fontFamily: "'Times New Roman', serif", color: "#000"
    }}>
      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        <h1 style={{ margin: 0, fontSize: "2rem", textTransform: "uppercase", letterSpacing: "2px" }}>PROFORMA INVOICE</h1>
      </div>

      <div style={{ display: "flex", border: "1px solid #000" }}>
        <div style={{ flex: 1, borderRight: "1px solid #000", padding: "15px" }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "1rem" }}>Supplier Details:</h3>
          <p style={{ margin: "0 0 5px 0", fontWeight: "bold" }}>{data.vendorName || "Company Name"}</p>
          <p style={{ margin: "0 0 5px 0" }}>{data.vendorAddress || "Company Address"}</p>
          <p style={{ margin: "0 0 5px 0" }}>PAN: {data.vendorPAN || "N/A"}</p>
          <p style={{ margin: 0 }}>GSTIN: {data.gstinSupplier || "N/A"}</p>
        </div>
        <div style={{ flex: 1, padding: "15px" }}>
          <p style={{ margin: "0 0 5px 0" }}><strong>Proforma Invoice No:</strong> {data.invoiceNumber || "PI-0001"}</p>
          <p style={{ margin: "0 0 5px 0" }}><strong>Date:</strong> {data.date || new Date().toISOString().split("T")[0]}</p>
        </div>
      </div>

      <div style={{ display: "flex", border: "1px solid #000", borderTop: "none", marginBottom: "20px" }}>
        <div style={{ flex: 1, borderRight: "1px solid #000", padding: "15px" }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "1rem" }}>Buyer (Billed To):</h3>
          <p style={{ margin: "0 0 5px 0", fontWeight: "bold" }}>{data.clientName || "Client Name"}</p>
          <p style={{ margin: "0 0 5px 0" }}>{data.clientAddress || "Client Address"}</p>
          <p style={{ margin: 0 }}>GSTIN: {data.gstinBuyer || "N/A"}</p>
        </div>
        <div style={{ flex: 1, padding: "15px" }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "1rem" }}>Consignee (Shipped To):</h3>
          <p style={{ margin: "0 0 5px 0", fontWeight: "bold" }}>{data.consigneeName || data.clientName || "Consignee Name"}</p>
          <p style={{ margin: "0 0 5px 0" }}>{data.consigneeAddress || data.clientAddress || "Consignee Address"}</p>
          <p style={{ margin: 0 }}>GSTIN: {data.consigneeGSTIN || data.gstinBuyer || "N/A"}</p>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000" }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #000", padding: "10px" }}>S.No</th>
            <th style={{ border: "1px solid #000", padding: "10px" }}>Description of Goods</th>
            <th style={{ border: "1px solid #000", padding: "10px" }}>Quantity</th>
            <th style={{ border: "1px solid #000", padding: "10px" }}>Rate</th>
            <th style={{ border: "1px solid #000", padding: "10px" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {(data.items && data.items.length > 0 ? data.items : [{ description: "Sample Goods", quantity: 1, rate: 100 }]).map((item, idx) => (
            <tr key={idx}>
              <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>{idx + 1}</td>
              <td style={{ border: "1px solid #000", padding: "10px" }}>{item.description}</td>
              <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>{item.quantity} {item.unit || ""}</td>
              <td style={{ border: "1px solid #000", padding: "10px", textAlign: "right" }}>{formatCurrency(item.rate)}</td>
              <td style={{ border: "1px solid #000", padding: "10px", textAlign: "right" }}>{formatCurrency(item.quantity * item.rate)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan="4" style={{ border: "1px solid #000", padding: "10px", textAlign: "right", fontWeight: "bold" }}>Subtotal</td>
            <td style={{ border: "1px solid #000", padding: "10px", textAlign: "right", fontWeight: "bold" }}>{formatCurrency(data.subtotal)}</td>
          </tr>
          <tr>
            <td colSpan="4" style={{ border: "1px solid #000", padding: "10px", textAlign: "right", fontWeight: "bold" }}>Tax ({data.taxRate || 18}%)</td>
            <td style={{ border: "1px solid #000", padding: "10px", textAlign: "right", fontWeight: "bold" }}>{formatCurrency(data.taxAmount)}</td>
          </tr>
          <tr>
            <td colSpan="4" style={{ border: "1px solid #000", padding: "10px", textAlign: "right", fontWeight: "bold" }}>Total Amount</td>
            <td style={{ border: "1px solid #000", padding: "10px", textAlign: "right", fontWeight: "bold" }}>{formatCurrency(data.total)}</td>
          </tr>
        </tbody>
      </table>
      
      <div style={{ marginTop: "30px", border: "1px solid #000", padding: "15px" }}>
        <h4 style={{ margin: "0 0 10px 0" }}>Bank Details</h4>
        <p style={{ margin: "2px 0" }}>Bank Name: {data.bankName || "N/A"}</p>
        <p style={{ margin: "2px 0" }}>A/c Name: {data.accountName || "N/A"}</p>
        <p style={{ margin: "2px 0" }}>A/c No: {data.accountNumber || "N/A"}</p>
        <p style={{ margin: "2px 0" }}>IFSC: {data.ifscCode || "N/A"}</p>
      </div>

      <div style={{ marginTop: "40px", textAlign: "right" }}>
        <p style={{ margin: "0 0 40px 0" }}>For <strong>{data.vendorName || "Company Name"}</strong></p>
        <p style={{ margin: 0 }}>Authorized Signatory</p>
      </div>
    </div>
  );
}
