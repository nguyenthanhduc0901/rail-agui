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
  "Northline Express", "Delta Commuter", "Harbor Intercity", "Metro Link",
  "East Freight", "Sunset Regional", "Alpine Express", "Coastal Rapid",
  "Urban Transit", "Industrial Freight", "Highland Connector", "Riverline Shuttle",
  "Pacific Cargo", "Golden Arrow", "Summit Rail", "Valley Intermodal",
  "Central Commuter", "Blue Horizon", "Pioneer Freight", "Aurora Line",
];

const fleetTypes   = ["High-Speed", "Commuter", "Freight", "Regional", "Intercity"];
const locationPool = [
  "Route 1A – Northbound", "Route 2B – Southbound", "Route 3C – Eastbound",
  "Route 4A – Westbound",  "Central Station Hold",  "Northern Depot",
  "Southern Terminal",     "East Junction",         "West Freight Yard",
  "Maintenance Bay",
];

const carriageTypePool    = ["Passenger", "Cargo", "Service"];
const systemCategories    = ["Brakes", "HVAC", "Doors", "Power", "Network"];
const priorities          = ["high", "medium", "low"];
const statuses            = ["open", "in-progress", "closed"];
const priorityWeight      = [0.28, 0.47, 0.25];
const statusWeight        = [0.58, 0.27, 0.15];
const estimatedHoursPool  = [1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 4.5, 6.0, 8.0];

const titleBySystem = {
  Brakes:  ["Brake Pressure Drift Detected", "Disc Wear Threshold Exceeded", "Regenerative Brake Mismatch"],
  HVAC:    ["Cabin Temperature Oscillation", "Compressor Cycle Instability", "Airflow Distribution Imbalance"],
  Doors:   ["Door Actuator Response Delay", "Door Lock Sensor Mismatch", "Emergency Release Calibration Error"],
  Power:   ["Auxiliary Power Voltage Sag", "Inverter Thermal Drift", "Battery Module Degradation"],
  Network: ["Telemetry Packet Loss Spike", "Onboard Gateway Timeout", "Train Control Link Interruption"],
};

