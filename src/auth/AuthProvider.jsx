// src/auth/AuthProvider.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, getIdTokenResult } from "firebase/auth";
import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { Navigate } from "react-router-dom";

/**
 * CONFIG (tweak as needed)
 * - In emulator/local mode, these checks are relaxed automatically.
 */
const ALLOWED_DOMAINS = []; // e.g., ["brightbots.com"]
const ENFORCE_VERIFIED_EMAIL = false; // set true to require verified emails in PROD

// Helper: detect if we’re using emulators (set by firebase.js)
const usingEmulators = (() => {
    try {
        return Boolean(window?.__FIREBASE__?.useEmulators);
    } catch {
        return false;
    }
})();

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

/**
 * Role precedence (string)
 * - Keep simple: "viewer" < "admin" < "super_admin"
 */
const normalizeRole = (val) => (["viewer", "admin", "super_admin"].includes(val) ? val : "viewer");

/**
 * Create or patch users/{uid} profile on first login.
 * - Also auto-promote dev@brightbots.in to super_admin (and enforce thereafter).
 */
async function ensureUserProfile(user) {
    if (!user?.uid) return null;

    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    const isDev = user.email === "dev@brightbots.in";

    if (!snap.exists()) {
        const payload = {
            email: user.email || null,
            name: user.displayName || null,
            role: isDev ? "super_admin" : "viewer", // default or super_admin for dev
            photoURL: user.photoURL || null,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
        };
        await setDoc(ref, payload, { merge: true });
        return payload;
    } else {
        const existing = snap.data() || {};
        const patch = { lastLoginAt: serverTimestamp() };
        // Enforce super_admin for dev account even if doc was edited
        if (isDev && existing.role !== "super_admin") {
            patch.role = "super_admin";
        }
        if (Object.keys(patch).length) {
            await setDoc(ref, patch, { merge: true });
        }
        return { ...existing, ...patch };
    }
}

/**
 * Fetch role from Firestore users/{uid}.
 * Fallback to "viewer" if not present or offline.
 */
async function fetchUserRole(uid) {
    try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) return normalizeRole(snap.data()?.role);
    } catch (_) { }
    return "viewer";
}

export default function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [claims, setClaims] = useState(null);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState("");

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (fbUser) => {
            setLoading(true);
            setAuthError("");
            setClaims(null);
            setRole(null);
            setUser(fbUser || null);

            if (!fbUser) {
                setLoading(false);
                return;
            }

            try {
                // Optional: pull custom claims (works even in emulator)
                const tokenRes = await getIdTokenResult(fbUser);
                setClaims(tokenRes?.claims || null);

                // Create/patch profile on first login (and enforce dev super_admin), then read role
                await ensureUserProfile(fbUser);
                const fetchedRole = await fetchUserRole(fbUser.uid);
                setRole(fetchedRole);

                // PROD-only checks (auto-relaxed in emulator)
                if (!usingEmulators) {
                    // Allowed domain gate
                    if (ALLOWED_DOMAINS.length > 0 && fbUser.email) {
                        const ok = ALLOWED_DOMAINS.some((d) =>
                            fbUser.email.toLowerCase().endsWith(`@${d.toLowerCase()}`)
                        );
                        if (!ok) {
                            setAuthError("unauthorized-domain");
                            await signOut(auth);
                            setLoading(false);
                            return;
                        }
                    }
                    // Verified email gate
                    if (ENFORCE_VERIFIED_EMAIL && !fbUser.emailVerified) {
                        setAuthError("email-not-verified");
                        await signOut(auth);
                        setLoading(false);
                        return;
                    }
                }

                setLoading(false);
            } catch (e) {
                console.error("[AuthProvider] error:", e);
                setAuthError(e?.code || "auth-internal-error");
                // Don’t sign out automatically; surface error and keep state
                setLoading(false);
            }
        });

        return () => unsub();
    }, []);

    const value = useMemo(() => {
        const isViewer = role === "viewer";
        const isAdmin = role === "admin" || role === "super_admin";
        const isSuperAdmin = role === "super_admin";

        // Simple can() helper for UI gating
        const can = (action) => {
            switch (action) {
                case "read:any":
                    return Boolean(user);
                case "write:standard":
                    return isAdmin || isSuperAdmin;
                case "write:dangerous":
                    return isSuperAdmin;
                default:
                    return false;
            }
        };

        return {
            user,
            role,
            claims,
            loading,
            error: authError,
            usingEmulators,
            isViewer,
            isAdmin,
            isSuperAdmin,
            can,
        };
    }, [user, role, claims, loading, authError]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * ProtectedRoute
 * - Usage:
 *   <Route
 *     path="/admin"
 *     element={
 *       <ProtectedRoute roles={["admin","super_admin"]}>
 *         <AdminPage/>
 *       </ProtectedRoute>
 *     }
 *   />
 */
export function ProtectedRoute({ roles, children, fallback = "/login" }) {
    const { user, role, loading } = useAuth();

    if (loading) return null; // or a spinner
    if (!user) return <Navigate to={fallback} replace />;

    if (roles && roles.length > 0) {
        const ok = roles.includes(role);
        if (!ok) return <Navigate to="/403" replace />;
    }

    return children;
}

/**
 * RoleGate
 * - Inline gate for components:
 *   <RoleGate allow={["super_admin"]}>
 *     <DangerZone/>
 *   </RoleGate>
 */
export function RoleGate({ allow = [], children, fallback = null }) {
    const { role } = useAuth();
    if (allow.length === 0) return children;
    return allow.includes(role) ? children : fallback;
}
