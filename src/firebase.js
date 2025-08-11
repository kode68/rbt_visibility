// src/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
  // initializeAuth, indexedDBLocalPersistence, // <- use these instead if you ever target React Native
  connectAuthEmulator,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  setLogLevel,
} from "firebase/firestore";

/**
 * ---- Config from environment (prod-safe) ----
 * Keep your real keys in .env / .env.production
 * For local development, override in .env.local
 */
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || undefined,
};

// ---- Behavior toggles ----
const useEmulators =
  String(process.env.REACT_APP_USE_EMULATOR || "false").toLowerCase() === "true";
const isDev = process.env.NODE_ENV === "development";

// Optional: strict sanity check in production builds
if (!useEmulators) {
  const required = [
    "REACT_APP_FIREBASE_API_KEY",
    "REACT_APP_FIREBASE_AUTH_DOMAIN",
    "REACT_APP_FIREBASE_PROJECT_ID",
    "REACT_APP_FIREBASE_APP_ID",
  ];
  for (const key of required) {
    if (!process.env[key]) {
      // Don't throw in dev to avoid breaking DX; warn instead.
      // In prod, this will still compile but you can see the error in logs.
      // If you prefer hard-fail, replace console.error with: throw new Error(...)
      console.error(`[firebase] Missing env: ${key}`);
    }
  }
}

// Optional verbose Firestore logs in dev
if (isDev) {
  setLogLevel("debug");
  console.log(
    `[firebase] Mode: ${useEmulators ? "EMULATORS" : "PRODUCTION"} | NODE_ENV=${process.env.NODE_ENV}`
  );
}

// ---- Initialize (reuse if hot reloaded) ----
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Persist user sessions across refreshes
setPersistence(auth, browserLocalPersistence).catch(() => { /* ignore */ });

// ---- Emulator wiring (opt-in) ----
// NOTE: We call direct connect* APIs to keep emulator code out of prod bundles.
if (useEmulators) {
  try {
    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  } catch (e) {
    // ignore double-connect during hot reload
  }
  try {
    connectFirestoreEmulator(db, "localhost", 8080);
  } catch (e) {
    // ignore double-connect during hot reload
  }
  if (isDev) console.log("[firebase] Connected to Auth(9099) + Firestore(8080) emulators");
}

// Handy for quick inspection from the browser console
if (typeof window !== "undefined") {
  window.__FIREBASE__ = { app, auth, db, useEmulators };
}

export { app, auth, db };
