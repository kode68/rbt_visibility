const fs = require('fs');
const csv = require('csv-parser');
const admin = require('firebase-admin');
const path = require('path');

// Load service account key
const serviceAccount = require('./rbt-app-a30e8-e9b17d081302.json');

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Setup
const inputFile = 'firestore_rbt_bulk_upload.csv';
let count = 0;

// Helper: Extract selected value from mutually exclusive columns
function extractSelectedValue(row, prefix) {
  const keys = Object.keys(row).filter(k => k.startsWith(prefix));
  const selected = keys.find(k => row[k] && row[k].toString().trim().toLowerCase() === 'true');
  return selected ? selected.replace(`${prefix}:`, '') : '';
}

// Helper: Extract part issues
function extractPartIssues(row) {
  const partIssues = {};
  const partKeys = Object.keys(row).filter(k => k.startsWith("part_issue:") && k.endsWith(":dispatch_date"));

  partKeys.forEach(dispatchKey => {
    const partName = dispatchKey.split(":")[1]; // e.g., Battery
    const deliveryKey = `part_issue:${partName}:delivery_date`;
    const dispatchDate = row[dispatchKey] ? row[dispatchKey].trim() : null;
    const deliveryDate = row[deliveryKey] ? row[deliveryKey].trim() : null;

    if (dispatchDate || deliveryDate) {
      partIssues[partName.toUpperCase()] = {
        dispatch_date: dispatchDate || null,
        delivery_date: deliveryDate || null
      };
    }
  });

  return partIssues;
}

// Main Upload Logic
fs.createReadStream(path.resolve(__dirname, inputFile))
  .pipe(csv())
  .on('data', async (row) => {
    const site = row.site?.trim();
    const rbt_id = row.rbt_id?.trim();

    if (!site || !rbt_id) return;

    const cleaner_did = row.cleaner_did?.trim() || '';
    const cl_pcb_model = row.cl_pcb_model?.trim() || '';
    const tc_did = row.to_did?.trim() || '';
    const tc_pcb_model = row.tc_pcb_model?.trim() || '';

    const running_status = extractSelectedValue(row, "running_status");
    const work = extractSelectedValue(row, "work_status");
    const breakdown_summary = extractSelectedValue(row, "breakdown_summary"); // Optional, if you add later

    const part_issues = extractPartIssues(row);

    const rbtData = {
      cleaner_did,
      cl_pcb_model,
      tc_did,
      tc_pcb_model,
      running_status,
      work,
      breakdown_summary,
      part_issues,
      last_updated: admin.firestore.Timestamp.now()
    };

    try {
      await db
        .collection('sites')
        .doc(site)
        .collection('rbts')
        .doc(rbt_id)
        .set(rbtData);

      console.log(`✅ Uploaded: ${site}/${rbt_id}`);
      count++;
    } catch (error) {
      console.error(`❌ Failed for ${site}/${rbt_id}:`, error);
    }
  })
  .on('end', () => {
    console.log(`\n✅ Bulk upload complete. Total RBTs uploaded: ${count}`);
  });
