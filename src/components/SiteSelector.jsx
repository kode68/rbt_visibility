import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";

const SiteSelector = ({ onSiteChange }) => {
    const [sites, setSites] = useState([]);
    const [selectedSite, setSelectedSite] = useState("");

    useEffect(() => {
        const fetchSites = async () => {
            try {
                const snapshot = await getDocs(collection(db, "sites"));
                const siteNames = snapshot.docs.map(doc => doc.id);
                console.log("Fetched site names:", siteNames);
                setSites(siteNames);
            } catch (error) {
                console.error("Error fetching site names:", error);
            }
        };

        fetchSites();
    }, []);

    const handleChange = (e) => {
        const site = e.target.value;
        setSelectedSite(site);
        onSiteChange(site);
    };

    return (
        <div className="p-4">
            <label htmlFor="site" className="block mb-2 font-semibold text-lg">
                Select Site
            </label>
            <select
                id="site"
                value={selectedSite}
                onChange={handleChange}
                className="border border-gray-300 p-2 rounded w-64"
            >
                <option value="">-- Choose Site --</option>
                {sites.map((site) => (
                    <option key={site} value={site}>
                        {site}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default SiteSelector;
