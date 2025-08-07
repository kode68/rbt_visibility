const admin = require("firebase-admin");
const readline = require("readline");
const serviceAccount = require("./rbt-app-77196-firebase-adminsdk-fbsvc-e109c77d41.json"); // Use correct service key for rbt-app-77196

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const defaultPartIssues = {
    "ANTENA CABLE": { dispatch_date: null, delivery_date: null },
    "ANTENA PORT": { dispatch_date: null, delivery_date: null },
    "BATTERY": { dispatch_date: null, delivery_date: null },
    "BATTERY BOX": { dispatch_date: null, delivery_date: null },
    "BRUSH MOTOR": { dispatch_date: null, delivery_date: null },
    "CHARGE CONTROLLER": { dispatch_date: null, delivery_date: null },
    "GUIDE WHEEL 1": { dispatch_date: null, delivery_date: null },
    "GUIDE WHEEL 2": { dispatch_date: null, delivery_date: null },
    "GUIDE WHEEL 3": { dispatch_date: null, delivery_date: null },
    "GUIDE WHEEL 4": { dispatch_date: null, delivery_date: null },
    "HOME SENSOR": { dispatch_date: null, delivery_date: null },
    "LIMIT SWITCH 1": { dispatch_date: null, delivery_date: null },
    "LIMIT SWITCH 2": { dispatch_date: null, delivery_date: null },
    "LOAD WHEEL 1": { dispatch_date: null, delivery_date: null },
    "LOAD WHEEL 2": { dispatch_date: null, delivery_date: null },
    "LOAD WHEEL 3": { dispatch_date: null, delivery_date: null },
    "LOAD WHEEL 4": { dispatch_date: null, delivery_date: null },
    "LOAD WHEEL 5": { dispatch_date: null, delivery_date: null },
    "LOAD WHEEL 6": { dispatch_date: null, delivery_date: null },
    "LT 1": { dispatch_date: null, delivery_date: null },
    "LT 2": { dispatch_date: null, delivery_date: null },
    "PCB BOX": { dispatch_date: null, delivery_date: null },
    "PULSE COUNT": { dispatch_date: null, delivery_date: null },
    "PV MODULE": { dispatch_date: null, delivery_date: null },
    "REPEATER PCB": { dispatch_date: null, delivery_date: null },
    "RTC": { dispatch_date: null, delivery_date: null },
    "SS PIPE": { dispatch_date: null, delivery_date: null },
    "SSC": { dispatch_date: null, delivery_date: null },
    "STEPPER DRIVE": { dispatch_date: null, delivery_date: null },
    "STEPPER MOTOR": { dispatch_date: null, delivery_date: null },
    "TC BELT": { dispatch_date: null, delivery_date: null },
    "TC LOAD WHEEL": { dispatch_date: null, delivery_date: null },
    "XBEE": { dispatch_date: null, delivery_date: null }
};

const fieldsToRemove = [
    "GUIDE WHEEL",
    "LOAD WHEEL",
    "LIMIT SWITCH"
];

function getTodayDate() {
    const today = new Date();
    return today.toISOString().split("T")[0]; // YYYY-MM-DD
}

async function updatePartIssues(clientName) {
    const today = getTodayDate();
    const clientRef = db.collection("clients").doc(clientName);
    const sitesSnapshot = await clientRef.collection("sites").get();

    if (sitesSnapshot.empty) {
        console.log(`❌ No sites found for client: ${clientName}`);
        return;
    }

    let totalSites = 0;
    let totalRbts = 0;

    for (const siteDoc of sitesSnapshot.docs) {
        totalSites++;
        const siteId = siteDoc.id;
        const rbtsSnapshot = await siteDoc.ref.collection("rbts").get();

        for (const rbtDoc of rbtsSnapshot.docs) {
            totalRbts++;
            const rbtId = rbtDoc.id;
            const rbtData = rbtDoc.data();

            // Build updated parts
            const updatedParts = {};
            for (const [part, defaultData] of Object.entries(defaultPartIssues)) {
                const existingPart = rbtData.part_issues?.[part] || {};
                updatedParts[part] = {
                    dispatch_date: existingPart.dispatch_date ?? defaultData.dispatch_date,
                    delivery_date: existingPart.delivery_date ?? defaultData.delivery_date,
                };
            }

            // Prepare fields to delete
            const removeFields = {};
            for (const field of fieldsToRemove) {
                removeFields[`part_issues.${field}`] = admin.firestore.FieldValue.delete();
            }

            // 1️⃣ Remove old fields first
            if (Object.keys(removeFields).length > 0) {
                await rbtDoc.ref.update(removeFields);
            }

            // 2️⃣ Update new part_issues
            await rbtDoc.ref.update({
                part_issues: updatedParts,
            });

            // 3️⃣ Update today's history
            await rbtDoc.ref.collection("history").doc(today).set(
                {
                    part_issues: updatedParts,
                    last_updated: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );

            console.log(`✅ Updated part_issues for ${clientName} -> ${siteId} -> ${rbtId}`);
        }
    }

    console.log(`🎯 Completed: ${totalSites} sites, ${totalRbts} RBTs updated for client "${clientName}"`);
}

// CLI Prompt
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.question("Enter the client name: ", (clientName) => {
    updatePartIssues(clientName.trim())
        .catch(console.error)
        .finally(() => rl.close());
});
