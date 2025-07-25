const admin = require("firebase-admin");
const serviceAccount = require("./rbt-app-a30e8-e9b17d081302.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// List all your site names
const siteNames = [
    "Indave", "Kasare", "Parola", "Rajapur",
    "Tembhe", "Tingri", "Varul", "Vehelgaon"
];

async function deleteBadFormattedRBTs() {
    for (const site of siteNames) {
        const rbtsRef = db.collection("sites").doc(site).collection("rbts");
        const snapshot = await rbtsRef.get();

        const badDocs = snapshot.docs.filter((doc) => /^RBT\d+$/.test(doc.id)); // No space

        if (badDocs.length === 0) {
            console.log(`✅ No bad RBTs found in ${site}`);
            continue;
        }

        console.log(`🧹 Deleting ${badDocs.length} badly named RBTs in ${site}...`);

        const batch = db.batch();
        badDocs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();

        console.log(`✅ Cleaned ${site}`);
    }

    console.log("🎉 All sites cleaned successfully.");
}

deleteBadFormattedRBTs();
