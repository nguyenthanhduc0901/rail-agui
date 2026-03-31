import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

// Tailwind avatar colours â€” matches technicians ORDER BY id (TECH-01â€¦10)
const AVATAR_COLORS = [
  "bg-emerald-500/80", "bg-teal-500/80",    "bg-cyan-500/80",    "bg-fuchsia-500/80",
  "bg-orange-500/80",  "bg-indigo-500/80",  "bg-rose-500/80",    "bg-lime-500/80",
  "bg-amber-500/80",   "bg-purple-500/80",
];

export async function GET() {
  const dbPath = path.resolve(process.cwd(), "..", "agent", "fleet.db");

  if (!fs.existsSync(dbPath)) {
    return NextResponse.json(
      { error: "fleet.db not found â€” start the agent once to auto-create it" },
      { status: 503 },
    );
  }

  try {
    const Database = (await import("better-sqlite3")).default;
    const db = new Database(dbPath, { readonly: true });

    const trainRows = db.prepare("SELECT * FROM trains").all() as Record<string, unknown>[];
    const carriageRows = db
      .prepare("SELECT * FROM carriages ORDER BY train_id, sequence")
      .all() as Record<string, unknown>[];
    const techRows = db
      .prepare("SELECT id, name, specialty FROM technicians ORDER BY id")
      .all() as Record<string, unknown>[];
    // JOIN carriages so we can derive train_id per issue
    const issueRows = db
      .prepare(
        "SELECT i.id, c.train_id, i.carriage_id, i.system_category, i.title, " +
          "i.description, i.priority, i.status, i.reported_at, i.scheduled_date, " +
          "i.total_estimated_hours " +
          "FROM issues i JOIN carriages c ON c.id = i.carriage_id",
      )
      .all() as Record<string, unknown>[];
    // JOIN technicians so we can resolve technician_name without a second query
    const planStepRows = db
      .prepare(
        "SELECT ps.id, ps.issue_id, ps.technician_id, ps.seq_order, ps.title, " +
          "ps.estimated_hours, ps.status, t.name AS technician_name " +
          "FROM plan_steps ps LEFT JOIN technicians t ON t.id = ps.technician_id " +
          "ORDER BY ps.seq_order",
      )
      .all() as Record<string, unknown>[];

    db.close();

    const issues = issueRows.map((i) => ({
      id:                  i.id,
      trainId:             i.train_id,
      carriageId:          i.carriage_id,
      systemCategory:      i.system_category,
      title:               i.title,
      description:         i.description,
      priority:            i.priority,
      status:              i.status,
      reportedAt:          i.reported_at,
      scheduledDate:       i.scheduled_date ?? null,
      totalEstimatedHours: i.total_estimated_hours,
    }));

    const planStepsByIssue: Record<string, Array<Record<string, unknown>>> = {};
    for (const s of planStepRows) {
      const issueId = s.issue_id as string;
      if (!planStepsByIssue[issueId]) planStepsByIssue[issueId] = [];
      planStepsByIssue[issueId].push({
        id:             s.id,
        issueId,
        technicianId:   s.technician_id ?? null,
        technicianName: (s.technician_name as string | null) ?? "Unassigned",
        seqOrder:       s.seq_order,
        title:          s.title,
        estimatedHours: s.estimated_hours,
        status:         s.status,           // pending | doing | done
      });
    }

    // Issues WITH action plans
    const issuesWithPlans = issues.map((i) => ({
      ...i,
      planSteps: planStepsByIssue[i.id as string] ?? [],
    }));

    // â”€â”€ Per-carriage issue stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const openByCarriage:   Record<string, number>  = {};
    const critByCarriage:   Record<string, boolean> = {};
    const highByCarriage:   Record<string, boolean> = {};
    for (const iss of issuesWithPlans) {
      const cid = iss.carriageId as string;
      if (iss.status !== "closed" && iss.status !== "resolved") {
        openByCarriage[cid] = (openByCarriage[cid] ?? 0) + 1;
        if      (iss.priority === "critical") critByCarriage[cid] = true;
        else if (iss.priority === "high")     highByCarriage[cid] = true;
      }
    }

    // â”€â”€ Carriages grouped by trainId â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const carriages: Record<string, unknown[]> = {};
    for (const c of carriageRows) {
      const tid = c.train_id as string;
      if (!carriages[tid]) carriages[tid] = [];
      const cid = c.id as string;
      const healthStatus =
        critByCarriage[cid] ? "critical" :
        highByCarriage[cid] ? "warning"  : "healthy";
      carriages[tid].push({
        id:              cid,
        serialNumber:    c.serial_number,
        sequence:        c.sequence,
        type:            c.type,
        healthStatus,
        openIssuesCount: openByCarriage[cid] ?? 0,
      });
    }

    // â”€â”€ Trains â€” compute health / efficiency from carriages & issues â”€â”€â”€â”€â”€â”€â”€â”€
    const trains = trainRows.map((t) => {
      const tid  = t.id as string;
      const cars = (carriages[tid] ?? []) as Array<{ healthStatus: string; openIssuesCount: number }>;
      const openIssues       = cars.reduce((s, c) => s + c.openIssuesCount, 0);
      const criticalCars     = cars.filter((c) => c.healthStatus === "critical").length;
      const warningCars      = cars.filter((c) => c.healthStatus === "warning").length;
      const healthyCarriages = cars.filter((c) => c.healthStatus === "healthy").length;
      const healthStatus     =
        criticalCars >= 2 || openIssues >= 7 ? "critical" :
        warningCars  >= 2 || openIssues >= 3 ? "warning"  : "healthy";
      const efficiency = Math.max(70, 99 - warningCars * 3 - criticalCars * 7 - openIssues);
      return {
        id:               tid,
        name:             t.name,
        fleetType:        t.fleet_type,
        operationalState: t.operational_state,
        healthStatus,
        currentLocation:  t.current_location,
        metrics: {
          openIssues,
          efficiency,
          totalCarriages:   cars.length,
          healthyCarriages,
        },
      };
    });

    // â”€â”€ Technicians â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€ Plan steps â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const planSteps = planStepRows.map((s) => ({
      id:             s.id,
      issueId:        s.issue_id ?? null,
      technicianId:   s.technician_id ?? null,
      technicianName: (s.technician_name as string | null) ?? "Unassigned",
      order:          s.seq_order,
      title:          s.title,
      details:        s.details ?? null,
      estimatedHours: s.estimated_hours,
      status:         s.status,           // pending | doing | done
    }));

    return NextResponse.json({ trains, carriages, technicians, issues: issuesWithPlans, planSteps });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
