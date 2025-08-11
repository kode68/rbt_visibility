import React from "react";
import { Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";

const ADMIN_EMAILS = ["admin@brightbots.in"]; // Add more if needed

const ProtectedRoute = ({ children, adminOnly = false }) => {
    const [user, loading] = useAuthState(auth);

    if (loading) return <div className="text-center py-20">Loading...</div>;
    if (!user) return <Navigate to="/login" replace />;

    if (adminOnly && !ADMIN_EMAILS.includes(user.email)) {
        return (
            <div className="text-center py-20 text-red-500 font-semibold">
                Access Denied: Admins only
            </div>
        );
    }

    return children;
};

export default ProtectedRoute;
