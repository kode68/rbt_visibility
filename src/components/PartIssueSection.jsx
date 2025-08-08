import React, { useState, useEffect } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { logAndUpdateField } from "../utils/db";

const ALL_PARTS = [
    "ANTENA CABLE", "ANTENA PORT", "BATTERY", "BATTERY BOX", "BRUSH MOTOR",
    "CHARGE CONTROLLER", "GUIDE WHEEL 1", "GUIDE WHEEL 2", "GUIDE WHEEL 3", "GUIDE WHEEL 4",
    "HOME SENSOR", "LIMIT SWITCH 1", "LIMIT SWITCH 2",
    "LOAD WHEEL 1", "LOAD WHEEL 2", "LOAD WHEEL 3", "LOAD WHEEL 4", "LOAD WHEEL 5", "LOAD WHEEL 6",
    "LT 1", "LT 2", "PCB BOX", "PULSE COUNT", "PV MODULE", "REPEATER PCB",
    "RTC", "SS PIPE", "SSC", "STEPPER DRIVE", "STEPPER MOTOR",
    "TC BELT", "TC LOAD WHEEL", "XBEE"
].sort();

// Helper to generate default structure
const generateDefaultPartIssues = () => {
    const defaults = {};
    ALL_PARTS.forEach((part) => {
        defaults[part] = { dispatch_date: "", delivery_date: "" };
    });
    return defaults;
};

const PartIssueSection = ({ client, site, rbtId, rbt, onPartIssueChange, onClose }) => {
    const [selectedParts, setSelectedParts] = useState({});
    const [showParts, setShowParts] = useState(false);

    const rbtRef =
        client && site && rbtId
            ? doc(db, "clients", client, "sites", site, "rbts", rbtId)
            : null;

    // Show parts only if conditions match
    useEffect(() => {
        if (!rbt) return;
        const canShowParts =
            ["Manual", "Not Running"].includes(rbt.running_status || "") ||
            (rbt.breakdown_status && rbt.breakdown_status !== "N/A");
        setShowParts(canShowParts);
    }, [rbt?.breakdown_status, rbt?.running_status, rbt]);

    // Initialize part issues
    useEffect(() => {
        if (!rbt) return;
        const defaults = generateDefaultPartIssues();
        const existing = rbt.part_issues || {};
        const merged = {};

        ALL_PARTS.forEach((part) => {
            merged[part] = {
                dispatch_date: existing[part]?.dispatch_date || "",
                delivery_date: existing[part]?.delivery_date || "",
            };
        });

        setSelectedParts(merged);
        if (typeof onPartIssueChange === "function") onPartIssueChange(merged);
    }, [rbt]);

    if (!client || !site || !rbtId || !rbt) {
        return <p className="text-red-500 text-sm">Loading part issues...</p>;
    }

    // ---------- helpers ----------
    const writeAndLog = async (path, oldVal, newVal) => {
        if (!rbtRef) return;
        // avoid redundant writes/logs
        const same =
            typeof oldVal === "object"
                ? JSON.stringify(oldVal) === JSON.stringify(newVal)
                : oldVal === newVal;
        if (same) return;

        await updateDoc(rbtRef, {
            [path]: newVal,
            last_updated: serverTimestamp(),
        });
        await logAndUpdateField(client, site, rbtId, path, oldVal, newVal);
    };

    const setLocalAndEmit = (next) => {
        setSelectedParts(next);
        if (typeof onPartIssueChange === "function") onPartIssueChange(next);
    };

    // Toggle part selection (auto-save to Firestore)
    // Selection is defined as "any date set". When toggling off, we clear both dates.
    const togglePart = async (part) => {
        const prevObj = selectedParts[part] || { dispatch_date: "", delivery_date: "" };
        const isSelected = !!(prevObj.dispatch_date || prevObj.delivery_date);

        const nextObj = isSelected
            ? { dispatch_date: "", delivery_date: "" } // unselect -> clear
            : { dispatch_date: "", delivery_date: "" }; // select -> start empty dates

        // Log full object change for the part
        await writeAndLog(`part_issues.${part}`, prevObj, nextObj);

        const updated = { ...selectedParts, [part]: nextObj };
        setLocalAndEmit(updated);
    };

    // Update dispatch or delivery date
    const updateDate = async (part, field, value) => {
        const prevObj = selectedParts[part] || { dispatch_date: "", delivery_date: "" };
        const prevValue = prevObj[field] || "";
        if (prevValue === value) return;

        // Write specific nested field
        await writeAndLog(`part_issues.${part}.${field}`, prevValue, value);

        const nextObj = { ...prevObj, [field]: value };
        const updated = { ...selectedParts, [part]: nextObj };
        setLocalAndEmit(updated);
    };

    if (!showParts) return null;

    return (
        <div className="bg-white p-5 rounded-lg shadow-md border border-gray-200 w-[700px] max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-bold mb-4 text-blue-700 border-b pb-2 sticky top-0 bg-white z-10">
                Part Issue - {rbtId}
            </h3>

            {/* Parts Selection List */}
            <div className="flex-1 overflow-y-auto mb-4 pr-2">
                <div className="grid grid-cols-2 gap-3">
                    {ALL_PARTS.map((part) => {
                        const obj = selectedParts[part] || { dispatch_date: "", delivery_date: "" };
                        const isSelected = !!(obj.dispatch_date || obj.delivery_date);

                        return (
                            <div key={part} className="border rounded-lg p-3 bg-gray-50">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="flex items-center space-x-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={!!isSelected}
                                            onChange={() => togglePart(part)}
                                            className="accent-blue-600"
                                        />
                                        <span className="text-gray-700 font-medium">{part}</span>
                                    </label>
                                </div>

                                {isSelected && (
                                    <div className="flex gap-2">
                                        <div className="flex flex-col w-1/2">
                                            <label className="text-xs text-gray-500 mb-1">Dispatch</label>
                                            <input
                                                type="date"
                                                value={obj.dispatch_date || ""}
                                                onChange={(e) => updateDate(part, "dispatch_date", e.target.value)}
                                                className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div className="flex flex-col w-1/2">
                                            <label className="text-xs text-gray-500 mb-1">Delivery</label>
                                            <input
                                                type="date"
                                                value={obj.delivery_date || ""}
                                                onChange={(e) => updateDate(part, "delivery_date", e.target.value)}
                                                className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end space-x-4 border-t pt-3 sticky bottom-0 bg-white">
                <button
                    className="px-4 py-2 text-gray-600 hover:text-gray-900"
                    onClick={onClose || (() => setShowParts(false))}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default PartIssueSection;
