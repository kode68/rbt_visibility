import React, { useState, useEffect } from "react";
import {
    collection,
    onSnapshot,
    query,
    orderBy,
    doc,
    deleteDoc,
    updateDoc,
    serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { saveAs } from "file-saver";
import { format } from "date-fns";

function Logs() {
    const [logs, setLogs] = useState([]);
    const [filteredLogs, setFilteredLogs] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editedLog, setEditedLog] = useState({ old_value: "", new_value: "" });
    const [currentUser, setCurrentUser] = useState(null);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [jsonModal, setJsonModal] = useState({ open: false, title: "", payload: "" });

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

    useEffect(() => {
        const q = query(collection(db, "rbt_logs"), orderBy("timestamp", "desc"));
        const unsub = onSnapshot(
            q,
            (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
            (err) => {
                console.error("Error fetching logs:", err);
                toast.error("Failed to fetch logs");
            }
        );
        return unsub;
    }, []);

    const getLogDate = (log) =>
        log.timestamp?.toDate?.() || log.updated_at?.toDate?.() || null;

    useEffect(() => {
        const filtered = logs.filter((log) => {
            const logDate = getLogDate(log);
            if (!logDate) return false;
            const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
            const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
            return (!start || logDate >= start) && (!end || logDate <= end);
        });
        setFilteredLogs(filtered);
    }, [logs, startDate, endDate]);

    // ---------- Helpers ----------

    const parseJSON = (val) => {
        if (val == null) return null;
        if (typeof val === "object") return val;
        if (typeof val === "string") {
            try { return JSON.parse(val); } catch { return null; }
        }
        return null;
    };

    const pretty = (v) => {
        const obj = parseJSON(v);
        return obj ? JSON.stringify(obj, null, 2) : String(v ?? "—");
    };

    // Is this a part_issues-shaped object? (values are objects with dispatch/delivery keys)
    const isPartIssues = (obj) =>
        obj &&
        typeof obj === "object" &&
        Object.values(obj).some(
            (v) => v && typeof v === "object" && ("dispatch_date" in v || "delivery_date" in v)
        );

    // Keep only parts that actually have at least one date
    const filterRelevantParts = (obj) => {
        if (!isPartIssues(obj)) return obj;
        const out = {};
        for (const [part, meta] of Object.entries(obj)) {
            const dd = (meta?.dispatch_date || "").trim();
            const del = (meta?.delivery_date || "").trim();
            if (dd || del) out[part] = { dispatch_date: dd || null, delivery_date: del || null };
        }
        return out;
    };

    // Changed keys (shallow) — for part_issues we compare only relevant (filtered) parts
    const changedKeys = (oldVal, newVal, isPartField) => {
        const oldObj0 = parseJSON(oldVal);
        const newObj0 = parseJSON(newVal);
        if (!oldObj0 || !newObj0) return null;

        const oldObj = isPartField ? filterRelevantParts(oldObj0) : oldObj0;
        const newObj = isPartField ? filterRelevantParts(newObj0) : newObj0;

        const keys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
        const diffs = keys.filter((k) => String(oldObj[k] ?? "") !== String(newObj[k] ?? ""));
        return diffs;
    };

    // Compact renderer
    const renderCompact = (value, field, keysFilter = null) => {
        const obj0 = parseJSON(value);

        // Special display for part_issues: show chips only for parts with dates
        if (isPartIssues(obj0)) {
            const obj = filterRelevantParts(obj0);
            const entries = Object.entries(obj);
            if (entries.length === 0) return <span className="text-gray-400">—</span>;

            const MAX = 6;
            const shown = entries.slice(0, MAX);
            const hiddenCount = entries.length - shown.length;

            return (
                <div className="flex flex-wrap gap-1">
                    {shown.map(([part, meta]) => {
                        const bits = [];
                        if (meta.dispatch_date) bits.push(`dispatch=${meta.dispatch_date}`);
                        if (meta.delivery_date) bits.push(`delivery=${meta.delivery_date}`);
                        return (
                            <span
                                key={part}
                                className="inline-block bg-gray-100 border border-gray-200 px-2 py-0.5 rounded text-xs"
                                title={`${part}: ${bits.join(" • ")}`}
                            >
                                <b>{part}</b>: {bits.join(" • ")}
                            </span>
                        );
                    })}
                    {hiddenCount > 0 && (
                        <button
                            className="text-xs text-blue-600 underline"
                            onClick={() =>
                                setJsonModal({
                                    open: true,
                                    title: `${field} (full)`,
                                    payload: JSON.stringify(filterRelevantParts(obj0), null, 2),
                                })
                            }
                        >
                            +{hiddenCount} more
                        </button>
                    )}
                </div>
            );
        }

        // Generic JSON object case (non-parts)
        if (obj0 && typeof obj0 === "object") {
            const entries = Object.entries(obj0).filter(
                ([k]) => !keysFilter || keysFilter.includes(k)
            );
            if (entries.length === 0) return <span className="text-gray-400">—</span>;
            const MAX = 6;
            const shown = entries.slice(0, MAX);
            const hiddenCount = entries.length - shown.length;
            return (
                <div className="flex flex-wrap gap-1">
                    {shown.map(([k, v]) => (
                        <span
                            key={k}
                            className="inline-block bg-gray-100 border border-gray-200 px-2 py-0.5 rounded text-xs"
                            title={`${k}: ${String(v ?? "-")}`}
                        >
                            <b>{k}</b>: {String(v ?? "-")}
                        </span>
                    ))}
                    {hiddenCount > 0 && (
                        <button
                            className="text-xs text-blue-600 underline"
                            onClick={() =>
                                setJsonModal({
                                    open: true,
                                    title: `${field} (full)`,
                                    payload: JSON.stringify(obj0, null, 2),
                                })
                            }
                        >
                            +{hiddenCount} more
                        </button>
                    )}
                </div>
            );
        }

        // Primitive string/number
        const s = value == null || value === "" ? "—" : String(value);
        const isLong = s.length > 60;
        return (
            <div className="truncate max-w-[360px]" title={s}>
                {isLong ? `${s.slice(0, 60)}…` : s}
            </div>
        );
    };

    // ---------- Actions ----------

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this log entry?")) return;
        try {
            await deleteDoc(doc(db, "rbt_logs", id));
            toast.success("Log deleted");
            setLogs((prev) => prev.filter((l) => l.id !== id));
        } catch (err) {
            console.error("Error deleting log:", err);
            toast.error("Failed to delete log");
        }
    };

    const handleEdit = (log) => {
        setEditingId(log.id);
        setEditedLog({
            old_value: typeof log.old_value === "string" ? log.old_value : JSON.stringify(log.old_value ?? "-"),
            new_value: typeof log.new_value === "string" ? log.new_value : JSON.stringify(log.new_value ?? "-"),
        });
    };

    const handleSave = async () => {
        try {
            await updateDoc(doc(db, "rbt_logs", editingId), {
                old_value: editedLog.old_value ?? "-",
                new_value: editedLog.new_value ?? "-",
                edited_at: serverTimestamp(),
                edited_by: currentUser?.email || "unknown",
            });
            toast.success("Log updated");
            setEditingId(null);
        } catch (err) {
            console.error("Error updating log:", err);
            toast.error("Failed to update log");
        }
    };

    const handleChange = (field, value) =>
        setEditedLog((p) => ({ ...p, [field]: value }));

    // ---------- CSV (with filtered part_issues) ----------

    const csvEscape = (val) => {
        const s = String(val ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const compactForCsv = (field, oldVal, newVal) => {
        const isParts = String(field || "").startsWith("part_issues");
        const oldObj0 = parseJSON(oldVal);
        const newObj0 = parseJSON(newVal);

        if (isParts && (oldObj0 || newObj0)) {
            const oldObj = filterRelevantParts(oldObj0 || {});
            const newObj = filterRelevantParts(newObj0 || {});
            const toStr = (obj) =>
                Object.entries(obj)
                    .map(([part, m]) => {
                        const bits = [];
                        if (m.dispatch_date) bits.push(`dispatch=${m.dispatch_date}`);
                        if (m.delivery_date) bits.push(`delivery=${m.delivery_date}`);
                        return `${part}: ${bits.join(" • ")}`;
                    })
                    .join("; ");
            return { oldStr: toStr(oldObj) || "-", newStr: toStr(newObj) || "-" };
        }

        // non-parts
        return {
            oldStr: typeof oldVal === "string" ? oldVal : JSON.stringify(oldVal ?? "-"),
            newStr: typeof newVal === "string" ? newVal : JSON.stringify(newVal ?? "-"),
        };
    };

    const handleExport = () => {
        const header = ["Client", "Site", "RBT ID", "Field", "Old Value", "New Value", "Updated By", "Time"];
        const rows = filteredLogs.map((log) => {
            const ts = getLogDate(log);
            const { oldStr, newStr } = compactForCsv(log.field, log.old_value, log.new_value);
            return [
                log.client || "-",
                log.site || "-",
                log.rbt_id || "-",
                log.field || "-",
                oldStr,
                newStr,
                log.updated_by || "-",
                ts ? format(ts, "dd-MM-yyyy HH:mm:ss") : "-",
            ];
        });
        const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        saveAs(blob, `rbt_logs_export_${Date.now()}.csv`);
    };

    // ---------- UI ----------

    return (
        <div className="min-h-screen bg-gray-100 p-6 font-sans">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold text-blue-700">🔍 Log Viewer</h1>
                <div className="space-x-2 flex items-center">
                    <button
                        onClick={() => navigate("/dashboard")}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
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
                <table className="min-w-full table-fixed text-sm text-left border">
                    <colgroup>
                        <col className="w-[110px]" />
                        <col className="w-[110px]" />
                        <col className="w-[90px]" />
                        <col className="w-[230px]" />
                        <col className="w-[360px]" />
                        <col className="w-[360px]" />
                        <col className="w-[160px]" />
                        <col className="w-[160px]" />
                        <col className="w-[140px]" />
                    </colgroup>
                    <thead className="bg-blue-100 text-blue-800 font-semibold">
                        <tr>
                            <th className="px-3 py-2 border">Client</th>
                            <th className="px-3 py-2 border">Site</th>
                            <th className="px-3 py-2 border">RBT</th>
                            <th className="px-3 py-2 border">Field</th>
                            <th className="px-3 py-2 border">Old</th>
                            <th className="px-3 py-2 border">New</th>
                            <th className="px-3 py-2 border">Updated By</th>
                            <th className="px-3 py-2 border">Time</th>
                            {isSuperAdmin && <th className="px-3 py-2 border">Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLogs.map((log) => {
                            const ts = getLogDate(log);
                            const isPartsField = String(log.field || "").startsWith("part_issues");
                            const diffs = !isPartsField ? changedKeys(log.old_value, log.new_value, false) : null;

                            return (
                                <tr key={log.id} className="border-t align-top hover:bg-gray-50">
                                    <td className="px-3 py-2 border">{log.client || "-"}</td>
                                    <td className="px-3 py-2 border">{log.site || "-"}</td>
                                    <td className="px-3 py-2 border">{log.rbt_id || "-"}</td>
                                    <td className="px-3 py-2 border break-words">{log.field || "-"}</td>
                                    <td className="px-3 py-2 border">
                                        {renderCompact(log.old_value, log.field, diffs || undefined)}
                                    </td>
                                    <td className="px-3 py-2 border">
                                        {renderCompact(log.new_value, log.field, diffs || undefined)}
                                    </td>
                                    <td className="px-3 py-2 border">{log.updated_by || "-"}</td>
                                    <td className="px-3 py-2 border">
                                        {ts ? format(ts, "dd-MM-yyyy HH:mm:ss") : "-"}
                                    </td>
                                    {isSuperAdmin && (
                                        <td className="px-3 py-2 border space-x-1">
                                            <button
                                                onClick={() =>
                                                    setJsonModal({
                                                        open: true,
                                                        title: "Full entry",
                                                        payload: pretty({
                                                            old: isPartIssues(parseJSON(log.old_value))
                                                                ? filterRelevantParts(parseJSON(log.old_value))
                                                                : parseJSON(log.old_value) ?? log.old_value,
                                                            new: isPartIssues(parseJSON(log.new_value))
                                                                ? filterRelevantParts(parseJSON(log.new_value))
                                                                : parseJSON(log.new_value) ?? log.new_value,
                                                        }),
                                                    })
                                                }
                                                className="bg-slate-200 text-gray-800 px-3 py-1 rounded hover:bg-slate-300"
                                            >
                                                View
                                            </button>
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
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {jsonModal.open && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-lg w-[720px] max-w-[95vw] max-h-[85vh] overflow-hidden">
                        <div className="px-4 py-3 border-b flex items-center justify-between">
                            <h3 className="font-semibold">{jsonModal.title}</h3>
                            <button
                                className="text-gray-500 hover:text-gray-700"
                                onClick={() => setJsonModal({ open: false, title: "", payload: "" })}
                            >
                                ✕
                            </button>
                        </div>
                        <pre className="p-4 text-sm overflow-auto whitespace-pre-wrap break-all">
                            {typeof jsonModal.payload === "string"
                                ? jsonModal.payload
                                : JSON.stringify(jsonModal.payload, null, 2)}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Logs;
