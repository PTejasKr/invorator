import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged as firebaseOnAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const isConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

export let app;
export let auth;
export let provider;

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  provider = new GoogleAuthProvider();
} else {
  // Mock objects to prevent app crash before the user adds their keys
  console.warn("Firebase is not configured! Please update src/utils/firebase.js with your keys.");
  app = null;
  auth = null;
  provider = null;
}

export const loginWithGoogle = async () => {
  if (!isConfigured) {
    alert("Firebase is not configured! Please add your Firebase configuration to src/utils/firebase.js to enable Google Sign-In.");
    throw new Error("Firebase not configured");
  }
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Firebase Login Error:", error);
    throw error;
  }
};

export const logout = async () => {
  if (!isConfigured) return;
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Firebase Logout Error:", error);
    throw error;
  }
};

export const onAuthStateChanged = (callback) => {
  if (!isConfigured) {
    // If not configured, just return a dummy unsubscribe function and don't trigger the callback
    // (This keeps the user on the Login screen)
    callback(null);
    return () => {};
  }
  return firebaseOnAuthStateChanged(auth, callback);
};
