import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUTPUT_PATH = resolve(
  process.cwd(),
  "src/features/rail-dashboard/data/rail-data.json",
);

function mulberry32(seed) {
  let t = seed;
  return function random() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(20260327);

const trainNames = [
  "Northline Express",
  "Delta Commuter",
  "Harbor Intercity",
  "Metro Link",
  "East Freight",
  "Sunset Regional",
  "Alpine Express",
  "Coastal Rapid",
  "Urban Transit",
  "Industrial Freight",
  "Highland Connector",
  "Riverline Shuttle",
  "Pacific Cargo",
  "Golden Arrow",
  "Summit Rail",
  "Valley Intermodal",
  "Central Commuter",
  "Blue Horizon",
  "Pioneer Freight",
  "Aurora Line",
];

const FIXED_CARRIAGE_LAYOUT = ["Head", "Middle", "Middle", "Middle", "Tail"];
const systems = ["Brakes", "HVAC", "Doors", "Power", "Network"];
const priorities = ["high", "medium", "low"];
const statuses = ["open", "in-progress", "closed"];
const priorityWeight = [0.28, 0.47, 0.25];
const statusWeight = [0.58, 0.27, 0.15];
const ISSUE_COUNT_PER_CARRIAGE = { min: 3, max: 8 };

const titleBySystem = {
  Brakes: [
    "Brake Pressure Drift Detected",
    "Disc Wear Threshold Exceeded",
    "Regenerative Brake Mismatch",
  ],
  HVAC: [
    "Cabin Temperature Oscillation",
    "Compressor Cycle Instability",
    "Airflow Distribution Imbalance",
  ],
  Doors: [
    "Door Actuator Response Delay",
    "Door Lock Sensor Mismatch",
    "Emergency Release Calibration Error",
  ],
  Power: [
    "Auxiliary Power Voltage Sag",
    "Inverter Thermal Drift",
    "Battery Module Degradation",
  ],
  Network: [
    "Telemetry Packet Loss Spike",
    "Onboard Gateway Timeout",
    "Train Control Link Interruption",
  ],
};

const assignees = [
  ["Linh Tran", "LT", "bg-cyan-500/80"],
  ["Minh Le", "ML", "bg-fuchsia-500/80"],
  ["Bao Vu", "BV", "bg-orange-500/80"],
  ["Gia Nguyen", "GN", "bg-emerald-500/80"],
  ["Phuc Do", "PD", "bg-indigo-500/80"],
  ["Nhi Dang", "ND", "bg-teal-500/80"],
  ["Sofia Martinez", "SM", "bg-rose-500/80"],
  ["Alex Chen", "AC", "bg-lime-500/80"],
  ["Raj Kumar", "RK", "bg-amber-500/80"],
  ["Emma Wilson", "EW", "bg-purple-500/80"],
];

function weightedPick(items, weights) {
  const r = random();
  let cumulative = 0;
  for (let i = 0; i < items.length; i += 1) {
    cumulative += weights[i];
    if (r <= cumulative) return items[i];
  }
  return items[items.length - 1];
}

function randomInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function pick(array) {
  return array[randomInt(0, array.length - 1)];
}

function toDateString(offsetDays) {
  const start = new Date("2026-02-01T00:00:00Z");
  const date = new Date(start);
  date.setUTCDate(start.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function buildDescription({ trainId, carriageId, system, title, status, priority }) {
  const impact = {
    high: "Risk of service interruption is elevated if not mitigated within the next cycle.",
    medium: "Operational stability is currently acceptable but trending outside baseline tolerance.",
    low: "No immediate safety impact observed, but the anomaly should be tracked for recurrence.",
  };

  const action = {
    open: "Recommended action: dispatch on-site diagnostics and verify subsystem calibration.",
    "in-progress": "Current action: maintenance team is running staged verification and component replacement.",
    closed: "Resolution note: issue was mitigated and post-fix telemetry returned to nominal range.",
  };

  return `${title} observed on ${trainId}/${carriageId} (${system}). Telemetry indicates sustained deviation across multiple sampling windows. ${impact[priority]} ${action[status]}`;
}

let issueSequence = 1001;

const trains = trainNames.map((name, index) => {
  const id = `T${String(index + 1).padStart(2, "0")}`;
  return {
    id,
    name,
    status: "healthy",
    openIssues: 0,
    efficiency: 96,
    healthyCarriages: 0,
  };
});

const carriagesByTrain = {};
const issues = [];

for (const train of trains) {
  const carriages = [];

  for (let i = 1; i <= FIXED_CARRIAGE_LAYOUT.length; i += 1) {
    const carriageId = `C${String(i).padStart(2, "0")}`;
    const type = FIXED_CARRIAGE_LAYOUT[i - 1];

    const issueCount = randomInt(
      ISSUE_COUNT_PER_CARRIAGE.min,
      ISSUE_COUNT_PER_CARRIAGE.max,
    );
    let activeForCarriage = 0;

    for (let j = 0; j < issueCount; j += 1) {
      const system = pick(systems);
      const priority = weightedPick(priorities, priorityWeight);
      const status = weightedPick(statuses, statusWeight);

      if (status !== "closed") activeForCarriage += 1;

      const assigneeTuple = random() < 0.22 ? null : pick(assignees);
      const title = pick(titleBySystem[system]);
      const issueId = `ISS-${issueSequence}`;
      issueSequence += 1;

      issues.push({
        id: issueId,
        trainId: train.id,
        carriageId,
        system,
        title,
        description: buildDescription({
          trainId: train.id,
          carriageId,
          system,
          title,
          status,
          priority,
        }),
        priority,
        status,
        assignee: assigneeTuple
          ? { name: assigneeTuple[0], initials: assigneeTuple[1], color: assigneeTuple[2] }
          : null,
        date: toDateString(randomInt(0, 56)),
      });
    }

    let carriageStatus = "healthy";
    if (activeForCarriage >= 3) carriageStatus = "critical";
    else if (activeForCarriage >= 1) carriageStatus = "warning";

    carriages.push({ id: carriageId, type, status: carriageStatus, issues: activeForCarriage });
  }

  carriagesByTrain[train.id] = carriages;

  const openIssues = carriages.reduce((acc, c) => acc + c.issues, 0);
  const healthyCarriages = carriages.filter((c) => c.status === "healthy").length;
  const warningCarriages = carriages.filter((c) => c.status === "warning").length;
  const criticalCarriages = carriages.filter((c) => c.status === "critical").length;

  let trainStatus = "healthy";
  if (criticalCarriages >= 2 || openIssues >= 7) trainStatus = "critical";
  else if (warningCarriages >= 2 || openIssues >= 3) trainStatus = "warning";

  const efficiency = Math.max(70, 99 - warningCarriages * 3 - criticalCarriages * 7 - openIssues);

  train.status = trainStatus;
  train.openIssues = openIssues;
  train.healthyCarriages = healthyCarriages;
  train.efficiency = efficiency;
}

const output = {
  meta: {
    generatedAt: new Date().toISOString(),
    generator: "apps/app/scripts/generate-rail-data.mjs",
    version: 1,
  },
  trains,
  carriagesByTrain,
  issues,
  navLinks: [{ to: "/rail-dashboard", label: "Dashboard" }],
};

writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
console.log(`Generated rail data:\n- trains: ${trains.length}\n- issues: ${issues.length}\n- file: ${OUTPUT_PATH}`);
