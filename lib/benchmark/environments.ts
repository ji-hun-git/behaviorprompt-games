export type CoreEnvironmentId = "doorkey" | "switchbridge" | "ownership";
export type CorePromptCondition = "none" | "text" | "behavior" | "hybrid";
export type CoreAction = "north" | "south" | "east" | "west" | "interact" | "wait";

export type CorePosition = {
  row: number;
  col: number;
};

export type CoreStep = {
  t: number;
  action: CoreAction;
  position: CorePosition;
  observation: string;
  reward: number;
  inventory: string[];
  flags: string[];
  violation: string | null;
};

export type CoreEnvironment = {
  id: CoreEnvironmentId;
  name: string;
  family: "procedural" | "causal" | "social";
  rule: string;
  start: CorePosition;
  goal: CorePosition;
  key?: CorePosition;
  door?: CorePosition;
  lever?: CorePosition;
  bridge?: CorePosition;
  hazard?: CorePosition;
  chest?: CorePosition;
  owner?: CorePosition;
};

export type CoreEpisodeResult = {
  environmentId: CoreEnvironmentId;
  environmentName: string;
  family: CoreEnvironment["family"];
  promptCondition: CorePromptCondition;
  seed: number;
  success: boolean;
  totalReward: number;
  stepsUsed: number;
  violations: number;
  inferredRule: string;
  terminalReason: string;
  steps: CoreStep[];
};

export type CoreBenchmarkResult = CoreEpisodeResult & {
  conditionLabel: string;
};

export const CORE_ENVIRONMENTS: CoreEnvironment[] = [
  {
    id: "doorkey",
    name: "DoorKey Gridworld",
    family: "procedural",
    rule: "Collect the key before opening the locked door, then reach the goal.",
    start: { row: 0, col: 0 },
    key: { row: 0, col: 4 },
    door: { row: 3, col: 4 },
    goal: { row: 6, col: 6 },
  },
  {
    id: "switchbridge",
    name: "SwitchBridge Gridworld",
    family: "causal",
    rule: "Activate the lever before crossing the bridge over the hazard.",
    start: { row: 6, col: 0 },
    lever: { row: 3, col: 0 },
    bridge: { row: 3, col: 3 },
    hazard: { row: 3, col: 2 },
    goal: { row: 0, col: 6 },
  },
  {
    id: "ownership",
    name: "Ownership Gridworld",
    family: "social",
    rule: "Ask the owner for permission before opening the owned chest.",
    start: { row: 0, col: 0 },
    owner: { row: 0, col: 6 },
    chest: { row: 3, col: 3 },
    goal: { row: 6, col: 6 },
  },
];

const conditionLabels: Record<CorePromptCondition, string> = {
  none: "No prompt",
  text: "Text",
  behavior: "Behavior",
  hybrid: "Text + behavior",
};

function samePosition(a: CorePosition | undefined, b: CorePosition) {
  return Boolean(a && a.row === b.row && a.col === b.col);
}

function move(position: CorePosition, action: CoreAction): CorePosition {
  if (action === "north") return { row: Math.max(0, position.row - 1), col: position.col };
  if (action === "south") return { row: Math.min(6, position.row + 1), col: position.col };
  if (action === "west") return { row: position.row, col: Math.max(0, position.col - 1) };
  if (action === "east") return { row: position.row, col: Math.min(6, position.col + 1) };
  return position;
}

function route(from: CorePosition, to: CorePosition): CoreAction[] {
  const actions: CoreAction[] = [];
  const vertical: CoreAction = to.row > from.row ? "south" : "north";
  const horizontal: CoreAction = to.col > from.col ? "east" : "west";

  for (let row = from.row; row !== to.row; row += to.row > row ? 1 : -1) {
    actions.push(vertical);
  }
  for (let col = from.col; col !== to.col; col += to.col > col ? 1 : -1) {
    actions.push(horizontal);
  }

  return actions;
}

function routeThrough(points: CorePosition[], includeInteractions = true): CoreAction[] {
  const actions: CoreAction[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    actions.push(...route(points[index], points[index + 1]));
    if (includeInteractions && index < points.length - 2) {
      actions.push("interact");
    }
  }
  return actions;
}

function directPlan(environment: CoreEnvironment): CoreAction[] {
  if (environment.id === "doorkey" && environment.door) {
    return routeThrough([environment.start, environment.door, environment.goal]);
  }
  if (environment.id === "switchbridge" && environment.hazard) {
    return routeThrough([environment.start, environment.hazard, environment.goal], false);
  }
  if (environment.id === "ownership" && environment.chest) {
    return routeThrough([environment.start, environment.chest, environment.goal]);
  }
  return routeThrough([environment.start, environment.goal], false);
}

function textPlan(environment: CoreEnvironment): CoreAction[] {
  if (environment.id === "doorkey" && environment.key && environment.door) {
    return routeThrough([environment.start, environment.key, environment.door, environment.goal]);
  }
  if (environment.id === "switchbridge" && environment.lever && environment.bridge) {
    return routeThrough([environment.start, environment.lever, environment.bridge, environment.goal]);
  }
  if (environment.id === "ownership" && environment.owner && environment.chest) {
    return routeThrough([environment.start, environment.owner, environment.chest, environment.goal]);
  }
  return routeThrough([environment.start, environment.goal], false);
}

function behaviorPlan(environment: CoreEnvironment): CoreAction[] {
  const actions = textPlan(environment);
  const hesitationIndex = Math.min(2, actions.length);
  return [
    ...actions.slice(0, hesitationIndex),
    "wait",
    ...actions.slice(hesitationIndex),
  ];
}

function hybridPlan(environment: CoreEnvironment): CoreAction[] {
  return textPlan(environment);
}

