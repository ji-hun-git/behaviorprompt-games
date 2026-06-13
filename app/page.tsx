"use client";

import { useMemo, useState } from "react";
import {
  CORE_ENVIRONMENTS,
  runCoreBenchmark,
  type CoreBenchmarkResult,
  type CorePromptCondition,
} from "@/lib/benchmark/environments";

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
  gameName: string;
  agent: string;
  seed: number;
  batch: number;
  evaluator: string;
  promptMargin: number;
  sampleEfficiency: number;
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
  category: "classic" | "cs";
  familyIds: FamilyId[];
  trainMaps: number;
  evalMaps: number;
  demoClips: number;
  complexity: number;
  promptSensitivity: number;
  targetInference: string;
};

type AgentProfile = {
  behaviorSkill: number;
  languageSkill: number;
  causalSkill: number;
  socialSkill: number;
  sampleEfficiency: number;
};

type TraceStatus = "success" | "failed" | "partial";

type TraceStep = {
  t: number;
  cell: number;
  row: number;
  col: number;
  action: string;
  observation: string;
  reward: number;
  inventory: string[];
  flags: string[];
};

type BehaviorTrace = {
  id: string;
  familyId: FamilyId;
  gameName: string;
  conditionId: ConditionId;
  budgetId: BudgetId;
  seed: number;
  status: TraceStatus;
  success: boolean;
  totalReward: number;
  inferredRule: string;
  failureReason: string | null;
  steps: TraceStep[];
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

const agentProfiles: Record<string, AgentProfile> = {
  "BC-Transformer": {
    behaviorSkill: 4,
    languageSkill: 1,
    causalSkill: 2,
    socialSkill: 1,
    sampleEfficiency: 3,
  },
  "VLM-Planner": {
    behaviorSkill: 3,
    languageSkill: 3,
    causalSkill: 2,
    socialSkill: 3,
    sampleEfficiency: 2,
  },
  "World-Model RL": {
    behaviorSkill: 2,
    languageSkill: 1,
    causalSkill: 5,
    socialSkill: 1,
    sampleEfficiency: 2,
  },
  "GameGPT-Agent": {
    behaviorSkill: 3,
    languageSkill: 4,
    causalSkill: 3,
    socialSkill: 3,
    sampleEfficiency: 4,
  },
};

const classicGameBenchmarks: ClassicGameBenchmark[] = [
  {
    name: "Pong-like Rally",
    category: "classic",
    familyIds: ["procedural"],
    trainMaps: 40,
    evalMaps: 16,
    demoClips: 180,
    complexity: 2,
    promptSensitivity: 3,
    targetInference: "turn-taking, pursuit, and defensive positioning",
  },
  {
    name: "Breakout-like Bricks",
    category: "classic",
    familyIds: ["causal"],
    trainMaps: 56,
    evalMaps: 20,
    demoClips: 220,
    complexity: 3,
    promptSensitivity: 4,
    targetInference: "bounce rules and destructible affordances",
  },
  {
    name: "Snake-like Growth",
    category: "classic",
    familyIds: ["procedural"],
    trainMaps: 64,
    evalMaps: 24,
    demoClips: 260,
    complexity: 4,
    promptSensitivity: 4,
    targetInference: "self-avoidance, collection order, and route planning",
  },
  {
    name: "Maze Chase",
    category: "classic",
    familyIds: ["causal"],
    trainMaps: 72,
    evalMaps: 28,
    demoClips: 300,
    complexity: 4,
    promptSensitivity: 5,
    targetInference: "enemy avoidance and temporary power states",
  },
  {
    name: "Road Crossing",
    category: "classic",
    familyIds: ["causal"],
    trainMaps: 60,
    evalMaps: 24,
    demoClips: 240,
    complexity: 3,
    promptSensitivity: 3,
    targetInference: "timing windows and moving hazards",
  },
  {
    name: "Crate Pusher",
    category: "classic",
    familyIds: ["procedural", "causal"],
    trainMaps: 80,
    evalMaps: 32,
    demoClips: 320,
    complexity: 5,
    promptSensitivity: 5,
    targetInference: "irreversible moves and spatial dependencies",
  },
  {
    name: "Bomb Maze",
    category: "classic",
    familyIds: ["causal", "social"],
    trainMaps: 64,
    evalMaps: 24,
    demoClips: 280,
    complexity: 5,
    promptSensitivity: 5,
    targetInference: "delayed effects, blast zones, and teammate safety",
  },
  {
    name: "Builder Swarm",
    category: "classic",
    familyIds: ["causal", "social"],
    trainMaps: 56,
    evalMaps: 20,
    demoClips: 220,
    complexity: 4,
    promptSensitivity: 4,
    targetInference: "role assignment and cooperative rescue",
  },
  {
    name: "Falling Blocks",
    category: "classic",
    familyIds: ["procedural"],
    trainMaps: 48,
    evalMaps: 16,
    demoClips: 180,
    complexity: 3,
    promptSensitivity: 2,
    targetInference: "placement conventions and long-term board control",
  },
  {
    name: "Invader Defense",
    category: "classic",
    familyIds: ["procedural", "causal"],
    trainMaps: 52,
    evalMaps: 20,
    demoClips: 210,
    complexity: 3,
    promptSensitivity: 3,
    targetInference: "cover use, projectile timing, and target priority",
  },
  {
    name: "Platform Rescue",
    category: "classic",
    familyIds: ["causal"],
    trainMaps: 56,
    evalMaps: 20,
    demoClips: 220,
    complexity: 4,
    promptSensitivity: 4,
    targetInference: "ladder, jump, barrel, and rescue affordances",
  },
  {
    name: "Dungeon Key Quest",
    category: "classic",
    familyIds: ["procedural", "social"],
    trainMaps: 84,
    evalMaps: 32,
    demoClips: 360,
    complexity: 5,
    promptSensitivity: 5,
    targetInference: "keys, locks, trading, and ownership conventions",
  },
  {
    name: "Asteroid Field",
    category: "classic",
    familyIds: ["causal"],
    trainMaps: 66,
    evalMaps: 24,
    demoClips: 250,
    complexity: 4,
    promptSensitivity: 4,
    targetInference: "inertia, wraparound motion, and threat prioritization",
  },
  {
    name: "Light Cycle Arena",
    category: "classic",
    familyIds: ["procedural", "social"],
    trainMaps: 54,
    evalMaps: 18,
    demoClips: 210,
    complexity: 4,
    promptSensitivity: 4,
    targetInference: "territory control, self-trapping, and opponent pressure",
  },
  {
    name: "Missile Defense",
    category: "classic",
    familyIds: ["causal"],
    trainMaps: 58,
    evalMaps: 20,
    demoClips: 220,
    complexity: 3,
    promptSensitivity: 3,
    targetInference: "interception timing and limited defensive resources",
  },
  {
    name: "River Route",
    category: "classic",
    familyIds: ["procedural", "causal"],
    trainMaps: 62,
    evalMaps: 22,
    demoClips: 240,
    complexity: 4,
    promptSensitivity: 3,
    targetInference: "fuel constraints, lane choice, and obstacle timing",
  },
  {
    name: "Pyramid Hop",
    category: "classic",
    familyIds: ["procedural"],
    trainMaps: 50,
    evalMaps: 18,
    demoClips: 190,
    complexity: 3,
    promptSensitivity: 4,
    targetInference: "tile conversion order and enemy-safe traversal",
  },
  {
    name: "Runner Heist",
    category: "classic",
    familyIds: ["procedural", "social"],
    trainMaps: 70,
    evalMaps: 26,
    demoClips: 280,
    complexity: 5,
    promptSensitivity: 5,
    targetInference: "digging timing, capture avoidance, and resource ownership",
  },
  {
    name: "Boulder Mine",
    category: "classic",
    familyIds: ["causal"],
    trainMaps: 72,
    evalMaps: 28,
    demoClips: 300,
    complexity: 5,
    promptSensitivity: 4,
    targetInference: "falling-object causality and safe collection order",
  },
  {
    name: "Pinball Control",
    category: "classic",
    familyIds: ["causal"],
    trainMaps: 48,
    evalMaps: 16,
    demoClips: 180,
    complexity: 4,
    promptSensitivity: 3,
    targetInference: "angle control, rebound prediction, and delayed payoff",
  },
  {
    name: "Escort Shooter",
    category: "classic",
    familyIds: ["procedural", "social"],
    trainMaps: 52,
    evalMaps: 20,
    demoClips: 210,
    complexity: 4,
    promptSensitivity: 4,
    targetInference: "formation reading, target priority, and ally protection",
  },
  {
    name: "Mini Golf Angle",
    category: "classic",
    familyIds: ["causal"],
    trainMaps: 44,
    evalMaps: 16,
    demoClips: 170,
    complexity: 3,
    promptSensitivity: 3,
    targetInference: "force selection, rebound planning, and hazard avoidance",
  },
  {
    name: "RockSample POMDP",
    category: "cs",
    familyIds: ["causal"],
    trainMaps: 96,
    evalMaps: 36,
    demoClips: 420,
    complexity: 5,
    promptSensitivity: 5,
    targetInference: "information gathering, sensing value, and sample risk",
  },
  {
    name: "Tiger POMDP",
    category: "cs",
    familyIds: ["causal"],
    trainMaps: 48,
    evalMaps: 18,
    demoClips: 180,
    complexity: 3,
    promptSensitivity: 5,
    targetInference: "listening before acting under hidden state uncertainty",
  },
  {
    name: "Hallway POMDP",
    category: "cs",
    familyIds: ["procedural", "causal"],
    trainMaps: 72,
    evalMaps: 28,
    demoClips: 300,
    complexity: 4,
    promptSensitivity: 5,
    targetInference: "local observation aliasing and memory-dependent navigation",
  },
  {
    name: "Wumpus World",
    category: "cs",
    familyIds: ["procedural", "causal"],
    trainMaps: 80,
    evalMaps: 32,
    demoClips: 340,
    complexity: 5,
    promptSensitivity: 5,
    targetInference: "logical hazard inference from breeze and stench cues",
  },
  {
    name: "FrozenLake",
    category: "cs",
    familyIds: ["causal"],
    trainMaps: 60,
    evalMaps: 24,
    demoClips: 240,
    complexity: 3,
    promptSensitivity: 4,
    targetInference: "slippery dynamics and risk-aware route selection",
  },
  {
    name: "Taxi MDP",
    category: "cs",
    familyIds: ["procedural", "causal"],
    trainMaps: 72,
    evalMaps: 28,
    demoClips: 300,
    complexity: 4,
    promptSensitivity: 4,
    targetInference: "pickup-dropoff ordering and wall-constrained navigation",
  },
  {
    name: "Cliff Walking",
    category: "cs",
    familyIds: ["causal"],
    trainMaps: 64,
    evalMaps: 24,
    demoClips: 260,
    complexity: 4,
    promptSensitivity: 4,
    targetInference: "reward-risk tradeoff near catastrophic boundaries",
  },
  {
    name: "Four Rooms Gridworld",
    category: "cs",
    familyIds: ["procedural"],
    trainMaps: 76,
    evalMaps: 28,
    demoClips: 300,
    complexity: 3,
    promptSensitivity: 3,
    targetInference: "subgoal discovery through bottleneck doorways",
  },
  {
    name: "Mountain Car",
    category: "cs",
    familyIds: ["causal"],
    trainMaps: 56,
    evalMaps: 20,
    demoClips: 220,
    complexity: 4,
    promptSensitivity: 3,
    targetInference: "momentum accumulation and counterintuitive retreat",
  },
  {
    name: "CartPole Balance",
    category: "cs",
    familyIds: ["causal"],
    trainMaps: 52,
    evalMaps: 20,
    demoClips: 210,
    complexity: 3,
    promptSensitivity: 3,
    targetInference: "stabilizing feedback from small corrective actions",
  },
  {
    name: "Acrobot Swing-Up",
    category: "cs",
    familyIds: ["causal"],
    trainMaps: 56,
    evalMaps: 20,
    demoClips: 220,
    complexity: 4,
    promptSensitivity: 3,
    targetInference: "energy pumping and delayed control effects",
  },
  {
    name: "Multi-Armed Bandit",
    category: "cs",
    familyIds: ["causal"],
    trainMaps: 40,
    evalMaps: 16,
    demoClips: 160,
    complexity: 2,
    promptSensitivity: 4,
    targetInference: "exploration-exploitation from reward observations",
  },
  {
    name: "MiniGrid DoorKey",
    category: "cs",
    familyIds: ["procedural", "causal"],
    trainMaps: 88,
    evalMaps: 34,
    demoClips: 380,
    complexity: 4,
    promptSensitivity: 5,
    targetInference: "key-door dependency and compact symbolic affordances",
  },
];

const benchmarkTotals = classicGameBenchmarks.reduce(
  (totals, game) => ({
    templates: totals.templates + 1,
    classicGames:
      totals.classicGames + (game.category === "classic" ? 1 : 0),
    csEnvironments:
      totals.csEnvironments + (game.category === "cs" ? 1 : 0),
    levels: totals.levels + game.trainMaps + game.evalMaps,
    heldOut: totals.heldOut + game.evalMaps,
    demos: totals.demos + game.demoClips,
  }),
  {
    templates: 0,
    classicGames: 0,
    csEnvironments: 0,
    levels: 0,
    heldOut: 0,
    demos: 0,
  },
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
    gameName: "Dungeon Key Quest",
    agent: "VLM-Planner",
    seed: 19,
    batch: 160,
    evaluator: "held-out transfer evaluator",
    promptMargin: 18,
    sampleEfficiency: 74,
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
    gameName: "Bomb Maze",
    agent: "World-Model RL",
    seed: 11,
    batch: 240,
    evaluator: "causal failure-demo evaluator",
    promptMargin: 24,
    sampleEfficiency: 78,
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
    gameName: "Snake-like Growth",
    agent: "BC-Transformer",
    seed: 7,
    batch: 120,
    evaluator: "procedural transfer evaluator",
    promptMargin: 9,
    sampleEfficiency: 66,
    accuracy: 69,
    generalization: 62,
    ruleRecovery: 58,
    social: 54,
  },
];

