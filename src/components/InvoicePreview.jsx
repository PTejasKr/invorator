import React from "react";

// Utility to convert numbers to words (Indian format)
function numberToWords(num) {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  
  if ((num = num.toString()).length > 9) return "Overflow";
  const n = ("000000000" + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return "";
  
  let str = "";
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + " " + a[n[1][1]]) + " Crore " : "";
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + " " + a[n[2][1]]) + " Lakh " : "";
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + " " + a[n[3][1]]) + " Thousand " : "";
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + " " + a[n[4][1]]) + " Hundred " : "";
  str += (n[5] != 0) ? ((str != "") ? "and " : "") + (a[Number(n[5])] || b[n[5][0]] + " " + a[n[5][1]]) + " Rupees Only /-" : "Rupees Only /-";
  
  return str.trim();
}

export default function InvoicePreview({ data, lang = "en", currency = "INR" }) {
  if (!data) return null;

  const {
    vendorName = "PURPLE BEAN AGRO INDUSTRIES PRIVATE LIMITED",
    invoiceNumber = "TI-26-27-64",
    date = new Date().toISOString().split("T")[0],
    items = [],
    subtotal = 0,
    taxRate = 0,
    taxAmount = 0,
    total = 0,
    notes = "Thank you for your business",
    gstinSupplier = "27AAPCP3820M1ZX",
    gstinBuyer = "27AANCM7223M1ZX"
  } = data;

  // Format currency without the symbol for the table, symbol is added where needed or defined in header
  const formatNum = (val) => {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val || 0);
  };
  
  const formatCurrency = (val) => "₹ " + formatNum(val);

  // Default hardcoded values from template
  const buyerName = "MAPRICOT FOODS PRIVATE LIMITED";
  const buyerAddress = "GROUND FLOOR GAT NO 58 KHANDOBACHI WADI Dhanore Pune, Pune, Maharashtra, 412105";
  const sellerAddress = "CTS NO. 1174 Bombay Puna Road Pimpri Chinchwad Pune, Pune, Maharashtra, 411012";
  const sellerPhone = "7718781594";
  const sellerEmail = "sales@pbai.in";
  const sellerPAN = "AAPCP3820M";
  
  // Dynamic totals for the bottom row of the items table
  let sumQty = 0;
  let sumTaxable = 0;
  let sumCgstAmount = 0;
  let sumSgstAmount = 0;
  let sumTotal = 0;

  // Render items mapped to the specific columns
  const renderItems = items.map((item, idx) => {
    const qty = item.quantity || 1;
    const rate = item.rate || 0;
    const taxableValue = qty * rate;
    
    // Split tax evenly between CGST/SGST for intrastate
    const gstRate = taxRate > 0 ? taxRate : 5; // Default to 5% if not provided
    const halfRate = gstRate / 2;
    const halfAmount = (taxableValue * halfRate) / 100;
    const itemTotal = taxableValue + (halfAmount * 2);
    
    sumQty += qty;
    sumTaxable += taxableValue;
    sumCgstAmount += halfAmount;
    sumSgstAmount += halfAmount;
    sumTotal += itemTotal;

    return (
      <tr key={idx} className="gst-item-row">
        <td className="text-center">{idx + 1}</td>
        <td><strong>{item.description || "Product"}</strong></td>
        <td className="text-center">{item.hsnCode || "2101"}</td>
        <td></td>
        <td></td>
        <td></td>
        <td className="text-center">{qty}</td>
        <td className="text-center">KGS</td>
        <td className="text-right">{formatNum(rate)}</td>
        <td className="text-right">{formatNum(taxableValue)}</td>
        <td className="text-center">{halfRate.toFixed(2)}%</td>
        <td className="text-right">{formatNum(halfAmount)}</td>
        <td className="text-center">{halfRate.toFixed(2)}%</td>
        <td className="text-right">{formatNum(halfAmount)}</td>
        <td className="text-right"><strong>{formatCurrency(itemTotal)}</strong></td>
      </tr>
    );
  });

  // If no items, add a fallback row
  if (items.length === 0) {
    const defaultTaxable = subtotal > 0 ? subtotal : 3800;
    const defaultHalfTax = (defaultTaxable * 2.5) / 100;
    
    sumQty = 10;
    sumTaxable = defaultTaxable;
    sumCgstAmount = defaultHalfTax;
    sumSgstAmount = defaultHalfTax;
    sumTotal = defaultTaxable + (defaultHalfTax * 2);
    
    renderItems.push(
      <tr key="fallback" className="gst-item-row">
        <td className="text-center">1</td>
        <td><strong>Instant Tea Powder</strong><br/><span style={{fontSize:"0.7rem"}}>Light MP lot</span></td>
        <td className="text-center">2101</td>
        <td></td>
        <td></td>
        <td></td>
        <td className="text-center">10</td>
        <td className="text-center">KGS</td>
        <td className="text-right">{formatNum(380.00)}</td>
        <td className="text-right">{formatNum(3800.00)}</td>
        <td className="text-center">2.50%</td>
        <td className="text-right">{formatNum(95.00)}</td>
        <td className="text-center">2.50%</td>
        <td className="text-right">{formatNum(95.00)}</td>
        <td className="text-right"><strong>{formatCurrency(3990.00)}</strong></td>
      </tr>
    );
  }

  // Ensure total values match what's in data if available, otherwise use calculations
  const finalTaxable = subtotal > 0 ? subtotal : sumTaxable;
  const finalCgst = taxAmount > 0 ? (taxAmount / 2) : sumCgstAmount;
  const finalSgst = taxAmount > 0 ? (taxAmount / 2) : sumSgstAmount;
  const finalTotal = total > 0 ? total : sumTotal;
  
  // Fill empty rows to make the table look full
  const emptyRows = [];
  for (let i = 0; i < Math.max(0, 5 - (items.length || 1)); i++) {
    emptyRows.push(
      <tr key={`empty-${i}`} className="gst-item-row-empty">
        <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      </tr>
    );
  }

  return (
    <div className="invoice-preview-wrapper" id="printable-invoice">
      <div className="gst-invoice-container">
        
        <div className="gst-header">
          <div className="gst-header-center">
            <span className="gst-thank-you">🙏 Thank-you for doing business with us</span>
            <h1 className="gst-title">TAX INVOICE</h1>
          </div>
          <div className="gst-header-right">
            Original For Recipient
          </div>
        </div>

        <table className="gst-main-table">
          <tbody>
            {/* Vendor Details Row */}
            <tr>
              <td colSpan="15" className="gst-vendor-details">
                <h2>{vendorName.toUpperCase()}</h2>
                <p>{sellerAddress}</p>
                <p>📞 {sellerPhone} &nbsp; ✉ {sellerEmail}</p>
                <p>
                  <strong>GSTIN :</strong> {gstinSupplier} 
                  <span className="gst-badge-box ml-2">State Code : 27</span>
                </p>
                <p><strong>PAN :</strong> {sellerPAN}</p>
              </td>
            </tr>

            {/* Billed To & Invoice Meta Row */}
            <tr>
              <td colSpan="8" className="gst-half-cell p-0 border-right">
                <div className="p-2">
                  <div className="gst-section-title">Details of Receiver | Billed to</div>
                  <table className="gst-inner-layout">
                    <tbody>
                      <tr><td width="50">Name:</td><td><strong>{buyerName}</strong></td></tr>
                      <tr><td>Address:</td><td>{buyerAddress}</td></tr>
                      <tr><td>GSTIN:</td><td>{gstinBuyer} <span className="gst-badge-box ml-1">State Code : 27</span></td></tr>
                      <tr><td>State:</td><td>Maharashtra</td></tr>
                    </tbody>
                  </table>
                </div>
              </td>
              <td colSpan="7" className="gst-half-cell p-0">
                <table className="gst-meta-table">
                  <tbody>
                    <tr>
                      <td width="50%" className="border-right border-bottom p-2">
                        Invoice Number<br/><strong>{invoiceNumber}</strong>
                      </td>
                      <td width="50%" className="border-bottom p-2">
                        Invoice Date<br/><strong>{date.split('-').reverse().join('-')}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan="2" className="p-2">
                        Reverse Charge<br/><strong>NO</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Consignee Row */}
            <tr>
              <td colSpan="8" className="gst-half-cell p-0 border-right">
                <div className="p-2">
                  <div className="gst-section-title">Details of Consignee | Shipped to</div>
                  <table className="gst-inner-layout">
                    <tbody>
                      <tr><td width="50">Name:</td><td><strong>{buyerName}</strong></td></tr>
                      <tr><td>Address:</td><td>{buyerAddress}</td></tr>
                      <tr><td>GSTIN:</td><td>{gstinBuyer}</td></tr>
                      <tr><td>State:</td><td>Maharashtra</td></tr>
                    </tbody>
                  </table>
                </div>
              </td>
              <td colSpan="7" className="gst-half-cell bg-light">
                {/* Empty block to match image */}
              </td>
            </tr>

            {/* Items Table Headers */}
            <tr className="gst-table-header">
              <td rowSpan="2" width="4%">Sr.<br/>No.</td>
              <td rowSpan="2" width="18%">Name of Product</td>
              <td rowSpan="2" width="6%">HSN/SAC</td>
              <td rowSpan="2" width="5%">Delivery<br/>Terms</td>
              <td rowSpan="2" width="6%">Payment<br/>Terms</td>
              <td rowSpan="2" width="5%">Supply<br/>Timeline</td>
              <td rowSpan="2" width="4%">QTY</td>
              <td rowSpan="2" width="4%">Unit</td>
              <td rowSpan="2" width="6%">Rate</td>
              <td rowSpan="2" width="8%">Taxable<br/>Value</td>
              <td colSpan="2" width="12%">CGST</td>
              <td colSpan="2" width="12%">SGST</td>
              <td rowSpan="2" width="10%">Total</td>
            </tr>
            <tr className="gst-table-header">
              <td width="5%">Rate</td>
              <td width="7%">Amount</td>
              <td width="5%">Rate</td>
              <td width="7%">Amount</td>
            </tr>

            {/* Items */}
            {renderItems}
            {emptyRows}

            {/* Items Total Row */}
            <tr className="gst-items-total">
              <td colSpan="6" className="text-right pr-2">Total</td>
              <td className="text-center">{sumQty}</td>
              <td></td>
              <td></td>
              <td className="text-right"><strong>{formatCurrency(finalTaxable)}</strong></td>
              <td></td>
              <td className="text-right"><strong>{formatCurrency(finalCgst)}</strong></td>
              <td></td>
              <td className="text-right"><strong>{formatCurrency(finalSgst)}</strong></td>
              <td className="text-right"><strong>{formatCurrency(finalTotal)}</strong></td>
            </tr>

            {/* HSN Summary Header */}
            <tr className="gst-hsn-header">
              <td colSpan="3">HSN</td>
              <td colSpan="2">QTY</td>
              <td colSpan="2">Taxable Value</td>
              <td colSpan="3" className="p-0">
                 <table style={{width:"100%", height:"100%", borderCollapse:"collapse"}}>
                   <tbody>
                     <tr><td colSpan="2" className="border-bottom text-center">CGST</td></tr>
                     <tr><td width="40%" className="border-right text-center">Rate</td><td width="60%" className="text-center">Amount</td></tr>
                   </tbody>
                 </table>
              </td>
              <td colSpan="3" className="p-0">
                 <table style={{width:"100%", height:"100%", borderCollapse:"collapse"}}>
                   <tbody>
                     <tr><td colSpan="2" className="border-bottom text-center">SGST</td></tr>
                     <tr><td width="40%" className="border-right text-center">Rate</td><td width="60%" className="text-center">Amount</td></tr>
                   </tbody>
                 </table>
              </td>
              <td colSpan="2" className="text-right pr-2">Total</td>
            </tr>

            {/* HSN Summary Row */}
            <tr className="gst-hsn-row">
              <td colSpan="3">2101</td>
              <td colSpan="2" className="text-center">{sumQty.toFixed(1)}</td>
              <td colSpan="2" className="text-right">{formatNum(finalTaxable)}</td>
              <td className="border-right text-center" colSpan="2">{taxRate > 0 ? (taxRate/2).toFixed(2) : "2.50"}%</td>
              <td className="text-right">{formatNum(finalCgst)}</td>
              <td className="border-right text-center" colSpan="2">{taxRate > 0 ? (taxRate/2).toFixed(2) : "2.50"}%</td>
              <td className="text-right">{formatNum(finalSgst)}</td>
              <td colSpan="2" className="text-right">{formatNum(finalTotal)}</td>
            </tr>

            {/* HSN Summary Total */}
            <tr className="gst-hsn-total">
              <td colSpan="3"></td>
              <td colSpan="2" className="text-center">{sumQty}</td>
              <td colSpan="2" className="text-right"><strong>{formatCurrency(finalTaxable)}</strong></td>
              <td colSpan="2"></td>
              <td className="text-right"><strong>{formatCurrency(finalCgst)}</strong></td>
              <td colSpan="2"></td>
              <td className="text-right"><strong>{formatCurrency(finalSgst)}</strong></td>
              <td colSpan="2" className="text-right"><strong>{formatCurrency(finalTotal)}</strong></td>
            </tr>

            {/* Amount In Words & Calculations */}
            <tr>
              <td colSpan="11" className="gst-amount-words border-right">
                <div className="text-center mt-2 mb-2">Total Invoice Amount in words</div>
                <div className="text-center mb-2">
                   <strong>{numberToWords(Math.round(finalTotal))}</strong>
                </div>
              </td>
              <td colSpan="4" className="p-0">
                <table className="gst-calc-table">
                  <tbody>
                    <tr>
                      <td>Total Amount Before Tax</td>
                      <td className="text-right"><strong>{formatCurrency(finalTaxable)}</strong></td>
                    </tr>
                    <tr>
                      <td className="text-right pr-3">Add : CGST</td>
                      <td className="text-right"><strong>{formatCurrency(finalCgst)}</strong></td>
                    </tr>
                    <tr>
                      <td className="text-right pr-3">Add : SGST</td>
                      <td className="text-right"><strong>{formatCurrency(finalSgst)}</strong></td>
                    </tr>
                    <tr className="border-top-thick">
                      <td><strong>Total Tax Amount</strong></td>
                      <td className="text-right"><strong>{formatCurrency(finalCgst + finalSgst)}</strong></td>
                    </tr>
                    <tr className="border-top-thick">
                      <td><strong>TOTAL</strong></td>
                      <td className="text-right"><strong>{formatCurrency(finalTotal)}</strong></td>
                    </tr>
                    <tr className="border-top-thick">
                      <td><strong>Final Invoice Amount</strong></td>
                      <td className="text-right"><strong>{formatCurrency(finalTotal)}</strong></td>
                    </tr>
                    <tr className="border-top-thick">
                      <td><strong>Balance Due</strong></td>
                      <td className="text-right"><strong>{formatCurrency(finalTotal)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Bank Details */}
            <tr>
              <td colSpan="15" className="gst-bank-details border-bottom-0">
                <div className="mb-1"><strong>🏦 Bank and Payment Details</strong></div>
                <table className="gst-inner-layout ml-2">
                  <tbody>
                    <tr><td width="150">Account Name</td><td className="text-right"><strong>{vendorName}</strong></td></tr>
                    <tr><td>Account No.</td><td className="text-right"><strong>10227953860</strong></td></tr>
                    <tr><td>IFSC Code</td><td className="text-right"><strong>IDFB0041438</strong></td></tr>
                    <tr><td>Bank Name</td><td className="text-right"><strong>IDFC FIRST Bank</strong></td></tr>
                    <tr><td>Branch Name</td><td className="text-right"><strong>CHAKAN BRANCH</strong></td></tr>
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Terms and Conditions */}
            <tr>
              <td colSpan="15" className="gst-terms border-top-thick">
                <div className="mb-1"><strong>Terms And Conditions</strong></div>
                <ol>
                  <li>This is an electronically generated document.</li>
                  <li>All disputes are subject to Pune city jurisdiction.</li>
                  <li>Payment Terms: 100% Advance</li>
                  <li>1.5% per month interest to be levied after the said term and date of delivery.</li>
                  <li>Quality of Goods as per specifications and Description mentioned.</li>
                </ol>
                <div className="text-center mt-3 mb-1" style={{fontStyle:"italic", fontSize:"0.75rem"}}>
                  Thankyou for your business
                </div>
              </td>
            </tr>
          </tbody>
        </table>

      </div>
    </div>
  );
}
