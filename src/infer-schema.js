// src/infer-schema.js
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

// === point to YOUR downloaded key ===
const serviceAccount = require(path.resolve(
    __dirname,
    "../rbt-app-77196-firebase-adminsdk-fbsvc-e109c77d41.json"
));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "rbt-app-77196",
});

const db = admin.firestore();

const TYPE = (v) => {
    if (v === null) return "null";
    if (Array.isArray(v)) return "array";
    if (v instanceof admin.firestore.Timestamp) return "timestamp";
    if (v instanceof admin.firestore.GeoPoint) return "geopoint";
    if (v instanceof admin.firestore.DocumentReference) return "reference";
    if (Buffer.isBuffer(v)) return "bytes";
    if (typeof v === "object") return "map";
    return typeof v; // string, number, boolean
};

const mergeTypeSets = (a, b) => new Set([...(a || []), ...(b || [])]);

async function scanCollection(collPath, schema = {}) {
    const snap = await db.collection(collPath).get();

    for (const doc of snap.docs) {
        const data = doc.data();
        schema[collPath] ??= { count: 0, fields: {}, subcollections: new Set() };
        schema[collPath].count++;

        for (const [k, v] of Object.entries(data)) {
            const t = TYPE(v);
            const field =
                schema[collPath].fields[k] ?? { types: new Set(), examples: new Set(), present: 0 };
            field.types = mergeTypeSets(field.types, [t]);
            field.present++;
            if (field.examples.size < 3) {
                field.examples.add(
                    t === "map" || t === "array" ? JSON.stringify(v).slice(0, 200) : String(v).slice(0, 200)
                );
            }
            schema[collPath].fields[k] = field;
        }

        // find subcollections
        const subs = await doc.ref.listCollections();
        for (const sc of subs) {
            schema[collPath].subcollections.add(`${collPath}/${doc.id}/${sc.id}`);
        }
    }

    // recurse into subcollections
    for (const scPath of schema[collPath].subcollections) {
        await scanCollection(scPath, schema);
    }
    return schema;
}

function toPrintable(schema) {
    const out = {};
    for (const [coll, def] of Object.entries(schema)) {
        out[coll] = {
            documents: def.count,
            fields: Object.fromEntries(
                Object.entries(def.fields).map(([k, f]) => [
                    k,
                    {
                        types: [...f.types],
                        required: f.present === def.count,
                        exampleValues: [...f.examples],
                    },
                ])
            ),
            subcollections: [...def.subcollections],
        };
    }
    return out;
}

function suggestDDL(collPath, def) {
    const tableName = collPath.replace(/\//g, "__");
    const lines = [`CREATE TABLE ${tableName} (`, `  id VARCHAR(128) PRIMARY KEY,`];
    for (const [k, f] of Object.entries(def.fields)) {
        const types = [...f.types];
        let sql = "TEXT";
        if (types.length === 1) {
            switch (types[0]) {
                case "number": sql = "DOUBLE PRECISION"; break;
                case "boolean": sql = "BOOLEAN"; break;
                case "timestamp": sql = "TIMESTAMP"; break;
                case "geopoint": sql = "TEXT"; break; // or GEOGRAPHY(Point)
                case "array":
                case "map": sql = "JSON"; break;
                default: sql = "TEXT";
            }
        } else {
            sql = "JSON"; // mixed types -> safest
        }
        lines.push(`  "${k}" ${sql},`);
    }
    lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, "");
    lines.push(");");
    return lines.join("\n");
}

(async () => {
    try {
        const rootCollections = await db.listCollections();
        const schema = {};
        for (const c of rootCollections) {
            await scanCollection(c.id, schema);
        }

        const printable = toPrintable(schema);

        // write files to project root
        const outSchema = path.resolve(__dirname, "../schema.json");
        fs.writeFileSync(outSchema, JSON.stringify(printable, null, 2));

        let ddl = "-- Suggested DDL --\n";
        for (const [coll, def] of Object.entries(schema)) {
            ddl += suggestDDL(coll, def) + "\n\n";
        }
        const outDdl = path.resolve(__dirname, "../ddl.sql");
        fs.writeFileSync(outDdl, ddl);

        console.log(`Wrote ${outSchema}`);
        console.log(`Wrote ${outDdl}`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
