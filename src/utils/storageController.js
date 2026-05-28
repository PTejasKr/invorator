/**
 * storageController.js
 * 
 * Privacy-first localStorage controller for Invorator.
 * Implements a strict Whitelist/Blacklist model:
 *   - WHITELIST: Vendor operational data (auto-saved, auto-refilled)
 *   - BLACKLIST: Client PII and per-invoice data (NEVER persisted)
 * 
 * This ensures recurring users don't need to re-enter their business details
 * while guaranteeing zero client data leakage to disk.
 */

const STORAGE_KEY = "invorator_vendor_profile";

// ─────────────────────────────────────────────────────────────────
// WHITELIST: These keys represent the user's own business identity.
// They are safe to persist because they belong to the app operator,
// not their clients. Saved on every form update, loaded on new invoice.
// ─────────────────────────────────────────────────────────────────
const VENDOR_WHITELIST_KEYS = [
  "vendorName",
  "vendorAddress",
  "vendorPhone",
  "vendorEmail",
  "vendorPAN",
  "vendorStateCode",
  "gstinSupplier",
  "gstRegime",
  "taxRate",
  "reverseCharge",
  "bankName",
  "accountName",
  "accountNumber",
  "ifscCode",
  "branchName",
  "notes"            // Terms & Conditions are vendor-level boilerplate
];

// ─────────────────────────────────────────────────────────────────
// BLACKLIST: Client PII and per-transaction data.
// These are NEVER written to localStorage under any circumstance.
// They exist only in volatile React state during the active session.
// ─────────────────────────────────────────────────────────────────
// (Listed for documentation — not used in code, but enforced by
//  the whitelist-only extraction approach below.)
//
// const CLIENT_BLACKLIST_KEYS = [
//   "clientName", "clientAddress", "clientState", "clientStateCode",
//   "gstinBuyer",
//   "consigneeName", "consigneeAddress", "consigneeGSTIN",
//   "consigneeState", "consigneeStateCode",
//   "items", "invoiceNumber", "date",
//   "subtotal", "taxAmount", "total"
// ];

/**
 * Extracts only whitelisted vendor keys from the full invoice state
 * and writes them to localStorage. Called on vendor field changes.
 * 
 * @param {Object} invoiceData - The full invoice form state object.
 */
export function saveVendorProfile(invoiceData) {
  if (!invoiceData) return;

  const profile = {};
  for (const key of VENDOR_WHITELIST_KEYS) {
    if (invoiceData[key] !== undefined && invoiceData[key] !== null) {
      profile[key] = invoiceData[key];
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn("[StorageController] Failed to save vendor profile:", e);
  }
}

/**
 * Loads the persisted vendor profile from localStorage.
 * Returns a partial object with ONLY whitelisted keys.
 * Safe to spread into the initial invoice state.
 * 
 * @returns {Object} Partial invoice data with vendor fields only.
 */
export function loadVendorProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);

    // Safety: only return whitelisted keys even if the stored object
    // was somehow corrupted or tampered with.
    const safeProfile = {};
    for (const key of VENDOR_WHITELIST_KEYS) {
      if (parsed[key] !== undefined && parsed[key] !== null) {
        safeProfile[key] = parsed[key];
      }
    }
    return safeProfile;
  } catch (e) {
    console.warn("[StorageController] Failed to load vendor profile:", e);
    return {};
  }
}

/**
 * Clears the vendor profile from localStorage.
 * Called when the user explicitly wants to reset their saved data.
 */
export function clearVendorProfile() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("[StorageController] Failed to clear vendor profile:", e);
  }
}

/**
 * Returns the list of whitelisted keys (for UI display or debugging).
 */
export function getWhitelistKeys() {
  return [...VENDOR_WHITELIST_KEYS];
}
