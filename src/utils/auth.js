// src/utils/auth.js
export const ADMIN_EMAILS = ["admin@brightbots.in", "vinay@brightbots.in"];

export function isAdmin(user) {
    return user && ADMIN_EMAILS.includes(user.email);
}
