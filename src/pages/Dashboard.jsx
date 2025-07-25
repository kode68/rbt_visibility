// src/pages/Dashboard.jsx
import React, { useState, useEffect } from "react";
import SiteSelector from "../components/SiteSelector";
import RBTCard from "../components/RBTCard";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";

export default function Dashboard() {
  const [selectedSite, setSelectedSite] = useState("");
  const [rbtList, setRbtList] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Redirect unauthenticated or unverified users
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user || !user.emailVerified) {
        navigate("/login");
      }
    });
    return unsub;
  }, [navigate]);

  // Fetch RBTs when site changes
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

        // ✅ Sort numerically by RBT number
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 px-6 py-8 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-10 border-b pb-4">
        <div className="flex items-center gap-4">
          <img
            src="https://brightbots.in/img/Brightbots-logo.png"
            className="h-12 drop-shadow-sm"
            alt="BrightBots Logo"
          />
          <h1 className="text-3xl font-extrabold text-blue-800 tracking-tight">RBT Dashboard</h1>
        </div>
        <button
          onClick={() => auth.signOut()}
          className="bg-red-500 hover:bg-red-600 text-white font-semibold px-5 py-2 rounded-lg shadow-lg"
        >
          Logout
        </button>
      </div>

      {/* Site Selector */}
      <div className="mb-8">
        <SiteSelector onSiteChange={setSelectedSite} />
      </div>

      {/* RBT Section */}
      {selectedSite && (
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Robots at <span className="text-blue-700">{selectedSite}</span>
          </h2>

          {loading ? (
            <p className="text-blue-500 animate-pulse font-medium">Loading RBTs...</p>
          ) : rbtList.length === 0 ? (
            <div className="text-gray-500 italic text-lg">No robots found at this site.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {rbtList.map((rbt) => (
                <RBTCard key={rbt.rbt_id} site={selectedSite} rbt={rbt} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
