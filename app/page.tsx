"use client";

import { useMemo, useState } from "react";

type FamilyId = "procedural" | "causal" | "social";
type ConditionId = "none" | "text" | "behavior" | "hybrid";
type BudgetId = "one" | "partial" | "full" | "multi" | "failed";
type RunStatus = "queued" | "running" | "paused" | "complete";
type TabId = "lab" | "runs" | "analysis" | "protocol";

type MetricSet = {
  accuracy: number;
  generalization: number;
  ruleRecovery: number;
  social: number;
};

type Run = MetricSet & {
  id: string;
  status: RunStatus;
  familyId: FamilyId;
  conditionId: ConditionId;
  budgetId: BudgetId;
  agent: string;
  seed: number;
  batch: number;
};

type TaskFamily = {
  id: FamilyId;
  label: string;
  shorthand: string;
  focus: string;
  transfer: string;
  objects: Record<number, string>;
  blockers: number[];
  hazard: number[];
  path: number[];
  events: Array<{
    action: string;
    signal: string;
    transfer: string;
  }>;
  style: {
    accent: string;
    soft: string;
    border: string;
    text: string;
  };
};

type ClassicGameBenchmark = {
  name: string;
  familyIds: FamilyId[];
  trainMaps: number;
  evalMaps: number;
  demoClips: number;
  targetInference: string;
};

type ReadinessStatus = "planned" | "building" | "ready";

type ReadinessItem = {
  id: string;
  label: string;
  owner: string;
  status: ReadinessStatus;
  detail: string;
};

const worldIndexes = Array.from({ length: 49 }, (_, index) => index);

const taskFamilies: TaskFamily[] = [
  {
    id: "procedural",
    label: "Procedural Goal",
    shorthand: "Key before gate",
    focus: "Goal inference from action order",
    transfer: "New map: collect the key, unlock the gate, then exit.",
    objects: {
      0: "A",
      6: "K",
      20: "D",
      48: "G",
    },
    blockers: [9, 10, 17, 24, 31, 38],
    hazard: [],
    path: [0, 1, 2, 3, 4, 5, 6, 13, 20, 27, 34, 41, 48],
    events: [
      {
        action: "Actor starts away from the obvious exit lane.",
        signal: "The short route is not sufficient.",
        transfer: "Search for a prerequisite object.",
      },
      {
        action: "Actor walks to the key before approaching the door.",
        signal: "Key pickup has priority over distance.",
        transfer: "Visit key-like affordances early.",
      },
      {
        action: "Actor crosses the door tile only after carrying the key.",
        signal: "Door is gated by inventory state.",
        transfer: "Avoid locked doors until the dependency is satisfied.",
      },
      {
        action: "Actor goes straight to the goal after opening the door.",
        signal: "The final objective is exit completion.",
        transfer: "Complete the route after the prerequisite chain.",
      },
    ],
    style: {
      accent: "bg-emerald-600",
      soft: "bg-emerald-50",
      border: "border-emerald-300",
      text: "text-emerald-700",
    },
  },
  {
    id: "causal",
    label: "Causal Affordance",
    shorthand: "Switch builds bridge",
    focus: "Rule learning from success and failure",
    transfer: "New room: activate the switch before crossing water.",
    objects: {
      21: "L",
      22: "B",
      42: "A",
      44: "G",
    },
    blockers: [3, 4, 5, 18, 25, 32, 39],
    hazard: [29, 36, 43],
    path: [42, 35, 28, 21, 22, 23, 30, 37, 44],
    events: [
      {
        action: "Actor rejects the direct crossing over water.",
        signal: "The visible route is unsafe.",
        transfer: "Model terrain as conditionally traversable.",
      },
      {
        action: "Actor detours to a lever tile.",
        signal: "Lever has causal power over the map.",
        transfer: "Try switch-like objects before blocked crossings.",
      },
      {
        action: "Bridge tile becomes usable after lever contact.",
        signal: "Affordance changes after intervention.",
        transfer: "Track state changes caused by actions.",
      },
      {
        action: "Actor uses the new bridge to reach the goal.",
        signal: "The intervention was instrumental.",
        transfer: "Prefer causal plans over memorized routes.",
      },
    ],
    style: {
      accent: "bg-amber-500",
      soft: "bg-amber-50",
      border: "border-amber-300",
      text: "text-amber-700",
    },
  },
  {
    id: "social",
    label: "Social Convention",
    shorthand: "Respect ownership",
    focus: "Norm inference from interaction",
    transfer: "New village: ask the owner before taking shared resources.",
    objects: {
      6: "A",
      27: "C",
      28: "P",
      34: "O",
      42: "G",
    },
    blockers: [2, 9, 16, 23, 30, 37],
    hazard: [19, 26],
    path: [6, 13, 20, 27, 28, 35, 42],
    events: [
      {
        action: "Actor pauses at the chest instead of taking it.",
        signal: "Object access has a social precondition.",
        transfer: "Detect ownership-like constraints.",
      },
      {
        action: "Actor moves toward the nearby partner.",
        signal: "Partner interaction can grant permission.",
        transfer: "Resolve ambiguous ownership through interaction.",
      },
      {
        action: "Partner steps aside after the interaction.",
        signal: "Consent changes the acceptable action set.",
        transfer: "Treat social feedback as task state.",
      },
      {
        action: "Actor exits without stealing from the owner tile.",
        signal: "Success includes convention compliance.",
        transfer: "Optimize reward and norm satisfaction together.",
      },
    ],
    style: {
      accent: "bg-rose-500",
      soft: "bg-rose-50",
      border: "border-rose-300",
      text: "text-rose-700",
    },
  },
];

