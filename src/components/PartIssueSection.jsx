import React, { useState } from "react";

const ALL_PARTS = [
    "ANTENA CABLE", "ANTENA PORT", "BATTERY", "BATTERY BOX", "BATTTERY", "BRUSH MOTOR",
    "CHARGE CONTROLLER", "GUIDE WHEEL", "HOME SENSOR", "LIMIT SWITCH", "LOAD WHEEL",
    "LT 1", "LT 2", "PCB BOX", "PULSE COUNT", "PV MODULE", "REPEATER PCB", "RTC",
    "SS PIPE", "SSC", "STEPPER DRIVE", "STEPPER MOTOR", "TC BELT", "TC Load Wheel", "XBEE"
];

const PartIssueSection = ({ rbtId }) => {
    const [selectedParts, setSelectedParts] = useState({});

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
        <div className="bg-gray-100 p-4 rounded-lg">
            <h3 className="text-md font-semibold mb-2 text-gray-800">Part Issue Section</h3>

            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto mb-4">
                {ALL_PARTS.map((part) => (
                    <label key={part} className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            checked={!!selectedParts[part]}
                            onChange={() => togglePart(part)}
                            className="accent-blue-600"
                        />
                        <span>{part}</span>
                    </label>
                ))}
            </div>

            {Object.entries(selectedParts).map(([part, dates]) => (
                dates && (
                    <div key={part} className="mb-3">
                        <p className="font-medium text-sm mb-1">{part}</p>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                value={dates.dispatch_date}
                                onChange={(e) => updateDate(part, "dispatch_date", e.target.value)}
                                className="input"
                            />
                            <input
                                type="date"
                                value={dates.delivery_date}
                                onChange={(e) => updateDate(part, "delivery_date", e.target.value)}
                                className="input"
                            />
                        </div>
                    </div>
                )
            ))}
        </div>
    );
};

export default PartIssueSection;
