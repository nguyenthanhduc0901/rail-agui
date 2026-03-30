import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import crypto from "crypto";

export const dynamic = "force-dynamic";

interface PlanStepInput {
  id?: string;
  title: string;
  technicianId: string | null;
  estimatedHours: number;
  seqOrder: number;
}

interface SavePayload {
  issueId: string;
  planSteps: PlanStepInput[];
  mode?: "replace" | "append";
}

export async function POST(req: NextRequest) {
  const dbPath = path.resolve(process.cwd(), "..", "agent", "fleet.db");

  if (!fs.existsSync(dbPath)) {
    return NextResponse.json(
      { error: "fleet.db not found" },
      { status: 503 },
    );
  }

  let body: SavePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { issueId, planSteps, mode = "replace" } = body;

  if (!issueId || !Array.isArray(planSteps)) {
    return NextResponse.json(
      { error: "issueId and planSteps are required" },
      { status: 400 },
    );
  }

  try {
    const Database = (await import("better-sqlite3")).default;
    const db = new Database(dbPath, { readonly: false });

    // Verify the issue exists
    const issue = db.prepare("SELECT id FROM issues WHERE id = ?").get(issueId);
    if (!issue) {
      db.close();
      return NextResponse.json({ error: `Issue ${issueId} not found` }, { status: 404 });
    }

    // Replace mode: delete existing steps first. Append mode: keep existing steps.
    if (mode !== "append") {
      db.prepare("DELETE FROM plan_steps WHERE issue_id = ?").run(issueId);
    }

    const insert = db.prepare(
      `INSERT INTO plan_steps (id, issue_id, technician_id, seq_order, title, estimated_hours, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    );

    const insertMany = db.transaction((steps: PlanStepInput[]) => {
      for (const step of steps) {
        const id = step.id || crypto.randomUUID();
        insert.run(
          id,
          issueId,
          step.technicianId || null,
          step.seqOrder,
          step.title || "Untitled Step",
          step.estimatedHours || 0,
        );
      }
    });

    insertMany(planSteps);
    db.close();

    return NextResponse.json({ success: true, issueId, count: planSteps.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
