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
  const navigate = useNavigate();

  // Redirect if user is not logged in or email not verified
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user || !user.emailVerified) {
        navigate("/login");
      }
    });
    return unsub;
  }, [navigate]);

  // Fetch RBTs when site is selected
  useEffect(() => {
    const fetchRBTs = async () => {
      if (!selectedSite) return;
      try {
        const rbtsRef = collection(db, "sites", selectedSite, "rbts");
        const snapshot = await getDocs(rbtsRef);
        const robots = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRbtList(robots);
      } catch (error) {
        console.error("Error fetching RBTs:", error);
      }
    };

    fetchRBTs();
  }, [selectedSite]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <img
          src="https://brightbots.in/img/Brightbots-logo.png"
          className="h-12"
          alt="BrightBots Logo"
        />
        <button
          onClick={() => auth.signOut()}
          className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-md"
        >
          Logout
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-4 text-gray-800">RBT Dashboard</h1>

      {/* Site Dropdown */}
      <SiteSelector onSiteChange={setSelectedSite} />

      {/* Show RBTs if site is selected */}
      {selectedSite && (
        <>
          <h2 className="text-lg font-semibold mt-6 mb-2 text-gray-700">
            Robots at {selectedSite}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rbtList.map((rbt) => (
              <RBTCard key={rbt.id} site={selectedSite} rbt={rbt} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
