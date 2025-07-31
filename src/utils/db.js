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

export const logAndUpdateField = async (client, site, rbtId, field, oldValue, newValue) => {
    try {
        // Validate parameters
        if (!site || !rbtId || !field) {
            console.error("❌ Missing required parameters:", { client, site, rbtId, field });
            toast.error("Update failed: Missing parameters");
            return;
        }

        const user = auth.currentUser?.email || "unknown";
        const now = serverTimestamp();

        // ✅ Fallback to /sites if client is undefined
        const rbtRef = client
            ? doc(db, "clients", client, "sites", site, "rbts", rbtId)
            : doc(db, "sites", site, "rbts", rbtId);

        const updatePayload = {
            [field]: newValue,
            last_updated: now,
        };

        // Handle ageing
        if (field === "running_status") {
            updatePayload.ageing = newValue === "Auto" ? 0 : null;
        }

        // Update RBT document
        await updateDoc(rbtRef, updatePayload);

        // ✅ History tracking
        const today = new Date();
        const dateKey = today.toISOString().split("T")[0];
        const historyRef = client
            ? doc(db, "clients", client, "sites", site, "rbts", rbtId, "history", dateKey)
            : doc(db, "sites", site, "rbts", rbtId, "history", dateKey);

        await setDoc(
            historyRef,
            {
                [field]: newValue,
                updated_by: user,
                updated_at: now,
            },
            { merge: true }
        );

        // ✅ Logging to rbt_logs
        const logRef = collection(db, "rbt_logs");
        await addDoc(logRef, {
            client: client || null,
            site,
            rbt_id: rbtId,
            field,
            old_value: oldValue ?? "-",
            new_value: newValue ?? "-",
            updated_by: user,
            timestamp: new Date(),
        });

        // ✅ Recalculate ageing for Manual/Breakdown robots
        if (field === "running_status" && newValue !== "Auto") {
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

        toast.success(`${field} updated successfully`);
    } catch (err) {
        console.error("❌ Failed to update and log:", err);
        toast.error("Update failed");
    }
};
