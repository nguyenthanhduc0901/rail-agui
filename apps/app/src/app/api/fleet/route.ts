import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

// Tailwind avatar colours — matches rail-data.json order (TECH-01…10)
const AVATAR_COLORS = [
  "bg-emerald-500/80", "bg-teal-500/80",    "bg-cyan-500/80",    "bg-fuchsia-500/80",
  "bg-orange-500/80",  "bg-indigo-500/80",  "bg-rose-500/80",    "bg-lime-500/80",
  "bg-amber-500/80",   "bg-purple-500/80",
];

export async function GET() {
  const dbPath = path.resolve(process.cwd(), "..", "agent", "fleet.db");

  if (!fs.existsSync(dbPath)) {
    return NextResponse.json(
      { error: "fleet.db not found — run `python build_db.py` inside apps/agent first" },
      { status: 503 },
    );
  }

  try {
    // Dynamic import keeps the native addon out of the compilation graph
    const Database = (await import("better-sqlite3")).default;
    const db = new Database(dbPath, { readonly: true });

    const trainRows = db.prepare("SELECT * FROM trains").all() as Record<string, unknown>[];
    const carriageRows = db
      .prepare("SELECT * FROM carriages ORDER BY sequence")
      .all() as Record<string, unknown>[];
    const techRows = db
      .prepare("SELECT id, name, specialty FROM technicians ORDER BY id")
      .all() as Record<string, unknown>[];
    const issueRows = db
      .prepare(
        "SELECT id, train_id, carriage_id, system_category, title, description, " +
          "priority, status, assignee_id, reported_at, scheduled_date, estimated_hours " +
          "FROM issues",
      )
      .all() as Record<string, unknown>[];
    const planStepRows = db
      .prepare(
        "SELECT id, plan_id, seq_order, issue_id, title, details, priority, status, " +
          "estimated_hours, assignee_id, assignee_name, created_at FROM plan_steps ORDER BY seq_order",
      )
      .all() as Record<string, unknown>[];

    db.close();

    // ── Issues ─────────────────────────────────────────────────────────────
    const issues = issueRows.map((i) => ({
      id:             i.id,
      trainId:        i.train_id,
      carriageId:     i.carriage_id,
      systemCategory: i.system_category,
      title:          i.title,
      description:    i.description,
      priority:       i.priority,
      status:         i.status,
      assigneeId:     i.assignee_id ?? null,
      planning: {
        reportedAt:     i.reported_at,
        scheduledDate:  i.scheduled_date ?? null,
        estimatedHours: i.estimated_hours,
      },
    }));

    // ── Carriage openIssuesCount ────────────────────────────────────────────
    const openByCarriage: Record<string, number> = {};
    const openByTrain: Record<string, number> = {};
    for (const iss of issues) {
      if (iss.status !== "closed") {
        const cid = iss.carriageId as string;
        openByCarriage[cid] = (openByCarriage[cid] ?? 0) + 1;
        const tid = iss.trainId as string;
        openByTrain[tid] = (openByTrain[tid] ?? 0) + 1;
      }
    }

    // ── Carriages grouped by trainId ───────────────────────────────────────
    const carriages: Record<string, unknown[]> = {};
    for (const c of carriageRows) {
      const tid = c.train_id as string;
      if (!carriages[tid]) carriages[tid] = [];
      carriages[tid].push({
        id:             c.id,
        serialNumber:   c.serial_number,
        sequence:       c.sequence,
        type:           c.type,
        healthStatus:   c.health_status,
        openIssuesCount: openByCarriage[c.id as string] ?? 0,
      });
    }

    // ── Trains ─────────────────────────────────────────────────────────────
    const trains = trainRows.map((t) => ({
      id:               t.id,
      name:             t.name,
      fleetType:        t.fleet_type,
      operationalState: t.operational_state,
      healthStatus:     t.health_status,
      currentLocation:  t.current_location,
      metrics: {
        openIssues:      openByTrain[t.id as string] ?? 0,  // computed fresh from issues
        efficiency:      t.efficiency,
        totalCarriages:  t.total_carriages,
        healthyCarriages: t.healthy_carriages,
      },
    }));

    // ── Technicians (compute display fields not stored in DB) ───────────────
    const technicians = techRows.map((t, idx) => ({
      id:          t.id,
      name:        t.name,
      specialty:   t.specialty,
      initials:    (t.name as string)
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 3),
      avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
    }));

    // ── Plan steps ─────────────────────────────────────────────────────────
    const planSteps = planStepRows.map((s) => ({
      id:             s.id,
      planId:         s.plan_id,
      order:          s.seq_order,
      issueId:        s.issue_id ?? null,
      title:          s.title,
      details:        s.details ?? null,
      priority:       s.priority,
      status:         s.status,
      estimatedHours: s.estimated_hours,
      assigneeId:     s.assignee_id ?? "",
      assigneeName:   s.assignee_name ?? "Unassigned",
      createdAt:      s.created_at,
    }));

    return NextResponse.json({ trains, carriages, technicians, issues, planSteps });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
