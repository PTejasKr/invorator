import React, { useState } from "react";
import { translations } from "../utils/translations";

export default function Dashboard({ 
  history, 
  lang = "en",
  currency = "USD",
  onStartGenerator, 
  onDeleteInvoice, 
  onPrintInvoice, 
  onShareInvoice,
  onEditInvoice,
  onCopyInvoice
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const t = translations[lang] || translations["en"];

  // Calculations for stats
  const totalInvoices = history.length;
  const totalSpent = history.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);
  
  // Find top vendor
  const vendorCounts = history.reduce((acc, inv) => {
    const name = inv.vendorName || "N/A";
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  
  let topVendor = "N/A";
  let maxCount = 0;
  Object.entries(vendorCounts).forEach(([vendor, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topVendor = vendor;
    }
  });

  const formatCurrency = (val) => {
    if (currency === "INR") {
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

  // Filter history based on search
  const filteredHistory = history.filter(inv => {
    const term = searchTerm.toLowerCase();
    return (
      (inv.vendorName || "").toLowerCase().includes(term) ||
      (inv.invoiceNumber || "").toLowerCase().includes(term) ||
      (inv.date || "").includes(term) ||
      inv.items?.some(item => (item.description || "").toLowerCase().includes(term))
    );
  });

  // Export encrypted database as a decrypted CSV file for the user
  const handleExportCSV = () => {
    if (history.length === 0) return;
    
    // CSV Header
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Invoice Number,Date,Vendor/Merchant,Subtotal,Tax Rate,Tax Amount,Total,Notes\n";
    
    // CSV Rows
    history.forEach(inv => {
      const notes = (inv.notes || "").replace(/"/g, '""');
      const vendor = (inv.vendorName || "").replace(/"/g, '""');
      const row = [
        `"${inv.invoiceNumber}"`,
        `"${inv.date}"`,
        `"${vendor}"`,
        inv.subtotal,
        inv.taxRate,
        inv.taxAmount,
        inv.total,
        `"${notes}"`
      ].join(",");
      csvContent += row + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bill_generator_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Spend Analytics Grid */}
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-label">{t.spentAnalytics}</div>
          <div className="stat-value">{formatCurrency(totalSpent)}</div>
          <div className="stat-footer">Across all generated bills</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-label">{t.invoicesCount}</div>
          <div className="stat-value">{totalInvoices}</div>
          <div className="stat-footer">Processed successfully</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">{t.topMerchant}</div>
          <div className="stat-value" style={{ fontSize: "1.5rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0.4rem 0" }}>
            {topVendor}
          </div>
          <div className="stat-footer">
            {maxCount > 0 ? `${maxCount} transaction(s)` : "No transactions recorded"}
          </div>
        </div>
      </div>

      {/* Main Billing Records Section */}
      <div className="section-container">
        <div className="section-header">
          <div className="section-title">
            <h2>{t.historyTitle}</h2>
            <p>{t.historySubtitle}</p>
          </div>
          
          <div className="nav-actions">
            <button className="btn btn-secondary" onClick={handleExportCSV} disabled={history.length === 0}>
              {t.btnExportCSV}
            </button>
            <button className="btn btn-primary" onClick={onStartGenerator}>
              {t.btnNewInvoice}
            </button>
          </div>
        </div>

        {/* Searching / Filtering Toolbar */}
        <div style={{ display: "flex", gap: "1rem", width: "100%" }}>
          <input 
            type="text" 
            placeholder={t.searchPlaceholder} 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            style={{ flex: 1 }}
            id="history-search-input"
          />
        </div>

        {/* Invoices List Table */}
        {filteredHistory.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 2rem", border: "1px dashed var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📂</div>
            <h3>{t.noInvoices}</h3>
            <p style={{ fontSize: "0.85rem", marginTop: "0.5rem", marginBottom: "1.5rem" }}>
              {searchTerm ? "No bills match your current search keywords." : t.noInvoicesDesc}
            </p>
            {!searchTerm && (
              <button className="btn btn-accent" onClick={onStartGenerator}>
                {t.btnUploadCreate}
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: "15%" }}>{t.colInvoiceNum}</th>
                  <th style={{ width: "15%" }}>{t.colDate}</th>
                  <th style={{ width: "20%" }}>{t.colMerchant}</th>
                  <th style={{ width: "25%" }}>{t.colItems}</th>
                  <th style={{ width: "15%", textAlign: "right" }}>{t.colTotal}</th>
                  <th style={{ width: "10%", textAlign: "center" }}>{t.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: "600", fontFamily: "var(--font-display)" }}>
                      {inv.invoiceNumber}
                    </td>
                    <td>{inv.date}</td>
                    <td style={{ fontWeight: "500", color: "var(--primary)" }}>
                      {inv.vendorName}
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {inv.items?.map(item => `${item.description} (x${item.quantity})`).join(", ") || "No item descriptions"}
                    </td>
                    <td style={{ fontWeight: "700", textAlign: "right", color: "var(--primary)" }}>
                      {formatCurrency(inv.total)}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => onEditInvoice(inv)}
                          style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", background: "#059669", color: "white", border: "none" }}
                          title="Edit Invoice"
                        >
                          ✏️ Edit
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => onPrintInvoice(inv)}
                          style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                          title="Print / Save PDF"
                        >
                          Print
                        </button>
                        <button 
                          className="btn btn-primary" 
                          onClick={() => onShareInvoice(inv)}
                          style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", background: "var(--primary)", color: "white" }}
                          title="Share Invoice"
                        >
                          Share
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => onCopyInvoice(inv)}
                          style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", background: "#3b82f6", color: "white", border: "none" }}
                          title="Create Copy"
                        >
                          Create Copy
                        </button>
                        <button 
                          className="btn btn-danger" 
                          onClick={() => onDeleteInvoice(inv.id)}
                          style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                          title="Delete Record"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
