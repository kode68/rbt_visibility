const admin = require("firebase-admin");
const serviceAccount = require("./rbt-app-a30e8-e9b17d081302.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function copyDocumentRecursive(sourceDocRef, targetDocRef) {
    const docSnapshot = await sourceDocRef.get();
    if (!docSnapshot.exists) return;

    await targetDocRef.set(docSnapshot.data());

    const subcollections = await sourceDocRef.listCollections();
    for (const subcollection of subcollections) {
        const subSnapshot = await subcollection.get();
        for (const subDoc of subSnapshot.docs) {
            await copyDocumentRecursive(
                subcollection.doc(subDoc.id),
                targetDocRef.collection(subcollection.id).doc(subDoc.id)
            );
        }
    }
}

async function migrateSites() {
    console.log("🚀 Migration Started: sites/Juniper/sites → clients/Juniper/sites");

    const sitesSnapshot = await db
        .collection("sites") // ✅ correct path
        .doc("Juniper")
        .collection("sites")
        .get();

    if (sitesSnapshot.empty) {
        console.error("❌ No documents found in 'sites/Juniper/sites'. Check if this path has data.");
        return;
    }

    for (const siteDoc of sitesSnapshot.docs) {
        const siteName = siteDoc.id;
        console.log(`🚀 Migrating site: ${siteName}`);

        const newSiteRef = db
            .collection("clients")
            .doc("Juniper")
            .collection("sites")
            .doc(siteName);

        await copyDocumentRecursive(siteDoc.ref, newSiteRef);

        console.log(`✅ Site migrated: ${siteName}`);
    }

    console.log("🎉 Migration completed successfully!");
}

migrateSites().catch((err) => console.error("❌ Migration Error:", err));
