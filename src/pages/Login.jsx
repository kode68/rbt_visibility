import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const user = userCred.user;

      if (!user.emailVerified) {
        setErr("Please verify your email before logging in.");
        setLoading(false);
        return;
      }

      // Check or create user document in Firestore
      const userRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userRef);

      if (!docSnap.exists()) {
        const role = user.email === "mis@brightbots.in" ? "super_admin" : "user";
        await setDoc(userRef, {
          email: user.email,
          emailVerified: user.emailVerified,
          role,
        });
      }

      navigate("/dashboard");
    } catch (err) {
      setErr("Login failed: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200 relative overflow-hidden px-4">
      {/* Floating Logo */}
      <img
        src="https://brightbots.in/img/Brightbots-logo.png"
        alt="BrightBots Logo"
        className="absolute top-6 left-6 h-12 drop-shadow-lg transition-transform duration-300 hover:scale-105"
      />

      {/* Glow Effects */}
      <div className="absolute w-72 h-72 bg-blue-300 rounded-full opacity-30 blur-3xl top-0 -left-20 animate-pulse"></div>
      <div className="absolute w-72 h-72 bg-purple-300 rounded-full opacity-30 blur-3xl bottom-0 -right-20 animate-pulse delay-1000"></div>

      {/* Login Box */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 sm:p-10 z-10 backdrop-blur-sm transition-all duration-500 hover:shadow-2xl hover:scale-[1.01]">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-extrabold text-blue-700">Welcome Back 👋</h1>
          <p className="text-sm text-gray-500 mt-1">Log in to your BrightBots dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              placeholder="you@brightbots.in"
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
          </div>

          {err && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded relative text-sm animate-fade-in">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full ${loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
              } text-white font-semibold py-2.5 rounded-lg transition duration-200 shadow-sm hover:shadow-md`}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-sm text-center text-gray-600 mt-6">
          Don’t have an account?{" "}
          <Link to="/signup" className="text-blue-600 hover:underline font-medium transition">
            Sign up here
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