function clampMetric(value: number) {
  return Math.max(35, Math.min(96, Math.round(value)));
}

function clampScore(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function stringHash(value: string) {
  return Array.from(value).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
}

function getBenchmarkGame(gameName: string) {
  return (
    classicGameBenchmarks.find((game) => game.name === gameName) ??
    classicGameBenchmarks[0]
  );
}

function getAgentProfile(agent: string) {
  return agentProfiles[agent] ?? agentProfiles["VLM-Planner"];
}

function estimateMetrics(
  familyId: FamilyId,
  conditionId: ConditionId,
  budgetId: BudgetId,
  seed: number,
  batch: number,
  gameName = classicGameBenchmarks[0].name,
  agent = agents[0],
): MetricSet {
  const game = getBenchmarkGame(gameName);
  const profile = getAgentProfile(agent);
  const conditionBoost: Record<ConditionId, number> = {
    none: 0,
    text: 5 + profile.languageSkill * 2,
    behavior: 7 + profile.behaviorSkill * 2 + game.promptSensitivity,
    hybrid:
      11 +
      profile.languageSkill +
      profile.behaviorSkill +
      game.promptSensitivity,
  };
  const budgetBoost: Record<BudgetId, number> = {
    one: 2 + profile.sampleEfficiency,
    partial: 7 + profile.sampleEfficiency,
    full: 13,
    multi: 17,
    failed: 8 + Math.max(profile.causalSkill, profile.behaviorSkill),
  };
  const familyFit: Record<FamilyId, number> = {
    procedural: profile.behaviorSkill + profile.sampleEfficiency,
    causal: profile.causalSkill * 2,
    social: profile.socialSkill * 2 + profile.languageSkill,
  };
  const familyPenalty: Record<FamilyId, number> = {
    procedural: 0,
    causal: 3,
    social: 5,
  };
  const batchBonus = clampScore((batch - 40) / 45, 0, 8);
  const complexityPenalty =
    game.complexity * 2 + Math.max(0, game.familyIds.length - 1) * 2;
  const supportedFamilyBonus = game.familyIds.includes(familyId) ? 4 : -5;
  const noise = ((seed * 37 + batch * 11 + stringHash(game.name)) % 15) - 7;
  const base =
    47 +
    conditionBoost[conditionId] +
    budgetBoost[budgetId] +
    familyFit[familyId] +
    batchBonus +
    supportedFamilyBonus -
    complexityPenalty -
    familyPenalty[familyId] +
    noise;

  const behaviorSignal =
    conditionId === "behavior" || conditionId === "hybrid"
      ? 7 + game.promptSensitivity
      : -3;
  const failedDemoSignal =
    budgetId === "failed" ? 4 + profile.causalSkill + game.promptSensitivity : 0;
  const socialSignal =
    familyId === "social" && conditionId !== "none"
      ? profile.socialSkill * 2 + game.promptSensitivity
      : familyId === "social"
        ? -7
        : 0;
  const causalSignal =
    familyId === "causal" ? profile.causalSkill * 2 + failedDemoSignal : 0;

  return {
    accuracy: clampMetric(base),
    generalization: clampMetric(base - 5 + behaviorSignal),
    ruleRecovery: clampMetric(base - 10 + behaviorSignal + causalSignal),
    social: clampMetric(base - 7 + socialSignal),
  };
}

function computePromptMargin(
  familyId: FamilyId,
  conditionId: ConditionId,
  budgetId: BudgetId,
  seed: number,
  batch: number,
  gameName: string,
  agent: string,
) {
  const promptScore = estimateMetrics(
    familyId,
    conditionId,
    budgetId,
    seed,
    batch,
    gameName,
    agent,
  ).generalization;
  const noPromptScore = estimateMetrics(
    familyId,
    "none",
    budgetId,
    seed,
    batch,
    gameName,
    agent,
  ).generalization;
  return promptScore - noPromptScore;
}

function computeSampleEfficiency(
  conditionId: ConditionId,
  budgetId: BudgetId,
  gameName: string,
  agent: string,
) {
  const game = getBenchmarkGame(gameName);
  const profile = getAgentProfile(agent);
  const conditionFactor: Record<ConditionId, number> = {
    none: -4,
    text: profile.languageSkill,
    behavior: profile.behaviorSkill + game.promptSensitivity,
    hybrid: profile.languageSkill + profile.behaviorSkill + 2,
  };
  const budgetFactor: Record<BudgetId, number> = {
    one: 3,
    partial: 7,
    full: 11,
    multi: 13,
    failed: 8,
  };
  return clampScore(
    45 +
      profile.sampleEfficiency * 5 +
      conditionFactor[conditionId] +
      budgetFactor[budgetId] -
      game.complexity * 2,
    20,
    96,
  );
}

function evaluatorLabel(familyId: FamilyId, budgetId: BudgetId) {
  if (budgetId === "failed") return "counterfactual failure-demo evaluator";
  if (familyId === "social") return "social transfer evaluator";
  if (familyId === "causal") return "causal affordance evaluator";
  return "procedural transfer evaluator";
}

function verdictLabel(promptMargin: number, metrics: MetricSet) {
  if (promptMargin >= 18 && metrics.generalization >= 70) {
    return "Strong behavior-prompt signal";
  }
  if (promptMargin >= 10) {
    return "Promising behavior-prompt signal";
  }
  if (promptMargin >= 4) {
    return "Weak but positive signal";
  }
  return "Needs stronger demonstrations";
}

function cellToCoord(cell: number) {
  return {
    row: Math.floor(cell / 7),
    col: cell % 7,
  };
}

function movementLabel(from: number, to: number) {
  const delta = to - from;
  if (delta === 1) return "move east";
  if (delta === -1) return "move west";
  if (delta === 7) return "move south";
  if (delta === -7) return "move north";
  return "jump";
}

function traceRuleLabel(familyId: FamilyId) {
  if (familyId === "procedural") {
    return "Satisfy prerequisite objects before crossing gated state tiles.";
  }
  if (familyId === "causal") {
    return "Use interventions to change affordances before entering hazards.";
  }
  return "Resolve ownership or consent before using socially constrained objects.";
}

function failedPathForFamily(familyId: FamilyId) {
  if (familyId === "procedural") return [0, 7, 14, 21, 20];
  if (familyId === "causal") return [42, 43];
  return [6, 13, 20, 27];
}

function pathForBudget(family: TaskFamily, budgetId: BudgetId) {
  if (budgetId === "failed") return failedPathForFamily(family.id);
  if (budgetId === "one") return family.path.slice(0, 2);
  if (budgetId === "partial") {
    return family.path.slice(0, Math.max(3, Math.ceil(family.path.length * 0.45)));
  }
  return family.path;
}

function simulateBehaviorTrace(
  family: TaskFamily,
  game: ClassicGameBenchmark,
  conditionId: ConditionId,
  budgetId: BudgetId,
  seed: number,
): BehaviorTrace {
  const path = pathForBudget(family, budgetId);
  const inventory: string[] = [];
  const flags: string[] = [];
  const steps: TraceStep[] = [];
  let totalReward = 0;
  let failed = false;
  let failureReason: string | null = null;
  let success = false;

  path.forEach((cell, index) => {
    const coord = cellToCoord(cell);
    const object = family.objects[cell];
    let reward = index === 0 ? 0 : -1;
    let observation =
      index === 0
        ? `Spawned in ${game.name}.`
        : `Entered cell ${coord.row},${coord.col}.`;
    const action =
      index === 0 ? "start" : movementLabel(path[index - 1], cell);

    if (family.id === "procedural") {
      if (object === "K" && !inventory.includes("key")) {
        inventory.push("key");
        reward += 5;
        observation = "Collected key prerequisite.";
      }
      if (object === "D") {
        if (inventory.includes("key")) {
          flags.push("door-open");
          reward += 5;
          observation = "Opened gated door after collecting key.";
        } else {
          failed = true;
          failureReason = "Reached locked door without key.";
          reward -= 10;
          observation = failureReason;
        }
      }
      if (object === "G" && !failed) {
        success = true;
        reward += 20;
        observation = "Reached goal after satisfying the prerequisite chain.";
      }
    }

    if (family.id === "causal") {
      if (object === "L" && !flags.includes("lever-on")) {
        flags.push("lever-on");
        reward += 6;
        observation = "Activated causal lever.";
      }
      if (object === "B" && flags.includes("lever-on")) {
        flags.push("bridge-active");
        reward += 4;
        observation = "Crossed bridge after intervention changed affordance.";
      }
      if (family.hazard.includes(cell) && !flags.includes("lever-on")) {
        failed = true;
        failureReason = "Entered hazard before changing the environment.";
        reward -= 12;
        observation = failureReason;
      }
      if (object === "G" && !failed) {
        success = true;
        reward += 20;
        observation = "Reached goal after using the causal intervention.";
      }
    }

    if (family.id === "social") {
      if (object === "P" && !flags.includes("permission")) {
        flags.push("permission");
        reward += 6;
        observation = "Received permission from partner.";
      }
      if (object === "C") {
        if (flags.includes("permission")) {
          reward += 4;
          observation = "Opened chest after resolving ownership convention.";
        } else {
          failed = true;
          failureReason = "Touched owned object before getting permission.";
          reward -= 10;
          observation = failureReason;
        }
      }
      if (object === "G" && !failed) {
        success = true;
        reward += 20;
        observation = "Exited while respecting the social convention.";
      }
    }

    totalReward += reward;
    steps.push({
      t: index,
      cell,
      row: coord.row,
      col: coord.col,
      action,
      observation,
      reward,
      inventory: [...inventory],
      flags: [...flags],
    });
  });

  const isTruncated = budgetId === "one" || budgetId === "partial";
  const status: TraceStatus = failed ? "failed" : success ? "success" : "partial";

  return {
    id: `trace-${family.id}-${game.name.toLowerCase().replaceAll(" ", "-")}-${seed}`,
    familyId: family.id,
    gameName: game.name,
    conditionId,
    budgetId,
    seed,
    status: isTruncated && !failed ? "partial" : status,
    success: success && !isTruncated,
    totalReward,
    inferredRule: traceRuleLabel(family.id),
    failureReason,
    steps,
  };
}

function metricLabel(value: number) {
  return `${value}%`;
}

function signedLabel(value: number) {
  return value > 0 ? `+${value}` : String(value);
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
  const [selectedGameName, setSelectedGameName] = useState("Snake-like Growth");
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
  const [coreResults, setCoreResults] = useState<CoreBenchmarkResult[]>([]);

  const selectedFamily = taskFamilies.find((family) => family.id === familyId)!;
  const compatibleGames = useMemo(
    () =>
      classicGameBenchmarks.filter((game) => game.familyIds.includes(familyId)),
    [familyId],
  );
  const selectedGame =
    compatibleGames.find((game) => game.name === selectedGameName) ??
    compatibleGames[0] ??
    classicGameBenchmarks[0];
  const selectedCondition =
    promptConditions.find((condition) => condition.id === conditionId)!;
  const selectedBudget = demoBudgets.find((budget) => budget.id === budgetId)!;
  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null,
    [runs, selectedRunId],
  );
  const currentMetrics = useMemo(
    () =>
      estimateMetrics(
        familyId,
        conditionId,
        budgetId,
        seed,
        batchSize,
        selectedGame.name,
        selectedAgent,
      ),
    [
      familyId,
      conditionId,
      budgetId,
      seed,
      batchSize,
      selectedGame.name,
      selectedAgent,
    ],
  );
  const displayedMetrics = selectedRun ?? currentMetrics;
  const currentPromptMargin = useMemo(
    () =>
      computePromptMargin(
        familyId,
        conditionId,
        budgetId,
        seed,
        batchSize,
        selectedGame.name,
        selectedAgent,
      ),
    [
      familyId,
      conditionId,
      budgetId,
      seed,
      batchSize,
      selectedGame.name,
      selectedAgent,
    ],
  );
  const currentSampleEfficiency = useMemo(
    () =>
      computeSampleEfficiency(
        conditionId,
        budgetId,
        selectedGame.name,
        selectedAgent,
      ),
    [conditionId, budgetId, selectedGame.name, selectedAgent],
  );
  const currentVerdict = verdictLabel(currentPromptMargin, currentMetrics);
  const currentTrace = useMemo(
    () =>
      simulateBehaviorTrace(
        selectedFamily,
        selectedGame,
        conditionId,
        budgetId,
        seed,
      ),
    [selectedFamily, selectedGame, conditionId, budgetId, seed],
  );
  const traceCells = currentTrace.steps.map((step) => step.cell);
  const safeTracePlayhead = Math.min(
    playhead,
    Math.max(0, traceCells.length - 1),
  );

  const conditionComparison = promptConditions.map((condition) => ({
    ...condition,
    metrics: estimateMetrics(
      familyId,
      condition.id,
      budgetId,
      seed + condition.label.length,
      batchSize,
      selectedGame.name,
      selectedAgent,
    ),
  }));

  const matrix = demoBudgets.map((budget) => ({
    ...budget,
    cells: promptConditions.map((condition) =>
      estimateMetrics(
        familyId,
        condition.id,
        budget.id,
        seed,
        batchSize,
        selectedGame.name,
        selectedAgent,
      ).generalization,
    ),
  }));
  const readinessSummary = useMemo(
    () => ({
      ready: readiness.filter((item) => item.status === "ready").length,
      total: readiness.length,
    }),
    [readiness],
  );
  const coreSummary = useMemo(() => {
    if (coreResults.length === 0) {
      return {
        episodes: 0,
        successRate: 0,
        averageReward: 0,
        violations: 0,
      };
    }
    return {
      episodes: coreResults.length,
      successRate: Math.round(
        (coreResults.filter((result) => result.success).length /
          coreResults.length) *
          100,
      ),
      averageReward: Math.round(
        coreResults.reduce((total, result) => total + result.totalReward, 0) /
          coreResults.length,
      ),
      violations: coreResults.reduce(
        (total, result) => total + result.violations,
        0,
      ),
    };
  }, [coreResults]);

  function queueRun() {
    const id = `run-${String(nextRunNumber).padStart(3, "0")}`;
    const metrics = estimateMetrics(
      familyId,
      conditionId,
      budgetId,
      seed,
      batchSize,
      selectedGame.name,
      selectedAgent,
    );
    const run: Run = {
      id,
      status: "queued",
      familyId,
      conditionId,
      budgetId,
      gameName: selectedGame.name,
      agent: selectedAgent,
      seed,
      batch: batchSize,
      evaluator: evaluatorLabel(familyId, budgetId),
      promptMargin: computePromptMargin(
        familyId,
        conditionId,
        budgetId,
        seed,
        batchSize,
        selectedGame.name,
        selectedAgent,
      ),
      sampleEfficiency: computeSampleEfficiency(
        conditionId,
        budgetId,
        selectedGame.name,
        selectedAgent,
      ),
      ...metrics,
    };
    setRuns((previous) => [run, ...previous]);
    setSelectedRunId(id);
    setNextRunNumber((value) => value + 1);
    setActiveTab("runs");
  }

  function queueAblationSet() {
    const newRuns = promptConditions.map((condition, index) => {
      const id = `run-${String(nextRunNumber + index).padStart(3, "0")}`;
      const runSeed = seed + index;
      const metrics = estimateMetrics(
        familyId,
        condition.id,
        budgetId,
        runSeed,
        batchSize,
        selectedGame.name,
        selectedAgent,
      );
      return {
        id,
        status: "queued" as RunStatus,
        familyId,
        conditionId: condition.id,
        budgetId,
        gameName: selectedGame.name,
        agent: selectedAgent,
        seed: runSeed,
        batch: batchSize,
        evaluator: evaluatorLabel(familyId, budgetId),
        promptMargin: computePromptMargin(
          familyId,
          condition.id,
          budgetId,
          runSeed,
          batchSize,
          selectedGame.name,
          selectedAgent,
        ),
        sampleEfficiency: computeSampleEfficiency(
          condition.id,
          budgetId,
          selectedGame.name,
          selectedAgent,
        ),
        ...metrics,
      };
    });
    setRuns((previous) => [...newRuns, ...previous]);
    setSelectedRunId(newRuns[0].id);
    setNextRunNumber((value) => value + newRuns.length);
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
        gameName: selectedGame.name,
        conditionId,
        budgetId,
        agent: selectedAgent,
        seed,
        batchSize,
        evaluator: evaluatorLabel(familyId, budgetId),
        promptMargin: currentPromptMargin,
        sampleEfficiency: currentSampleEfficiency,
        verdict: currentVerdict,
      },
      totals: benchmarkTotals,
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
      currentTrace,
      coreEngine: {
        environments: CORE_ENVIRONMENTS,
        summary: coreSummary,
        results: coreResults,
      },
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
      "game",
      "condition",
      "budget",
      "agent",
      "seed",
      "batch",
      "evaluator",
      "prompt_margin",
      "sample_efficiency",
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
        run.gameName,
        condition?.label ?? run.conditionId,
        budget?.label ?? run.budgetId,
        run.agent,
        run.seed,
        run.batch,
        run.evaluator,
        run.promptMargin,
        run.sampleEfficiency,
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

  function exportTraceJson() {
    downloadText(
      "behaviorprompt-trace.json",
      "application/json",
      JSON.stringify(currentTrace, null, 2),
    );
  }

  function runCoreEngineBatch() {
    setCoreResults(
      runCoreBenchmark({
        seed,
        conditions: promptConditions.map(
          (condition) => condition.id as CorePromptCondition,
        ),
      }),
    );
    setActiveTab("analysis");
  }

  function exportCoreResultsJson() {
    downloadText(
      "behaviorprompt-core-engine-results.json",
      "application/json",
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          seed,
          environments: CORE_ENVIRONMENTS,
          summary: coreSummary,
          results: coreResults,
        },
        null,
        2,
      ),
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
          <CountTile label="Templates" value={benchmarkTotals.templates} />
          <CountTile
            label="Classic games"
            value={benchmarkTotals.classicGames}
          />
          <CountTile
            label="CS envs"
            value={benchmarkTotals.csEnvironments}
          />
          <CountTile label="Generated levels" value={benchmarkTotals.levels} />
          <CountTile label="Held-out levels" value={benchmarkTotals.heldOut} />
          <CountTile label="Demo clips" value={benchmarkTotals.demos} />
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
                        const firstCompatibleGame = classicGameBenchmarks.find(
                          (game) => game.familyIds.includes(family.id),
                        );
                        if (firstCompatibleGame) {
                          setSelectedGameName(firstCompatibleGame.name);
                        }
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

              <ControlGroup title="Benchmark template">
                <select
                  value={selectedGame.name}
                  onChange={(event) => setSelectedGameName(event.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                >
                  {compatibleGames.map((game) => (
                    <option key={game.name} value={game.name}>
                      {game.category === "cs" ? "CS" : "Classic"}: {game.name}
                    </option>
                  ))}
                </select>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <MiniStat
                    label="Complexity"
                    value={`${selectedGame.complexity}/5`}
                  />
                  <MiniStat
                    label="Sensitivity"
                    value={`${selectedGame.promptSensitivity}/5`}
                  />
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
              <button
                type="button"
                onClick={queueAblationSet}
                className="mt-2 w-full rounded-md border border-zinc-300 px-4 py-3 text-sm font-semibold hover:border-zinc-600"
              >
                Queue 4-Way Ablation
              </button>
              <button
                type="button"
                onClick={runCoreEngineBatch}
                className="mt-2 w-full rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 hover:border-emerald-600"
              >
                Run Core Engine Batch
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
              {coreResults.length > 0 && (
                <button
                  type="button"
                  onClick={exportCoreResultsJson}
                  className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:border-zinc-600"
                >
                  Export Core Results
                </button>
              )}
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
                    onClick={() =>
                      setPlayhead(Math.max(0, safeTracePlayhead - 1))
                    }
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:border-zinc-600"
                  >
                    Prev Step
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPlayhead(
                        Math.min(traceCells.length - 1, safeTracePlayhead + 1),
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
                  <button
                    type="button"
                    onClick={() => setPlayhead(traceCells.length - 1)}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:border-zinc-600"
                  >
                    Run Trace
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
                        playhead={safeTracePlayhead}
                        path={traceCells}
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
                        Step {safeTracePlayhead + 1} / {currentTrace.steps.length}
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {selectedFamily.events.map((event, index) => (
                        <div
                          key={event.action}
                          className={`rounded-md border p-3 ${
                            index <= Math.min(safeTracePlayhead, selectedFamily.events.length - 1)
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
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <MiniStat label="Game" value={selectedGame.name} />
                      <MiniStat
                        label="Evaluator"
                        value={evaluatorLabel(familyId, budgetId)}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">
                        Trajectory Simulator
                      </h3>
                      <button
                        type="button"
                        onClick={exportTraceJson}
                        className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-semibold hover:border-zinc-600"
                      >
                        Export Trace
                      </button>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <MiniStat label="Status" value={currentTrace.status} />
                      <MiniStat
                        label="Steps"
                        value={String(currentTrace.steps.length)}
                      />
                      <MiniStat
                        label="Reward"
                        value={String(currentTrace.totalReward)}
                      />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-zinc-500">
                      {currentTrace.failureReason ?? currentTrace.inferredRule}
                    </p>
                    <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                      {currentTrace.steps.map((step) => (
                        <div
                          key={`${currentTrace.id}-${step.t}`}
                          className={`rounded-md border p-2 text-xs ${
                            step.t === safeTracePlayhead
                              ? "border-zinc-900 bg-zinc-50"
                              : "border-zinc-200"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">
                              t{step.t}: {step.action}
                            </span>
                            <span className="text-zinc-500">
                              r {step.reward}
                            </span>
                          </div>
                          <p className="mt-1 text-zinc-600">
                            {step.observation}
                          </p>
                        </div>
                      ))}
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

              <div className="mt-6 rounded-lg border border-zinc-200 p-4">
                <h3 className="text-sm font-semibold">Evaluator Verdict</h3>
                <p className="mt-3 text-sm font-semibold">{currentVerdict}</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <MiniStat
                    label="Prompt margin"
                    value={signedLabel(currentPromptMargin)}
                  />
                  <MiniStat
                    label="Sample efficiency"
                    value={`${currentSampleEfficiency}%`}
                  />
                </div>
                <p className="mt-3 text-xs leading-5 text-zinc-500">
                  Margin compares the selected prompt condition against
                  no-prompt transfer for the same game, agent, seed, and demo
                  budget.
                </p>
              </div>
            </section>
          </div>
        )}

        {activeTab === "runs" && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4">
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
                <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs uppercase tracking-[0.12em] text-zinc-500">
                      <th className="py-3 pr-4 font-semibold">Run</th>
                      <th className="py-3 pr-4 font-semibold">Status</th>
                      <th className="py-3 pr-4 font-semibold">Game</th>
                      <th className="py-3 pr-4 font-semibold">Family</th>
                      <th className="py-3 pr-4 font-semibold">Prompt</th>
                      <th className="py-3 pr-4 font-semibold">Agent</th>
                      <th className="py-3 pr-4 font-semibold">Accuracy</th>
                      <th className="py-3 pr-4 font-semibold">Transfer</th>
                      <th className="py-3 pr-4 font-semibold">Margin</th>
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
                          <td className="py-3 pr-4">{run.gameName}</td>
                          <td className="py-3 pr-4">{family.label}</td>
                          <td className="py-3 pr-4">{condition.label}</td>
                          <td className="py-3 pr-4">{run.agent}</td>
                          <td className="py-3 pr-4">
                            {metricLabel(run.accuracy)}
                          </td>
                          <td className="py-3 pr-4">
                            {metricLabel(run.generalization)}
                          </td>
                          <td className="py-3 pr-4">
                            {signedLabel(run.promptMargin)}
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
                  <MiniStat label="Game" value={selectedRun.gameName} />
                  <MiniStat label="Agent" value={selectedRun.agent} />
                  <MiniStat
                    label="Seed / batch"
                    value={`${selectedRun.seed} / ${selectedRun.batch}`}
                  />
                  <MiniStat label="Evaluator" value={selectedRun.evaluator} />
                  <div className="grid grid-cols-2 gap-2">
                    <MiniStat
                      label="Prompt margin"
                      value={signedLabel(selectedRun.promptMargin)}
                    />
                    <MiniStat
                      label="Efficiency"
                      value={`${selectedRun.sampleEfficiency}%`}
                    />
                  </div>
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
            <section className="rounded-lg border border-zinc-200 bg-white p-4 lg:col-span-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">
                    Core Engine Results
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Deterministic rollouts for DoorKey, SwitchBridge, and
                    Ownership across prompt conditions.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={runCoreEngineBatch}
                    className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:border-emerald-600"
                  >
                    Run Core Engine
                  </button>
                  {coreResults.length > 0 && (
                    <button
                      type="button"
                      onClick={exportCoreResultsJson}
                      className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:border-zinc-600"
                    >
                      Export Results
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <MiniStat
                  label="Episodes"
                  value={String(coreSummary.episodes)}
                />
                <MiniStat
                  label="Success rate"
                  value={`${coreSummary.successRate}%`}
                />
                <MiniStat
                  label="Avg reward"
                  value={String(coreSummary.averageReward)}
                />
                <MiniStat
                  label="Violations"
                  value={String(coreSummary.violations)}
                />
              </div>

              {coreResults.length > 0 ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-xs uppercase tracking-[0.12em] text-zinc-500">
                        <th className="py-3 pr-4 font-semibold">Environment</th>
                        <th className="py-3 pr-4 font-semibold">Family</th>
                        <th className="py-3 pr-4 font-semibold">Prompt</th>
                        <th className="py-3 pr-4 font-semibold">Success</th>
                        <th className="py-3 pr-4 font-semibold">Reward</th>
                        <th className="py-3 pr-4 font-semibold">Steps</th>
                        <th className="py-3 pr-4 font-semibold">Violations</th>
                        <th className="py-3 pr-4 font-semibold">Terminal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coreResults.map((result) => (
                        <tr
                          key={`${result.environmentId}-${result.promptCondition}`}
                          className="border-b border-zinc-100"
                        >
                          <td className="py-3 pr-4 font-semibold">
                            {result.environmentName}
                          </td>
                          <td className="py-3 pr-4">{result.family}</td>
                          <td className="py-3 pr-4">{result.conditionLabel}</td>
                          <td className="py-3 pr-4">
                            {result.success ? "yes" : "no"}
                          </td>
                          <td className="py-3 pr-4">{result.totalReward}</td>
                          <td className="py-3 pr-4">{result.stepsUsed}</td>
                          <td className="py-3 pr-4">{result.violations}</td>
                          <td className="py-3 pr-4 text-zinc-600">
                            {result.terminalReason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                  Run the core engine to compute real deterministic rollouts.
                </p>
              )}
            </section>

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
                          selectedGame.name,
                          selectedAgent,
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
                          label="Templates"
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
                    Environment Catalog
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Classic-inspired games and CS benchmark environments share
                    the same prompt-condition protocol.
                  </p>
                </div>
                <span className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold">
                  {benchmarkTotals.templates} templates /{" "}
                  {benchmarkTotals.levels.toLocaleString()} levels
                </span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs uppercase tracking-[0.12em] text-zinc-500">
                      <th className="py-3 pr-4 font-semibold">Template</th>
                      <th className="py-3 pr-4 font-semibold">Category</th>
                      <th className="py-3 pr-4 font-semibold">Families</th>
                      <th className="py-3 pr-4 font-semibold">Train</th>
                      <th className="py-3 pr-4 font-semibold">Held-out</th>
                      <th className="py-3 pr-4 font-semibold">Demos</th>
                      <th className="py-3 pr-4 font-semibold">Complexity</th>
                      <th className="py-3 pr-4 font-semibold">Sensitivity</th>
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
                          {game.category === "cs" ? "CS env" : "Classic"}
                        </td>
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
                        <td className="py-3 pr-4">{game.complexity}/5</td>
                        <td className="py-3 pr-4">
                          {game.promptSensitivity}/5
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
  path,
}: {
  index: number;
  family: TaskFamily;
  playhead: number;
  path: number[];
}) {
  const visiblePath = path.slice(0, playhead + 1);
  const isTrail = visiblePath.includes(index);
  const isActive = path[playhead] === index;
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
