import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
    collection,
    getDocs,
    updateDoc,
    deleteDoc,
    doc
} from "firebase/firestore";

export default function ManageUsers() {
    const [users, setUsers] = useState([]);
    const navigate = useNavigate();
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (!currentUser || currentUser.email !== "dev@brightbots.in") {
            navigate("/dashboard");
        } else {
            fetchUsers();
        }
    }, [currentUser, navigate]);

    const fetchUsers = async () => {
        const snapshot = await getDocs(collection(db, "users"));
        const allUsers = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

        const uniqueUsers = [];
        const seenEmails = new Map();

        // Deduplicate users and remove duplicates from Firestore
        for (const user of allUsers) {
            if (!seenEmails.has(user.email)) {
                seenEmails.set(user.email, user.id);
                uniqueUsers.push(user);
            } else {
                // Delete duplicate from Firestore
                await deleteDoc(doc(db, "users", user.id));
                console.log(`🗑 Removed duplicate user: ${user.email}`);
            }
        }

        setUsers(uniqueUsers);
    };

    const makeAdmin = async (userId, email) => {
        if (email === "dev@brightbots.in") return; // safeguard
        await updateDoc(doc(db, "users", userId), { role: "admin" });
        fetchUsers();
    };

    const removeAdmin = async (userId, email) => {
        if (email === "dev@brightbots.in") return;
        await updateDoc(doc(db, "users", userId), { role: "user" });
        fetchUsers();
    };

    const removeUser = async (userId, email) => {
        if (email === "dev@brightbots.in") return; // cannot delete super admin
        if (window.confirm(`Are you sure you want to remove ${email}?`)) {
            await deleteDoc(doc(db, "users", userId));
            fetchUsers();
        }
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
                                    {user.email === "dev@brightbots.in"
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
                                <td className="px-4 py-2 space-x-2">
                                    {user.email !== "dev@brightbots.in" && (
                                        <>
                                            {user.role !== "admin" ? (
                                                <button
                                                    onClick={() => makeAdmin(user.id, user.email)}
                                                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded text-xs font-medium"
                                                >
                                                    Make Admin
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => removeAdmin(user.id, user.email)}
                                                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded text-xs font-medium"
                                                >
                                                    Remove Admin
                                                </button>
                                            )}

                                            <button
                                                onClick={() => removeUser(user.id, user.email)}
                                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded text-xs font-medium"
                                            >
                                                Remove User
                                            </button>
                                        </>
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
