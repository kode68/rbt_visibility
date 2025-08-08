// src/utils/db.js
import {
    doc,
    updateDoc,
    serverTimestamp,
    collection,
    addDoc,
    setDoc,
    getDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import toast from "react-hot-toast";

const serialize = (v) => {
    if (v === null || v === undefined || v === "") return "-";
    if (typeof v === "object") {
        try {
            return JSON.stringify(v);
        } catch {
            return String(v);
        }
    }
    return String(v);
};

// ms → whole days (non-negative)
const diffDaysFromNow = (dateObj) => {
    if (!dateObj) return 0;
    const ms = Date.now() - dateObj.getTime?.();
    if (isNaN(ms)) return 0;
    return Math.max(Math.floor(ms / (1000 * 60 * 60 * 24)), 0);
};

export const logAndUpdateField = async (client, site, rbtId, field, oldValue, newValue) => {
    try {
        // Basic guards
        if (!site || !rbtId || !field) {
            console.error("❌ Missing required parameters:", { client, site, rbtId, field });
            toast.error("Update failed: Missing parameters");
            return;
        }

        const userEmail = auth.currentUser?.email || "unknown";
        const nowServer = serverTimestamp();

        // Path for the RBT document (supports both /clients/... and /sites/...)
        const rbtRef = client
            ? doc(db, "clients", client, "sites", site, "rbts", rbtId)
            : doc(db, "sites", site, "rbts", rbtId);

        // Read current doc (needed for timestamp + ageing logic)
        const snap = await getDoc(rbtRef);
        const data = snap.exists() ? snap.data() : {};

        // Build update payload (dot-paths like "part_issues.X.dispatch_date" work in updateDoc)
        const updatePayload = { [field]: newValue, last_updated: nowServer };

        // --- Running status special handling: timestamps + ageing ---
        if (field === "running_status") {
            const prevManualAt = data.running_manual_at?.toDate?.() || null;
            const prevNotRunAt = data.running_not_running_at?.toDate?.() || null;

            if (newValue === "Auto") {
                // Reset when back to Auto
                updatePayload.running_manual_at = null;
                updatePayload.running_not_running_at = null;
                updatePayload.running_status_ageing = 0;
            } else if (newValue === "Manual") {
                // Only set if not already set (preserve the older timestamp)
                if (!prevManualAt) {
                    updatePayload.running_manual_at = nowServer;
                }
                // Compute ageing from the OLDER of (existing manual_at or now) vs existing not_running_at
                const manualBase = prevManualAt || new Date(); // if we just set serverTimestamp, use now as base client-side
                const older = prevNotRunAt
                    ? (manualBase < prevNotRunAt ? manualBase : prevNotRunAt)
                    : manualBase;
                updatePayload.running_status_ageing = diffDaysFromNow(older);
            } else if (newValue === "Not Running") {
                if (!prevNotRunAt) {
                    updatePayload.running_not_running_at = nowServer;
                }
                const notRunBase = prevNotRunAt || new Date();
                const older = prevManualAt
                    ? (notRunBase < prevManualAt ? notRunBase : prevManualAt)
                    : notRunBase;
                updatePayload.running_status_ageing = diffDaysFromNow(older);
            }
        }

        // 1) Update the RBT doc
        await updateDoc(rbtRef, updatePayload);

        // 2) Append/update history for the day
        const today = new Date();
        const dateKey = today.toISOString().split("T")[0];
        const historyRef = client
            ? doc(db, "clients", client, "sites", site, "rbts", rbtId, "history", dateKey)
            : doc(db, "sites", site, "rbts", rbtId, "history", dateKey);

        await setDoc(
            historyRef,
            {
                [field]: newValue,
                updated_by: userEmail,
                updated_at: nowServer,
            },
            { merge: true }
        );

        // 3) Add audit log row
        const logRef = collection(db, "rbt_logs");
        await addDoc(logRef, {
            client: client || null,
            site,
            rbt_id: rbtId,
            field,
            old_value: serialize(oldValue),
            new_value: serialize(newValue),
            updated_by: userEmail,
            timestamp: nowServer, // server timestamp for consistent ordering
        });

        toast.success(`${field} updated successfully`);
    } catch (err) {
        console.error("❌ Failed to update and log:", err);
        toast.error("Update failed");
    }
};
