/**
 * Secure client-side encryption utility using the Web Cryptography API (AES-GCM 256-bit).
 * Encrypts data with PBKDF2 key derivation from a passphrase.
 */

// Helper to derive AES-GCM key from password and salt
async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts cleartext string using a passphrase.
 * @param {string} text - The cleartext JSON or string to encrypt
 * @param {string} password - The encryption passphrase
 * @returns {Promise<string>} Base64 encoded package containing salt + iv + ciphertext
 */
export async function encryptData(text, password) {
  if (!text) return "";
  try {
    const encoder = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const key = await deriveKey(password, salt);
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encoder.encode(text)
    );
    
    // Combine salt, iv, and ciphertext into a single byte array
    const combined = new Uint8Array(salt.byteLength + iv.byteLength + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.byteLength);
    combined.set(new Uint8Array(encrypted), salt.byteLength + iv.byteLength);
    
    // Convert combined array to base64
    let binary = "";
    const len = combined.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    return window.btoa(binary);
  } catch (error) {
    console.error("Encryption failed:", error);
    throw new Error("Failed to encrypt data safely.");
  }
}

/**
 * Decrypts base64 encoded ciphertext package using a passphrase.
 * @param {string} cipherText - Base64 encoded salt + iv + ciphertext package
 * @param {string} password - The decryption passphrase
 * @returns {Promise<string>} The decrypted cleartext string
 */
export async function decryptData(cipherText, password) {
  if (!cipherText) return "";
  try {
    const binary = window.atob(cipherText);
    const combined = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      combined[i] = binary.charCodeAt(i);
    }
    
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encrypted = combined.slice(28);
    
    const key = await deriveKey(password, salt);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Invalid decryption key or corrupted data package.");
  }
}

/**
 * Automatically retrieves or creates a browser-unique default key so encryption is transparent.
 * If user enables Vault Mode, they use their own password instead.
 */
export function getSystemMasterKey() {
  let key = localStorage.getItem("_sys_token_sec");
  if (!key) {
    // Generate a random high-entropy token
    const buffer = window.crypto.getRandomValues(new Uint8Array(32));
    let binary = "";
    for (let i = 0; i < buffer.byteLength; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    key = window.btoa(binary);
    localStorage.setItem("_sys_token_sec", key);
  }
  return key;
}
