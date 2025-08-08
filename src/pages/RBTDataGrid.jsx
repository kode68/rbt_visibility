// src/components/RBTDataGrid.jsx
import React, { useEffect, useState } from "react";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { collection, getDocs, doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { logAndUpdateField } from "../utils/db";
import {
    Chip,
    Box,
    LinearProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    FormControl,
    Select,
    MenuItem,
    Checkbox,
    FormControlLabel,
    Stack,
    Divider,
    Tooltip,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EventIcon from "@mui/icons-material/Event";
import ScheduleIcon from "@mui/icons-material/Schedule";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { differenceInDays, format } from "date-fns";

const ALL_PARTS = [
    "ANTENA CABLE", "ANTENA PORT", "BATTERY", "BATTERY BOX", "BRUSH MOTOR",
    "CHARGE CONTROLLER", "GUIDE WHEEL 1", "GUIDE WHEEL 2", "GUIDE WHEEL 3", "GUIDE WHEEL 4",
    "HOME SENSOR", "LIMIT SWITCH 1", "LIMIT SWITCH 2", "LOAD WHEEL 1", "LOAD WHEEL 2",
    "LOAD WHEEL 3", "LOAD WHEEL 4", "LT 1", "LT 2", "PCB BOX", "PULSE COUNT", "PV MODULE",
    "REPEATER PCB", "RTC", "SS PIPE", "SSC", "STEPPER DRIVE", "STEPPER MOTOR", "TC BELT",
    "TC LOAD WHEEL", "XBEE"
].sort();

const generateDefaultPartIssues = () => {
    const defaults = {};
    ALL_PARTS.forEach((part) => {
        defaults[part] = { selected: false, dispatch_date: "", delivery_date: "" };
    });
    return defaults;
};

// ------- helpers -------
const asDate = (maybeTs) => {
    if (!maybeTs) return null;
    if (typeof maybeTs.toDate === "function") return maybeTs.toDate();
    const d = new Date(maybeTs);
    return isNaN(d) ? null : d;
};

const computeAgeing = (row) => {
    if (!row || row.running_status === "Auto") return 0;
    const manualAt = asDate(row.running_manual_at);
    const notRunAt = asDate(row.running_not_running_at);
    const candidates = [];
    if (manualAt) candidates.push(manualAt);
    if (notRunAt) candidates.push(notRunAt);
    if (!candidates.length) return Number(row.running_status_ageing || 0);
    const older = candidates.sort((a, b) => a - b)[0];
    return Math.max(differenceInDays(new Date(), older), 0);
};

// nicer chip render
const StatusChip = ({ label, color }) => (
    <Chip
        label={label}
        color={color}
        size="small"
        sx={{
            fontWeight: 600,
            borderRadius: 2,
            px: 1,
            minWidth: 96,
            justifyContent: "center",
        }}
    />
);

const RBTDataGrid = ({ client, sites }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedRBT, setSelectedRBT] = useState(null);
    const [partIssues, setPartIssues] = useState({});
    const [targetDate, setTargetDate] = useState(""); // YYYY-MM-DD
    const [pendingUpdates, setPendingUpdates] = useState(null); // { running_status?, breakdown_status? }
    const [userRole, setUserRole] = useState("user");
    const userEmail = auth.currentUser?.email || "";

    // ✅ Fetch user role
    useEffect(() => {
        const fetchRole = async () => {
            if (userEmail) {
                const userRef = doc(db, "users", auth.currentUser.uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) setUserRole(userSnap.data().role || "user");
            }
        };
        fetchRole();
    }, [userEmail]);

    // ✅ Fetch RBTs (multi-site)
    useEffect(() => {
        const fetchRBTs = async () => {
            if (!client || !sites || sites.length === 0) {
                setRows([]);
                return;
            }
            setLoading(true);
            try {
                const allRBTs = await Promise.all(
                    sites.map(async (site) => {
                        const snapshot = await getDocs(collection(db, "clients", client, "sites", site, "rbts"));
                        return snapshot.docs.map((docSnap) => {
                            const rbtData = docSnap.data();
                            return {
                                id: docSnap.id,
                                site,
                                running_status: rbtData.running_status || "Auto",
                                breakdown_status: rbtData.breakdown_status || "N/A",
                                work: rbtData.work || "",
                                target_date: rbtData.target_date || "", // YYYY-MM-DD
                                running_status_ageing: rbtData.running_status_ageing ?? 0,
                                running_manual_at: rbtData.running_manual_at || null,
                                running_not_running_at: rbtData.running_not_running_at || null,
                                part_issues: { ...generateDefaultPartIssues(), ...(rbtData.part_issues || {}) },
                                ...rbtData,
                            };
                        });
                    })
                );

                const mergedRBTs = allRBTs.flat();
                // ✅ Sort by site then RBT number
                mergedRBTs.sort((a, b) => {
                    if (a.site !== b.site) return a.site.localeCompare(b.site);
                    const numA = parseInt(String(a.id).replace(/\D/g, ""), 10) || 0;
                    const numB = parseInt(String(b.id).replace(/\D/g, ""), 10) || 0;
                    return numA - numB;
                });

                setRows(mergedRBTs);
            } catch (error) {
                console.error("Error fetching RBTs:", error);
            }
            setLoading(false);
        };
        fetchRBTs();
    }, [client, JSON.stringify(sites)]);

    // ========== LOG HELPERS ==========
    const updateFieldWithLog = async (row, field, newValue) => {
        const oldValue = row[field] ?? "";
        if (oldValue === newValue) return;
        const rbtRef = doc(db, "clients", client, "sites", row.site, "rbts", row.id);
        await updateDoc(rbtRef, { [field]: newValue });
        await logAndUpdateField(client, row.site, row.id, field, oldValue, newValue);
        setRows((prev) => prev.map((r) => (r.id === row.id && r.site === row.site ? { ...r, [field]: newValue } : r)));
    };

    const updateManyWithLog = async (row, updates) => {
        // single Firestore update, then log each field change
        const rbtRef = doc(db, "clients", client, "sites", row.site, "rbts", row.id);
        await updateDoc(rbtRef, updates);
        for (const [field, newValue] of Object.entries(updates)) {
            const oldValue = row[field] ?? "";
            if (oldValue !== newValue) {
                await logAndUpdateField(client, row.site, row.id, field, oldValue, newValue);
            }
        }
        setRows((prev) =>
            prev.map((r) => (r.id === row.id && r.site === row.site ? { ...r, ...updates } : r))
        );
    };

    const updatePartIssueFieldWithLog = async (row, part, subField, newValue) => {
        const prev = row.part_issues?.[part] || { selected: false, dispatch_date: "", delivery_date: "" };
        const oldValue = prev?.[subField] || "";
        if (oldValue === newValue) return;

        const rbtRef = doc(db, "clients", client, "sites", row.site, "rbts", row.id);
        const path = `part_issues.${part}.${subField}`;
        await updateDoc(rbtRef, { [path]: newValue });
        await logAndUpdateField(client, row.site, row.id, path, oldValue, newValue);

        setPartIssues((prevIssues) => ({
            ...prevIssues,
            [part]: { ...(prevIssues[part] || {}), [subField]: newValue },
        }));
        setRows((prevRows) =>
            prevRows.map((r) =>
                r.id === row.id && r.site === row.site
                    ? {
                        ...r,
                        part_issues: {
                            ...r.part_issues,
                            [part]: { ...(r.part_issues?.[part] || {}), [subField]: newValue },
                        },
                    }
                    : r
            )
        );
    };

    const togglePartSelectionWithLog = async (row, part) => {
        const prev = row.part_issues?.[part] || { selected: false, dispatch_date: "", delivery_date: "" };
        const nextSelected = !prev.selected;
        const nextObj = {
            selected: nextSelected,
            dispatch_date: nextSelected ? prev.dispatch_date || "" : "",
            delivery_date: nextSelected ? prev.delivery_date || "" : "",
        };

        const rbtRef = doc(db, "clients", client, "sites", row.site, "rbts", row.id);
        const path = `part_issues.${part}`;
        await updateDoc(rbtRef, { [path]: nextObj });
        await logAndUpdateField(client, row.site, row.id, path, JSON.stringify(prev), JSON.stringify(nextObj));

        setPartIssues((p) => ({ ...p, [part]: nextObj }));
        setRows((prevRows) =>
            prevRows.map((r) =>
                r.id === row.id && r.site === row.site
                    ? { ...r, part_issues: { ...r.part_issues, [part]: nextObj } }
                    : r
            )
        );
    };

    // ========= UI HELPERS (COLORS) =========
    const getStatusColor = (field, value) => {
        if (field === "running_status") {
            if (value === "Auto") return "success";
            if (value === "Manual") return "warning";
            return "error";
        }
        if (field === "breakdown_status") {
            if (value === "Running With Issue") return "warning";
            if (value === "Breakdown") return "error";
            return "default";
        }
        if (field === "work") {
            if (value === "Part Installation") return "info";
            if (value === "Part Testing") return "secondary";
            if (value === "Trial") return "warning";
            if (value === "Auto Scheduling") return "success";
            return "default";
        }
        return "default";
    };

    // ========= STATUS CHANGE ORCHESTRATION =========

    const openIssueDialogFor = (row, pending) => {
        setSelectedRBT(row);
        setPartIssues(row.part_issues || generateDefaultPartIssues());
        setTargetDate(row.target_date || "");
        setPendingUpdates(pending); // { running_status?, breakdown_status? }
    };

    const beginStatusChange = async (row, field, newValue) => {
        const currentRun = row.running_status || "Auto";
        const currentBrk = row.breakdown_status || "N/A";

        if (field === "running_status") {
            if (newValue === "Auto") {
                // Back to nominal: apply immediately
                await updateManyWithLog(row, { running_status: "Auto", breakdown_status: "N/A" });
                return;
            }
            // Require part issues dialog + target date
            const nextBrk = currentBrk === "N/A" ? "Running With Issue" : currentBrk;
            const pending = { running_status: newValue };
            if (nextBrk !== currentBrk) pending.breakdown_status = nextBrk;
            openIssueDialogFor(row, pending);
            return;
        }

        if (field === "breakdown_status") {
            if (newValue === "N/A") {
                // Nominal => Auto
                await updateManyWithLog(row, { breakdown_status: "N/A", running_status: "Auto" });
                return;
            }
            // Non-N/A requires target date and possibly set run from Auto -> Manual
            const nextRun = currentRun === "Auto" ? "Manual" : currentRun;
            const pending = { breakdown_status: newValue };
            if (nextRun !== currentRun) pending.running_status = nextRun;
            openIssueDialogFor(row, pending);
            return;
        }

        // other fields (work etc.) normal update
        await updateFieldWithLog(row, field, newValue);
    };

    // ✅ DROPDOWN: render in a portal so it never gets clipped; comfy size
    const renderDropdown = (params, field, options) => (
        <FormControl size="small" sx={{ minWidth: 140, width: "100%" }}>
            <Select
                value={params.value || ""}
                onChange={async (e) => {
                    const newValue = e.target.value;
                    await beginStatusChange(params.row, field, newValue);

                    if (
                        (field === "running_status" && (newValue === "Manual" || newValue === "Not Running")) ||
                        (field === "breakdown_status" && (newValue === "Breakdown" || newValue === "Running With Issue"))
                    ) {
                        // opening dialog already handled in beginStatusChange
                    }
                }}
                displayEmpty
                fullWidth
                MenuProps={{
                    disablePortal: false,
                    container: () => document.body,
                    PaperProps: {
                        sx: {
                            zIndex: 2000,
                            minWidth: 220,
                            maxHeight: 360,
                            borderRadius: 2,
                        },
                    },
                    MenuListProps: { dense: true },
                }}
                sx={{
                    width: "100%",
                    "& .MuiSelect-select": { display: "flex", alignItems: "center", py: 0.5 },
                }}
            >
                {options.map((opt) => (
                    <MenuItem key={opt} value={opt}>
                        <StatusChip label={opt} color={getStatusColor(field, opt)} />
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );

    const openPartIssues = (row) => {
        // Manual open (no status pending). Let them edit parts/target_date optionally.
        setSelectedRBT(row);
        setPartIssues(row.part_issues || generateDefaultPartIssues());
        setTargetDate(row.target_date || "");
        setPendingUpdates(null); // no pending status change
    };

    const getSelectedPartCount = (row) =>
        Object.values(row.part_issues || {}).filter((p) => p?.selected).length;

    // ====== Columns ======
    const baseEditable = userRole === "super_admin";

    const columns = [
        { field: "site", headerName: "Site", flex: 0.7, minWidth: 110, headerAlign: "center", align: "center" },
        { field: "id", headerName: "RBT ID", flex: 0.6, minWidth: 90, headerAlign: "center", align: "center" },
        { field: "cleaner_did", headerName: "Cleaner DID", flex: 1.2, minWidth: 160, editable: baseEditable },
        { field: "tc_did", headerName: "TC DID", flex: 1.2, minWidth: 160, editable: baseEditable },
        { field: "cl_pcb_model", headerName: "CL PCB Model", flex: 0.8, minWidth: 110, headerAlign: "center", align: "center", editable: baseEditable },
        { field: "tc_pcb_model", headerName: "TC PCB Model", flex: 0.8, minWidth: 110, headerAlign: "center", align: "center", editable: baseEditable },
        {
            field: "running_status",
            headerName: "Running Status",
            flex: 0.9,
            minWidth: 170,
            headerAlign: "center",
            align: "center",
            renderCell: (params) => renderDropdown(params, "running_status", ["Auto", "Manual", "Not Running"]),
        },
        {
            field: "breakdown_status",
            headerName: "Breakdown Status",
            flex: 1.0,
            minWidth: 170,
            headerAlign: "center",
            align: "center",
            renderCell: (params) => renderDropdown(params, "breakdown_status", ["Running With Issue", "Breakdown", "N/A"]),
        },
        {
            field: "work",
            headerName: "Work Status",
            flex: 1.0,
            minWidth: 170,
            headerAlign: "center",
            align: "center",
            renderCell: (params) => {
                const run = params.row.running_status || "";
                const brk = params.row.breakdown_status || "";
                const showWork = run !== "Auto" || brk !== "N/A";
                if (!showWork) return <span style={{ opacity: 0.45 }}>—</span>;
                return renderDropdown(params, "work", [
                    "Part Procurement",
                    "Part In-Transit",
                    "Part Installation",
                    "Part Testing",
                    "Trial",
                    "Auto Scheduling",
                ]);
            },
        },
        // Target Date (read-only in grid for cleanliness)
        {
            field: "target_date",
            headerName: "Target Date",
            flex: 0.85,
            minWidth: 150,
            headerAlign: "center",
            align: "center",
            sortable: false,
            renderCell: (params) => {
                const value = params.row.target_date || "";
                if (!value) return <span style={{ opacity: 0.45 }}>—</span>;
                // show as dd-MMM-yyyy
                let label = value;
                try { label = format(new Date(value), "dd-MMM-yyyy"); } catch { }
                return (
                    <Chip
                        icon={<EventIcon sx={{ fontSize: 16 }} />}
                        label={label}
                        size="small"
                        variant="outlined"
                        sx={{ borderRadius: 2, fontWeight: 600 }}
                    />
                );
            },
        },
        // Ageing (computed) — handle both v5/v6 signatures
        {
            field: "ageing",
            headerName: "Ageing",
            flex: 0.55,
            minWidth: 90,
            headerAlign: "center",
            align: "center",
            valueGetter: (value, row, params) => {
                const r = row ?? params?.row ?? null;
                return computeAgeing(r);
            },
            renderCell: (params) => {
                const v = Number(params.value || 0);
                const color = v > 14 ? "error" : v > 7 ? "warning" : "default";
                return (
                    <Chip
                        icon={<ScheduleIcon sx={{ fontSize: 16 }} />}
                        color={color}
                        variant={color === "default" ? "outlined" : "filled"}
                        size="small"
                        label={`${v}d`}
                        sx={{ borderRadius: 2, fontWeight: 700, minWidth: 64, justifyContent: "center" }}
                    />
                );
            },
        },
        {
            field: "part_issues_btn",
            headerName: "Part Issues",
            flex: 0.9,
            minWidth: 130,
            sortable: false,
            headerAlign: "center",
            align: "center",
            renderCell: (params) => {
                const count = getSelectedPartCount(params.row);
                return (
                    <Tooltip title="Open part issues & target date">
                        <Button variant="outlined" size="small" onClick={() => openPartIssues(params.row)}>
                            {count > 0 ? `Part Issues (${count})` : "Part Issues"}
                        </Button>
                    </Tooltip>
                );
            },
        },
        ...(userRole === "super_admin"
            ? [
                {
                    field: "actions",
                    headerName: "Actions",
                    flex: 0.6,
                    minWidth: 108,
                    headerAlign: "center",
                    align: "center",
                    sortable: false,
                    renderCell: (params) => (
                        <Button
                            variant="outlined"
                            size="small"
                            color="error"
                            startIcon={<DeleteOutlineIcon />}
                            onClick={() => handleDeleteRBT(params.row)}
                        >
                            Delete
                        </Button>
                    ),
                },
            ]
            : []),
    ];

    // ✅ Delete RBT (Super Admin only)
    const handleDeleteRBT = async (rbt) => {
        if (userRole !== "super_admin") {
            alert("Only Super Admin can delete RBTs.");
            return;
        }
        if (!window.confirm(`Are you sure you want to delete ${rbt.id}?`)) return;
        await deleteDoc(doc(db, "clients", client, "sites", rbt.site, "rbts", rbt.id));
        setRows((prev) => prev.filter((row) => !(row.id === rbt.id && row.site === rbt.site)));
    };

    // Handle inline edits (super admin) for base text fields
    const makeEditCommitHandler = (site) => async (params) => {
        const row = rows.find((r) => r.site === site && r.id === params.id);
        if (!row) return;
        const blocked = [
            "running_status",
            "breakdown_status",
            "work",
            "part_issues_btn",
            "actions",
            "target_date",
            "ageing",
        ];
        if (blocked.includes(params.field)) return;
        await updateFieldWithLog(row, params.field, params.value);
    };

    return (
        <Box sx={{ width: "100%", p: 2 }}>
            {sites.map((site) => (
                <Box
                    key={site}
                    sx={{
                        mb: 3,
                        p: 2,
                        borderRadius: 3,
                        background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
                        boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
                        border: "1px solid #eef0f3",
                    }}
                >
                    <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700, color: "primary.main" }}>
                        RBT Dashboard - {site}
                    </Typography>

                    <DataGrid
                        autoHeight
                        density="compact"
                        rowHeight={44}
                        headerHeight={44}
                        loading={loading}
                        rows={rows.filter((r) => r.site === site)}
                        columns={columns}
                        components={{ Toolbar: GridToolbar, LoadingOverlay: LinearProgress }}
                        componentsProps={{
                            toolbar: { showQuickFilter: true, quickFilterProps: { debounceMs: 300 } },
                        }}
                        getRowClassName={(params) => (getSelectedPartCount(params.row) > 0 ? "row-has-issues" : "")}
                        onCellEditCommit={makeEditCommitHandler(site)}
                        initialState={{
                            pagination: { paginationModel: { pageSize: 25 } },
                        }}
                        pageSizeOptions={[10, 25, 50]}
                        disableColumnMenu
                        disableSelectionOnClick
                        sx={{
                            borderRadius: 2,
                            border: "1px solid #e6e9ef",
                            overflow: "visible",
                            "& .MuiDataGrid-row": { overflow: "visible" },
                            "& .MuiDataGrid-cell": {
                                overflow: "visible",
                                alignItems: "center",
                                whiteSpace: "nowrap",
                                textOverflow: "ellipsis",
                            },
                            "& .MuiDataGrid-columnHeaders": {
                                fontWeight: 700,
                                background:
                                    "linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(242,245,250,1) 100%)",
                                borderBottom: "1px solid #e6e9ef",
                            },
                            "& .MuiDataGrid-columnHeaderTitle": { whiteSpace: "nowrap" },
                            "& .MuiDataGrid-row:hover": {
                                backgroundColor: "rgba(33, 150, 243, 0.06)",
                            },
                            "& .MuiDataGrid-virtualScrollerContent": { minHeight: "auto" },
                            "& .row-has-issues": {
                                backgroundColor: "rgba(255, 193, 7, 0.08)",
                            },
                            "& .row-has-issues.Mui-selected": {
                                backgroundColor: "rgba(255, 193, 7, 0.16) !important",
                            },
                            "& .MuiDataGrid-row:nth-of-type(even)": {
                                backgroundColor: "#fcfdff",
                            },
                            "& .MuiDataGrid-footerContainer": {
                                borderTop: "1px solid #e6e9ef",
                            },
                        }}
                    />
                </Box>
            ))}

            {/* Part Issues + Target Date Dialog */}
            <Dialog
                open={Boolean(selectedRBT)}
                // Block esc/backdrop only when a status change is pending & date is required
                disableEscapeKeyDown={Boolean(pendingUpdates)}
                onClose={(_, reason) => {
                    if (pendingUpdates && (reason === "backdropClick" || reason === "escapeKeyDown")) {
                        return; // block closing
                    }
                    setSelectedRBT(null);
                    setPendingUpdates(null);
                }}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 700 }}>
                    Part Issues — {selectedRBT?.id}
                    {pendingUpdates && (
                        <Chip
                            icon={<WarningAmberRoundedIcon sx={{ fontSize: 16 }} />}
                            color="warning"
                            label="Target date required to confirm status change"
                            size="small"
                            sx={{ ml: 1, fontWeight: 600, borderRadius: 2 }}
                        />
                    )}
                </DialogTitle>

                <DialogContent dividers sx={{ pt: 2 }}>
                    {/* Summary + Target Date */}
                    <Box
                        sx={{
                            p: 2,
                            mb: 2,
                            borderRadius: 2,
                            bgcolor: "rgba(242,245,250,0.8)",
                            border: "1px solid #e6e9ef",
                        }}
                    >
                        <Stack direction={{ xs: "column", sm: "row" }} gap={2} alignItems="center" justifyContent="space-between">
                            <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                                <Typography sx={{ fontWeight: 700 }}>Status:</Typography>
                                <StatusChip
                                    label={`Run: ${pendingUpdates?.running_status ?? selectedRBT?.running_status ?? "-"}`}
                                    color={getStatusColor("running_status", pendingUpdates?.running_status ?? selectedRBT?.running_status ?? "Auto")}
                                />
                                <StatusChip
                                    label={`Brk: ${pendingUpdates?.breakdown_status ?? selectedRBT?.breakdown_status ?? "-"}`}
                                    color={getStatusColor("breakdown_status", pendingUpdates?.breakdown_status ?? selectedRBT?.breakdown_status ?? "N/A")}
                                />
                            </Stack>

                            <Box sx={{ minWidth: 260 }}>
                                <TextField
                                    fullWidth
                                    required={Boolean(pendingUpdates)}
                                    label="Target Running Date"
                                    type="date"
                                    value={targetDate}
                                    onChange={(e) => setTargetDate(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    error={Boolean(pendingUpdates) && !targetDate}
                                    helperText={Boolean(pendingUpdates) && !targetDate ? "Required to confirm this status" : " "}
                                    sx={{
                                        "& .MuiOutlinedInput-root": { height: 42 },
                                        "& .MuiInputBase-input": { textAlign: "center" },
                                    }}
                                />
                            </Box>
                        </Stack>
                    </Box>

                    {/* Parts list */}
                    <Box display="flex" flexDirection="column" gap={1.25}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                            Select parts with issues (optional)
                        </Typography>
                        <Divider />
                        {Object.keys(partIssues || {})
                            .sort()
                            .map((part) => {
                                const isSelected = partIssues[part]?.selected;
                                return (
                                    <Box
                                        key={part}
                                        display="flex"
                                        alignItems="center"
                                        gap={2}
                                        sx={{ py: 0.5, borderBottom: "1px dashed #eee" }}
                                    >
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={!!isSelected}
                                                    onChange={() => togglePartSelectionWithLog(selectedRBT, part)}
                                                />
                                            }
                                            label={<Typography sx={{ minWidth: 160, fontWeight: 600 }}>{part}</Typography>}
                                            sx={{ flex: 1 }}
                                        />

                                        {isSelected && (
                                            <Box display="flex" gap={2} flexWrap="wrap" sx={{ flex: 2 }}>
                                                <TextField
                                                    type="date"
                                                    label="Dispatch Date"
                                                    size="small"
                                                    value={partIssues[part]?.dispatch_date || ""}
                                                    onChange={(e) =>
                                                        updatePartIssueFieldWithLog(selectedRBT, part, "dispatch_date", e.target.value)
                                                    }
                                                    sx={{ minWidth: 160 }}
                                                    InputLabelProps={{ shrink: true }}
                                                />
                                                <TextField
                                                    type="date"
                                                    label="Delivery Date"
                                                    size="small"
                                                    value={partIssues[part]?.delivery_date || ""}
                                                    onChange={(e) =>
                                                        updatePartIssueFieldWithLog(selectedRBT, part, "delivery_date", e.target.value)
                                                    }
                                                    sx={{ minWidth: 160 }}
                                                    InputLabelProps={{ shrink: true }}
                                                />
                                            </Box>
                                        )}
                                    </Box>
                                );
                            })}
                    </Box>
                </DialogContent>

                <DialogActions sx={{ p: 2 }}>
                    {/* If a status change is pending, don't allow cancel/close */}
                    {!pendingUpdates && (
                        <Button onClick={() => { setSelectedRBT(null); setPendingUpdates(null); }} variant="text">
                            Close
                        </Button>
                    )}
                    <Button
                        variant="contained"
                        onClick={async () => {
                            if (pendingUpdates) {
                                if (!targetDate) return; // guard, button is disabled anyway
                                // 1) Save target date
                                await updateFieldWithLog(selectedRBT, "target_date", targetDate);
                                // 2) Apply status updates together
                                await updateManyWithLog(selectedRBT, pendingUpdates);
                            } else {
                                // Manual open: Only save date if changed
                                if (targetDate !== (selectedRBT?.target_date || "")) {
                                    await updateFieldWithLog(selectedRBT, "target_date", targetDate);
                                }
                            }
                            setSelectedRBT(null);
                            setPendingUpdates(null);
                        }}
                        disabled={Boolean(pendingUpdates) && !targetDate}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default RBTDataGrid;
