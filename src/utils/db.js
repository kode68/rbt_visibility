import { doc, updateDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import toast from "react-hot-toast";

/**
 * Updates a single field on an RBT and logs the change in /rbt_logs
 * @param {string} site - Site name (e.g. 'Rajapur')
 * @param {string} rbtId - Robot ID (e.g. 'RBT1')
 * @param {string} field - Field name to update (e.g. 'running_status')
 * @param {*} oldValue - Previous value
 * @param {*} newValue - New value to update
 */
export const logAndUpdateField = async (site, rbtId, field, oldValue, newValue) => {
    try {
        const user = auth.currentUser?.email || "unknown";
        const now = serverTimestamp();

        // 1. Update RBT document
        const rbtRef = doc(db, "sites", site, "rbts", rbtId);
        await updateDoc(rbtRef, {
            [field]: newValue,
            last_updated: now,
        });

        // 2. Log to centralized /rbt_logs
        const logRef = collection(db, "rbt_logs");
        await addDoc(logRef, {
            site,
            rbt_id: rbtId,
            field,
            old_value: oldValue,
            new_value: newValue,
            updated_by: user,
            updated_at: now,
        });

        // ✅ Toast message after success
        toast.success(`${field} updated`);
    } catch (err) {
        console.error("Failed to update and log:", err);
        toast.error("Update failed");
    }
};
