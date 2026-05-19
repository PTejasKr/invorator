import React, { useState, useEffect, useRef } from "react";
import Tesseract from "tesseract.js";
import { parseOCRText } from "../utils/ocrParser";
import InvoicePreview from "./InvoicePreview";
import { translations } from "../utils/translations";
import { downloadInvoiceImage, shareInvoice } from "../utils/imageExport";

export default function BillGenerator({ onSaveInvoice, onCancel, lang = "en", currency = "USD" }) {
  const [step, setStep] = useState(1); // 1 = Upload/Choose, 2 = Builder
  const [imagePreview, setImagePreview] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState("");
  
  const t = translations[lang] || translations["en"];
  const symbol = currency === "INR" ? "₹" : "$";

  // Invoice form state with GST additions
  const [invoiceData, setInvoiceData] = useState({
    vendorName: "",
    invoiceNumber: "",
    date: "",
    items: [],
    taxRate: 18, // GST Indian standard is typically 18%
    taxAmount: 0,
    subtotal: 0,
    total: 0,
    notes: "",
    gstRegime: "standard", // "standard", "intrastate", "interstate"
    gstinSupplier: "",
    gstinBuyer: ""
  });

  const fileInputRef = useRef(null);

  // Recalculate subtotals, taxes, and totals dynamically
  useEffect(() => {
    const calculatedSubtotal = invoiceData.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const calculatedTaxAmount = Math.round((calculatedSubtotal * (invoiceData.taxRate / 100)) * 100) / 100;
    const calculatedTotal = Math.round((calculatedSubtotal + calculatedTaxAmount) * 100) / 100;

    setInvoiceData(prev => ({
      ...prev,
      subtotal: Math.round(calculatedSubtotal * 100) / 100,
      taxAmount: calculatedTaxAmount,
      total: calculatedTotal
    }));
  }, [invoiceData.items, invoiceData.taxRate]);

  // Handle OCR Tesseract scanning
  const processImage = (file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
      setIsScanning(true);
      setScanProgress(0);
      setScanStatus("Initializing OCR Engine...");

      Tesseract.recognize(
        e.target.result,
        "eng",
        {
          logger: (m) => {
            if (m.status === "recognizing") {
              setScanStatus("Analyzing document texts...");
              setScanProgress(Math.round(m.progress * 100));
            } else {
              setScanStatus(m.status);
            }
          }
        }
      )
        .then(({ data: { text } }) => {
          setIsScanning(false);
          setScanStatus("Completed successfully!");
          const parsed = parseOCRText(text);
          // Set initial items and calculated subtotal
          setInvoiceData(prev => ({
            ...prev,
            ...parsed,
            gstRegime: "standard",
            taxRate: parsed.taxRate || 18,
            items: parsed.items?.map(item => ({
              ...item,
              id: Date.now() + Math.random(),
              hsnCode: ""
            })) || []
          }));
          setStep(2);
        })
        .catch((error) => {
          console.error("OCR scanning error:", error);
          setIsScanning(false);
          alert("OCR analysis failed. Reverting to manual editor input.");
          handleManualStart();
        });
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add("drag-over");
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      processImage(file);
    } else {
      alert("Please upload a supported image file.");
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      processImage(file);
    }
  };

  // Manual fallback initialization
  const handleManualStart = () => {
    setInvoiceData({
      vendorName: "Merchant Enterprise",
      invoiceNumber: "INV-" + Math.floor(100000 + Math.random() * 900000),
      date: new Date().toISOString().split("T")[0],
      items: [
        { id: Date.now(), description: "Standard Professional Consulting", quantity: 1, rate: 1000, hsnCode: "998311", total: 1000 }
      ],
      taxRate: 18,
      taxAmount: 180,
      subtotal: 1000,
      total: 1180,
      notes: "Prepared manually via premium editor template.",
      gstRegime: "intrastate",
      gstinSupplier: "27AAPCG2910R1Z2",
      gstinBuyer: "27AADCB0910A1Z5"
    });
    setStep(2);
  };

  const handleInputChange = (field, value) => {
    setInvoiceData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleItemChange = (itemId, field, value) => {
    setInvoiceData(prev => {
      const updatedItems = prev.items.map(item => {
        if (item.id === itemId) {
          const updatedVal = (field === "description" || field === "hsnCode") ? value : parseFloat(value) || 0;
          const updatedItem = { ...item, [field]: updatedVal };
          updatedItem.total = Math.round((updatedItem.quantity * updatedItem.rate) * 100) / 100;
          return updatedItem;
        }
        return item;
      });
      return { ...prev, items: updatedItems };
    });
  };

  const handleAddItem = () => {
    const newItem = {
      id: Date.now() + Math.random(),
      description: "Additional Billing Item",
      quantity: 1,
      rate: 100,
      hsnCode: "",
      total: 100
    };
    setInvoiceData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const handleRemoveItem = (itemId) => {
    if (invoiceData.items.length <= 1) {
      alert("At least one line item is required on a corporate bill.");
      return;
    }
    setInvoiceData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }));
  };

  // High-dpi image capturing
  const handleSaveAsImage = async () => {
    try {
      await downloadInvoiceImage("printable-invoice", invoiceData.invoiceNumber);
    } catch (e) {
      alert("Failed to export image.");
    }
  };

  // Web Share API trigger
  const handleShareInvoice = async () => {
    try {
      const canvasElement = document.getElementById("printable-invoice");
      if (!canvasElement) return;
      
      // Grab direct transparent blob for Web Share API
      const canvas = await import("html2canvas").then(h => h.default(canvasElement, { 
        scale: 2, 
        backgroundColor: "#ffffff",
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById("printable-invoice");
          if(el) el.style.transform = "none";
        }
      }));
      canvas.toBlob(async (blob) => {
        const result = await shareInvoice(invoiceData, blob);
        if (result.success && result.method === "fallback") {
          const openMethod = window.confirm("Web share completed. Would you like to share via WhatsApp message fallback?");
          if (openMethod) {
            window.open(result.urls.whatsapp, "_blank");
          }
        }
      }, "image/png");
    } catch (e) {
      alert("Error sharing invoice.");
    }
  };

  // Finalize PDF save trigger
  const handleFinalizeAndPrint = () => {
    if (!invoiceData.vendorName) {
      alert("Please provide a valid Merchant/Vendor Name.");
      return;
    }
    
    // Save generated invoice to history vault
    onSaveInvoice({
      ...invoiceData,
      currency: currency // Keep preference tied in history records
    });
    
    // Trigger printable sibling frame
    setTimeout(() => {
      window.print();
    }, 250);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Step Indicators */}
      <div className="wizard-steps">
        <div className={`step-indicator ${step === 1 ? "active" : ""}`}>
          <span className="step-number">1</span>
          <span>{t.step1Title}</span>
        </div>
        <div style={{ width: "80px", height: "1px", backgroundColor: "var(--border)" }}></div>
        <div className={`step-indicator ${step === 2 ? "active" : ""}`}>
          <span className="step-number">2</span>
          <span>{t.step2Title}</span>
        </div>
      </div>

      {/* Step 1: Upload Receipts & Initial OCR Scanning */}
      {step === 1 && !isScanning && (
        <div className="generator-step1-grid">
          {/* Scanning/Upload Choice */}
          <div className="section-container" style={{ justifyContent: "center" }}>
            <div className="section-header" style={{ marginBottom: "1rem" }}>
              <div className="section-title">
                <h2>{t.scanTitle}</h2>
                <p>{t.scanSubtitle}</p>
              </div>
            </div>
            
            <div 
              className="uploader-box"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
            >
              <div className="upload-icon">📤</div>
              <div>
                <h3 style={{ fontSize: "1.1rem" }}>{t.dragDropText}</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                  {t.supportFormats}
                </p>
              </div>
              <button className="btn btn-secondary" style={{ marginTop: "0.5rem" }}>
                {t.btnSelectFile}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept="image/*" 
                style={{ display: "none" }}
              />
            </div>
          </div>

          {/* Manual Input Choice Card */}
          <div className="section-container" style={{ justifyContent: "center", textAlign: "center", backgroundColor: "var(--bg-canvas)", borderStyle: "dashed" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✍️</div>
            <h3>{t.manualTitle}</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.5rem", marginBottom: "1.5rem" }}>
              {t.manualSubtitle}
            </p>
            <button className="btn btn-primary" onClick={handleManualStart} style={{ width: "100%" }}>
              {t.btnManualStart}
            </button>
          </div>
        </div>
      )}

      {/* Step 1 Loader: OCR Engine Running with Visual Scanning Animation */}
      {step === 1 && isScanning && (
        <div className="scanning-card">
          <h2 style={{ fontSize: "1.3rem" }}>{t.extractingData}</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            {t.neuralReading}
          </p>

          <div className="scanning-image-wrapper">
            {imagePreview && (
              <img src={imagePreview} alt="Receipt Preview" className="scanning-preview" />
            )}
            <div className="scanning-bar"></div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <strong style={{ display: "block", fontSize: "0.9rem", color: "var(--primary)" }}>
              {scanProgress}% ({scanStatus})
            </strong>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${scanProgress}%` }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Interactive Split screen Editor & A4 Live Preview */}
      {step === 2 && (
        <div className="builder-split-view">
          {/* Left Panel: Invoice Details & Items Form Editor */}
          <div className="section-container form-section">
            <div>
              <h2 style={{ fontSize: "1.2rem", marginBottom: "0.25rem" }}>{t.refineTitle}</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                {t.refineSubtitle}
              </p>
            </div>

            {/* General Corporate Metadata */}
            <div className="form-group-row">
              <div className="form-group">
                <label htmlFor="vendorName">{t.labelMerchant}</label>
                <input 
                  type="text" 
                  id="vendorName" 
                  value={invoiceData.vendorName} 
                  onChange={(e) => handleInputChange("vendorName", e.target.value)}
                  placeholder="e.g. Apple Inc, Reliance Retail"
                />
              </div>
              <div className="form-group">
                <label htmlFor="invoiceNumber">{t.labelInvoiceNum}</label>
                <input 
                  type="text" 
                  id="invoiceNumber" 
                  value={invoiceData.invoiceNumber} 
                  onChange={(e) => handleInputChange("invoiceNumber", e.target.value)}
                  placeholder="e.g. INV-203923"
                />
              </div>
            </div>

            <div className="form-group-row">
              <div className="form-group">
                <label htmlFor="date">{t.labelDate}</label>
                <input 
                  type="date" 
                  id="date" 
                  value={invoiceData.date} 
                  onChange={(e) => handleInputChange("date", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="taxRate">{t.labelTaxRate}</label>
                <input 
                  type="number" 
                  id="taxRate" 
                  min="0"
                  max="100"
                  value={invoiceData.taxRate} 
                  onChange={(e) => handleInputChange("taxRate", parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 18%"
                />
              </div>
            </div>

            {/* Indian GST Regime Toggles & GSTIN Numbers */}
            <div className="form-group-row">
              <div className="form-group">
                <label htmlFor="gstRegime">{t.taxRegime}</label>
                <select 
                  id="gstRegime" 
                  value={invoiceData.gstRegime}
                  onChange={(e) => handleInputChange("gstRegime", e.target.value)}
                  className="select-pref"
                  style={{ width: "100%", padding: "0.55rem" }}
                >
                  <option value="standard">{t.standardTax}</option>
                  <option value="intrastate">{t.intrastateGST}</option>
                  <option value="interstate">{t.interstateGST}</option>
                </select>
              </div>
            </div>

            {invoiceData.gstRegime !== "standard" && (
              <div className="form-group-row">
                <div className="form-group">
                  <label htmlFor="gstinSupplier">{t.labelGSTIN}</label>
                  <input 
                    type="text" 
                    id="gstinSupplier" 
                    value={invoiceData.gstinSupplier}
                    onChange={(e) => handleInputChange("gstinSupplier", e.target.value.toUpperCase())}
                    placeholder="e.g. 27AAPCG2910R1Z2"
                    style={{ fontFamily: "monospace" }}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="gstinBuyer">{t.labelClientGSTIN}</label>
                  <input 
                    type="text" 
                    id="gstinBuyer" 
                    value={invoiceData.gstinBuyer}
                    onChange={(e) => handleInputChange("gstinBuyer", e.target.value.toUpperCase())}
                    placeholder="e.g. 27AADCB0910A1Z5"
                    style={{ fontFamily: "monospace" }}
                  />
                </div>
              </div>
            )}

            {/* Line Items Dynamic Grid */}
            <div className="form-group">
              <label>{t.labelItems}</label>
              <div className="items-editor">
                <div className="items-editor-header" style={{ gridTemplateColumns: invoiceData.gstRegime !== "standard" ? "1.8fr 1fr 0.6fr 0.8fr 0.8fr 0.4fr" : "2fr 0.6fr 1fr 1fr 0.4fr" }}>
                  <span>Description</span>
                  {invoiceData.gstRegime !== "standard" && <span>{t.labelHSN}</span>}
                  <span style={{ textAlign: "center" }}>Qty</span>
                  <span style={{ textAlign: "right" }}>Rate ({symbol})</span>
                  <span style={{ textAlign: "right" }}>Amount ({symbol})</span>
                  <span></span>
                </div>
                
                {invoiceData.items.map((item) => (
                  <div key={item.id} className="item-row" style={{ gridTemplateColumns: invoiceData.gstRegime !== "standard" ? "1.8fr 1fr 0.6fr 0.8fr 0.8fr 0.4fr" : "2fr 0.6fr 1fr 1fr 0.4fr" }}>
                    <input 
                      type="text"
                      value={item.description}
                      onChange={(e) => handleItemChange(item.id, "description", e.target.value)}
                      placeholder="Consulting services..."
                      style={{ padding: "0.4rem 0.6rem", fontSize: "0.85rem" }}
                    />
                    {invoiceData.gstRegime !== "standard" && (
                      <input 
                        type="text"
                        value={item.hsnCode || ""}
                        onChange={(e) => handleItemChange(item.id, "hsnCode", e.target.value)}
                        placeholder="HSN/SAC Code"
                        style={{ padding: "0.4rem 0.6rem", fontSize: "0.85rem", textAlign: "center", fontFamily: "monospace" }}
                      />
                    )}
                    <input 
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(item.id, "quantity", e.target.value)}
                      style={{ padding: "0.4rem 0.6rem", fontSize: "0.85rem", textAlign: "center" }}
                    />
                    <input 
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rate}
                      onChange={(e) => handleItemChange(item.id, "rate", e.target.value)}
                      style={{ padding: "0.4rem 0.6rem", fontSize: "0.85rem", textAlign: "right" }}
                    />
                    <span className="item-total text-right" style={{ fontWeight: "600" }}>
                      {(item.quantity * item.rate).toFixed(2)}
                    </span>
                    <button 
                      className="btn-remove" 
                      onClick={() => handleRemoveItem(item.id)}
                      title="Remove Item"
                      type="button"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
              <button 
                type="button"
                className="btn btn-secondary" 
                onClick={handleAddItem}
                style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem", alignSelf: "flex-start", marginTop: "0.5rem" }}
              >
                {t.btnAddItem}
              </button>
            </div>

            <div className="form-group">
              <label htmlFor="notes">{t.labelNotes}</label>
              <textarea 
                id="notes" 
                rows="3"
                value={invoiceData.notes} 
                onChange={(e) => handleInputChange("notes", e.target.value)}
                placeholder="Include custom terms or bank instructions..."
              />
            </div>

            {/* Stepper Control Footer */}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1.25rem", flexWrap: "wrap" }}>
              <button className="btn btn-secondary" onClick={onCancel} style={{ flex: 1, minWidth: "120px" }}>
                {t.btnCancel}
              </button>
              <button className="btn btn-secondary" onClick={handleSaveAsImage} style={{ flex: 1, minWidth: "120px" }}>
                📸 {t.btnDownloadImg}
              </button>
              <button className="btn btn-secondary" onClick={handleShareInvoice} style={{ flex: 1, minWidth: "120px" }}>
                🔗 {t.btnShare}
              </button>
              <button className="btn btn-accent" onClick={handleFinalizeAndPrint} style={{ flex: 1.8, minWidth: "160px" }}>
                {t.btnSavePrint}
              </button>
            </div>
          </div>

          {/* Right Panel: High-Fidelity A4 Live Invoice Preview */}
          <div className="preview-pane-sticky">
            <div className="preview-pane-header">
              <h3>{t.livePreviewTitle}</h3>
              <span style={{ fontSize: "0.75rem", color: "var(--success)", fontWeight: "600" }}>
                {t.synchronized}
              </span>
            </div>
            <div className="preview-scale-wrapper">
              <InvoicePreview data={invoiceData} lang={lang} currency={currency} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
