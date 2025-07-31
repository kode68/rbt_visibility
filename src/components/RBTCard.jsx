import React, { useState, useEffect, useCallback } from "react";
import { doc, updateDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { logAndUpdateField } from "../utils/db";
import PartIssueSection from "./PartIssueSection";

const RBTCard = ({ site, rbt, filters }) => {
    const [breakdownStatus, setBreakdownStatus] = useState(rbt?.breakdown_status || "N/A");
    const [runningStatus, setRunningStatus] = useState(rbt?.running_status || "Auto");
    const [work, setWork] = useState(rbt?.work || "");
    const [partIssues, setPartIssues] = useState(rbt?.part_issues || {});
    const [editableFields, setEditableFields] = useState({
        cleaner_did: rbt?.cleaner_did || "",
        tc_did: rbt?.tc_did || "",
        cl_pcb_model: rbt?.cl_pcb_model || "",
        tc_pcb_model: rbt?.tc_pcb_model || "",
    });

    const [showParts, setShowParts] = useState(false);

    const userEmail = auth.currentUser?.email;
    const isAdmin = userEmail?.endsWith("@brightbots.in");
    const isSuperAdmin = userEmail === "dev@brightbots.in";

    const rbtRef = doc(db, "sites", site, "rbts", rbt.rbt_id);

    // Sync part issues with RBT updates
    useEffect(() => {
        if (rbt?.part_issues) {
            setPartIssues(rbt.part_issues);
        }
    }, [rbt]);

    // Check if any part is active or has valid in-transit details
    const hasActiveParts = Object.values(partIssues || {}).some(
        (p) => p?.dispatch_date || p?.delivery_date
    );
    const hasValidInTransitParts = Object.values(partIssues || {}).some(
        (p) => p?.dispatch_date && p?.delivery_date
    );

    // Show PartIssueSection conditionally
    useEffect(() => {
        const show =
            ["Breakdown", "Running With Issue", "Not Running"].includes(breakdownStatus) ||
            ["Manual", "Breakdown"].includes(runningStatus);
        setShowParts(show);
    }, [breakdownStatus, runningStatus]);

    const handlePartIssueChange = useCallback((updated) => {
        setPartIssues(updated);
    }, []);

    const handleUpdate = async (field, newValue) => {
        const oldValue = {
            running_status: runningStatus,
            breakdown_status: breakdownStatus,
            work: work,
        }[field];

        await updateDoc(rbtRef, {
            [field]: newValue,
            last_updated: serverTimestamp(),
        });

        await logAndUpdateField(site, rbt.rbt_id, field, oldValue, newValue);

        if (field === "running_status") setRunningStatus(newValue);
        if (field === "breakdown_status") setBreakdownStatus(newValue);
        if (field === "work") setWork(newValue);
    };

    const handleFieldEdit = async (field, value) => {
        const oldValue = editableFields[field];
        const updatedFields = { ...editableFields, [field]: value };
        setEditableFields(updatedFields);

        await updateDoc(rbtRef, {
            [field]: value,
            last_updated: serverTimestamp(),
        });

        await logAndUpdateField(site, rbt.rbt_id, field, oldValue, value);
    };

    const deleteRBT = async () => {
        if (!window.confirm("Are you sure you want to delete this RBT? This action is irreversible.")) return;
        await deleteDoc(rbtRef);
        alert(`${rbt.rbt_id} deleted successfully.`);
        window.location.reload();
    };

    // ✅ FILTER LOGIC
    const matchesFilters = () => {
        if (!filters) return true;
        if (filters.site && site !== filters.site) return false;
        if (filters.runningStatus && runningStatus !== filters.runningStatus) return false;
        if (filters.breakdownStatus && breakdownStatus !== filters.breakdownStatus) return false;
        if (filters.work && work !== filters.work) return false;
        if (filters.date) {
            const rbtDate = rbt.last_updated?.toDate
                ? rbt.last_updated.toDate()
                : rbt.last_updated
                    ? new Date(rbt.last_updated)
                    : null;
            if (!rbtDate || rbtDate.toDateString() !== filters.date.toDateString()) return false;
        }
        return true;
    };

    if (!rbt || !rbt.rbt_id || !matchesFilters()) return null;

    return (
        <div
            className={`p-4 rounded-xl shadow-md transition-all w-full ${hasActiveParts ? "bg-red-100 border border-red-400" : "bg-white"
                } hover:shadow-lg`}
        >
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-extrabold text-blue-800 mb-3 tracking-tight">
                    🦿 {rbt.rbt_id.replace(/RBT/, "RBT ")}
                </h2>
                {isSuperAdmin && (
                    <button
                        onClick={deleteRBT}
                        className="text-xs bg-red-600 text-white px-2 py-1 rounded-md hover:bg-red-700"
                    >
                        Delete
                    </button>
                )}
            </div>

            {/* Editable Fields */}
            <div className="grid grid-cols-2 gap-3 text-sm mb-4 text-gray-700">
                {["cleaner_did", "tc_did", "cl_pcb_model", "tc_pcb_model"].map((field) => (
                    <div key={field}>
                        <label className="font-semibold block capitalize">
                            {field.replace(/_/g, " ").toUpperCase()}:
                        </label>
                        {isAdmin ? (
                            <input
                                type="text"
                                value={editableFields[field]}
                                onChange={(e) => handleFieldEdit(field, e.target.value)}
                                className="input w-full mt-1"
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
                        className="input w-full"
                    >
                        <option value="">Select Running Status</option>
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
                        className="input w-full"
                    >
                        <option value="">Select Breakdown Status</option>
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
                        className="input w-full"
                    >
                        <option value="">Select Work Status</option>
                        <option value="Part Procurement">Part Procurement</option>
                        <option value="Part In-Transit" disabled={!hasValidInTransitParts}>
                            🔒 Part In-Transit
                        </option>
                        <option value="Part Installation">Part Installation</option>
                        <option value="Part Testing">Part Testing</option>
                        <option value="Trial">Trial</option>
                        <option value="Auto Scheduling">Auto Scheduling</option>
                    </select>
                    {!hasValidInTransitParts && work === "Part In-Transit" && (
                        <p className="text-xs text-red-500 mt-1">
                            🔒 To unlock, enter both dispatch and delivery date for at least one part.
                        </p>
                    )}
                </div>
            </div>

            {/* Part Issues Section */}
            {showParts && (
                <div className="mt-5">
                    <PartIssueSection
                        site={site}
                        rbtId={rbt.rbt_id}
                        rbt={rbt}
                        onPartIssueChange={handlePartIssueChange}
                    />
                </div>
            )}
        </div>
    );
};

export default RBTCard;
