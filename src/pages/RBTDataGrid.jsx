import React, { useEffect, useState } from "react";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { collection, getDocs } from "firebase/firestore";
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
} from "@mui/material";

const RBTDataGrid = ({ client, site }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRBT, setSelectedRBT] = useState(null);
    const [partIssues, setPartIssues] = useState({});
    const userEmail = auth.currentUser?.email || "";

    // Fetch RBTs
    useEffect(() => {
        const fetchRBTs = async () => {
            if (!client || !site) return;
            setLoading(true);
            const snapshot = await getDocs(collection(db, "clients", client, "sites", site, "rbts"));
            const data = snapshot.docs.map((doc) => {
                const rbtData = doc.data();
                return {
                    id: doc.id,
                    running_status: rbtData.running_status || "Auto",
                    breakdown_status: rbtData.breakdown_status || "N/A",
                    work: rbtData.work || "",
                    ...rbtData,
                };
            });

            const sortedData = data.sort((a, b) => {
                const numA = parseInt(a.id.replace(/\D/g, ""), 10);
                const numB = parseInt(b.id.replace(/\D/g, ""), 10);
                return numA - numB;
            });

            setRows(sortedData);
            setLoading(false);
        };
        fetchRBTs();
    }, [client, site]);

    const handlePartIssueChange = (part, field, val) => {
        setPartIssues((prev) => ({
            ...prev,
            [part]: {
                ...prev[part],
                [field]: val,
            },
        }));
    };

    const handleSavePartIssues = async () => {
        await logAndUpdateField(client, site, selectedRBT, "part_issues", {}, partIssues);
        setRows((prev) =>
            prev.map((r) => (r.id === selectedRBT ? { ...r, part_issues: partIssues } : r))
        );
        setSelectedRBT(null);
    };

    // Status color mapping
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
        <FormControl
            size="small"
            sx={{
                minWidth: 140,
                "& .MuiOutlinedInput-root": {
                    background: "#ffffff",
                    color: "#111827",
                    borderRadius: "8px",
                    border: "1px solid #4f46e5",
                    "&:hover": {
                        borderColor: "#7c3aed",
                        boxShadow: "0 0 6px rgba(124, 58, 237, 0.4)",
                    },
                },
                "& .MuiSelect-select": { padding: "6px 12px" },
                "& .MuiSelect-icon": { color: "#4f46e5" },
            }}
        >
            <Select
                value={params.value || ""}
                onChange={async (e) => {
                    const newValue = e.target.value;
                    const oldValue = params.value;

                    await logAndUpdateField(client, site, params.row.id, field, oldValue, newValue);

                    setRows((prev) =>
                        prev.map((r) => (r.id === params.row.id ? { ...r, [field]: newValue } : r))
                    );

                    if (
                        (field === "running_status" && (newValue === "Manual" || newValue === "Not Running")) ||
                        (field === "breakdown_status" &&
                            (newValue === "Breakdown" || newValue === "Running With Issue"))
                    ) {
                        setSelectedRBT(params.row.id);
                        setPartIssues(params.row.part_issues || {});
                    }
                }}
                MenuProps={{
                    PaperProps: {
                        sx: {
                            borderRadius: "8px",
                            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.12)",
                            "& .MuiMenuItem-root": {
                                fontSize: 14,
                                "&:hover": {
                                    backgroundColor: "rgba(79, 70, 229, 0.1)",
                                },
                            },
                        },
                    },
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
                                textTransform: "capitalize",
                            }}
                        />
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );

    const columns = [
        { field: "id", headerName: "RBT ID", width: 120, editable: false },
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
    ];

    return (
        <Box
            sx={{
                height: 650,
                width: "100%",
                p: 2,
                backgroundColor: "#fff",
                borderRadius: 3,
                boxShadow: 4,
                fontFamily: "'Roboto', sans-serif",
            }}
        >
            <Typography variant="h6" mb={2} fontWeight="bold" color="primary">
                RBT Dashboard - {site}
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
                sx={{
                    fontSize: 14,
                    "& .MuiDataGrid-columnHeaders": {
                        backgroundColor: "#f4f6f8",
                        color: "#333",
                        fontWeight: "bold",
                        fontSize: 14,
                    },
                    "& .MuiDataGrid-row": {
                        "&:nth-of-type(odd)": { backgroundColor: "#fafafa" },
                    },
                    "& .MuiDataGrid-cell": { fontSize: 13 },
                }}
            />

            {/* Part Issue Modal */}
            <Dialog open={Boolean(selectedRBT)} onClose={() => setSelectedRBT(null)} maxWidth="sm" fullWidth>
                <DialogTitle>Part Issue - {selectedRBT}</DialogTitle>
                <DialogContent dividers>
                    {Object.keys(partIssues || {}).length === 0 ? (
                        <Typography color="textSecondary">No parts to update.</Typography>
                    ) : (
                        Object.keys(partIssues).map((part) => (
                            <Box key={part} display="flex" alignItems="center" gap={2} mt={2}>
                                <Typography sx={{ width: "150px", fontWeight: 500 }}>{part}</Typography>
                                <TextField
                                    type="date"
                                    label="Dispatch Date"
                                    size="small"
                                    value={partIssues[part]?.dispatch_date || ""}
                                    onChange={(e) => handlePartIssueChange(part, "dispatch_date", e.target.value)}
                                />
                                <TextField
                                    type="date"
                                    label="Delivery Date"
                                    size="small"
                                    value={partIssues[part]?.delivery_date || ""}
                                    onChange={(e) => handlePartIssueChange(part, "delivery_date", e.target.value)}
                                />
                            </Box>
                        ))
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSelectedRBT(null)}>Cancel</Button>
                    <Button onClick={handleSavePartIssues} variant="contained" color="primary">
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default RBTDataGrid;
