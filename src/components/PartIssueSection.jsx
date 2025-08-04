import React, { useState, useEffect } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { logAndUpdateField } from "../utils/db";

const ALL_PARTS = [
    "ANTENA CABLE", "ANTENA PORT", "BATTERY", "BATTERY BOX", "BATTTERY", "BRUSH MOTOR",
    "CHARGE CONTROLLER", "GUIDE WHEEL", "HOME SENSOR", "LIMIT SWITCH", "LOAD WHEEL",
    "LT 1", "LT 2", "PCB BOX", "PULSE COUNT", "PV MODULE", "REPEATER PCB", "RTC",
    "SS PIPE", "SSC", "STEPPER DRIVE", "STEPPER MOTOR", "TC BELT", "TC Load Wheel", "XBEE"
];

// Helper to generate default structure
const generateDefaultPartIssues = () => {
    const defaults = {};
    ALL_PARTS.forEach((part) => {
        defaults[part] = { dispatch_date: "", delivery_date: "" };
    });
    return defaults;
};

const PartIssueSection = ({ client, site, rbtId, rbt, onPartIssueChange }) => {
    const [selectedParts, setSelectedParts] = useState({});
    const [showParts, setShowParts] = useState(false);

    const rbtRef = doc(db, "clients", client, "sites", site, "rbts", rbtId);

    // ✅ Show/hide part section based on new logic
    useEffect(() => {
        if (!rbt) return;
        const canShowParts =
            ["Manual", "Not Running"].includes(rbt.running_status || "") ||
            (rbt.breakdown_status && rbt.breakdown_status !== "N/A");
        setShowParts(canShowParts);
    }, [rbt?.breakdown_status, rbt?.running_status]);

    // ✅ Merge Firestore data with defaults
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

    // ✅ Toggle part selection (clear dates if unchecked)
    const togglePart = async (part) => {
        const updated = { ...selectedParts };
        const isSelected = !!(updated[part]?.dispatch_date || updated[part]?.delivery_date);

        if (isSelected) {
            updated[part] = { dispatch_date: "", delivery_date: "" };
            await updateDoc(rbtRef, {
                [`part_issues.${part}`]: { dispatch_date: "", delivery_date: "" },
                last_updated: serverTimestamp(),
            });
            await logAndUpdateField(client, site, rbtId, `part_issues.${part}`, "Selected", "Cleared");
        }

        setSelectedParts(updated);
        if (typeof onPartIssueChange === "function") onPartIssueChange(updated);
    };

    // ✅ Update dispatch/delivery date
    const updateDate = async (part, field, value) => {
        const prevValue = selectedParts[part]?.[field] || "";
        if (prevValue === value) return; // No change, skip update

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

    // 🚫 Hide section if not applicable
    if (!showParts) return null;

    return (
        <div className="bg-white p-5 rounded-lg shadow-md border border-gray-200">
            <h3 className="text-lg font-bold mb-4 text-blue-700 border-b pb-2 sticky top-0 bg-white z-10">
                Part Issue Section
            </h3>

            {/* ✅ Parts Selection List */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 max-h-40 overflow-y-auto mb-4 pr-2 border-b pb-2">
                {ALL_PARTS.map((part) => {
                    const isSelected = selectedParts[part]?.dispatch_date || selectedParts[part]?.delivery_date;
                    return (
                        <label
                            key={part}
                            className={`flex items-center space-x-2 text-sm px-2 py-1 rounded cursor-pointer 
                                ${isSelected ? "bg-blue-50 border border-blue-300" : "hover:bg-gray-50"}`}
                        >
                            <input
                                type="checkbox"
                                checked={!!isSelected}
                                onChange={() => togglePart(part)}
                                className="accent-blue-600"
                            />
                            <span className="text-gray-700">{part}</span>
                        </label>
                    );
                })}
            </div>

            {/* ✅ Selected Parts Date Inputs */}
            <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                {ALL_PARTS.filter((p) => selectedParts[p]?.dispatch_date || selectedParts[p]?.delivery_date).map((part) => (
                    <div key={part} className="border rounded p-3 bg-gray-50">
                        <p className="font-semibold text-sm text-blue-700 mb-2">{part}</p>
                        <div className="flex gap-4">
                            <div className="flex flex-col w-1/2">
                                <label className="text-xs text-gray-500 mb-1">Dispatch Date</label>
                                <input
                                    type="date"
                                    value={selectedParts[part]?.dispatch_date || ""}
                                    onChange={(e) => updateDate(part, "dispatch_date", e.target.value)}
                                    className="rounded-md border border-gray-300 px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex flex-col w-1/2">
                                <label className="text-xs text-gray-500 mb-1">Delivery Date</label>
                                <input
                                    type="date"
                                    value={selectedParts[part]?.delivery_date || ""}
                                    onChange={(e) => updateDate(part, "delivery_date", e.target.value)}
                                    className="rounded-md border border-gray-300 px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PartIssueSection;