const promptConditions: Array<{
  id: ConditionId;
  label: string;
  summary: string;
}> = [
  { id: "none", label: "No prompt", summary: "Task instance only" },
  { id: "text", label: "Text", summary: "Natural-language instruction" },
  { id: "behavior", label: "Behavior", summary: "Observed trajectory" },
  { id: "hybrid", label: "Text + behavior", summary: "Instruction plus demo" },
];

const demoBudgets: Array<{
  id: BudgetId;
  label: string;
  short: string;
}> = [
  { id: "one", label: "One action", short: "1 act" },
  { id: "partial", label: "Partial trajectory", short: "partial" },
  { id: "full", label: "Full success", short: "success" },
  { id: "multi", label: "Multiple demos", short: "multi" },
  { id: "failed", label: "Failed demo", short: "fail" },
];

const agents = ["BC-Transformer", "VLM-Planner", "World-Model RL", "GameGPT-Agent"];

const classicGameBenchmarks: ClassicGameBenchmark[] = [
  {
    name: "Pong-like Rally",
    familyIds: ["procedural"],
    trainMaps: 40,
    evalMaps: 16,
    demoClips: 180,
    targetInference: "turn-taking, pursuit, and defensive positioning",
  },
  {
    name: "Breakout-like Bricks",
    familyIds: ["causal"],
    trainMaps: 56,
    evalMaps: 20,
    demoClips: 220,
    targetInference: "bounce rules and destructible affordances",
  },
  {
    name: "Snake-like Growth",
    familyIds: ["procedural"],
    trainMaps: 64,
    evalMaps: 24,
    demoClips: 260,
    targetInference: "self-avoidance, collection order, and route planning",
  },
  {
    name: "Maze Chase",
    familyIds: ["causal"],
    trainMaps: 72,
    evalMaps: 28,
    demoClips: 300,
    targetInference: "enemy avoidance and temporary power states",
  },
  {
    name: "Road Crossing",
    familyIds: ["causal"],
    trainMaps: 60,
    evalMaps: 24,
    demoClips: 240,
    targetInference: "timing windows and moving hazards",
  },
  {
    name: "Crate Pusher",
    familyIds: ["procedural", "causal"],
    trainMaps: 80,
    evalMaps: 32,
    demoClips: 320,
    targetInference: "irreversible moves and spatial dependencies",
  },
  {
    name: "Bomb Maze",
    familyIds: ["causal", "social"],
    trainMaps: 64,
    evalMaps: 24,
    demoClips: 280,
    targetInference: "delayed effects, blast zones, and teammate safety",
  },
  {
    name: "Builder Swarm",
    familyIds: ["causal", "social"],
    trainMaps: 56,
    evalMaps: 20,
    demoClips: 220,
    targetInference: "role assignment and cooperative rescue",
  },
  {
    name: "Falling Blocks",
    familyIds: ["procedural"],
    trainMaps: 48,
    evalMaps: 16,
    demoClips: 180,
    targetInference: "placement conventions and long-term board control",
  },
  {
    name: "Invader Defense",
    familyIds: ["procedural", "causal"],
    trainMaps: 52,
    evalMaps: 20,
    demoClips: 210,
    targetInference: "cover use, projectile timing, and target priority",
  },
  {
    name: "Platform Rescue",
    familyIds: ["causal"],
    trainMaps: 56,
    evalMaps: 20,
    demoClips: 220,
    targetInference: "ladder, jump, barrel, and rescue affordances",
  },
  {
    name: "Dungeon Key Quest",
    familyIds: ["procedural", "social"],
    trainMaps: 84,
    evalMaps: 32,
    demoClips: 360,
    targetInference: "keys, locks, trading, and ownership conventions",
  },
];

const classicTotals = classicGameBenchmarks.reduce(
  (totals, game) => ({
    games: totals.games + 1,
    levels: totals.levels + game.trainMaps + game.evalMaps,
    heldOut: totals.heldOut + game.evalMaps,
    demos: totals.demos + game.demoClips,
  }),
  { games: 0, levels: 0, heldOut: 0, demos: 0 },
);

