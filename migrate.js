const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const serviceAccount = require("./new-project-service-account.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const exportPath = "./firestore-backup/firestore_export";

// Recursively import a document and its subcollections
async function importDocument(collectionRef, docId, docData) {
    const { __collections__, ...data } = docData;
    await collectionRef.doc(docId).set(data);
    console.log(`Imported doc: ${collectionRef.path}/${docId}`);

    if (__collections__) {
        for (const [subColName, subColDocs] of Object.entries(__collections__)) {
            const subColRef = collectionRef.doc(docId).collection(subColName);
            for (const [subDocId, subDocData] of Object.entries(subColDocs)) {
                await importDocument(subColRef, subDocId, subDocData);
            }
        }
    }
}

// Import a collection from JSON
async function importCollection(filePath, collectionName) {
    const fileContent = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const colRef = db.collection(collectionName);

    for (const [docId, docData] of Object.entries(fileContent)) {
        await importDocument(colRef, docId, docData);
    }
}

async function startImport() {
    const files = fs.readdirSync(exportPath).filter(file => file.endsWith(".json"));

    for (const file of files) {
        const collectionName = path.basename(file, ".json");
        console.log(`\n=== Importing collection: ${collectionName} ===`);
        await importCollection(path.join(exportPath, file), collectionName);
    }

    console.log("\n✅ Firestore migration completed successfully!");
}

startImport().catch(err => console.error("Migration error:", err));
