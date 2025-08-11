import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import toast from "react-hot-toast";
import RBTDataGrid from "./RBTDataGrid";
import PartIssueSection from "../components/PartIssueSection";
import { FormControl, Select, MenuItem, Checkbox, ListItemText } from "@mui/material";

const defaultPartIssues = {
  "ANTENA CABLE": { dispatch_date: "", delivery_date: "" },
  "ANTENA PORT": { dispatch_date: "", delivery_date: "" },
  "BATTERY": { dispatch_date: "", delivery_date: "" },
  "BATTERY BOX": { dispatch_date: "", delivery_date: "" },
  "BATTTERY": { dispatch_date: "", delivery_date: "" },
  "BRUSH MOTOR": { dispatch_date: "", delivery_date: "" },
  "CHARGE CONTROLLER": { dispatch_date: "", delivery_date: "" },
  "HOME SENSOR": { dispatch_date: "", delivery_date: "" },
  "LT 1": { dispatch_date: "", delivery_date: "" },
  "LT 2": { dispatch_date: "", delivery_date: "" },
  "PCB BOX": { dispatch_date: "", delivery_date: "" },
  "PULSE COUNT": { dispatch_date: "", delivery_date: "" },
  "PV MODULE": { dispatch_date: "", delivery_date: "" },
  "REPEATER PCB": { dispatch_date: "", delivery_date: "" },
  "RTC": { dispatch_date: "", delivery_date: "" },
  "SS PIPE": { dispatch_date: "", delivery_date: "" },
  "SSC": { dispatch_date: "", delivery_date: "" },
  "STEPPER DRIVE": { dispatch_date: "", delivery_date: "" },
  "STEPPER MOTOR": { dispatch_date: "", delivery_date: "" },
  "TC BELT": { dispatch_date: "", delivery_date: "" },
  "TC Load Wheel": { dispatch_date: "", delivery_date: "" },
  "XBEE": { dispatch_date: "", delivery_date: "" },
  "GUIDE WHEEL 1": { dispatch_date: "", delivery_date: "" },
  "GUIDE WHEEL 2": { dispatch_date: "", delivery_date: "" },
  "GUIDE WHEEL 3": { dispatch_date: "", delivery_date: "" },
  "GUIDE WHEEL 4": { dispatch_date: "", delivery_date: "" },
  "LIMIT SWITCH 1": { dispatch_date: "", delivery_date: "" },
  "LIMIT SWITCH 2": { dispatch_date: "", delivery_date: "" },
  "LOAD WHEEL 1": { dispatch_date: "", delivery_date: "" },
  "LOAD WHEEL 2": { dispatch_date: "", delivery_date: "" },
  "LOAD WHEEL 3": { dispatch_date: "", delivery_date: "" },
  "LOAD WHEEL 4": { dispatch_date: "", delivery_date: "" },
  "TC LOAD WHEEL": { dispatch_date: "", delivery_date: "" }
};

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const [sites, setSites] = useState([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedSites, setSelectedSites] = useState([]);
  const [rbtList, setRbtList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [selectedRBT, setSelectedRBT] = useState(null);
  const [partIssues, setPartIssues] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        navigate("/login", { replace: true });
      } else {
        await user.reload();
        const refreshedUser = auth.currentUser;
        setCurrentUser(refreshedUser);

        const userRef = doc(db, "users", refreshedUser.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          const data = userDoc.data();
          setFirstName(data.firstName || "");

          if (data.emailVerified !== refreshedUser.emailVerified) {
            await updateDoc(userRef, { emailVerified: refreshedUser.emailVerified });
          }

          if (!refreshedUser.emailVerified) navigate("/login", { replace: true });
        }
      }
    });
    return unsub;
  }, [navigate]);

  useEffect(() => {
    const unsubClients = onSnapshot(collection(db, "clients"), (snapshot) => {
      setClients(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return unsubClients;
  }, []);

  const handleClientChange = (clientId) => {
    setSelectedClient(clientId);
    setSelectedSites([]);
    setRbtList([]);
  };

  useEffect(() => {
    if (!selectedClient) return;
    const sitesRef = collection(db, `clients/${selectedClient}/sites`);
    const unsubSites = onSnapshot(sitesRef, (sitesSnapshot) => {
      setSites(sitesSnapshot.docs.map((doc) => doc.id));
    });
    return unsubSites;
  }, [selectedClient]);

  useEffect(() => {
    if (!selectedClient || selectedSites.length === 0) return;
    setLoading(true);
    setRbtList([]);
    const fetchRBTs = async () => {
      try {
        const allRBTs = await Promise.all(
          selectedSites.map(async (site) => {
            const rbtRef = collection(db, `clients/${selectedClient}/sites/${site}/rbts`);
            const snapshot = await getDocs(rbtRef);
            return snapshot.docs.map((docSnap) => ({
              site,
              rbt_id: docSnap.id,
              ...docSnap.data(),
            }));
          })
        );
        setRbtList(allRBTs.flat());
      } catch (err) {
        console.error("Error fetching RBTs:", err);
        toast.error("Failed to fetch robots");
      } finally {
        setLoading(false);
      }
    };

    fetchRBTs();
  }, [selectedClient, JSON.stringify(selectedSites)]);

  const isAdmin = currentUser?.email?.endsWith("@brightbots.in");
  const isSuperAdmin = currentUser?.email === "dev@brightbots.in";

  const handleAddRBT = async () => {
    if (!selectedClient || selectedSites.length === 0)
      return toast.error("Select client & site first!");
    try {
      const site = selectedSites[0];
      const siteRbts = rbtList.filter((r) => r.site === site);
      const nextId = siteRbts.length + 1;
      const newRbtId = `RBT${nextId}`;
      const rbtRef = doc(db, `clients/${selectedClient}/sites/${site}/rbts`, newRbtId);

      await setDoc(rbtRef, {
        breakdown_status: "N/A",
        running_status: "Auto",
        work: "",
        cleaner_did: "",
        tc_did: "",
        cl_pcb_model: "",
        tc_pcb_model: "",
        part_issues: defaultPartIssues,
        running_status_ageing: 0,
        last_updated: serverTimestamp(),
      });

      toast.success(`RBT ${newRbtId} added to ${site}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to add RBT");
    }
  };

  const handleDeleteRBT = async (rbt_id, site) => {
    if (!isSuperAdmin) return toast.error("Only Super Admin can delete RBTs");
    if (!window.confirm(`Delete ${rbt_id}? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, `clients/${selectedClient}/sites/${site}/rbts`, rbt_id));
      setRbtList((prev) => prev.filter((rbt) => !(rbt.rbt_id === rbt_id && rbt.site === site)));
      toast.success(`${rbt_id} deleted`);
    } catch (err) {
      console.error(err);
      toast.error("Delete failed");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 px-6 py-8 font-sans">
      <div className="flex items-center justify-between mb-10 border-b pb-4">
        <div className="flex items-center gap-4">
          <img
            src="https://brightbots.in/img/Brightbots-logo.png"
            className="h-12 drop-shadow-sm cursor-pointer"
            alt="BrightBots Logo"
            onClick={() => navigate("/dashboard")}
          />
          <h1 className="text-3xl font-extrabold text-blue-800 tracking-tight">RBT Dashboard</h1>
        </div>
        <div className="flex gap-3 items-center">
          {firstName && <div className="text-gray-700 font-semibold mr-2">Hi, {firstName}</div>}
          <button
            onClick={() => navigate("/overall-dashboard")}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded-lg shadow-lg"
          >
            📊 View Overall Dashboard
          </button>
          {(isAdmin || isSuperAdmin) && (
            <button
              onClick={() => navigate("/logs")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg shadow-lg"
            >
              📄 View Logs
            </button>
          )}
          {isSuperAdmin && (
            <button
              onClick={() => navigate("/manage-users")}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow-lg"
            >
              👥 Manage Users
            </button>
          )}
          <button
            onClick={() => auth.signOut()}
            className="bg-red-500 hover:bg-red-600 text-white font-semibold px-5 py-2 rounded-lg shadow-lg"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="mb-8 flex gap-4">
        <div>
          <label className="block text-gray-700 mb-1">Select Client:</label>
          <select
            value={selectedClient}
            onChange={(e) => handleClientChange(e.target.value)}
            className="border p-2 rounded-lg"
          >
            <option value="">-- Select Client --</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.id}
              </option>
            ))}
          </select>
        </div>

        {selectedClient && (
          <div>
            <label className="block text-gray-700 mb-1">Select Site(s):</label>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <Select
                multiple
                value={selectedSites}
                onChange={(e) => {
                  const {
                    target: { value },
                  } = e;
                  setSelectedSites(typeof value === "string" ? value.split(",") : value);
                }}
                renderValue={(selected) => (selected.length > 0 ? selected.join(", ") : "-- Select Sites --")}
              >
                {sites.map((site) => (
                  <MenuItem key={site} value={site}>
                    <Checkbox checked={selectedSites.includes(site)} />
                    <ListItemText primary={site} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        )}
      </div>

      {selectedClient && selectedSites.length > 0 && (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Robots at <span className="text-blue-700">{selectedSites.join(", ")}</span>
            </h2>
            {isAdmin && (
              <button
                onClick={handleAddRBT}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg shadow"
              >
                ➕ Add RBT
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-blue-500 animate-pulse font-medium">Loading RBTs...</p>
          ) : rbtList.length === 0 ? (
            <div className="text-gray-500 italic text-lg">No robots found.</div>
          ) : (
            <RBTDataGrid
              client={selectedClient}
              sites={selectedSites}
              rbts={rbtList}
              onDelete={handleDeleteRBT}
              onTriggerPartIssue={(rbtId, parts) => {
                setSelectedRBT(rbtId);
                setPartIssues(parts || defaultPartIssues);
              }}
            />
          )}
        </>
      )}

      {selectedRBT && (
        <PartIssueSection
          client={selectedClient}
          sites={selectedSites}
          rbtId={selectedRBT}
          rbt={rbtList.find((rbt) => rbt.rbt_id === selectedRBT) || {}}
          onPartIssueChange={(parts) => setPartIssues(parts)}
        />
      )}
    </div>
  );
}
