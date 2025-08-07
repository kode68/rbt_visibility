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

    const rbtRef = doc(db, "clients", client, "sites", site, "rbts", rbtId);

    // Show parts only if conditions match
    useEffect(() => {
        if (!rbt) return;
        const canShowParts =
            ["Manual", "Not Running"].includes(rbt.running_status || "") ||
            (rbt.breakdown_status && rbt.breakdown_status !== "N/A");
        setShowParts(canShowParts);
    }, [rbt?.breakdown_status, rbt?.running_status]);

    // Initialize part issues
    useEffect(() => {
        if (rbt) {
            const defaultParts = generateDefaultPartIssues();
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
        }
    }, [rbt]);

    if (!client || !site || !rbtId || !rbt) {
        return <p className="text-red-500 text-sm">Loading part issues...</p>;
    }

    // Toggle part selection (auto-save to Firestore)
    const togglePart = async (part) => {
        const updated = { ...selectedParts };
        const isSelected = !!(updated[part]?.dispatch_date || updated[part]?.delivery_date);

        if (isSelected) {
            // Unselect part
            updated[part] = { dispatch_date: "", delivery_date: "" };
            await updateDoc(rbtRef, {
                [`part_issues.${part}`]: updated[part],
                last_updated: serverTimestamp(),
            });
            await logAndUpdateField(client, site, rbtId, `part_issues.${part}`, "Selected", "Cleared");
        } else {
            // Select part
            updated[part] = { dispatch_date: "", delivery_date: "" };
            await updateDoc(rbtRef, {
                [`part_issues.${part}`]: updated[part],
                last_updated: serverTimestamp(),
            });
            await logAndUpdateField(client, site, rbtId, `part_issues.${part}`, "Cleared", "Selected");
        }

        setSelectedParts(updated);
        if (typeof onPartIssueChange === "function") onPartIssueChange(updated);
    };

    // Update dispatch or delivery date
    const updateDate = async (part, field, value) => {
        const prevValue = selectedParts[part]?.[field] || "";
        if (prevValue === value) return;

        const updated = {
            ...selectedParts,
            [part]: { ...selectedParts[part], [field]: value },
        };

        setSelectedParts(updated);
        if (typeof onPartIssueChange === "function") onPartIssueChange(updated);

        await updateDoc(rbtRef, {
            [`part_issues.${part}.${field}`]: value,
            last_updated: serverTimestamp(),
        });

        await logAndUpdateField(client, site, rbtId, `part_issues.${part}.${field}`, prevValue, value);
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
                        const isSelected = selectedParts[part]?.dispatch_date || selectedParts[part]?.delivery_date;
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
                                                value={selectedParts[part]?.dispatch_date || ""}
                                                onChange={(e) => updateDate(part, "dispatch_date", e.target.value)}
                                                className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div className="flex flex-col w-1/2">
                                            <label className="text-xs text-gray-500 mb-1">Delivery</label>
                                            <input
                                                type="date"
                                                value={selectedParts[part]?.delivery_date || ""}
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
