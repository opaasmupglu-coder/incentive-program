import { createClient } from "@libsql/client";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

process.loadEnvFile(".env.local");

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function main() {
  console.log("Connecting to database...");

  // 1. Verify before state
  const beforeOffices = (await db.execute("SELECT * FROM offices WHERE code = 'NF12'")).rows;
  console.log("Current NF12 in db:", beforeOffices.length);

  // Office details for OPA
  const officeData = {
    code: "NF12",
    short: "OPA",
    full_name: "Office of the Provincial Administrator (OPA)",
    track: "Non-frontline",
    focal_name: "Jeffrey P. Racca",
    focal_position: "Administrative Aide I",
    notes: "Focal name from TABTV — please verify.",
    sort_order: 28,
  };

  // FeedbackV3 extracted monthly data for OPA
  // Month 1 to 10:
  // forms: [40, 23, 63, 13, 33, 39, 39, 18, 38, 33]
  // online: [0, 0, 1, 0, 3, 2, 1, 0, 0, 2]
  // physical: [40, 23, 62, 13, 30, 37, 38, 18, 38, 31]
  // visitors: [49, 37, 63, 39, 35, 44, 39, 28, 41, 35]
  // gpr: [100, 100, 100, 100, 99.66, 100, 100, 100, 100, 100]
  // negatives: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0]
  // suggestions: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  // acted: [null, null, null, null, 1, null, null, null, null, null]
  const monthsData = [
    { month: 1, forms: 40, online: 0, physical: 40, visitors: 49, gpr: 100.0, neg: 0, sug: 0, acted: null },
    { month: 2, forms: 23, online: 0, physical: 23, visitors: 37, gpr: 100.0, neg: 0, sug: 0, acted: null },
    { month: 3, forms: 63, online: 1, physical: 62, visitors: 63, gpr: 100.0, neg: 0, sug: 0, acted: null },
    { month: 4, forms: 13, online: 0, physical: 13, visitors: 39, gpr: 100.0, neg: 0, sug: 0, acted: null },
    { month: 5, forms: 33, online: 3, physical: 30, visitors: 35, gpr: 99.66, neg: 1, sug: 0, acted: 1 },
    { month: 6, forms: 39, online: 2, physical: 37, visitors: 44, gpr: 100.0, neg: 0, sug: 0, acted: null },
    { month: 7, forms: 39, online: 1, physical: 38, visitors: 39, gpr: 100.0, neg: 0, sug: 0, acted: null },
    { month: 8, forms: 18, online: 0, physical: 18, visitors: 28, gpr: 100.0, neg: 0, sug: 0, acted: null },
    { month: 9, forms: 38, online: 0, physical: 38, visitors: 41, gpr: 100.0, neg: 0, sug: 0, acted: null },
    { month: 10, forms: 33, online: 2, physical: 31, visitors: 35, gpr: 100.0, neg: 0, sug: 0, acted: null },
  ];

  const now = new Date().toISOString();
  const importId = `feedback-opa-nfl-${Date.now()}`;

  const statements: { sql: string; args: any[] }[] = [];

  // 1. Upsert office
  statements.push({
    sql: `INSERT INTO offices (code, short, full_name, track, focal_name, focal_position, notes, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(code) DO UPDATE SET
            short = excluded.short,
            full_name = excluded.full_name,
            track = excluded.track,
            focal_name = excluded.focal_name,
            focal_position = excluded.focal_position,
            notes = excluded.notes,
            sort_order = excluded.sort_order`,
    args: [
      officeData.code,
      officeData.short,
      officeData.full_name,
      officeData.track,
      officeData.focal_name,
      officeData.focal_position,
      officeData.notes,
      officeData.sort_order,
    ],
  });

  // 2. Insert monthly data
  for (const m of monthsData) {
    const plans = m.neg + m.sug;

    // Collection
    statements.push({
      sql: `INSERT INTO monthly_collection (office_code, month, forms, clients)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(office_code, month) DO UPDATE SET forms = excluded.forms, clients = excluded.clients`,
      args: [officeData.code, m.month, m.forms, m.visitors],
    });

    // GPR
    statements.push({
      sql: `INSERT INTO monthly_gpr (office_code, month, gpr)
            VALUES (?, ?, ?)
            ON CONFLICT(office_code, month) DO UPDATE SET gpr = excluded.gpr`,
      args: [officeData.code, m.month, m.gpr],
    });

    // Resolution
    statements.push({
      sql: `INSERT INTO monthly_resolution (office_code, month, acted, plans)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(office_code, month) DO UPDATE SET acted = excluded.acted, plans = excluded.plans`,
      args: [officeData.code, m.month, m.acted, plans],
    });

    // Timeliness basis
    statements.push({
      sql: `INSERT INTO monthly_timeliness_basis (office_code, month, feedback_count)
            VALUES (?, ?, ?)
            ON CONFLICT(office_code, month) DO UPDATE SET feedback_count = excluded.feedback_count`,
      args: [officeData.code, m.month, plans],
    });

    // Feedback source audit
    statements.push({
      sql: `INSERT INTO monthly_feedback_source (office_code, year, month, source_office_code, total_forms, online_forms, physical_forms, visitors, general_average_rating, collection_rate_at_import, import_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(office_code, year, month) DO UPDATE SET
              source_office_code = excluded.source_office_code,
              total_forms = excluded.total_forms,
              online_forms = excluded.online_forms,
              physical_forms = excluded.physical_forms,
              visitors = excluded.visitors,
              general_average_rating = excluded.general_average_rating,
              import_id = excluded.import_id`,
      args: [
        officeData.code,
        2026,
        m.month,
        "OPA",
        m.forms,
        m.online,
        m.physical,
        m.visitors,
        m.gpr,
        null,
        importId,
      ],
    });

    // Actionable feedback audit
    statements.push({
      sql: `INSERT INTO actionable_feedback_imports (office_code, year, month, negative_comments, suggestions, total, source_office_codes, source_sha256, imported_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(office_code, year, month) DO UPDATE SET
              negative_comments = excluded.negative_comments,
              suggestions = excluded.suggestions,
              total = excluded.total,
              source_office_codes = excluded.source_office_codes,
              imported_at = excluded.imported_at`,
      args: [
        officeData.code,
        2026,
        m.month,
        m.neg,
        m.sug,
        plans,
        "OPA",
        "feedbackV3-direct",
        now,
      ],
    });
  }

  console.log(`Executing batch of ${statements.length} statements...`);
  await db.batch(statements, "write");
  console.log("Batch successfully executed.");

  // Verify inserted rows
  const afterOffice = await db.execute({
    sql: "SELECT * FROM offices WHERE code = ?",
    args: [officeData.code],
  });
  console.log("Verified office in db:", afterOffice.rows[0]);

  const afterColl = await db.execute({
    sql: "SELECT COUNT(*) as c FROM monthly_collection WHERE office_code = ?",
    args: [officeData.code],
  });
  const afterGpr = await db.execute({
    sql: "SELECT COUNT(*) as c FROM monthly_gpr WHERE office_code = ?",
    args: [officeData.code],
  });
  const afterRes = await db.execute({
    sql: "SELECT COUNT(*) as c FROM monthly_resolution WHERE office_code = ?",
    args: [officeData.code],
  });
  console.log(`Verified counts for ${officeData.code}: collection=${afterColl.rows[0].c}, gpr=${afterGpr.rows[0].c}, resolution=${afterRes.rows[0].c}`);

  db.close();
}

main().catch((err) => {
  console.error("Import failed:", err);
  db.close();
  process.exit(1);
});