const initialReadiness: ReadinessItem[] = [
  {
    id: "envs",
    label: "Game environments",
    owner: "Benchmark",
    status: "building",
    detail: "Grid-world prototypes for procedural, causal, and social tasks.",
  },
  {
    id: "demos",
    label: "Behavior demos",
    owner: "Data",
    status: "planned",
    detail: "Trajectory schema, success clips, partial clips, and failed clips.",
  },
  {
    id: "agents",
    label: "Agent adapters",
    owner: "Evaluation",
    status: "planned",
    detail: "Adapters for VLM planners, imitation baselines, and RL agents.",
  },
  {
    id: "metrics",
    label: "Metrics",
    owner: "Analysis",
    status: "building",
    detail: "Goal completion, transfer, rule recovery, and norm compliance.",
  },
  {
    id: "paper",
    label: "Paper positioning",
    owner: "Writing",
    status: "ready",
    detail: "Claim benchmark contribution, not invention of demonstrations.",
  },
];

const initialRuns: Run[] = [
  {
    id: "run-003",
    status: "complete",
    familyId: "social",
    conditionId: "behavior",
    budgetId: "full",
    agent: "VLM-Planner",
    seed: 19,
    batch: 160,
    accuracy: 72,
    generalization: 68,
    ruleRecovery: 66,
    social: 78,
  },
  {
    id: "run-002",
    status: "running",
    familyId: "causal",
    conditionId: "hybrid",
    budgetId: "failed",
    agent: "World-Model RL",
    seed: 11,
    batch: 240,
    accuracy: 81,
    generalization: 75,
    ruleRecovery: 86,
    social: 61,
  },
  {
    id: "run-001",
    status: "queued",
    familyId: "procedural",
    conditionId: "text",
    budgetId: "partial",
    agent: "BC-Transformer",
    seed: 7,
    batch: 120,
    accuracy: 69,
    generalization: 62,
    ruleRecovery: 58,
    social: 54,
  },
];

function clampMetric(value: number) {
  return Math.max(35, Math.min(96, Math.round(value)));
}

function estimateMetrics(
  familyId: FamilyId,
  conditionId: ConditionId,
  budgetId: BudgetId,
  seed: number,
  batch: number,
): MetricSet {
  const conditionBoost: Record<ConditionId, number> = {
    none: 0,
    text: 10,
    behavior: 16,
    hybrid: 22,
  };
  const budgetBoost: Record<BudgetId, number> = {
    one: 3,
    partial: 8,
    full: 14,
    multi: 18,
    failed: 9,
  };
  const familyBias: Record<FamilyId, number> = {
    procedural: 4,
    causal: 0,
    social: -3,
  };
  const noise = ((seed * 37 + batch * 11) % 15) - 7;
  const base =
    51 +
    conditionBoost[conditionId] +
    budgetBoost[budgetId] +
    familyBias[familyId] +
    noise;

  const behaviorSignal =
    conditionId === "behavior" || conditionId === "hybrid" ? 8 : -4;
  const failedDemoSignal = budgetId === "failed" ? 7 : 0;
  const socialSignal =
    familyId === "social" && conditionId !== "none" ? 9 : familyId === "social" ? -5 : 0;

  return {
    accuracy: clampMetric(base),
    generalization: clampMetric(base - 5 + behaviorSignal),
    ruleRecovery: clampMetric(base - 9 + behaviorSignal + failedDemoSignal),
    social: clampMetric(base - 7 + socialSignal),
  };
}

function metricLabel(value: number) {
  return `${value}%`;
}

function statusClass(status: RunStatus) {
  switch (status) {
    case "running":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "complete":
      return "bg-zinc-100 text-zinc-800 border-zinc-200";
    case "paused":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-sky-100 text-sky-800 border-sky-200";
  }
}

function readinessClass(status: ReadinessStatus) {
  switch (status) {
    case "ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "building":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-700";
  }
}

function nextReadinessStatus(status: ReadinessStatus): ReadinessStatus {
  if (status === "planned") return "building";
  if (status === "building") return "ready";
  return "planned";
}

