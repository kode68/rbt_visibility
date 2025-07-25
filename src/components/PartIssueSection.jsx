import React, { useState, useEffect } from "react";

const ALL_PARTS = [
    "ANTENA CABLE", "ANTENA PORT", "BATTERY", "BATTERY BOX", "BATTTERY", "BRUSH MOTOR",
    "CHARGE CONTROLLER", "GUIDE WHEEL", "HOME SENSOR", "LIMIT SWITCH", "LOAD WHEEL",
    "LT 1", "LT 2", "PCB BOX", "PULSE COUNT", "PV MODULE", "REPEATER PCB", "RTC",
    "SS PIPE", "SSC", "STEPPER DRIVE", "STEPPER MOTOR", "TC BELT", "TC Load Wheel", "XBEE"
];

const PartIssueSection = ({ rbtId, rbt }) => {
    const [selectedParts, setSelectedParts] = useState({});

    // Prefill from Firestore (rbt.part_issues)
    useEffect(() => {
        if (rbt?.part_issues) {
            const initial = {};
            for (const [part, data] of Object.entries(rbt.part_issues)) {
                if (data?.dispatch_date || data?.delivery_date) {
                    initial[part] = {
                        dispatch_date: data.dispatch_date || "",
                        delivery_date: data.delivery_date || ""
                    };
                }
            }
            setSelectedParts(initial);
        }
    }, [rbt]);

    const togglePart = (part) => {
        setSelectedParts((prev) => ({
            ...prev,
            [part]: prev[part]
                ? undefined
                : { dispatch_date: "", delivery_date: "" }
        }));
    };

    const updateDate = (part, field, value) => {
        setSelectedParts((prev) => ({
            ...prev,
            [part]: { ...prev[part], [field]: value }
        }));
    };

    return (
        <div className="bg-gray-100 p-4 rounded-xl shadow-sm">
            <h3 className="text-md font-semibold mb-3 text-gray-800 border-b pb-1">Part Issue Section</h3>

            {/* Checkbox List */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 max-h-44 overflow-y-auto pr-2 mb-4">
                {ALL_PARTS.map((part) => (
                    <label key={part} className="flex items-center space-x-2 text-sm">
                        <input
                            type="checkbox"
                            checked={!!selectedParts[part]}
                            onChange={() => togglePart(part)}
                            className="accent-blue-600"
                        />
                        <span className="text-gray-700">{part}</span>
                    </label>
                ))}
            </div>

            {Object.entries(selectedParts).map(([part, dates]) => (
                dates && (
                    <div key={part} className="mb-4">
                        <p className="font-semibold text-sm text-blue-700 mb-2">{part}</p>
                        <div className="flex gap-4 items-start">
                            <div className="flex flex-col">
                                <label className="text-xs text-gray-500 mb-1">Dispatch Date</label>
                                <input
                                    type="date"
                                    value={dates.dispatch_date}
                                    onChange={(e) => updateDate(part, "dispatch_date", e.target.value)}
                                    className="w-full rounded-md border border-gray-300 px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs text-gray-500 mb-1">Delivery Date</label>
                                <input
                                    type="date"
                                    value={dates.delivery_date}
                                    onChange={(e) => updateDate(part, "delivery_date", e.target.value)}
                                    className="w-full rounded-md border border-gray-300 px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                )
            ))}
        </div>
    );
};

export default PartIssueSection;
