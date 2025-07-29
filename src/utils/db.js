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

/**
 * Updates a single field on an RBT and logs the change in /rbt_logs and daily history.
 * Also calculates and stores `ageing` if field is `running_status`.
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

        const rbtRef = doc(db, "sites", site, "rbts", rbtId);

        // Step 1: Prepare update payload
        const updatePayload = {
            [field]: newValue,
            last_updated: now,
        };

        // Set ageing to 0 for Auto, otherwise calculate below
        if (field === "running_status") {
            updatePayload.ageing = newValue === "Auto" ? 0 : null;
        }

        // Step 2: Update main RBT document
        await updateDoc(rbtRef, updatePayload);

        // Step 3: Update daily history
        const today = new Date();
        const dateKey = today.toISOString().split("T")[0]; // YYYY-MM-DD
        const historyRef = doc(db, "sites", site, "rbts", rbtId, "history", dateKey);
        await setDoc(
            historyRef,
            {
                [field]: newValue,
                updated_by: user,
                updated_at: now,
            },
            { merge: true }
        );

        // Step 4: Centralized logging
        const logRef = collection(db, "rbt_logs");
        await addDoc(logRef, {
            site,
            rbt_id: rbtId,
            field,
            old_value: oldValue,
            new_value: newValue,
            updated_by: user,
            updated_at: new Date(), // local time for easy filtering
        });

        // Step 5: Update ageing value (only if running_status !== "Auto")
        if (field === "running_status" && newValue !== "Auto") {
            // Small delay to allow Firestore to apply serverTimestamp
            setTimeout(async () => {
                const snapshot = await getDoc(rbtRef);
                const lastUpdated = snapshot?.data()?.last_updated?.toDate?.();
                if (lastUpdated) {
                    const nowDate = new Date();
                    const ageDays = Math.floor(
                        (nowDate.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
                    );
                    await updateDoc(rbtRef, { ageing: ageDays });
                }
            }, 1000);
        }

        toast.success(`${field} updated`);
    } catch (err) {
        console.error("Failed to update and log:", err);
        toast.error("Update failed");
    }
};