function downloadText(filename: string, mimeType: string, text: string) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("lab");
  const [familyId, setFamilyId] = useState<FamilyId>("procedural");
  const [conditionId, setConditionId] = useState<ConditionId>("behavior");
  const [budgetId, setBudgetId] = useState<BudgetId>("full");
  const [selectedAgent, setSelectedAgent] = useState(agents[1]);
  const [seed, setSeed] = useState(23);
  const [batchSize, setBatchSize] = useState(180);
  const [playhead, setPlayhead] = useState(2);
  const [runs, setRuns] = useState<Run[]>(initialRuns);
  const [selectedRunId, setSelectedRunId] = useState(initialRuns[0].id);
  const [nextRunNumber, setNextRunNumber] = useState(4);
  const [readiness, setReadiness] =
    useState<ReadinessItem[]>(initialReadiness);

  const selectedFamily = taskFamilies.find((family) => family.id === familyId)!;
  const selectedCondition =
    promptConditions.find((condition) => condition.id === conditionId)!;
  const selectedBudget = demoBudgets.find((budget) => budget.id === budgetId)!;
  const safePlayhead = Math.min(playhead, selectedFamily.path.length - 1);
  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null,
    [runs, selectedRunId],
  );
  const currentMetrics = useMemo(
    () => estimateMetrics(familyId, conditionId, budgetId, seed, batchSize),
    [familyId, conditionId, budgetId, seed, batchSize],
  );
  const displayedMetrics = selectedRun ?? currentMetrics;

  const conditionComparison = promptConditions.map((condition) => ({
    ...condition,
    metrics: estimateMetrics(
      familyId,
      condition.id,
      budgetId,
      seed + condition.label.length,
      batchSize,
    ),
  }));

  const matrix = demoBudgets.map((budget) => ({
    ...budget,
    cells: promptConditions.map((condition) =>
      estimateMetrics(familyId, condition.id, budget.id, seed, batchSize)
        .generalization,
    ),
  }));
  const readinessSummary = useMemo(
    () => ({
      ready: readiness.filter((item) => item.status === "ready").length,
      total: readiness.length,
    }),
    [readiness],
  );

  function queueRun() {
    const id = `run-${String(nextRunNumber).padStart(3, "0")}`;
    const metrics = estimateMetrics(
      familyId,
      conditionId,
      budgetId,
      seed,
      batchSize,
    );
    const run: Run = {
      id,
      status: "queued",
      familyId,
      conditionId,
      budgetId,
      agent: selectedAgent,
      seed,
      batch: batchSize,
      ...metrics,
    };
    setRuns((previous) => [run, ...previous]);
    setSelectedRunId(id);
    setNextRunNumber((value) => value + 1);
    setActiveTab("runs");
  }

  function updateSelectedRun(status: RunStatus) {
    if (!selectedRun) return;
    setRuns((previous) =>
      previous.map((run) =>
        run.id === selectedRun.id ? { ...run, status } : run,
      ),
    );
  }

  function archiveSelectedRun() {
    if (!selectedRun) return;
    const remaining = runs.filter((run) => run.id !== selectedRun.id);
    setRuns(remaining);
    setSelectedRunId(remaining[0]?.id ?? "");
  }

  function cycleReadiness(id: string) {
    setReadiness((previous) =>
      previous.map((item) =>
        item.id === id
          ? { ...item, status: nextReadinessStatus(item.status) }
          : item,
      ),
    );
  }

  function exportBenchmarkJson() {
    const manifest = {
      name: "BehaviorPrompt Games",
      exportedAt: new Date().toISOString(),
      selectedExperiment: {
        familyId,
        conditionId,
        budgetId,
        agent: selectedAgent,
        seed,
        batchSize,
      },
      totals: classicTotals,
      promptConditions,
      demoBudgets,
      taskFamilies: taskFamilies.map((family) => ({
        id: family.id,
        label: family.label,
        shorthand: family.shorthand,
        focus: family.focus,
        transfer: family.transfer,
        objects: family.objects,
        blockers: family.blockers,
        hazard: family.hazard,
        path: family.path,
        events: family.events,
      })),
      classicGameBenchmarks,
      readiness,
      runs,
    };
    downloadText(
      "behaviorprompt-benchmark-manifest.json",
      "application/json",
      JSON.stringify(manifest, null, 2),
    );
  }

  function exportRunsCsv() {
    const headers = [
      "run_id",
      "status",
      "family",
      "condition",
      "budget",
      "agent",
      "seed",
      "batch",
      "accuracy",
      "generalization",
      "rule_recovery",
      "social",
    ];
    const rows = runs.map((run) => {
      const family = taskFamilies.find((item) => item.id === run.familyId);
      const condition = promptConditions.find(
        (item) => item.id === run.conditionId,
      );
      const budget = demoBudgets.find((item) => item.id === run.budgetId);
      return [
        run.id,
        run.status,
        family?.label ?? run.familyId,
        condition?.label ?? run.conditionId,
        budget?.label ?? run.budgetId,
        run.agent,
        run.seed,
        run.batch,
        run.accuracy,
        run.generalization,
        run.ruleRecovery,
        run.social,
      ]
        .map(csvCell)
        .join(",");
    });
    downloadText(
      "behaviorprompt-runs.csv",
      "text/csv",
      [headers.join(","), ...rows].join("\n"),
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7f3] text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Non-linguistic in-context learning
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-zinc-950">
              BehaviorPrompt Games
            </h1>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="Dashboard views">
            {[
              ["lab", "Lab"],
              ["runs", "Runs"],
              ["analysis", "Analysis"],
              ["protocol", "Protocol"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id as TabId)}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                  activeTab === id
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-4">
          <MetricTile label="Inference accuracy" value={displayedMetrics.accuracy} />
          <MetricTile
            label="Transfer generalization"
            value={displayedMetrics.generalization}
          />
          <MetricTile
            label="Rule recovery"
            value={displayedMetrics.ruleRecovery}
          />
          <MetricTile label="Social alignment" value={displayedMetrics.social} />
          <CountTile label="Classic games" value={classicTotals.games} />
          <CountTile label="Generated levels" value={classicTotals.levels} />
          <CountTile label="Held-out levels" value={classicTotals.heldOut} />
          <CountTile label="Demo clips" value={classicTotals.demos} />
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {activeTab === "lab" && (
          <div className="grid gap-6 xl:grid-cols-[320px_1fr_340px]">
            <section className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">Experiment Setup</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {selectedFamily.focus}
                  </p>
                </div>
                <span
                  className={`h-3 w-3 rounded-full ${selectedFamily.style.accent}`}
                  aria-hidden="true"
                />
              </div>

              <ControlGroup title="Task family">
                <div className="grid gap-2">
                  {taskFamilies.map((family) => (
                    <button
                      key={family.id}
                      type="button"
                      onClick={() => {
                        setFamilyId(family.id);
                        setPlayhead(2);
                      }}
                      className={`rounded-md border p-3 text-left transition ${
                        familyId === family.id
                          ? `${family.style.border} ${family.style.soft}`
                          : "border-zinc-200 hover:border-zinc-400"
                      }`}
                    >
                      <span className="block text-sm font-semibold">
                        {family.label}
                      </span>
                      <span className="mt-1 block text-xs text-zinc-500">
                        {family.shorthand}
                      </span>
                    </button>
                  ))}
                </div>
              </ControlGroup>

              <ControlGroup title="Prompt condition">
                <div className="grid grid-cols-2 gap-2">
                  {promptConditions.map((condition) => (
                    <button
                      key={condition.id}
                      type="button"
                      onClick={() => setConditionId(condition.id)}
                      className={`min-h-16 rounded-md border p-2 text-left text-sm transition ${
                        conditionId === condition.id
                          ? "border-zinc-950 bg-zinc-950 text-white"
                          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                      }`}
                    >
                      <span className="block font-semibold">
                        {condition.label}
                      </span>
                      <span
                        className={`mt-1 block text-xs ${
                          conditionId === condition.id
                            ? "text-zinc-200"
                            : "text-zinc-500"
                        }`}
                      >
                        {condition.summary}
                      </span>
                    </button>
                  ))}
                </div>
              </ControlGroup>

              <ControlGroup title="Demonstration budget">
                <select
                  value={budgetId}
                  onChange={(event) => setBudgetId(event.target.value as BudgetId)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                >
                  {demoBudgets.map((budget) => (
                    <option key={budget.id} value={budget.id}>
                      {budget.label}
                    </option>
                  ))}
                </select>
              </ControlGroup>

              <ControlGroup title="Agent">
                <select
                  value={selectedAgent}
                  onChange={(event) => setSelectedAgent(event.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                >
                  {agents.map((agent) => (
                    <option key={agent} value={agent}>
                      {agent}
                    </option>
                  ))}
                </select>
              </ControlGroup>

              <ControlGroup title="Seed and batch">
                <RangeControl
                  label="Seed"
                  min={1}
                  max={99}
                  value={seed}
                  onChange={setSeed}
                />
                <RangeControl
                  label="Batch"
                  min={40}
                  max={400}
                  step={20}
                  value={batchSize}
                  onChange={setBatchSize}
                />
              </ControlGroup>

              <button
                type="button"
                onClick={queueRun}
                className="mt-4 w-full rounded-md bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Queue Experiment
              </button>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={exportBenchmarkJson}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:border-zinc-600"
                >
                  Export JSON
                </button>
                <button
                  type="button"
                  onClick={exportRunsCsv}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:border-zinc-600"
                >
                  Export CSV
                </button>
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className={`text-sm font-semibold ${selectedFamily.style.text}`}>
                    {selectedFamily.label}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">
                    Behavior Prompt Viewport
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPlayhead(Math.max(0, safePlayhead - 1))}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:border-zinc-600"
                  >
                    Prev Step
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPlayhead(
                        Math.min(selectedFamily.path.length - 1, safePlayhead + 1),
                      )
                    }
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:border-zinc-600"
                  >
                    Next Step
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlayhead(0)}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:border-zinc-600"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(280px,420px)_1fr]">
                <div>
                  <div className="grid grid-cols-7 gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-2">
                    {worldIndexes.map((index) => (
                      <WorldCell
                        key={`${selectedFamily.id}-${index}`}
                        index={index}
                        family={selectedFamily}
                        playhead={safePlayhead}
                      />
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-600 sm:grid-cols-4">
                    <LegendItem label="A" value="Agent" />
                    <LegendItem label="G" value="Goal" />
                    <LegendItem label="K/L/P" value="Cue" />
                    <LegendItem label="D/B/O" value="State" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-zinc-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">Observed Event</h3>
                      <span className="text-xs font-medium text-zinc-500">
                        Step {safePlayhead + 1} / {selectedFamily.path.length}
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {selectedFamily.events.map((event, index) => (
                        <div
                          key={event.action}
                          className={`rounded-md border p-3 ${
                            index <= Math.min(safePlayhead, selectedFamily.events.length - 1)
                              ? "border-zinc-300 bg-zinc-50"
                              : "border-zinc-100 bg-white text-zinc-400"
                          }`}
                        >
                          <p className="text-sm font-medium">{event.action}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Signal: {event.signal}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Transfer: {event.transfer}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-200 p-4">
                    <h3 className="text-sm font-semibold">Transfer Instance</h3>
                    <p className="mt-3 text-sm leading-6 text-zinc-600">
                      {selectedFamily.transfer}
                    </p>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <MiniStat label="Condition" value={selectedCondition.label} />
                      <MiniStat label="Budget" value={selectedBudget.short} />
                      <MiniStat label="Agent" value={selectedAgent} />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-4">
              <h2 className="text-base font-semibold">Live Analysis</h2>
              <div className="mt-4 space-y-4">
                {conditionComparison.map((condition) => (
                  <BarRow
                    key={condition.id}
                    label={condition.label}
                    value={condition.metrics.generalization}
                    active={condition.id === conditionId}
                  />
                ))}
              </div>

              <div className="mt-6 rounded-lg border border-zinc-200 p-4">
                <h3 className="text-sm font-semibold">Demo Sufficiency Matrix</h3>
                <div className="mt-4 grid grid-cols-[86px_repeat(4,1fr)] gap-1 text-xs">
                  <span />
                  {promptConditions.map((condition) => (
                    <span key={condition.id} className="text-center text-zinc-500">
                      {condition.label}
                    </span>
                  ))}
                  {matrix.map((row) => (
                    <MatrixRow key={row.id} row={row} />
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-zinc-200 p-4">
                <h3 className="text-sm font-semibold">Generalization Curve</h3>
                <MiniLineChart
                  points={conditionComparison.map(
                    (condition) => condition.metrics.generalization,
                  )}
                />
              </div>
            </section>
          </div>
        )}

        {activeTab === "runs" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <section className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-semibold">Run Queue</h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => updateSelectedRun("running")}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:border-zinc-600"
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedRun("paused")}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:border-zinc-600"
                  >
                    Pause
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedRun("complete")}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:border-zinc-600"
                  >
                    Complete
                  </button>
                  <button
                    type="button"
                    onClick={archiveSelectedRun}
                    className="rounded-md border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:border-rose-400"
                  >
                    Archive
                  </button>
                  <button
                    type="button"
                    onClick={exportRunsCsv}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:border-zinc-600"
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs uppercase tracking-[0.12em] text-zinc-500">
                      <th className="py-3 pr-4 font-semibold">Run</th>
                      <th className="py-3 pr-4 font-semibold">Status</th>
                      <th className="py-3 pr-4 font-semibold">Family</th>
                      <th className="py-3 pr-4 font-semibold">Prompt</th>
                      <th className="py-3 pr-4 font-semibold">Agent</th>
                      <th className="py-3 pr-4 font-semibold">Accuracy</th>
                      <th className="py-3 pr-4 font-semibold">Transfer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => {
                      const family = taskFamilies.find(
                        (taskFamily) => taskFamily.id === run.familyId,
                      )!;
                      const condition = promptConditions.find(
                        (promptCondition) =>
                          promptCondition.id === run.conditionId,
                      )!;
                      return (
                        <tr
                          key={run.id}
                          onClick={() => setSelectedRunId(run.id)}
                          className={`cursor-pointer border-b border-zinc-100 ${
                            selectedRun?.id === run.id
                              ? "bg-zinc-50"
                              : "hover:bg-zinc-50"
                          }`}
                        >
                          <td className="py-3 pr-4 font-semibold">{run.id}</td>
                          <td className="py-3 pr-4">
                            <span
                              className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${statusClass(
                                run.status,
                              )}`}
                            >
                              {run.status}
                            </span>
                          </td>
                          <td className="py-3 pr-4">{family.label}</td>
                          <td className="py-3 pr-4">{condition.label}</td>
                          <td className="py-3 pr-4">{run.agent}</td>
                          <td className="py-3 pr-4">
                            {metricLabel(run.accuracy)}
                          </td>
                          <td className="py-3 pr-4">
                            {metricLabel(run.generalization)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-4">
              <h2 className="text-base font-semibold">Selected Run</h2>
              {selectedRun ? (
                <div className="mt-4 space-y-4">
                  <MiniStat label="Run" value={selectedRun.id} />
                  <MiniStat label="Agent" value={selectedRun.agent} />
                  <MiniStat
                    label="Seed / batch"
                    value={`${selectedRun.seed} / ${selectedRun.batch}`}
                  />
                  <BarRow label="Inference" value={selectedRun.accuracy} active />
                  <BarRow
                    label="Transfer"
                    value={selectedRun.generalization}
                    active
                  />
                  <BarRow
                    label="Rules"
                    value={selectedRun.ruleRecovery}
                    active
                  />
                  <BarRow label="Social" value={selectedRun.social} active />
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-500">No active runs.</p>
              )}
            </section>
          </div>
        )}

        {activeTab === "analysis" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-lg border border-zinc-200 bg-white p-4">
              <h2 className="text-base font-semibold">Condition Comparison</h2>
              <div className="mt-5 space-y-5">
                {promptConditions.map((condition) => {
                  const runSet = runs.filter(
                    (run) => run.conditionId === condition.id,
                  );
                  const average =
                    runSet.length > 0
                      ? Math.round(
                          runSet.reduce(
                            (total, run) => total + run.generalization,
                            0,
                          ) / runSet.length,
                        )
                      : estimateMetrics(
                          familyId,
                          condition.id,
                          budgetId,
                          seed,
                          batchSize,
                        ).generalization;
                  return (
                    <BarRow
                      key={condition.id}
                      label={condition.label}
                      value={average}
                      active={condition.id === "behavior"}
                    />
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-4">
              <h2 className="text-base font-semibold">Benchmark Coverage</h2>
              <div className="mt-4 grid gap-3">
                {taskFamilies.map((family) => {
                  const familyRuns = runs.filter((run) => run.familyId === family.id);
                  const familyGames = classicGameBenchmarks.filter((game) =>
                    game.familyIds.includes(family.id),
                  );
                  const familyLevels = familyGames.reduce(
                    (total, game) => total + game.trainMaps + game.evalMaps,
                    0,
                  );
                  return (
                    <div
                      key={family.id}
                      className="rounded-lg border border-zinc-200 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{family.label}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {family.focus}
                          </p>
                        </div>
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-semibold ${family.style.soft} ${family.style.text}`}
                        >
                          {familyRuns.length} runs
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <MiniStat
                          label="Classic games"
                          value={String(familyGames.length)}
                        />
                        <MiniStat
                          label="Game levels"
                          value={familyLevels.toLocaleString()}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-4 lg:col-span-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">
                    Classic Game Numbers
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Classic-inspired tasks act as familiar priors while keeping
                    the benchmark procedurally controlled.
                  </p>
                </div>
                <span className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold">
                  {classicTotals.games} games /{" "}
                  {classicTotals.levels.toLocaleString()} levels
                </span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs uppercase tracking-[0.12em] text-zinc-500">
                      <th className="py-3 pr-4 font-semibold">Classic game</th>
                      <th className="py-3 pr-4 font-semibold">Families</th>
                      <th className="py-3 pr-4 font-semibold">Train</th>
                      <th className="py-3 pr-4 font-semibold">Held-out</th>
                      <th className="py-3 pr-4 font-semibold">Demos</th>
                      <th className="py-3 pr-4 font-semibold">
                        Target inference
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {classicGameBenchmarks.map((game) => (
                      <tr key={game.name} className="border-b border-zinc-100">
                        <td className="py-3 pr-4 font-semibold">{game.name}</td>
                        <td className="py-3 pr-4">
                          {game.familyIds
                            .map(
                              (id) =>
                                taskFamilies.find((family) => family.id === id)
                                  ?.label,
                            )
                            .join(", ")}
                        </td>
                        <td className="py-3 pr-4">
                          {game.trainMaps.toLocaleString()}
                        </td>
                        <td className="py-3 pr-4">
                          {game.evalMaps.toLocaleString()}
                        </td>
                        <td className="py-3 pr-4">
                          {game.demoClips.toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 text-zinc-600">
                          {game.targetInference}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-4 lg:col-span-2">
              <h2 className="text-base font-semibold">Research Questions</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-5">
                {[
                  "Goal inference",
                  "Causal affordances",
                  "Prompt comparison",
                  "Demo sufficiency",
                  "Social meaning",
                ].map((question, index) => (
                  <div
                    key={question}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      RQ {index + 1}
                    </p>
                    <p className="mt-2 text-sm font-semibold">{question}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === "protocol" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <section className="rounded-lg border border-zinc-200 bg-white p-4 lg:col-span-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Research Readiness</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {readinessSummary.ready} of {readinessSummary.total} tracks
                    marked ready
                  </p>
                </div>
                <button
                  type="button"
                  onClick={exportBenchmarkJson}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:border-zinc-600"
                >
                  Export Manifest
                </button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-5">
                {readiness.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => cycleReadiness(item.id)}
                    className={`rounded-lg border p-4 text-left transition hover:border-zinc-500 ${readinessClass(
                      item.status,
                    )}`}
                  >
                    <span className="block text-xs font-semibold uppercase tracking-[0.12em]">
                      {item.status}
                    </span>
                    <span className="mt-2 block text-sm font-semibold">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-xs">{item.owner}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-4">
              <h2 className="text-base font-semibold">Positioning Guardrails</h2>
              <div className="mt-4 space-y-3">
                {[
                  [
                    "Claim",
                    "Behavior trajectories are prompt inputs for game agents.",
                  ],
                  [
                    "Contribution",
                    "A controlled benchmark comparing no prompt, text, behavior, and hybrid prompts.",
                  ],
                  [
                    "Do not claim",
                    "That demonstrations, imitation learning, or in-context policy adaptation are new.",
                  ],
                  [
                    "Novel edge",
                    "Failed demos, demo sufficiency, and social conventions under behavior-only prompting.",
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 p-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      {label}
                    </p>
                    <p className="mt-2 text-sm text-zinc-700">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-4">
              <h2 className="text-base font-semibold">Benchmark Protocol</h2>
              <div className="mt-4 space-y-3">
                {[
                  ["Prompt inputs", "No prompt, text, behavior, text plus behavior"],
                  ["Demo budgets", "One action, partial, successful, multiple, failed"],
                  ["Task splits", "Procedural maps, causal variants, social villages"],
                  ["Evaluation", "Held-out transfer worlds with task labels hidden"],
                  ["Primary metric", "Goal completion under inferred rules"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="grid gap-2 rounded-lg border border-zinc-200 p-3 sm:grid-cols-[150px_1fr]"
                  >
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-sm text-zinc-600">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-4">
              <h2 className="text-base font-semibold">Dataset Registry</h2>
              <div className="mt-4 space-y-3">
                {taskFamilies.map((family) => (
                  <div
                    key={family.id}
                    className="rounded-lg border border-zinc-200 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{family.label}</p>
                      <span
                        className={`h-2 w-8 rounded-md ${family.style.accent}`}
                        aria-hidden="true"
                      />
                    </div>
                    <p className="mt-2 text-sm text-zinc-600">
                      {family.transfer}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{metricLabel(value)}</p>
    </div>
  );
}

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function ControlGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

function RangeControl({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="mb-3 block text-sm">
      <span className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <span className="text-zinc-500">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-zinc-950"
      />
    </label>
  );
}

function WorldCell({
  index,
  family,
  playhead,
}: {
  index: number;
  family: TaskFamily;
  playhead: number;
}) {
  const visiblePath = family.path.slice(0, playhead + 1);
  const isTrail = visiblePath.includes(index);
  const isActive = family.path[playhead] === index;
  const object = family.objects[index];
  const isBlocker = family.blockers.includes(index);
  const isHazard = family.hazard.includes(index);

  let cellClass = "border-zinc-200 bg-white text-zinc-400";
  if (isBlocker) cellClass = "border-zinc-900 bg-zinc-900 text-white";
  if (isHazard) cellClass = "border-rose-200 bg-rose-100 text-rose-700";
  if (isTrail) cellClass = `${family.style.border} ${family.style.soft} ${family.style.text}`;
  if (isActive) cellClass = "border-zinc-950 bg-zinc-950 text-white";

  return (
    <div
      className={`flex aspect-square min-h-9 items-center justify-center rounded-md border text-xs font-bold ${cellClass}`}
    >
      {object ?? (isTrail ? "." : "")}
    </div>
  );
}

function LegendItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 py-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-md border border-zinc-300 text-xs font-bold">
        {label}
      </span>
      <span>{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function BarRow({
  label,
  value,
  active = false,
}: {
  label: string;
  value: number;
  active?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className={active ? "font-semibold" : "text-zinc-600"}>{label}</span>
        <span className="font-semibold">{metricLabel(value)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-md bg-zinc-100">
        <div
          className={`h-full rounded-md ${active ? "bg-zinc-950" : "bg-sky-500"}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function MatrixRow({
  row,
}: {
  row: { label: string; cells: number[] };
}) {
  return (
    <>
      <span className="flex min-h-9 items-center text-zinc-600">{row.label}</span>
      {row.cells.map((value, index) => (
        <span
          key={`${row.label}-${index}`}
          className="flex min-h-9 items-center justify-center rounded-md border border-zinc-200 text-xs font-semibold"
          style={{
            backgroundColor: `rgba(20, 184, 166, ${0.18 + value / 150})`,
          }}
        >
          {value}
        </span>
      ))}
    </>
  );
}

function MiniLineChart({ points }: { points: number[] }) {
  const width = 320;
  const height = 140;
  const xStep = width / Math.max(1, points.length - 1);
  const coords = points.map((point, index) => {
    const x = index * xStep;
    const y = height - ((point - 35) / 65) * (height - 20) - 10;
    return `${x},${y}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Generalization comparison chart"
      className="mt-4 h-44 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3"
      preserveAspectRatio="none"
    >
      {[35, 55, 75, 95].map((tick) => {
        const y = height - ((tick - 35) / 65) * (height - 20) - 10;
        return (
          <g key={tick}>
            <line
              x1="0"
              x2={width}
              y1={y}
              y2={y}
              stroke="#e4e4e7"
              strokeWidth="1"
            />
            <text x="4" y={y - 4} fill="#71717a" fontSize="9">
              {tick}
            </text>
          </g>
        );
      })}
      <polyline
        fill="none"
        points={coords.join(" ")}
        stroke="#0f172a"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      {points.map((point, index) => {
        const [x, y] = coords[index].split(",").map(Number);
        return (
          <circle key={`${point}-${index}`} cx={x} cy={y} r="4" fill="#14b8a6" />
        );
      })}
    </svg>
  );
}
