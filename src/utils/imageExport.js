import html2canvas from "html2canvas";

/**
 * Capture an HTML element and download it as a PNG image file.
 * @param {string} elementId - The ID of the DOM element to capture
 * @param {string} invoiceNumber - The invoice identifier for the filename
 * @returns {Promise<Blob>} The image blob for sharing
 */
export async function downloadInvoiceImage(elementId, invoiceNumber) {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error("Target capture element not found");
  }

  try {
    // Standard capture settings optimized for high-dpi print outputs
    const canvas = await html2canvas(element, {
      scale: 2, // Retain high vector sharpness
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      onclone: (clonedDoc) => {
        const el = clonedDoc.getElementById(elementId);
        if (el) el.style.transform = "none";
      }
    });

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Canvas blob extraction failed"));
          return;
        }

        // Generate download
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `invoice_${invoiceNumber}.png`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        resolve(blob);
      }, "image/png");
    });
  } catch (error) {
    console.error("Image generation failed:", error);
    throw error;
  }
}

/**
 * Shared logic to generate the image blob without downloading
 */
export async function captureInvoiceBlob(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return null;
  
  const canvas = await html2canvas(element, {
    scale: 1.5,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    onclone: (clonedDoc) => {
      const el = clonedDoc.getElementById(elementId);
      if (el) el.style.transform = "none";
    }
  });
  
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
}

/**
 * Triggers the browser Web Share API or falls back to messaging links.
 * @param {object} invoice - The invoice data object
 * @param {Blob} imageBlob - Pre-rendered image blob (optional)
 */
export async function shareInvoice(invoice, imageBlob) {
  const { invoiceNumber, vendorName, total, currency = "USD" } = invoice;
  const symbol = currency === "INR" ? "₹" : "$";
  const formattedTotal = total.toLocaleString(currency === "INR" ? "en-IN" : "en-US", { minimumFractionDigits: 2 });
  const shareText = `Official Invoice *${invoiceNumber}* from *${vendorName}*\nTotal Payable: ${symbol}${formattedTotal}\nSecurely generated via InvoSafe.`;

  // 1. Attempt Native Web Share with Files (mobile/modern desktop browsers)
  if (navigator.canShare && navigator.share) {
    try {
      const shareData = {
        title: `Invoice ${invoiceNumber}`,
        text: shareText
      };

      if (imageBlob) {
        const file = new File([imageBlob], `invoice_${invoiceNumber}.png`, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          shareData.files = [file];
        }
      }

      await navigator.share(shareData);
      return { success: true, method: "native" };
    } catch (e) {
      if (e.name !== "AbortError") {
        console.warn("Native file sharing failed, falling back to text share:", e);
      } else {
        return { success: false, reason: "cancelled" };
      }
    }
  }

  // 2. Direct Social Share Redirects (Fallback)
  const encodedText = encodeURIComponent(shareText);
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
  const mailUrl = `mailto:?subject=${encodeURIComponent(`Invoice ${invoiceNumber} from ${vendorName}`)}&body=${encodeURIComponent(shareText)}`;

  return {
    success: true,
    method: "fallback",
    urls: {
      whatsapp: whatsappUrl,
      email: mailUrl,
      text: shareText
    }
  };
}
