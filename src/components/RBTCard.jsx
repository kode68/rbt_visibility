import React, { useState, useEffect, useCallback } from "react";
import { doc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { logAndUpdateField } from "../utils/db";
import PartIssueSection from "./PartIssueSection";

const RBTCard = ({ client, site, rbt, filters, refreshData }) => {
    const [breakdownStatus, setBreakdownStatus] = useState("");
    const [runningStatus, setRunningStatus] = useState("");
    const [work, setWork] = useState("");
    const [partIssues, setPartIssues] = useState({});
    const [editableFields, setEditableFields] = useState({});
    const [showParts, setShowParts] = useState(false);
    const [showPartsPopup, setShowPartsPopup] = useState(false);

    const userEmail = auth.currentUser?.email || "";
    const isAdmin = userEmail.endsWith("@brightbots.in");
    const isSuperAdmin = userEmail === "mis@brightbots.in";

    const rbtRef =
        client && site && rbt?.rbt_id
            ? doc(db, "clients", client, "sites", site, "rbts", rbt.rbt_id)
            : null;

    // ✅ Sync Firestore data into state when RBT changes
    useEffect(() => {
        if (rbt) {
            setBreakdownStatus(rbt.breakdown_status || "N/A");
            setRunningStatus(rbt.running_status || "Auto");
            setWork(rbt.work || "");
            setPartIssues(rbt.part_issues || {});
            setEditableFields({
                cleaner_did: rbt.cleaner_did || "",
                tc_did: rbt.tc_did || "",
                cl_pcb_model: rbt.cl_pcb_model || "",
                tc_pcb_model: rbt.tc_pcb_model || "",
            });

            // ✅ Recalculate showParts dynamically
            setShowParts(
                ["Breakdown", "Running With Issue", "Not Running"].includes(rbt.breakdown_status) ||
                ["Manual", "Breakdown"].includes(rbt.running_status)
            );
        }
    }, [rbt]);

    const hasValidInTransitParts = Object.values(partIssues || {}).some(
        (p) => p?.dispatch_date && p?.delivery_date
    );

    const validateClientPath = () => {
        if (!client || !site || !rbt?.rbt_id) {
            alert("Missing client or site reference.");
            return false;
        }
        return true;
    };

    // ✅ Update Firestore for dropdown changes
    const handleUpdate = async (field, newValue) => {
        if (!validateClientPath() || !rbtRef) return;

        const oldValue = rbt[field] || "";
        if (oldValue === newValue) return;

        try {
            await updateDoc(rbtRef, { [field]: newValue, last_updated: serverTimestamp() });
            await logAndUpdateField(client, site, rbt.rbt_id, field, oldValue, newValue);

            if (field === "running_status") setRunningStatus(newValue);
            if (field === "breakdown_status") setBreakdownStatus(newValue);
            if (field === "work") setWork(newValue);

            // ✅ Refresh parts popup condition
            setShowParts(
                ["Breakdown", "Running With Issue", "Not Running"].includes(
                    field === "breakdown_status" ? newValue : breakdownStatus
                ) ||
                ["Manual", "Breakdown"].includes(field === "running_status" ? newValue : runningStatus)
            );

            if (refreshData) refreshData(); // Force parent refresh if needed
        } catch (err) {
            console.error(`Update failed for ${field}:`, err);
        }
    };

    const handleFieldEdit = async (field, value) => {
        if (!validateClientPath() || !rbtRef) return;
        if (editableFields[field] === value) return;

        setEditableFields((prev) => ({ ...prev, [field]: value }));

        try {
            const oldValue = editableFields[field];
            await updateDoc(rbtRef, { [field]: value, last_updated: serverTimestamp() });
            await logAndUpdateField(client, site, rbt.rbt_id, field, oldValue, value);
        } catch (err) {
            console.error(`Field update failed for ${field}:`, err);
        }
    };

    const deleteRBT = async () => {
        if (!validateClientPath() || !rbtRef) return;
        if (!window.confirm("Delete this RBT?")) return;
        try {
            await deleteDoc(rbtRef);
            alert(`${rbt.rbt_id} deleted successfully.`);
            if (refreshData) refreshData();
        } catch (err) {
            console.error("RBT deletion failed:", err);
        }
    };

    const matchesFilters = () => {
        if (!filters) return true;
        if (filters.site && site !== filters.site) return false;
        if (filters.runningStatus && runningStatus !== filters.runningStatus) return false;
        if (filters.breakdownStatus && breakdownStatus !== filters.breakdownStatus) return false;
        if (filters.work && work !== filters.work) return false;
        return true;
    };

    if (!rbt || !rbt.rbt_id || !matchesFilters()) return null;

    return (
        <div className="p-4 rounded-xl shadow-md w-full bg-white hover:shadow-lg">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-blue-800">🦿 {rbt.rbt_id}</h2>
                <div className="flex gap-2">
                    {showParts && (
                        <button
                            onClick={() => setShowPartsPopup(true)}
                            className="text-xs bg-blue-600 text-white px-2 py-1 rounded-md"
                        >
                            Parts
                        </button>
                    )}
                    {isSuperAdmin && (
                        <button
                            onClick={deleteRBT}
                            className="text-xs bg-red-600 text-white px-2 py-1 rounded-md"
                        >
                            Delete
                        </button>
                    )}
                </div>
            </div>

            {/* Editable Fields */}
            <div className="grid grid-cols-2 gap-3 text-sm mb-4 text-gray-700">
                {["cleaner_did", "tc_did", "cl_pcb_model", "tc_pcb_model"].map((field) => (
                    <div key={field}>
                        <label className="font-semibold block">{field.replace(/_/g, " ").toUpperCase()}:</label>
                        {isAdmin ? (
                            <input
                                type="text"
                                value={editableFields[field]}
                                onChange={(e) => handleFieldEdit(field, e.target.value)}
                                className="input w-full mt-1 border px-2 py-1 rounded-md"
                            />
                        ) : (
                            <p>{editableFields[field]}</p>
                        )}
                    </div>
                ))}
            </div>

            {/* Dropdowns */}
            <div className="space-y-3 text-sm">
                <div>
                    <label className="block font-medium mb-1">Running Status</label>
                    <select
                        value={runningStatus}
                        onChange={(e) => handleUpdate("running_status", e.target.value)}
                        className="input w-full border px-2 py-1 rounded-md"
                    >
                        <option value="">Select</option>
                        <option value="Auto">Auto</option>
                        <option value="Manual">Manual</option>
                        <option value="Not Running">Not Running</option>
                    </select>
                </div>

                <div>
                    <label className="block font-medium mb-1">Breakdown Status</label>
                    <select
                        value={breakdownStatus}
                        onChange={(e) => handleUpdate("breakdown_status", e.target.value)}
                        className="input w-full border px-2 py-1 rounded-md"
                    >
                        <option value="">Select</option>
                        <option value="Running With Issue">Running With Issue</option>
                        <option value="Breakdown">Breakdown</option>
                        <option value="N/A">Not Applicable</option>
                    </select>
                </div>

                <div>
                    <label className="block font-medium mb-1">Work Status</label>
                    <select
                        value={work}
                        onChange={(e) => handleUpdate("work", e.target.value)}
                        className="input w-full border px-2 py-1 rounded-md"
                    >
                        <option value="">Select</option>
                        <option value="Part Procurement">Part Procurement</option>
                        <option value="Part In-Transit" disabled={!hasValidInTransitParts}>Part In-Transit</option>
                        <option value="Part Installation">Part Installation</option>
                        <option value="Part Testing">Part Testing</option>
                        <option value="Trial">Trial</option>
                        <option value="Auto Scheduling">Auto Scheduling</option>
                    </select>
                </div>
            </div>

            {showPartsPopup && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-lg p-5 w-[500px] relative">
                        <button
                            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                            onClick={() => setShowPartsPopup(false)}
                        >
                            ✕
                        </button>
                        <PartIssueSection
                            client={client}
                            site={site}
                            rbtId={rbt.rbt_id}
                            rbt={rbt}
                            onPartIssueChange={(updated) => setPartIssues(updated)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default RBTCard;
