// src/index.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";

// --- Simple loading + error UI ---
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

// Minimal 403 page
function Forbidden() {
    return (
        <div style={{ textAlign: "center", padding: "2rem" }}>
            <h2>403 — Not allowed</h2>
            <p>You don’t have permission to view this page.</p>
            <a href="/">Go Home</a>
        </div>
    );
}

function AppRoutes() {
    // ProtectedRoute already shows a loading state via react-firebase-hooks
    return (
        <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Protected: your main app */}
            <Route
                path="/*"
                element={
                    <ProtectedRoute>
                        <App />
                    </ProtectedRoute>
                }
            />

            {/* Forbidden + fallback */}
            <Route path="/403" element={<Forbidden />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
    <React.StrictMode>
        <ErrorBoundary>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </ErrorBoundary>
    </React.StrictMode>
);
