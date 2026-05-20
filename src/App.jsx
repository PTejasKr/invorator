import React, { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import BillGenerator from "./components/BillGenerator";
import InvoicePreview from "./components/InvoicePreview";
import { encryptData, decryptData } from "./utils/encryption";
import { languages } from "./utils/translations";
import { loginWithGoogle, logout, onAuthStateChanged } from "./utils/firebase";
import { captureInvoiceBlob, shareInvoice } from "./utils/imageExport";

export default function App() {
  const [view, setView] = useState("dashboard"); // "dashboard", "generator"
  const [history, setHistory] = useState([]);
  
  
  // Authentication states
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  
  // Global Bilingual & Currency preferences
  const [lang, setLang] = useState(() => localStorage.getItem("_inv_lang") || "en");
  const [currency, setCurrency] = useState(() => localStorage.getItem("_inv_currency") || "USD");

  // Temporary invoice state used for background printing layout
  const [activePrintInvoice, setActivePrintInvoice] = useState(null);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Automatically load database using UID as encryption key
        loadDatabase(currentUser.uid);
      } else {
        setHistory([]);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync preferences to localStorage
  const handleLangChange = (newLang) => {
    setLang(newLang);
    localStorage.setItem("_inv_lang", newLang);
  };

  const handleCurrencyChange = (newCurr) => {
    setCurrency(newCurr);
    localStorage.setItem("_inv_currency", newCurr);
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

  // Login handler
  const handleLogin = async () => {
    try {
      setAuthError("");
      await loginWithGoogle();
    } catch (err) {
      setAuthError("Failed to sign in with Google. Ensure Firebase is configured correctly.");
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await logout();
      setView("dashboard");
    } catch (err) {
      console.error(err);
    }
  };

  // Add new generated invoice to secure database
  const handleSaveInvoice = async (newInvoice) => {
    const invoiceRecord = {
      ...newInvoice,
      id: Date.now() + Math.floor(Math.random() * 1000)
    };
    
    const updatedHistory = [invoiceRecord, ...history];
    setHistory(updatedHistory);
    if (user) await saveDatabase(updatedHistory, user.uid);
    setView("dashboard");
  };

  // Delete invoice record from secure database
  const handleDeleteInvoice = async (invoiceId) => {
    if (!window.confirm("Are you sure you want to permanently delete this billing record?")) return;
    
    const updatedHistory = history.filter(inv => inv.id !== invoiceId);
    setHistory(updatedHistory);
    if (user) await saveDatabase(updatedHistory, user.uid);
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

  // Render while checking auth
  if (authLoading) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", color: "white" }}>Loading Secure Session...</div>;
  }

  return (
    <>
      {/* 
        CRITICAL BUG FIX: Renders the printable canvas as a direct sibling of the main .app-container
        at the #root level. Prevents print-media styles from blanking out the layout!
      */}
      {activePrintInvoice && (
        <div className="print-only-container">
          <InvoicePreview data={activePrintInvoice} lang={lang} currency={currency} />
        </div>
      )}

      <div className="app-container">
        {/* Main Screen App Shell */}
        <header className="app-header">
          <div className="brand-section" onClick={() => setView("dashboard")} style={{ cursor: "pointer" }}>
            <div className="brand-title">
              <h1 className="premium-logo">invorator.</h1>
            </div>
          </div>
          
          <div className="nav-actions">
            {/* Global Preference Selectors */}
            <div className="selector-group">
              <select 
                value={lang} 
                onChange={(e) => handleLangChange(e.target.value)}
                className="select-pref"
                aria-label="Select Language"
              >
                {languages.map(l => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>

              <select 
                value={currency} 
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="select-pref"
                aria-label="Select Currency"
              >
                <option value="USD">USD ($)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>

            {user && (
              <>
                <span className="badge-standard" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img src={user.photoURL} alt="Profile" style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                  {user.displayName}
                </span>
                
                {view !== "dashboard" && (
                  <button className="btn btn-secondary" onClick={() => setView("dashboard")}>
                    ← Back to Dashboard
                  </button>
                )}
                
                <button className="btn btn-danger btn-sm" onClick={handleLogout}>
                  Sign Out
                </button>
              </>
            )}
          </div>
        </header>

        {/* Firebase Google Auth Login Screen */}
        {!user && (
          <div className="vault-lock-screen">
            <h1 className="premium-logo" style={{ fontSize: "3.5rem", marginBottom: "0.5rem", color: "white" }}>invorator.</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "1rem", marginBottom: "2rem" }}>
              Secure Client-Side Invoice Platform
            </p>
            <button className="btn btn-primary" onClick={handleLogin} style={{ padding: "1rem 2rem", fontSize: "1.1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                <path fill="#ffffff" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
              </svg>
              Continue with Google
            </button>
            {authError && (
              <p style={{ color: "var(--error)", fontSize: "0.9rem", marginTop: "1rem" }}>
                {authError}
              </p>
            )}
          </div>
        )}

        {/* Core Views Routing Dashboard & Editor */}
        {user && (
          <main style={{ minHeight: "70vh" }}>
            {view === "dashboard" ? (
              <Dashboard 
                history={history}
                lang={lang}
                currency={currency}
                onStartGenerator={() => setView("generator")}
                onDeleteInvoice={handleDeleteInvoice}
                onPrintInvoice={handlePrintPastInvoice}
                onShareInvoice={handleSharePastInvoice}
              />
            ) : (
              <BillGenerator 
                lang={lang}
                currency={currency}
                onSaveInvoice={handleSaveInvoice}
                onCancel={() => setView("dashboard")}
              />
            )}
          </main>
        )}
      </div>
    </>
  );
}
