import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // If already signed in, go straight to dashboard
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) navigate("/dashboard", { replace: true });
    });
    return unsub;
  }, [navigate]);

  const handleSignup = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.endsWith("@brightbots.in")) {
      setErr("Only @brightbots.in emails are allowed.");
      setLoading(false);
      return;
    }

    try {
      const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCred.user;

      // Create/merge basic profile (role is managed by admins later)
      await setDoc(
        doc(db, "users", user.uid),
        {
          email: user.email,
          firstName,
          lastName,
          emailVerified: user.emailVerified,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        },
        { merge: true }
      );

      await sendEmailVerification(user);
      alert("Verification email sent. Please verify before logging in.");
      navigate("/login");
    } catch (error) {
      let message = error?.message || "Failed to create account.";
      if (error?.code === "auth/email-already-in-use") message = "This email is already registered.";
      if (error?.code === "auth/weak-password") message = "Password is too weak. Try a stronger one.";
      if (error?.code === "permission-denied")
        message = "Permission denied creating user profile. Ask an admin to review Firestore rules.";
      setErr(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 to-blue-200 relative overflow-hidden px-4">
      {/* Brand chip (same as Login) */}
      <a
        href="/"
        className="absolute top-4 left-4 inline-flex items-center gap-2 bg-white/90 rounded-lg shadow-md px-2 py-1"
        aria-label="BrightBots Home"
      >
        <img
          src="https://brightbots.in/img/Brightbots-logo.png"
          alt="BrightBots Logo"
          width={56}
          height={56}
          loading="eager"
          className="h-12 w-12 object-contain"
        />
        <span className="hidden sm:inline text-sm font-semibold text-blue-900 tracking-wide">
          BrightBots
        </span>
      </a>

      {/* Glow Effects */}
      <div className="absolute w-72 h-72 bg-purple-300 rounded-full opacity-30 blur-3xl top-0 -left-20 animate-pulse"></div>
      <div className="absolute w-72 h-72 bg-blue-300 rounded-full opacity-30 blur-3xl bottom-0 -right-20 animate-pulse delay-1000"></div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 sm:p-10 z-10 backdrop-blur-sm transition-all duration-500 hover:shadow-2xl hover:scale-[1.01]">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-extrabold text-blue-700">Create Account 📝</h1>
          <p className="text-sm text-gray-500 mt-1">Only @brightbots.in emails allowed</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="John"
              required
              autoComplete="given-name"
              autoFocus
              className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Doe"
              required
              autoComplete="family-name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
            />
          </div>

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
              autoComplete="email"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
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
              autoComplete="new-password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
            />
          </div>

          {err && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded relative text-sm animate-fade-in" role="alert">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full ${loading ? "bg-purple-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"} text-white font-semibold py-2.5 rounded-lg transition duration-200 shadow-sm hover:shadow-md`}
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p className="text-sm text-center text-gray-600 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-purple-600 hover:underline font-medium transition">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}
