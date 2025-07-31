import React, { useState, useEffect } from "react";
import SiteSelector from "../components/SiteSelector";
import RBTCard from "../components/RBTCard";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import toast from "react-hot-toast";

const defaultPartIssues = {
  "ANTENA CABLE": { dispatch_date: "", delivery_date: "" },
  "ANTENA PORT": { dispatch_date: "", delivery_date: "" },
  "BATTERY": { dispatch_date: "", delivery_date: "" },
  "BATTERY BOX": { dispatch_date: "", delivery_date: "" },
  "BATTTERY": { dispatch_date: "", delivery_date: "" },
  "BRUSH MOTOR": { dispatch_date: "", delivery_date: "" },
  "CHARGE CONTROLLER": { dispatch_date: "", delivery_date: "" },
  "GUIDE WHEEL": { dispatch_date: "", delivery_date: "" },
  "HOME SENSOR": { dispatch_date: "", delivery_date: "" },
  "LIMIT SWITCH": { dispatch_date: "", delivery_date: "" },
  "LOAD WHEEL": { dispatch_date: "", delivery_date: "" },
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
};

export default function Dashboard() {
  const [selectedSite, setSelectedSite] = useState("");
  const [rbtList, setRbtList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [firstName, setFirstName] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        navigate("/login");
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
            await updateDoc(userRef, {
              emailVerified: refreshedUser.emailVerified,
            });
          }

          if (!refreshedUser.emailVerified) {
            navigate("/login");
          }
        }
      }
    });
    return unsub;
  }, [navigate]);

  useEffect(() => {
    const fetchRBTs = async () => {
      if (!selectedSite) return;
      setLoading(true);
      try {
        const rbtsRef = collection(db, "sites", selectedSite, "rbts");
        const snapshot = await getDocs(rbtsRef);
        const robots = snapshot.docs.map((doc) => ({
          rbt_id: doc.id,
          ...doc.data(),
        }));

        robots.sort((a, b) => {
          const numA = parseInt(a.rbt_id.replace("RBT", ""));
          const numB = parseInt(b.rbt_id.replace("RBT", ""));
          return numA - numB;
        });

        setRbtList(robots);
      } catch (error) {
        console.error("Error fetching RBTs:", error);
      }
      setLoading(false);
    };

    fetchRBTs();
  }, [selectedSite]);

  const isAdmin = currentUser?.email.endsWith("@brightbots.in");
  const isSuperAdmin = currentUser?.email === "dev@brightbots.in";

  const handleAddRBT = async () => {
    try {
      const nextId = rbtList.length + 1;
      const newRbtId = `RBT${nextId}`;
      const rbtRef = doc(db, "sites", selectedSite, "rbts", newRbtId);

      await setDoc(rbtRef, {
        breakdown_status: "N/A",
        running_status: "Auto",
        work: "",
        cleaner_did: "",
        tc_did: "",
        cl_pcb_model: "",
        tc_pcb_model: "",
        part_issues: defaultPartIssues,
        last_updated: new Date(),
      });

      toast.success(`RBT ${newRbtId} added`);
      setRbtList((prev) => [
        ...prev,
        {
          rbt_id: newRbtId,
          cleaner_did: "",
          tc_did: "",
          cl_pcb_model: "",
          tc_pcb_model: "",
          running_status: "Auto",
          breakdown_status: "N/A",
          work: "",
          part_issues: defaultPartIssues,
        },
      ]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to add RBT");
    }
  };

  const handleDeleteRBT = async (rbt_id) => {
    if (!window.confirm(`Delete ${rbt_id}? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "sites", selectedSite, "rbts", rbt_id));
      setRbtList((prev) => prev.filter((r) => r.rbt_id !== rbt_id));
      toast.success(`Deleted ${rbt_id}`);
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
            onClick={() => {
              const user = auth.currentUser;
              if (user && user.emailVerified) {
                navigate("/dashboard");
              } else {
                navigate("/");
              }
            }}
          />
          <h1 className="text-3xl font-extrabold text-blue-800 tracking-tight">RBT Dashboard</h1>
        </div>
        <div className="flex gap-3 items-center">
          {firstName && (
            <div className="text-gray-700 font-semibold mr-2">Hi, {firstName}</div>
          )}
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

      <div className="mb-8">
        <SiteSelector onSiteChange={setSelectedSite} />
      </div>

      {selectedSite && (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Robots at <span className="text-blue-700">{selectedSite}</span>
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
            <div className="text-gray-500 italic text-lg">No robots found at this site.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {rbtList.map((rbt) => (
                <RBTCard
                  key={rbt.rbt_id}
                  site={selectedSite}
                  rbt={rbt}
                  isAdmin={isAdmin}
                  isSuperAdmin={isSuperAdmin}
                  onDelete={handleDeleteRBT}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
