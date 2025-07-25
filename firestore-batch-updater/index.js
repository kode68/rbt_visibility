const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const admin = require('firebase-admin');

// Firebase setup
const serviceAccount = require('./rbt-app-a30e8-e9b17d081302.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const inputFile = 'firestore_rbt_bulk_upload.csv';

// Extract part issues (if dispatch or delivery date exists)
function extractPartIssues(row) {
  const issues = {};
  const partKeys = Object.keys(row).filter(k => k.includes('part_issue:') && k.includes(':dispatch_date'));

  partKeys.forEach(dispatchKey => {
    const partName = dispatchKey.split(':')[1].toUpperCase();
    const deliveryKey = `part_issue:${partName}:delivery_date`;

    const dispatch = row[dispatchKey]?.trim();
    const delivery = row[deliveryKey]?.trim();

    if (dispatch || delivery) {
      issues[partName] = {
        dispatch_date: dispatch || null,
        delivery_date: delivery || null
      };
    }
  });

  return issues;
}

async function main() {
  const rows = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(path.resolve(__dirname, inputFile))
      .pipe(csv())
      .on('data', row => rows.push(row))
      .on('end', resolve)
      .on('error', reject);
  });

  let count = 0;

  for (const row of rows) {
    const site = row.site?.trim();
    const rbt_id = row.rbt_id?.trim();
    if (!site || !rbt_id) continue;

    const cleaner_did = row.cleaner_did?.trim() || '';
    const cl_pcb_model = row.cl_pcb_model?.trim() || '';
    const tc_did = row.tc_did?.trim() || '';
    const tc_pcb_model = row.tc_pcb_model?.trim() || '';
    const breakdown_status = row.breakdown_status?.trim() || '';
    const running_status = row.running_status?.trim() || '';
    const work = row.work?.trim() || '';

    const part_issues = extractPartIssues(row);

    const rbtData = {
      cleaner_did,
      cl_pcb_model,
      tc_did,
      tc_pcb_model,
      running_status,
      breakdown_status,
      work,
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
    } catch (err) {
      console.error(`❌ Failed for ${site}/${rbt_id}: ${err.message}`);
    }
  }

  console.log(`\n✅ Upload complete. Total RBTs uploaded: ${count}`);
}

main().catch(err => console.error("❌ Unexpected error:", err));
