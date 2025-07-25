import React, { useState, useEffect } from "react";
import { doc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import PartIssueSection from "./PartIssueSection";

const RBTCard = ({ site, rbt }) => {
    console.log("Rendering RBTCard for:", rbt);
    const [breakdownStatus, setBreakdownStatus] = useState(rbt?.breakdown_status || "N/A");
    const [runningStatus, setRunningStatus] = useState(rbt?.running_status || "Auto");
    const [work, setWork] = useState(rbt?.work || "");
    const [showParts, setShowParts] = useState(false);

    useEffect(() => {
        const show =
            ["Breakdown", "Running With Issue", "Not Running"].includes(breakdownStatus) ||
            ["Manual", "Breakdown"].includes(runningStatus);
        setShowParts(show);
    }, [breakdownStatus, runningStatus]);

    if (!rbt || !rbt.rbt_id) return null; // ✅ This is now safe, after hooks

    const rbtRef = doc(db, "sites", site, "rbts", rbt.rbt_id);
    const today = new Date().toISOString().split("T")[0];
    const logRef = doc(db, "sites", site, "rbts", rbt.rbt_id, "history", today);

    const logChange = async (field, oldValue, newValue) => {
        const logEntry = {
            [`${field}`]: {
                old: oldValue,
                new: newValue,
                updated_at: serverTimestamp()
            }
        };
        await setDoc(logRef, logEntry, { merge: true });
    };

    const handleUpdate = async (field, newValue) => {
        const oldValue = {
            running_status: runningStatus,
            breakdown_status: breakdownStatus,
            work: work
        }[field];

        await updateDoc(rbtRef, {
            [field]: newValue,
            last_updated: serverTimestamp()
        });

        await logChange(field, oldValue, newValue);

        if (field === "running_status") setRunningStatus(newValue);
        if (field === "breakdown_status") setBreakdownStatus(newValue);
        if (field === "work") setWork(newValue);
    };

    return (
        <div className="bg-white p-4 rounded-xl shadow-md hover:shadow-lg transition w-full">
            <h2 className="text-xl font-bold text-blue-700 mb-2">{rbt.rbt_id}</h2>

            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <p><strong>Cleaner ID:</strong> {rbt.cleaner_did}</p>
                <p><strong>TC ID:</strong> {rbt.tc_did}</p>
                <p><strong>CL PCB:</strong> {rbt.cl_pcb_model}</p>
                <p><strong>TC PCB:</strong> {rbt.tc_pcb_model}</p>
            </div>

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
                        <option value="Breakdown">Breakdown</option>
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
                        <option value="Running">Running</option>
                        <option value="Running With Issue">Running With Issue</option>
                        <option value="Breakdown">Breakdown</option>
                        <option value="Not Running">Not Running</option>
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
                        <option value="Part Installation">Part Installation</option>
                        <option value="Part Testing">Part Testing</option>
                        <option value="Trial">Trial</option>
                        <option value="Auto Scheduling">Auto Scheduling</option>
                    </select>
                </div>
            </div>

            {showParts && (
                <div className="mt-4">
                    <PartIssueSection site={site} rbtId={rbt.rbt_id} rbt={rbt} />

                </div>
            )}
        </div>
    );
};

export default RBTCard;
