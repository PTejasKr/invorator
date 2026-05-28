import React, { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import BillGenerator from "./components/BillGenerator";
import InvoicePreview from "./components/InvoicePreview";
import DesignSelector from "./components/DesignSelector";
import { encryptData, decryptData, getSystemMasterKey } from "./utils/encryption";
import { languages } from "./utils/translations";
import { captureInvoiceBlob, shareInvoice } from "./utils/imageExport";

export default function App() {
  const [view, setView] = useState("dashboard"); // "dashboard", "designSelector", "generator"
  const [history, setHistory] = useState([]);
  const [selectedDesign, setSelectedDesign] = useState(1);
  const [initialInvoiceData, setInitialInvoiceData] = useState(null);
  
  // Edit Mode: tracks whether we're editing an existing invoice
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  
  // Global Bilingual & Currency preferences
  const [lang, setLang] = useState(() => localStorage.getItem("_inv_lang") || "en");
  const [currency, setCurrency] = useState(() => localStorage.getItem("_inv_currency") || "USD");

  // Temporary invoice state used for background printing layout
  const [activePrintInvoice, setActivePrintInvoice] = useState(null);

  // Currency Conversion Loading State
  const [isConvertingCurrency, setIsConvertingCurrency] = useState(false);

  // Load encrypted database on mount automatically
  useEffect(() => {
    const sysKey = getSystemMasterKey();
    loadDatabase(sysKey);
  }, []);

  // Sync preferences to localStorage
  const handleLangChange = (newLang) => {
    setLang(newLang);
    localStorage.setItem("_inv_lang", newLang);
  };

  const handleCurrencyChange = async (newCurr) => {
    if (newCurr === currency) return; // No change needed
    
    // Warn user if history exists
    if (history.length > 0) {
      const confirm = window.confirm(
        `You are about to switch to ${newCurr}. This will update all your previously saved invoices using today's live market exchange rate. Proceed?`
      );
      if (!confirm) return;
    }

    setIsConvertingCurrency(true);
    
    try {
      // 1. Fetch real-time exchange rate
      // Using open API (exchangerate-api.com) for free access without keys
      const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${currency}`);
      
      if (!res.ok) throw new Error("Failed to fetch exchange rates");
      
      const data = await res.json();
      const rate = data.rates[newCurr];
      
      if (!rate) throw new Error("Target currency rate not found");

      // 2. Convert all historical data if any exists
      if (history.length > 0) {
        const sysKey = getSystemMasterKey();
        const convertedHistory = history.map(inv => {
          // Deep copy items to convert their individual values
          const convertedItems = (inv.items || []).map(item => ({
            ...item,
            rate: Math.round((item.rate * rate) * 100) / 100,
            total: Math.round((item.total * rate) * 100) / 100
          }));

          return {
            ...inv,
            currency: newCurr, // Update the currency tag on the invoice
            subtotal: Math.round((inv.subtotal * rate) * 100) / 100,
            taxAmount: Math.round((inv.taxAmount * rate) * 100) / 100,
            total: Math.round((inv.total * rate) * 100) / 100,
            items: convertedItems
          };
        });
        
        setHistory(convertedHistory);
        await saveDatabase(convertedHistory, sysKey);
      }
      
      // 3. Update global states
      setCurrency(newCurr);
      localStorage.setItem("_inv_currency", newCurr);
      
    } catch (err) {
      console.error("Currency conversion error:", err);
      alert("Failed to retrieve live market rates. Please check your internet connection.");
    } finally {
      setIsConvertingCurrency(false);
    }
  };

  // Helper to load and decrypt historical invoices from local storage
  const loadDatabase = async (decryptionKey) => {
    try {
      const encryptedPayload = localStorage.getItem("_invoice_db_vault");
      if (encryptedPayload) {
        const decryptedText = await decryptData(encryptedPayload, decryptionKey);
        const parsedHistory = JSON.parse(decryptedText);
        setHistory(parsedHistory || []);
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.error("Failed to load invoice history database:", err);
      // Failsafe empty DB if corrupted
      setHistory([]);
    }
  };

  // Helper to encrypt and save historical invoices to local storage
  const saveDatabase = async (updatedHistory, encryptionKey) => {
    try {
      const serialized = JSON.stringify(updatedHistory);
      const encryptedPayload = await encryptData(serialized, encryptionKey);
      localStorage.setItem("_invoice_db_vault", encryptedPayload);
    } catch (err) {
      console.error("Failed to write invoice payload safely:", err);
      alert("System security write error: Unable to store your invoice safely.");
    }
  };

  // Add new or update existing invoice in secure database
  const handleSaveInvoice = async (newInvoice) => {
    const sysKey = getSystemMasterKey();
    
    let updatedHistory;
    
    if (editingInvoiceId) {
      // EDIT MODE: mutate the existing entry, don't create a duplicate
      updatedHistory = history.map(inv => 
        inv.id === editingInvoiceId
          ? { ...newInvoice, id: editingInvoiceId }
          : inv
      );
    } else {
      // CREATE MODE: append a brand new record
      const invoiceRecord = {
        ...newInvoice,
        id: Date.now() + Math.floor(Math.random() * 1000)
      };
      updatedHistory = [invoiceRecord, ...history];
    }
    
    setHistory(updatedHistory);
    await saveDatabase(updatedHistory, sysKey);
    
    // Reset edit state and navigate back
    setEditingInvoiceId(null);
    setInitialInvoiceData(null);
    setView("dashboard");
  };

  // Delete invoice record from secure database
  const handleDeleteInvoice = async (invoiceId) => {
    if (!window.confirm("Are you sure you want to permanently delete this billing record?")) return;
    
    const sysKey = getSystemMasterKey();
    const updatedHistory = history.filter(inv => inv.id !== invoiceId);
    setHistory(updatedHistory);
    await saveDatabase(updatedHistory, sysKey);
  };

  // Sibling trigger to print a past invoice
  const handlePrintPastInvoice = (invoice) => {
    setActivePrintInvoice(invoice);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  // Sibling trigger to share a past invoice
  const handleSharePastInvoice = async (invoice) => {
    // Briefly render the invoice in the background print container
    setActivePrintInvoice(invoice);
    
    // Give DOM time to mount
    setTimeout(async () => {
      try {
        const blob = await captureInvoiceBlob("printable-invoice");
        const result = await shareInvoice(invoice, blob);
        
        if (result.success && result.method === "fallback") {
          const wnd = window.open("", "_blank");
          if (wnd) {
            wnd.document.write(`
              <div style="font-family:sans-serif; padding: 2rem; max-width: 600px; margin: 0 auto; text-align: center;">
                <h2>Share Invoice ${invoice.invoiceNumber}</h2>
                <p>Native file sharing is not supported on this browser. Share using the links below:</p>
                <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 2rem;">
                  <a href="${result.urls.whatsapp}" target="_blank" style="padding: 10px 20px; background: #25D366; color: white; text-decoration: none; border-radius: 5px;">WhatsApp</a>
                  <a href="${result.urls.email}" target="_blank" style="padding: 10px 20px; background: #333; color: white; text-decoration: none; border-radius: 5px;">Email</a>
                </div>
              </div>
            `);
          }
        }
      } catch (e) {
        console.error("Sharing failed", e);
        alert("Failed to generate or share the invoice.");
      } finally {
        // Clear it back
        setActivePrintInvoice(null);
      }
    }, 500);
  };

  // Navigate back to dashboard and clear edit state
  const handleBackToDashboard = () => {
    setEditingInvoiceId(null);
    setInitialInvoiceData(null);
    setView("dashboard");
  };

  return (
    <>
      {activePrintInvoice && (
        <div className="print-only-container">
          <InvoicePreview data={activePrintInvoice} lang={lang} currency={currency} />
        </div>
      )}

      <div className="app-container">
        {/* Main Screen App Shell */}
        <header className="app-header">
          <div className="brand-section" onClick={handleBackToDashboard} style={{ cursor: "pointer" }}>
            <div className="brand-title">
              <h1 className="premium-logo" style={{ fontFamily: "'Great Vibes', cursive", fontSize: "3.5rem", textTransform: "uppercase", letterSpacing: "2px", fontWeight: "400" }}>INVORATOR</h1>
            </div>
          </div>
          
          <div className="nav-actions">
            <div className="header-actions">
              <div className="control-group">
                <label>Lang:</label>
                <select value={lang} onChange={(e) => handleLangChange(e.target.value)} className="control-select">
                  {languages.map(l => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="control-group" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <label>Cur:</label>
                <select 
                  value={currency} 
                  onChange={(e) => handleCurrencyChange(e.target.value)} 
                  className="control-select"
                  disabled={isConvertingCurrency}
                >
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
                {isConvertingCurrency && (
                  <span style={{ fontSize: "0.8rem", color: "var(--accent)", animation: "fadeIn 0.5s infinite alternate" }}>
                    Converting...
                  </span>
                )}
              </div>

              {view !== "dashboard" && (
                <button className="btn btn-secondary" onClick={handleBackToDashboard}>
                  ← Back to Dashboard
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Core Views Routing Dashboard & Editor */}
        <main style={{ minHeight: "70vh" }}>
          {view === "dashboard" && (
            <Dashboard 
              history={history}
              lang={lang}
              currency={currency}
              onStartGenerator={() => {
                setEditingInvoiceId(null);
                setInitialInvoiceData(null);
                setView("designSelector");
              }}
              onEditInvoice={(inv) => {
                // EDIT MODE: load the full invoice and track its ID
                setEditingInvoiceId(inv.id);
                setInitialInvoiceData(inv);
                setView("designSelector");
              }}
              onCopyInvoice={(inv) => {
                // COPY MODE: load data but with no editing ID (creates new)
                setEditingInvoiceId(null);
                setInitialInvoiceData(inv);
                setView("designSelector");
              }}
              onDeleteInvoice={handleDeleteInvoice}
              onPrintInvoice={handlePrintPastInvoice}
              onShareInvoice={handleSharePastInvoice}
            />
          )}
          {view === "designSelector" && (
            <DesignSelector
              lang={lang}
              onSelectDesign={(designId) => {
                setSelectedDesign(designId);
                setView("generator");
              }}
              onCancel={handleBackToDashboard}
            />
          )}
          {view === "generator" && (
            <BillGenerator 
              lang={lang}
              currency={currency}
              initialData={initialInvoiceData}
              selectedDesign={selectedDesign}
              isEditMode={!!editingInvoiceId}
              onSaveInvoice={handleSaveInvoice}
              onCancel={handleBackToDashboard}
            />
          )}
          </main>
      </div>
    </>
  );
}