const technicians = [
  { id: "TECH-01", name: "Gia Nguyen",     initials: "GN", avatarColor: "bg-emerald-500/80", specialty: "Mechanics"      },
  { id: "TECH-02", name: "Nhi Dang",       initials: "ND", avatarColor: "bg-teal-500/80",    specialty: "Electronics"    },
  { id: "TECH-03", name: "Linh Tran",      initials: "LT", avatarColor: "bg-cyan-500/80",    specialty: "HVAC"           },
  { id: "TECH-04", name: "Minh Le",        initials: "ML", avatarColor: "bg-fuchsia-500/80", specialty: "Power Systems"  },
  { id: "TECH-05", name: "Bao Vu",         initials: "BV", avatarColor: "bg-orange-500/80",  specialty: "Brake Systems"  },
  { id: "TECH-06", name: "Phuc Do",        initials: "PD", avatarColor: "bg-indigo-500/80",  specialty: "Doors & Access" },
  { id: "TECH-07", name: "Sofia Martinez", initials: "SM", avatarColor: "bg-rose-500/80",    specialty: "Network"        },
  { id: "TECH-08", name: "Alex Chen",      initials: "AC", avatarColor: "bg-lime-500/80",    specialty: "Structural"     },
  { id: "TECH-09", name: "Raj Kumar",      initials: "RK", avatarColor: "bg-amber-500/80",   specialty: "Diagnostics"    },
  { id: "TECH-10", name: "Emma Wilson",    initials: "EW", avatarColor: "bg-purple-500/80",  specialty: "Safety Systems" },
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

function toISOTimestamp(offsetDays) {
  const start = new Date("2026-02-01T00:00:00Z");
  const date  = new Date(start);
  date.setUTCDate(start.getUTCDate() + offsetDays);
  date.setUTCHours(randomInt(6, 22), randomInt(0, 59), 0, 0);
  return date.toISOString();
}

function buildDescription({ trainId, carriageId, systemCategory, title, status, priority }) {
  const impact = {
    high:   "Risk of service interruption is elevated if not mitigated within the next cycle.",
    medium: "Operational stability is currently acceptable but trending outside baseline tolerance.",
    low:    "No immediate safety impact observed, but the anomaly should be tracked for recurrence.",
  };
  const action = {
    "open":        "Recommended action: dispatch on-site diagnostics and verify subsystem calibration.",
    "in-progress": "Current action: maintenance team is running staged verification and component replacement.",
    "closed":      "Resolution note: issue was mitigated and post-fix telemetry returned to nominal range.",
  };
  return `${title} observed on ${trainId}/${carriageId} (${systemCategory}). Telemetry indicates sustained deviation across multiple sampling windows. ${impact[priority]} ${action[status]}`;
}

let issueSequence = 1001;

const trains = trainNames.map((name, index) => {
  const id = `T${String(index + 1).padStart(2, "0")}`;
  return {
    id,
    name,
    fleetType:        pick(fleetTypes),
    operationalState: "in-service",
    healthStatus:     "healthy",
    currentLocation:  pick(locationPool),
    metrics: { openIssues: 0, efficiency: 96, totalCarriages: 0, healthyCarriages: 0 },
  };
});

const carriageMap = {};
const issues = [];

for (const train of trains) {
  const carriageCount = randomInt(5, 7);
  const carriages = [];

  for (let i = 1; i <= carriageCount; i += 1) {
    const carriageId = `C${String(i).padStart(2, "0")}-${train.id}`;
    const type = i === 1 ? "Head" : i === carriageCount ? "Power" : pick(carriageTypePool);
    const serialPrefix = { Head: "LOC", Power: "PWR", Cargo: "CGO", Service: "SRV" }[type] ?? "PAS";
    const serialNumber = `${serialPrefix}-${randomInt(1000, 9999)}-${String.fromCharCode(65 + randomInt(0, 3))}`;

    const issueCount = randomInt(0, 4);
    let activeForCarriage = 0;

    for (let j = 0; j < issueCount; j += 1) {
      const systemCategory = pick(systemCategories);
      const priority       = weightedPick(priorities, priorityWeight);
      const status         = weightedPick(statuses, statusWeight);

      if (status !== "closed") activeForCarriage += 1;

      const assigneeId    = random() < 0.22 ? null : pick(technicians).id;
      const title         = pick(titleBySystem[systemCategory]);
      const issueId       = `ISS-${issueSequence}`;
      issueSequence      += 1;

      const reportedOffset = randomInt(0, 50);
      const reportedAt     = toISOTimestamp(reportedOffset);
      let   scheduledDate  = null;
      if (status === "closed") {
        scheduledDate = toISOTimestamp(reportedOffset + randomInt(2, 7));
      } else if (random() < 0.6) {
        scheduledDate = toISOTimestamp(60 + randomInt(1, 14));
      }

      issues.push({
        id: issueId,
        trainId:        train.id,
        carriageId,
        systemCategory,
        title,
        description: buildDescription({ trainId: train.id, carriageId, systemCategory, title, status, priority }),
        priority,
        status,
        assigneeId,
        planning: {
          reportedAt,
          scheduledDate,
          estimatedHours: pick(estimatedHoursPool),
        },
      });
    }

    let healthStatus = "healthy";
    if (activeForCarriage >= 3)      healthStatus = "critical";
    else if (activeForCarriage >= 1) healthStatus = "warning";

    carriages.push({ id: carriageId, serialNumber, sequence: i, type, healthStatus, openIssuesCount: activeForCarriage });
  }

  carriageMap[train.id] = carriages;

  const openIssues       = carriages.reduce((acc, c) => acc + c.openIssuesCount, 0);
  const healthyCarriages = carriages.filter((c) => c.healthStatus === "healthy").length;
  const warningCarriages = carriages.filter((c) => c.healthStatus === "warning").length;
  const criticalCarriages= carriages.filter((c) => c.healthStatus === "critical").length;

  let healthStatus = "healthy";
  if (criticalCarriages >= 2 || openIssues >= 7) healthStatus = "critical";
  else if (warningCarriages >= 2 || openIssues >= 3) healthStatus = "warning";

  const efficiency = Math.max(70, 99 - warningCarriages * 3 - criticalCarriages * 7 - openIssues);

  train.healthStatus         = healthStatus;
  train.operationalState     = healthStatus === "critical" ? "maintenance" : train.operationalState;
  train.metrics.openIssues   = openIssues;
  train.metrics.efficiency   = efficiency;
  train.metrics.totalCarriages   = carriageCount;
  train.metrics.healthyCarriages = healthyCarriages;
}

const output = {
  meta: {
    generatedAt: new Date().toISOString(),
    generator:   "apps/app/scripts/generate-rail-data.mjs",
    version:     2.0,
  },
  technicians,
  trains,
  carriages: carriageMap,
  issues,
};

writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
console.log(`Generated rail data v2:\n- trains: ${trains.length}\n- issues: ${issues.length}\n- file: ${OUTPUT_PATH}`);
