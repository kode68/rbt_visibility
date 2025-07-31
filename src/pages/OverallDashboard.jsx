import React, { useEffect, useState, useRef } from "react";
import { collection, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { format, differenceInDays } from "date-fns";
import Chart from "chart.js/auto";

const OverallDashboard = () => {
    const [clients, setClients] = useState([]);
    const [selectedClient, setSelectedClient] = useState("");
    const [rbts, setRbts] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState("user");
    const [filters, setFilters] = useState({
        site: "",
        running_status: "",
        breakdown_status: "",
        work: "",
        from: "",
        to: "",
    });

    const chartRef = useRef(null);

    const runningStatusOptions = [
        { value: "Auto", label: "Auto" },
        { value: "Manual", label: "Manual" },
        { value: "Not Running", label: "Not Running" },
        { value: "N/A", label: "N/A" }
    ];

    const breakdownStatusOptions = [
        { value: "Breakdown", label: "Breakdown" },
        { value: "Running With Issue", label: "Running With Issue" },
        { value: "N/A", label: "N/A" }
    ];

    const workOptions = [
        { value: "Part Installation", label: "Part Installation" },
        { value: "Part Testing", label: "Part Testing" },
        { value: "Trial", label: "Trial" },
        { value: "Auto Scheduling", label: "Auto Scheduling" },
        { value: "N/A", label: "N/A" }
    ];

    // ✅ Fetch user role
    useEffect(() => {
        const fetchRole = () => {
            const user = auth.currentUser;
            if (!user || !user.email) return;
            if (user.email === "dev@brightbots.in") setUserRole("super_admin");
            else if (user.email.endsWith("@brightbots.in")) setUserRole("admin");
            else setUserRole("user");
        };
        fetchRole();
    }, []);

    // ✅ Fetch all clients
    useEffect(() => {
        const fetchClients = async () => {
            try {
                const snapshot = await getDocs(collection(db, "clients"));
                setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (err) {
                console.error("Error fetching clients:", err);
            }
        };
        fetchClients();
    }, []);

    // ✅ Fetch all RBTs for selected client
    useEffect(() => {
        if (!selectedClient) return;

        let interval;
        const fetchAllRBTs = async () => {
            try {
                setLoading(true);
                const sitesSnapshot = await getDocs(collection(db, "clients", selectedClient, "sites"));
                let allRbts = [];

                for (const siteDoc of sitesSnapshot.docs) {
                    const siteName = siteDoc.id;
                    const rbtsSnapshot = await getDocs(collection(db, "clients", selectedClient, "sites", siteName, "rbts"));

                    const siteRbts = rbtsSnapshot.docs.map(docItem => {
                        const rbt = docItem.data() || {};
                        const lastUpdated = rbt?.last_updated?.toDate?.() || null;
                        return {
                            id: docItem.id,
                            rbt_id: docItem.id,
                            site: siteName,
                            ...rbt,
                            running_status: rbt.running_status || "N/A",
                            breakdown_status: rbt.breakdown_status || "N/A",
                            work: rbt.work || "N/A",
                            last_updated: lastUpdated,
                            running_status_ageing:
                                rbt.running_status === "Auto"
                                    ? 0
                                    : lastUpdated
                                        ? Math.max(differenceInDays(new Date(), lastUpdated), 0)
                                        : "-"
                        };
                    });

                    allRbts = [...allRbts, ...siteRbts];
                }

                setRbts(allRbts);
                setFiltered(allRbts);
            } catch (error) {
                console.error("Error fetching RBTs:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAllRBTs();
        interval = setInterval(fetchAllRBTs, 30000);

        return () => clearInterval(interval);
    }, [selectedClient]);

    // ✅ Apply filters
    useEffect(() => {
        let result = [...rbts];

        if (filters.site) result = result.filter((rbt) => rbt.site === filters.site);
        if (filters.running_status) result = result.filter((rbt) => rbt.running_status === filters.running_status);
        if (filters.breakdown_status) result = result.filter((rbt) => rbt.breakdown_status === filters.breakdown_status);
        if (filters.work) result = result.filter((rbt) => rbt.work === filters.work);

        if (filters.from) {
            const fromDate = new Date(filters.from);
            if (!isNaN(fromDate)) result = result.filter((rbt) => rbt.last_updated && rbt.last_updated >= fromDate);
        }

        if (filters.to) {
            const toDate = new Date(filters.to);
            if (!isNaN(toDate)) result = result.filter((rbt) => rbt.last_updated && rbt.last_updated <= toDate);
        }

        setFiltered(result);
    }, [filters, rbts]);

    // ✅ Chart updates
    useEffect(() => {
        const ctx = document.getElementById("statusChart");
        if (!ctx) return;

        if (chartRef.current) chartRef.current.destroy();

        const counts = { Auto: 0, Manual: 0, "Not Running": 0 };
        filtered.forEach((rbt) => {
            if (counts.hasOwnProperty(rbt.running_status)) counts[rbt.running_status]++;
        });

        chartRef.current = new Chart(ctx, {
            type: "line",
            data: {
                labels: Object.keys(counts),
                datasets: [
                    {
                        label: "Running Status",
                        data: Object.values(counts),
                        borderColor: "#2563eb",
                        backgroundColor: "rgba(37, 99, 235, 0.3)",
                        tension: 0.4,
                        fill: true,
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: { tooltip: { enabled: true }, legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: "No. of RBTs" } },
                    x: { title: { display: true, text: "Running Status" } },
                },
            },
        });
    }, [filtered]);

    const handleFilterChange = (e) => setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));

    const handleExportCSV = () => {
        const headers = ["Site", "RBT", "Running Status", "Breakdown Status", "Work", "Ageing", "Last Updated"];
        const rows = filtered.map((rbt) => [
            rbt.site,
            rbt.rbt_id,
            rbt.running_status,
            rbt.breakdown_status,
            rbt.work,
            rbt.running_status_ageing,
            rbt.last_updated ? format(rbt.last_updated, "yyyy-MM-dd HH:mm") : "-",
        ]);

        const escapeCSV = (val) => `"${String(val || "").replace(/"/g, '""')}"`;
        const csvContent = [headers, ...rows].map((row) => row.map(escapeCSV).join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `RBT_Dashboard_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleEditField = async (rbtId, site, field, value) => {
        try {
            const ref = doc(db, "clients", selectedClient, "sites", site, "rbts", rbtId);
            const now = new Date();

            const updateData = { [field]: String(value), last_updated: serverTimestamp() };

            if (field === "running_status") {
                updateData.running_status_ageing = value === "Auto" ? 0 : 0;
            }

            await updateDoc(ref, updateData);

            setRbts((prev) =>
                prev.map((r) =>
                    r.id === rbtId
                        ? {
                            ...r,
                            ...updateData,
                            last_updated: now,
                            running_status_ageing: field === "running_status" ? (value === "Auto" ? 0 : 0) : r.running_status_ageing,
                        }
                        : r
                )
            );
        } catch (error) {
            console.error("Error updating field:", error);
        }
    };

    const totalRBTs = filtered.length;
    const autoCount = filtered.filter((r) => r.running_status === "Auto").length;
    const manualCount = filtered.filter((r) => r.running_status === "Manual").length;
    const notRunningCount = filtered.filter((r) => r.running_status === "Not Running").length;

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">📊 Overall RBT Dashboard</h1>

            {/* CLIENT SELECTOR */}
            <div className="mb-4">
                <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="border p-2 rounded-md">
                    <option value="">Select Client</option>
                    {clients.map((client) => (
                        <option key={client.id} value={client.id}>{client.id}</option>
                    ))}
                </select>
            </div>

            {/* SUMMARY */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-100 p-4 rounded shadow text-center">
                    <h2 className="text-lg font-semibold">Total RBTs</h2>
                    <p className="text-2xl font-bold">{totalRBTs}</p>
                </div>
                <div className="bg-green-100 p-4 rounded shadow text-center">
                    <h2 className="text-lg font-semibold">Auto</h2>
                    <p className="text-2xl font-bold">{autoCount}</p>
                </div>
                <div className="bg-yellow-100 p-4 rounded shadow text-center">
                    <h2 className="text-lg font-semibold">Manual</h2>
                    <p className="text-2xl font-bold">{manualCount}</p>
                </div>
                <div className="bg-red-100 p-4 rounded shadow text-center">
                    <h2 className="text-lg font-semibold">Not Running</h2>
                    <p className="text-2xl font-bold">{notRunningCount}</p>
                </div>
            </div>

            {/* FILTERS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <select name="site" value={filters.site} onChange={handleFilterChange} className="border p-2 rounded-md">
                    <option value="">Filter by Site</option>
                    {Array.from(new Set(rbts.map((rbt) => rbt.site)))
                        .filter((v) => v)
                        .map((val) => (
                            <option key={val} value={val}>{val}</option>
                        ))}
                </select>

                <select name="running_status" value={filters.running_status} onChange={handleFilterChange} className="border p-2 rounded-md">
                    <option value="">Filter by Running Status</option>
                    {runningStatusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>

                <select name="breakdown_status" value={filters.breakdown_status} onChange={handleFilterChange} className="border p-2 rounded-md">
                    <option value="">Filter by Breakdown Status</option>
                    {breakdownStatusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>

                <select name="work" value={filters.work} onChange={handleFilterChange} className="border p-2 rounded-md">
                    <option value="">Filter by Work</option>
                    {workOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>

                <input type="date" name="from" value={filters.from} onChange={handleFilterChange} className="border p-2 rounded-md" />
                <input type="date" name="to" value={filters.to} onChange={handleFilterChange} className="border p-2 rounded-md" />
            </div>

            {/* EXPORT */}
            <div className="mb-4">
                <button onClick={handleExportCSV} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                    Export CSV
                </button>
            </div>

            {/* CHART */}
            <div className="w-2/4 mx-auto mb-10 transition-transform duration-300 hover:scale-110">
                <canvas id="statusChart" height="200"></canvas>
            </div>

            {/* TABLE */}
            {loading ? (
                <p>Loading RBT data...</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white shadow-md rounded-lg">
                        <thead>
                            <tr className="bg-gray-200 text-gray-600 uppercase text-sm">
                                <th className="py-3 px-4 text-left">Site</th>
                                <th className="py-3 px-4 text-left">RBT</th>
                                <th className="py-3 px-4 text-left">Running</th>
                                <th className="py-3 px-4 text-left">Breakdown</th>
                                <th className="py-3 px-4 text-left">Work</th>
                                <th className="py-3 px-4 text-left">Ageing</th>
                                <th className="py-3 px-4 text-left">Last Updated</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-700 text-sm">
                            {filtered.map((rbt) => (
                                <tr key={rbt.id} className="border-b border-gray-200 hover:bg-gray-100">
                                    <td className="py-2 px-4">{rbt.site}</td>
                                    <td className="py-2 px-4">{rbt.rbt_id}</td>
                                    {["running_status", "breakdown_status", "work"].map((field) => (
                                        <td key={field} className="py-2 px-4">
                                            {userRole === "admin" || userRole === "super_admin" ? (
                                                <select
                                                    value={rbt[field] || "N/A"}
                                                    onChange={(e) => handleEditField(rbt.id, rbt.site, field, e.target.value)}
                                                    className="border p-1 rounded"
                                                >
                                                    {field === "running_status" &&
                                                        runningStatusOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                    {field === "breakdown_status" &&
                                                        breakdownStatusOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                    {field === "work" &&
                                                        workOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                </select>
                                            ) : (
                                                rbt[field] || "N/A"
                                            )}
                                        </td>
                                    ))}
                                    <td className="py-2 px-4 text-center">{rbt.running_status_ageing}</td>
                                    <td className="py-2 px-4">{rbt.last_updated ? format(rbt.last_updated, "yyyy-MM-dd HH:mm") : "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default OverallDashboard;
