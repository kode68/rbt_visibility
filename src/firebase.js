// src/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
  connectAuthEmulator,
} from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const cfg = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

for (const [k, v] of Object.entries(cfg)) {
  if (!v) {
    console.warn(`[firebase] Missing env: ${k}. Did you create .env.local?`);
  }
}

const app = getApps().length ? getApp() : initializeApp(cfg);
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);
const db = getFirestore(app);

// Local emulators are OFF by default. Flip the env to true only if you want them.
const useEmulators =
  String(process.env.REACT_APP_USE_FIREBASE_EMULATORS || "false").toLowerCase() === "true";

if (useEmulators) {
  try {
    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  } catch { }
  try {
    connectFirestoreEmulator(db, "localhost", 8080);
  } catch { }
  console.log("[firebase] Connected to local emulators (Auth:9099, Firestore:8080)");
}

export { app, auth, db };
