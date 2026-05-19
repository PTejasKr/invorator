import React, { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import BillGenerator from "./components/BillGenerator";
import InvoicePreview from "./components/InvoicePreview";
import { encryptData, decryptData, getSystemMasterKey } from "./utils/encryption";
import { languages } from "./utils/translations";

export default function App() {
  const [view, setView] = useState("dashboard"); // "dashboard", "generator"
  const [history, setHistory] = useState([]);
  
  // Security & Vault states
  const [isVaultEnabled, setIsVaultEnabled] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [activePassword, setActivePassword] = useState("");
  const [vaultError, setVaultError] = useState("");
  const [showPasscodeSetup, setShowPasscodeSetup] = useState(false);
  const [setupPasscode, setSetupPasscode] = useState("");
  
  // Global Bilingual & Currency preferences
  const [lang, setLang] = useState(() => localStorage.getItem("_inv_lang") || "en");
  const [currency, setCurrency] = useState(() => localStorage.getItem("_inv_currency") || "USD");

  // Temporary invoice state used for background printing layout
  const [activePrintInvoice, setActivePrintInvoice] = useState(null);

  // Load encrypted database on mount, checking for Device-Bound single sign-in (Virtual MAC Auth)
  useEffect(() => {
    const vaultFlag = localStorage.getItem("_vault_enabled_flag") === "true";
    setIsVaultEnabled(vaultFlag);
    
    const deviceToken = localStorage.getItem("INVOSAFE_DEVICE_TOKEN");
    
    if (deviceToken) {
      // Device already signed in and registered - seamless bypass activation!
      setActivePassword(deviceToken);
      setIsUnlocked(true);
      loadDatabase(deviceToken);
    } else if (vaultFlag) {
      // Vault passcode is enabled but no active device token - require challenge passcode
      setIsUnlocked(false);
    } else {
      // Standard transparent browser master key encryption
      const sysKey = getSystemMasterKey();
      setActivePassword(sysKey);
      loadDatabase(sysKey);
    }
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
      setVaultError("");
      setIsUnlocked(true);
    } catch (err) {
      console.error("Failed to load invoice history database:", err);
      setVaultError("Decryption failed. Incorrect passcode or corrupted storage.");
      setIsUnlocked(false);
      throw err;
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

  // Unlock vault using passcode challenge
  const handleUnlockVault = async (e) => {
    e.preventDefault();
    if (!passcodeInput) return;
    
    try {
      setVaultError("");
      
      // Decrypt the INVOSAFE_SECURE_KEY_PACKAGE to obtain the actual database device key
      const keyPackage = localStorage.getItem("INVOSAFE_SECURE_KEY_PACKAGE");
      if (keyPackage) {
        const deviceToken = await decryptData(keyPackage, passcodeInput);
        // If decryption succeeded, the passcode is valid! Setup deviceToken as encryption activePassword.
        localStorage.setItem("INVOSAFE_DEVICE_TOKEN", deviceToken); // Re-register device signature for seamless login
        setActivePassword(deviceToken);
        await loadDatabase(deviceToken);
        setIsUnlocked(true);
      } else {
        // Vault enabled flag was set but package was lost: Fallback decrypting database directly
        await loadDatabase(passcodeInput);
        setActivePassword(passcodeInput);
        setIsUnlocked(true);
      }
      setPasscodeInput("");
    } catch (err) {
      setVaultError("Decryption failed: Incorrect passcode.");
      setIsUnlocked(false);
    }
  };

  // Turn on passcode / vault mode
  const handleEnableVault = async (e) => {
    e.preventDefault();
    if (!setupPasscode || setupPasscode.length < 4) {
      alert("Passcode must be at least 4 characters long.");
      return;
    }

    try {
      // 1. Generate Virtual MAC signature token for transparent login
      const deviceToken = "VMAC-" + window.btoa(
        Array.from(window.crypto.getRandomValues(new Uint8Array(24)))
          .map(b => String.fromCharCode(b))
          .join("")
      ).replace(/[^a-zA-Z0-9]/g, "");

      // 2. Encrypt the device token with the user's custom passcode and save package
      const encryptedKeyPackage = await encryptData(deviceToken, setupPasscode);
      localStorage.setItem("INVOSAFE_SECURE_KEY_PACKAGE", encryptedKeyPackage);
      localStorage.setItem("INVOSAFE_DEVICE_TOKEN", deviceToken);
      localStorage.setItem("_vault_enabled_flag", "true");

      // 3. Save active database history with the deviceToken
      await saveDatabase(history, deviceToken);

      setIsVaultEnabled(true);
      setActivePassword(deviceToken);
      setShowPasscodeSetup(false);
      setSetupPasscode("");
      setIsUnlocked(true);
      alert("Virtual MAC Authentication active! Seamless sign-in enabled for this device.");
    } catch (err) {
      console.error(err);
      alert("Error enabling Vault Mode passcode encryption.");
    }
  };

  // Completely unregister device (Sign Out & Wipe Keys)
  const handleUnregisterDevice = () => {
    if (!window.confirm("Are you sure you want to sign out and unregister this device? This will wipe your active session credentials, requiring your passcode on next sign-in. Your invoice database will remain securely encrypted.")) return;
    
    // Wipe local session keys and credentials
    localStorage.removeItem("INVOSAFE_DEVICE_TOKEN");
    setIsUnlocked(false);
    setActivePassword("");
    setPasscodeInput("");
    setHistory([]);
  };

  // Revert back to transparent browser default encryption
  const handleDisableVault = async () => {
    if (!window.confirm("Decrypt and revert to standard transparent browser storage? Your database will remain encrypted in local storage, but won't require a manual passcode or registration on launch.")) return;

    try {
      const sysKey = getSystemMasterKey();
      
      // Decrypt database using active device token
      const currentHistory = [...history];
      
      // Re-save database using the standard browser-unique key
      await saveDatabase(currentHistory, sysKey);
      
      // Wipe vault variables
      localStorage.setItem("_vault_enabled_flag", "false");
      localStorage.removeItem("INVOSAFE_DEVICE_TOKEN");
      localStorage.removeItem("INVOSAFE_SECURE_KEY_PACKAGE");
      
      setIsVaultEnabled(false);
      setActivePassword(sysKey);
      setIsUnlocked(true);
      setHistory(currentHistory);
    } catch (err) {
      alert("Error disabling Vault passcode protection.");
    }
  };

  // Lock session manually
  const handleLockVaultManually = () => {
    if (isVaultEnabled) {
      // Remove device token to lock the workspace
      localStorage.removeItem("INVOSAFE_DEVICE_TOKEN");
      setIsUnlocked(false);
      setActivePassword("");
      setPasscodeInput("");
      setHistory([]);
    } else {
      setShowPasscodeSetup(true);
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
    await saveDatabase(updatedHistory, activePassword);
    setView("dashboard");
  };

  // Delete invoice record from secure database
  const handleDeleteInvoice = async (invoiceId) => {
    if (!window.confirm("Are you sure you want to permanently delete this billing record?")) return;
    
    const updatedHistory = history.filter(inv => inv.id !== invoiceId);
    setHistory(updatedHistory);
    await saveDatabase(updatedHistory, activePassword);
  };

  // Sibling trigger to print a past invoice
  const handlePrintPastInvoice = (invoice) => {
    setActivePrintInvoice(invoice);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  // Lock session (bypasses unregistering device)
  const handleSessionLock = () => {
    localStorage.removeItem("INVOSAFE_DEVICE_TOKEN"); // Remove token so it must be unlocked
    setIsUnlocked(false);
    setActivePassword("");
    setPasscodeInput("");
    setHistory([]);
  };

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
          <div className="brand-section">
            <div className="brand-icon">🧾</div>
            <div className="brand-title">
              <h1>InvoSafe / invorator</h1>
              <p>High-End Client-Side Invoice Vault</p>
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

            {isUnlocked && (
              <>
                {localStorage.getItem("INVOSAFE_DEVICE_TOKEN") ? (
                  <span className="badge-vmac" title="Seamless Virtual MAC Bypass Active">
                    🖥️ Device Auth Active
                  </span>
                ) : (
                  <span className="badge-standard">
                    🛡️ Client Secured
                  </span>
                )}
                {isVaultEnabled && (
                  <button className="btn btn-secondary btn-sm" onClick={handleSessionLock}>
                    🔒 Lock
                  </button>
                )}
                {localStorage.getItem("INVOSAFE_DEVICE_TOKEN") && (
                  <button className="btn btn-danger btn-sm" onClick={handleUnregisterDevice}>
                    🚪 Sign Out
                  </button>
                )}
                {view !== "dashboard" && (
                  <button className="btn btn-secondary" onClick={() => setView("dashboard")}>
                    Dashboard
                  </button>
                )}
              </>
            )}
          </div>
        </header>

        {/* Vault Passcode Setup Modal Overlay */}
        {showPasscodeSetup && (
          <div className="vault-lock-screen">
            <div className="vault-lock-icon">🔐</div>
            <h2>Create Vault Passcode</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Protect your expensed invoices with high-entropy client AES encryption. Your passcode is never stored or sent over a network.
            </p>
            <form onSubmit={handleEnableVault} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <input 
                type="password"
                placeholder="Enter master passcode (min 4 chars)"
                value={setupPasscode}
                onChange={(e) => setSetupPasscode(e.target.value)}
                required
                autoFocus
              />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowPasscodeSetup(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1.5 }}>
                  Secure Database
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Vault Challenge Lock Screen */}
        {!isUnlocked && !showPasscodeSetup && (
          <div className="vault-lock-screen">
            <div className="vault-lock-icon">🔒</div>
            <h2>InvoSafe Vault Locked</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Enter your custom cryptographic passcode to decrypt and access local invoice records.
            </p>
            <form onSubmit={handleUnlockVault} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <input 
                type="password"
                placeholder="Enter cryptographic passcode"
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                required
                autoFocus
              />
              {vaultError && (
                <p style={{ color: "var(--error)", fontSize: "0.8rem", fontWeight: "600" }}>
                  {vaultError}
                </p>
              )}
              <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                Unlock Database
              </button>
            </form>
          </div>
        )}

        {/* Core Views Routing Dashboard & Editor */}
        {isUnlocked && !showPasscodeSetup && (
          <main style={{ minHeight: "70vh" }}>
            {view === "dashboard" ? (
              <Dashboard 
                history={history}
                lang={lang}
                currency={currency}
                onStartGenerator={() => setView("generator")}
                onDeleteInvoice={handleDeleteInvoice}
                onPrintInvoice={handlePrintPastInvoice}
                isVaultEnabled={isVaultEnabled}
                onLockVault={handleLockVaultManually}
                onDisableVault={handleDisableVault}
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
