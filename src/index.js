// src/index.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import AuthProvider, { useAuth, ProtectedRoute } from "./auth/AuthProvider";
import Login from "./pages/Login";
import Signup from "./pages/Signup"; // 👈 add this

function LoadingScreen() {
    return (
        <div style={{ textAlign: "center", padding: "2rem" }}>
            <p>Loading...</p>
        </div>
    );
}

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error, info) {
        console.error("[App Error]", error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ textAlign: "center", padding: "2rem", color: "crimson" }}>
                    <h2>Something went wrong.</h2>
                    <p>Please refresh the page.</p>
                </div>
            );
        }
        return this.props.children;
    }
}

function Forbidden() {
    return (
        <div style={{ textAlign: "center", padding: "2rem" }}>
            <h2>403 — Not allowed</h2>
            <p>You don’t have permission to view this page.</p>
            <a href="/">Go Home</a>
        </div>
    );
}

function RouterWithAuthGate() {
    const { loading } = useAuth();
    if (loading) return <LoadingScreen />;

    return (
        <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} /> {/* 👈 add this */}

            {/* Protected app (any logged-in role) */}
            <Route
                path="/*"
                element={
                    <ProtectedRoute roles={["viewer", "admin", "super_admin"]}>
                        <App />
                    </ProtectedRoute>
                }
            />

            {/* Forbidden + fallback */}
            <Route path="/403" element={<Forbidden />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <ErrorBoundary>
            <AuthProvider>
                <BrowserRouter>
                    <RouterWithAuthGate />
                </BrowserRouter>
            </AuthProvider>
        </ErrorBoundary>
    </React.StrictMode>
);