function planFor(environment: CoreEnvironment, condition: CorePromptCondition, seed: number) {
  if (condition === "none") {
    const plan = directPlan(environment);
    return seed % 2 === 0 ? plan : ["wait", ...plan];
  }
  if (condition === "text") return textPlan(environment);
  if (condition === "behavior") return behaviorPlan(environment);
  return hybridPlan(environment);
}

function applyInteract(
  environment: CoreEnvironment,
  position: CorePosition,
  inventory: string[],
  flags: string[],
) {
  if (environment.id === "doorkey") {
    if (samePosition(environment.key, position) && !inventory.includes("key")) {
      return {
        observation: "Picked up the key.",
        reward: 5,
        inventory: [...inventory, "key"],
        flags,
        violation: null,
      };
    }
    if (samePosition(environment.door, position)) {
      if (inventory.includes("key")) {
        return {
          observation: "Unlocked the door with the key.",
          reward: 5,
          inventory,
          flags: flags.includes("door-open") ? flags : [...flags, "door-open"],
          violation: null,
        };
      }
      return {
        observation: "Tried to open the locked door without the key.",
        reward: -12,
        inventory,
        flags,
        violation: "locked-door-without-key",
      };
    }
  }

  if (environment.id === "switchbridge") {
    if (samePosition(environment.lever, position)) {
      return {
        observation: "Activated the lever; the bridge is now safe.",
        reward: 6,
        inventory,
        flags: flags.includes("lever-on") ? flags : [...flags, "lever-on"],
        violation: null,
      };
    }
  }

  if (environment.id === "ownership") {
    if (samePosition(environment.owner, position)) {
      return {
        observation: "Asked the owner and received permission.",
        reward: 6,
        inventory,
        flags: flags.includes("permission") ? flags : [...flags, "permission"],
        violation: null,
      };
    }
    if (samePosition(environment.chest, position)) {
      if (flags.includes("permission")) {
        return {
          observation: "Opened the chest after receiving permission.",
          reward: 5,
          inventory,
          flags: flags.includes("chest-open") ? flags : [...flags, "chest-open"],
          violation: null,
        };
      }
      return {
        observation: "Touched the owned chest before getting permission.",
        reward: -12,
        inventory,
        flags,
        violation: "ownership-violation",
      };
    }
  }

  return {
    observation: "Interacted, but nothing changed.",
    reward: -1,
    inventory,
    flags,
    violation: null,
  };
}

export function runCoreEpisode({
  environmentId,
  promptCondition,
  seed,
}: {
  environmentId: CoreEnvironmentId;
  promptCondition: CorePromptCondition;
  seed: number;
}): CoreEpisodeResult {
  const environment =
    CORE_ENVIRONMENTS.find((item) => item.id === environmentId) ??
    CORE_ENVIRONMENTS[0];
  const actions = planFor(environment, promptCondition, seed);
  let position = environment.start;
  let inventory: string[] = [];
  let flags: string[] = [];
  let totalReward = 0;
  let violations = 0;
  let terminalReason = "Step budget exhausted.";
  const steps: CoreStep[] = [];

  actions.some((action, index) => {
    let reward = -1;
    let violation: string | null = null;
    let observation = action === "wait" ? "Waited to observe the scene." : `Moved ${action}.`;

    if (action === "interact") {
      const result = applyInteract(environment, position, inventory, flags);
      observation = result.observation;
      reward = result.reward;
      inventory = result.inventory;
      flags = result.flags;
      violation = result.violation;
    } else if (action !== "wait") {
      position = move(position, action);
    }

    if (
      environment.id === "switchbridge" &&
      samePosition(environment.hazard, position) &&
      !flags.includes("lever-on")
    ) {
      observation = "Entered the unsafe crossing before activating the lever.";
      reward -= 14;
      violation = "hazard-before-lever";
    }

    if (
      environment.id === "doorkey" &&
      samePosition(environment.door, position) &&
      !flags.includes("door-open")
    ) {
      observation = "Reached the locked door before opening it.";
      reward -= 10;
      violation = "blocked-by-locked-door";
    }

    if (
      environment.id === "ownership" &&
      samePosition(environment.chest, position) &&
      !flags.includes("permission")
    ) {
      observation = "Approached the owned chest before asking permission.";
      reward -= 10;
      violation = "approached-owned-object";
    }

    if (samePosition(environment.goal, position)) {
      reward += 25;
      terminalReason = "Reached the goal.";
    }

    if (violation) {
      violations += 1;
      terminalReason = `Rule violation: ${violation}.`;
    }

    totalReward += reward;
    steps.push({
      t: index,
      action,
      position,
      observation,
      reward,
      inventory: [...inventory],
      flags: [...flags],
      violation,
    });

    return Boolean(violation || samePosition(environment.goal, position));
  });

  const success = samePosition(environment.goal, position) && violations === 0;

  return {
    environmentId: environment.id,
    environmentName: environment.name,
    family: environment.family,
    promptCondition,
    seed,
    success,
    totalReward,
    stepsUsed: steps.length,
    violations,
    inferredRule: environment.rule,
    terminalReason,
    steps,
  };
}

export function runCoreBenchmark({
  seed,
  conditions,
}: {
  seed: number;
  conditions: CorePromptCondition[];
}): CoreBenchmarkResult[] {
  return CORE_ENVIRONMENTS.flatMap((environment, environmentIndex) =>
    conditions.map((condition, conditionIndex) => ({
      ...runCoreEpisode({
        environmentId: environment.id,
        promptCondition: condition,
        seed: seed + environmentIndex * 10 + conditionIndex,
      }),
      conditionLabel: conditionLabels[condition],
    })),
  );
}
