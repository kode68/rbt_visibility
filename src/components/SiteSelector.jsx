import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const SiteSelector = ({ onSelect }) => {
    const [regions, setRegions] = useState([]);
    const [selectedRegion, setSelectedRegion] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRegions = async () => {
            try {
                const snapshot = await getDocs(collection(db, "clients"));
                const regionList = snapshot.docs.map((doc) => doc.id.trim());

                // ✅ Use Map to keep unique values (case-insensitive)
                const uniqueRegionsMap = new Map();
                regionList.forEach((region) => {
                    const lower = region.toLowerCase();
                    if (!uniqueRegionsMap.has(lower)) {
                        uniqueRegionsMap.set(lower, region);
                    }
                });

                const uniqueRegions = Array.from(uniqueRegionsMap.values());

                console.log("🔥 Raw Regions:", regionList);
                console.log("✅ Unique Regions:", uniqueRegions);

                setRegions(uniqueRegions);
            } catch (error) {
                console.error("Error fetching regions:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRegions();
    }, []);

    const handleChange = (e) => {
        const value = e.target.value;
        setSelectedRegion(value);
        if (onSelect) onSelect(value);
    };

    return (
        <div>
            <label className="block mb-2 font-medium">Select Region</label>
            {loading ? (
                <p>Loading regions...</p>
            ) : (
                <select
                    value={selectedRegion}
                    onChange={handleChange}
                    className="border p-2 rounded-md"
                >
                    <option value="">-- Select Region --</option>
                    {regions.map((region, index) => (
                        <option key={index} value={region}>
                            {region}
                        </option>
                    ))}
                </select>
            )}
        </div>
    );
};

export default SiteSelector;
