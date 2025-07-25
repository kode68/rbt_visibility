import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
    collection,
    getDocs,
    updateDoc,
    doc
} from "firebase/firestore";

export default function ManageUsers() {
    const [users, setUsers] = useState([]);
    const navigate = useNavigate();
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (!currentUser || currentUser.email !== "mis@brightbots.in") {
            navigate("/dashboard");
        } else {
            fetchUsers();
        }
    }, [currentUser, navigate]);

    const fetchUsers = async () => {
        const snapshot = await getDocs(collection(db, "users"));
        const userList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(userList);
    };

    const makeAdmin = async (userId, email) => {
        if (email === "mis@brightbots.in") return; // extra safeguard
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, { role: "admin" });
        fetchUsers();
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <img
                        src="https://brightbots.in/img/Brightbots-logo.png"
                        alt="Logo"
                        className="h-10"
                    />
                    <h1 className="text-2xl font-extrabold text-blue-800">Manage Users</h1>
                </div>
                <button
                    onClick={() => navigate("/dashboard")}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg"
                >
                    ← Back to Dashboard
                </button>
            </div>

            <div className="overflow-x-auto bg-white rounded-lg shadow p-4">
                <table className="min-w-full text-sm text-left">
                    <thead className="border-b font-semibold text-gray-700">
                        <tr>
                            <th className="px-4 py-2">Email</th>
                            <th className="px-4 py-2">Status</th>
                            <th className="px-4 py-2">Email Verified</th>
                            <th className="px-4 py-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id} className="border-t hover:bg-gray-50">
                                <td className="px-4 py-2">{user.email}</td>
                                <td className="px-4 py-2 font-medium text-gray-800">
                                    {user.email === "mis@brightbots.in"
                                        ? "Super Admin"
                                        : user.role === "admin"
                                            ? "Admin"
                                            : "User"}
                                </td>
                                <td className="px-4 py-2">
                                    {user.emailVerified ? (
                                        <span className="text-green-600 font-semibold">✅</span>
                                    ) : (
                                        <span className="text-red-500 font-semibold">❌</span>
                                    )}
                                </td>
                                <td className="px-4 py-2">
                                    {user.email !== "mis@brightbots.in" && user.role !== "admin" && (
                                        <button
                                            onClick={() => makeAdmin(user.id, user.email)}
                                            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded text-xs font-medium"
                                        >
                                            Make Admin
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
