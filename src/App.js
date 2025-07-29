import React from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuthState } from "react-firebase-hooks/auth";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Logs from "./pages/Logs";
import { auth } from "./firebase";
import ManageUsers from "./pages/ManageUsers";
import OverallDashboard from "./pages/OverallDashboard";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/logs" element={<AdminOnly><Logs /></AdminOnly>} />
        <Route path="/manage-users" element={<ManageUsers />} />
        <Route path="/overall-dashboard" element={<OverallDashboard />} />
      </Routes>
      <Toaster position="top-center" />
    </Router>
  );
}

function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white shadow-xl rounded-2xl p-8 max-w-md w-full text-center animate-fade-in">
        <img
          src="https://brightbots.in/img/Brightbots-logo.png"
          alt="BrightBots Logo"
          className="h-20 mx-auto mb-4"
        />
        <h1 className="text-2xl font-bold mb-4 text-gray-800">Welcome to BrightBots RBT Dashboard</h1>
        <p className="text-gray-600 mb-6">Manage all your site robots in one place.</p>
        <button
          onClick={() => navigate("/login")}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition duration-200"
        >
          Login
        </button>
        <p className="mt-4 text-sm text-gray-500">
          Don't have an account?{" "}
          <span
            onClick={() => navigate("/signup")}
            className="text-blue-600 cursor-pointer hover:underline"
          >
            Sign up
          </span>
        </p>
      </div>
    </div>
  );
}

// ✅ Admin-only wrapper using inline logic
function AdminOnly({ children }) {
  const [user, loading] = useAuthState(auth);

  if (loading) return null;

  const isAdmin = user?.email?.endsWith("@brightbots.in");

  if (!user || !user.emailVerified || !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
