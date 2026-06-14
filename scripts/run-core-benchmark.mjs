import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  CORE_AGENTS,
  CORE_ENVIRONMENTS,
  runCoreBenchmark,
} from "../lib/benchmark/environments.ts";

const conditions = ["none", "text", "behavior", "hybrid"];

function parseArgs(argv) {
  const options = {
    seed: 23,
    outDir: "benchmark-results",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--seed") {
      options.seed = Number(argv[index + 1]);
      index += 1;
    } else if (arg === "--out") {
      options.outDir = argv[index + 1];
      index += 1;
    }
  }

  if (!Number.isFinite(options.seed)) {
    throw new Error("--seed must be a number");
  }

  return options;
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function summarize(results) {
  const byAgent = CORE_AGENTS.map((agent) => {
    const agentResults = results.filter((result) => result.agentId === agent.id);
    const successes = agentResults.filter((result) => result.success).length;
    const totalReward = agentResults.reduce(
      (total, result) => total + result.totalReward,
      0,
    );
    const violations = agentResults.reduce(
      (total, result) => total + result.violations,
      0,
    );

    return {
      agentId: agent.id,
      agentName: agent.name,
      episodes: agentResults.length,
      successes,
      successRate:
        agentResults.length === 0
          ? 0
          : Math.round((successes / agentResults.length) * 100),
      averageReward:
        agentResults.length === 0
          ? 0
          : Math.round(totalReward / agentResults.length),
      violations,
    };
  });

  const byCondition = conditions.map((condition) => {
    const conditionResults = results.filter(
      (result) => result.promptCondition === condition,
    );
    const successes = conditionResults.filter((result) => result.success).length;
    return {
      condition,
      episodes: conditionResults.length,
      successes,
      successRate:
        conditionResults.length === 0
          ? 0
          : Math.round((successes / conditionResults.length) * 100),
      violations: conditionResults.reduce(
        (total, result) => total + result.violations,
        0,
      ),
    };
  });

  return {
    episodes: results.length,
    environments: CORE_ENVIRONMENTS.length,
    agents: CORE_AGENTS.length,
    conditions: conditions.length,
    successes: results.filter((result) => result.success).length,
    violations: results.reduce((total, result) => total + result.violations, 0),
    byAgent,
    byCondition,
  };
}

function toCsv(results) {
  const headers = [
    "environment_id",
    "environment_name",
    "family",
    "agent_id",
    "agent_name",
    "prompt_condition",
    "seed",
    "success",
    "total_reward",
    "steps_used",
    "violations",
    "terminal_reason",
  ];

  const rows = results.map((result) =>
    [
      result.environmentId,
      result.environmentName,
      result.family,
      result.agentId,
      result.agentName,
      result.promptCondition,
      result.seed,
      result.success,
      result.totalReward,
      result.stepsUsed,
      result.violations,
      result.terminalReason,
    ]
      .map(csvCell)
      .join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}

const options = parseArgs(process.argv.slice(2));
const results = runCoreBenchmark({
  seed: options.seed,
  conditions,
  agents: CORE_AGENTS.map((agent) => agent.id),
});
const summary = summarize(results);
const manifest = {
  generatedAt: new Date().toISOString(),
  seed: options.seed,
  environments: CORE_ENVIRONMENTS,
  agents: CORE_AGENTS,
  conditions,
  summary,
  results,
};

await mkdir(options.outDir, { recursive: true });

const jsonPath = join(options.outDir, "core-benchmark-results.json");
const csvPath = join(options.outDir, "core-benchmark-results.csv");
const summaryPath = join(options.outDir, "core-benchmark-summary.json");

await writeFile(jsonPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await writeFile(csvPath, `${toCsv(results)}\n`, "utf8");
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

console.log(`Wrote ${results.length} episodes`);
console.log(`JSON: ${jsonPath}`);
console.log(`CSV: ${csvPath}`);
console.log(`Summary: ${summaryPath}`);
console.log(
  `Successes: ${summary.successes}/${summary.episodes}, violations: ${summary.violations}`,
);
