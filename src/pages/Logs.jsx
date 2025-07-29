import React, { useState, useEffect } from "react";
import { collection, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { saveAs } from "file-saver";
import { format } from "date-fns";

function Logs() {
    const [logs, setLogs] = useState([]);
    const [filteredLogs, setFilteredLogs] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editedLog, setEditedLog] = useState({});
    const [currentUser, setCurrentUser] = useState(null);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const navigate = useNavigate();
    const isSuperAdmin = currentUser?.email === "dev@brightbots.in";

    useEffect(() => {
        const unsub = auth.onAuthStateChanged((user) => {
            if (!user || !user.emailVerified) {
                window.location.href = "/login";
            } else {
                setCurrentUser(user);
            }
        });
        return unsub;
    }, []);

    const fetchLogs = async () => {
        try {
            const snapshot = await getDocs(collection(db, "rbt_logs"));
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            data.sort((a, b) => new Date(b.updated_at?.toDate?.()) - new Date(a.updated_at?.toDate?.()));
            setLogs(data);
        } catch (err) {
            console.error("Error fetching logs:", err);
            toast.error("Failed to fetch logs");
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    useEffect(() => {
        const filtered = logs.filter(log => {
            const logDate = log.updated_at?.toDate?.();
            if (!logDate) return false;

            const start = startDate ? new Date(startDate + "T00:00:00") : null;
            const end = endDate ? new Date(endDate + "T23:59:59") : null;

            return (!start || logDate >= start) && (!end || logDate <= end);
        });
        setFilteredLogs(filtered);
    }, [logs, startDate, endDate]);

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this log entry?")) return;
        try {
            await deleteDoc(doc(db, "rbt_logs", id));
            toast.success("Log deleted");
            setLogs(prev => prev.filter(log => log.id !== id));
        } catch (err) {
            console.error("Error deleting log:", err);
            toast.error("Failed to delete log");
        }
    };

    const handleEdit = (log) => {
        setEditingId(log.id);
        setEditedLog({ ...log });
    };

    const handleSave = async () => {
        try {
            const logRef = doc(db, "rbt_logs", editingId);
            await updateDoc(logRef, {
                ...editedLog,
                updated_at: new Date(),
                updated_by: currentUser.email,
            });
            toast.success("Log updated");
            setEditingId(null);
            fetchLogs();
        } catch (err) {
            console.error("Error updating log:", err);
            toast.error("Failed to update log");
        }
    };

    const handleChange = (field, value) => {
        setEditedLog(prev => ({ ...prev, [field]: value }));
    };

    const flattenValue = (value) => {
        if (typeof value === "object" && value !== null) {
            return Object.entries(value)
                .map(([key, val]) => `${key}: ${val ?? "-"}`)
                .join("; ");
        }
        return value ?? "-";
    };

    const renderValue = (value) => {
        if (typeof value === "object" && value !== null) {
            return (
                <div className="space-y-1">
                    {Object.entries(value).map(([key, val]) => (
                        <div key={key} className="bg-gray-200 inline-block px-2 py-1 rounded text-xs mr-1">
                            <strong>{key}:</strong> {val || "-"}
                        </div>
                    ))}
                </div>
            );
        }
        return value || "-";
    };

    const handleExport = () => {
        const csvRows = [
            ["Site", "RBT ID", "Field", "Old Value", "New Value", "Updated By", "Time"],
            ...filteredLogs.map(log => [
                log.site,
                log.rbt_id,
                log.field,
                flattenValue(log.old_value),
                flattenValue(log.new_value),
                log.updated_by,
                log.updated_at?.toDate?.() ? format(log.updated_at.toDate(), "dd-MM-yyyy HH:mm:ss") : "-"
            ])
        ];

        const csvContent = csvRows.map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const filename = `rbt_logs_export_${Date.now()}.csv`;
        saveAs(blob, filename);
    };

    return (
        <div className="min-h-screen bg-gray-100 p-6 font-sans">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold text-blue-700">🔍 Log Viewer</h1>
                <div className="space-x-2 flex items-center">
                    <button onClick={() => navigate("/dashboard")} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        ⬅ Back to Dashboard
                    </button>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="border px-2 py-1 rounded"
                    />
                    <span>to</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="border px-2 py-1 rounded"
                    />
                    <button
                        onClick={handleExport}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                    >
                        📥 Download CSV
                    </button>
                </div>
            </div>

            <div className="overflow-auto bg-white shadow-md rounded-xl">
                <table className="min-w-full table-auto text-sm text-left border">
                    <thead className="bg-blue-100 text-blue-800 font-semibold">
                        <tr>
                            <th className="px-4 py-2 border">Site</th>
                            <th className="px-4 py-2 border">RBT ID</th>
                            <th className="px-4 py-2 border">Field</th>
                            <th className="px-4 py-2 border">Old</th>
                            <th className="px-4 py-2 border">New</th>
                            <th className="px-4 py-2 border">Updated By</th>
                            <th className="px-4 py-2 border">Time</th>
                            {isSuperAdmin && <th className="px-4 py-2 border">Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLogs.map((log) => (
                            <tr key={log.id} className="border-t hover:bg-gray-50">
                                <td className="px-4 py-2 border">{log.site}</td>
                                <td className="px-4 py-2 border">{log.rbt_id}</td>
                                <td className="px-4 py-2 border">{log.field}</td>
                                <td className="px-4 py-2 border">
                                    {editingId === log.id ? (
                                        <input
                                            value={editedLog.old_value}
                                            onChange={(e) => handleChange("old_value", e.target.value)}
                                            className="border px-2 py-1 rounded w-full"
                                        />
                                    ) : renderValue(log.old_value)}
                                </td>
                                <td className="px-4 py-2 border">
                                    {editingId === log.id ? (
                                        <input
                                            value={editedLog.new_value}
                                            onChange={(e) => handleChange("new_value", e.target.value)}
                                            className="border px-2 py-1 rounded w-full"
                                        />
                                    ) : renderValue(log.new_value)}
                                </td>
                                <td className="px-4 py-2 border">{log.updated_by}</td>
                                <td className="px-4 py-2 border">
                                    {log.updated_at?.toDate?.()
                                        ? format(log.updated_at.toDate(), "dd-MM-yyyy HH:mm:ss")
                                        : "-"}
                                </td>
                                {isSuperAdmin && (
                                    <td className="px-4 py-2 border space-x-2">
                                        {editingId === log.id ? (
                                            <>
                                                <button
                                                    onClick={handleSave}
                                                    className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="bg-gray-400 text-white px-3 py-1 rounded hover:bg-gray-500"
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleEdit(log)}
                                                    className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(log.id)}
                                                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                                                >
                                                    Delete
                                                </button>
                                            </>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default Logs;
