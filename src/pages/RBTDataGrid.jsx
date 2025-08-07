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
} from "@mui/material";

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

const RBTDataGrid = ({ client, sites }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRBT, setSelectedRBT] = useState(null);
    const [partIssues, setPartIssues] = useState({});
    const [userRole, setUserRole] = useState("user");
    const userEmail = auth.currentUser?.email || "";

    // ✅ Fetch user role
    useEffect(() => {
        const fetchRole = async () => {
            if (userEmail) {
                const userRef = doc(db, "users", auth.currentUser.uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    setUserRole(userSnap.data().role || "user");
                }
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
                                site, // ✅ Correct site mapping
                                running_status: rbtData.running_status || "Auto",
                                breakdown_status: rbtData.breakdown_status || "N/A",
                                work: rbtData.work || "",
                                part_issues: { ...generateDefaultPartIssues(), ...(rbtData.part_issues || {}) },
                                ...rbtData,
                            };
                        });
                    })
                );

                const mergedRBTs = allRBTs.flat();

                // ✅ Sort by site and RBT number
                mergedRBTs.sort((a, b) => {
                    if (a.site !== b.site) return a.site.localeCompare(b.site);
                    const numA = parseInt(a.id.replace(/\D/g, ""), 10) || 0;
                    const numB = parseInt(b.id.replace(/\D/g, ""), 10) || 0;
                    return numA - numB;
                });

                setRows(mergedRBTs);
            } catch (error) {
                console.error("Error fetching RBTs:", error);
            }
            setLoading(false);
        };
        fetchRBTs();
    }, [client, sites]);

    // ✅ Auto-save part issues
    const autoSavePartIssues = async (updatedIssues) => {
        if (!selectedRBT) return;
        const rbtRef = doc(db, "clients", client, "sites", selectedRBT.site, "rbts", selectedRBT.id);
        await updateDoc(rbtRef, { part_issues: updatedIssues });
        await logAndUpdateField(client, selectedRBT.site, selectedRBT.id, "part_issues", {}, updatedIssues);
        setRows((prev) =>
            prev.map((r) => (r.id === selectedRBT.id && r.site === selectedRBT.site ? { ...r, part_issues: updatedIssues } : r))
        );
    };

    const handlePartIssueChange = async (part, field, value) => {
        const updated = {
            ...partIssues,
            [part]: { ...partIssues[part], [field]: value },
        };
        setPartIssues(updated);
        await autoSavePartIssues(updated);
    };

    const togglePartSelection = async (part) => {
        const updated = {
            ...partIssues,
            [part]: {
                ...partIssues[part],
                selected: !partIssues[part]?.selected,
                dispatch_date: !partIssues[part]?.selected ? "" : partIssues[part].dispatch_date,
                delivery_date: !partIssues[part]?.selected ? "" : partIssues[part].delivery_date,
            },
        };
        setPartIssues(updated);
        await autoSavePartIssues(updated);
    };

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

    const renderDropdown = (params, field, options) => (
        <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select
                value={params.value || ""}
                onChange={async (e) => {
                    const newValue = e.target.value;
                    const oldValue = params.value;
                    await logAndUpdateField(client, params.row.site, params.row.id, field, oldValue, newValue);

                    setRows((prev) =>
                        prev.map((r) =>
                            r.id === params.row.id && r.site === params.row.site ? { ...r, [field]: newValue } : r
                        )
                    );

                    if (
                        (field === "running_status" && (newValue === "Manual" || newValue === "Not Running")) ||
                        (field === "breakdown_status" && (newValue === "Breakdown" || newValue === "Running With Issue"))
                    ) {
                        setSelectedRBT(params.row);
                        setPartIssues(params.row.part_issues || generateDefaultPartIssues());
                    }
                }}
            >
                {options.map((opt) => (
                    <MenuItem key={opt} value={opt}>
                        <Chip
                            label={opt}
                            color={getStatusColor(field, opt)}
                            size="small"
                            sx={{
                                fontWeight: "bold",
                                minWidth: "100px",
                                justifyContent: "center",
                            }}
                        />
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );

    const columns = [
        { field: "site", headerName: "Site", width: 150 },
        { field: "id", headerName: "RBT ID", width: 120 },
        { field: "cleaner_did", headerName: "Cleaner DID", width: 180 },
        { field: "tc_did", headerName: "TC DID", width: 180 },
        { field: "cl_pcb_model", headerName: "CL PCB Model", width: 150 },
        { field: "tc_pcb_model", headerName: "TC PCB Model", width: 150 },
        {
            field: "running_status",
            headerName: "Running Status",
            width: 180,
            renderCell: (params) =>
                renderDropdown(params, "running_status", ["Auto", "Manual", "Not Running"]),
        },
        {
            field: "breakdown_status",
            headerName: "Breakdown Status",
            width: 200,
            renderCell: (params) =>
                renderDropdown(params, "breakdown_status", ["Running With Issue", "Breakdown", "N/A"]),
        },
        {
            field: "work",
            headerName: "Work Status",
            width: 200,
            renderCell: (params) =>
                renderDropdown(params, "work", [
                    "Part Procurement",
                    "Part In-Transit",
                    "Part Installation",
                    "Part Testing",
                    "Trial",
                    "Auto Scheduling",
                ]),
        },
        ...(userRole === "super_admin"
            ? [
                {
                    field: "actions",
                    headerName: "Actions",
                    width: 120,
                    renderCell: (params) => (
                        <Button
                            variant="contained"
                            color="error"
                            size="small"
                            onClick={() => handleDeleteRBT(params.row)}
                        >
                            Delete
                        </Button>
                    ),
                },
            ]
            : []),
    ];

    return (
        <Box sx={{ height: 650, width: "100%", p: 2, backgroundColor: "#fff", borderRadius: 3, boxShadow: 4 }}>
            <Typography variant="h6" mb={2} fontWeight="bold" color="primary">
                RBT Dashboard - {Array.isArray(sites) ? sites.join(", ") : sites || "No Site Selected"}
            </Typography>

            <DataGrid
                rows={rows}
                columns={columns}
                loading={loading}
                disableSelectionOnClick
                components={{
                    Toolbar: GridToolbar,
                    LoadingOverlay: LinearProgress,
                }}
            />

            {/* Part Issue Modal */}
            <Dialog open={Boolean(selectedRBT)} onClose={() => setSelectedRBT(null)} maxWidth="sm" fullWidth>
                <DialogTitle>Part Issue - {selectedRBT?.id}</DialogTitle>
                <DialogContent dividers>
                    <Box display="flex" flexDirection="column" gap={2}>
                        {Object.keys(partIssues || {}).sort().map((part) => {
                            const isSelected = partIssues[part]?.selected;
                            return (
                                <Box
                                    key={part}
                                    display="flex"
                                    alignItems="center"
                                    gap={3}
                                    sx={{
                                        padding: "6px 0",
                                        borderBottom: "1px solid #eee",
                                    }}
                                >
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={!!isSelected}
                                                onChange={() => togglePartSelection(part)}
                                            />
                                        }
                                        label={<Typography sx={{ minWidth: 150, fontWeight: 500 }}>{part}</Typography>}
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
                                                    handlePartIssueChange(part, "dispatch_date", e.target.value)
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
                                                    handlePartIssueChange(part, "delivery_date", e.target.value)
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
                <DialogActions>
                    <Button onClick={() => setSelectedRBT(null)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default RBTDataGrid;
