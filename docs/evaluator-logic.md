# Evaluator Logic

The current evaluator is deterministic and local. It is still a simulated
research-console evaluator, not a completed game benchmark runner, but the logic
now mirrors the experimental variables the paper needs.

## Inputs

Each estimate depends on:

- task family: procedural, causal, or social
- benchmark template, either classic-inspired or CS/RL/POMDP
- prompt condition: no prompt, text, behavior, or text plus behavior
- demonstration budget: one action, partial, full success, multiple demos, or
  failed demo
- agent profile
- seed
- batch size

## Benchmark Template Fields

Benchmark templates include:

- category: classic-inspired game or CS environment
- train map count
- held-out map count
- behavior demo count
- complexity from 1 to 5
- prompt sensitivity from 1 to 5
- target inference description

Complexity penalizes transfer because harder environments need stronger
inference. Prompt sensitivity boosts behavior and hybrid prompts because those
settings should benefit more from seeing demonstrations.

## Agent Profiles

Agents are scored by:

- behavior skill
- language skill
- causal skill
- social skill
- sample efficiency

The same prompt can therefore help different agents differently. For example,
`BC-Transformer` benefits more from behavior demonstrations, while
`GameGPT-Agent` benefits more from text and hybrid prompts.

## Derived Scores

The dashboard computes:

- inference accuracy
- transfer generalization
- rule recovery
- social alignment
- prompt margin
- sample efficiency

Prompt margin is the selected prompt condition's transfer score minus no-prompt
transfer under the same family, game, agent, seed, batch size, and demo budget.

## Trajectory Simulation

The Lab view also generates a concrete trace for the selected setup. A trace
contains:

- timestep
- grid cell, row, and column
- action label
- observation text
- reward delta
- inventory
- environment flags
- success, failure, or partial status

Demo budget changes the generated trace:

- one action: only the first transition
- partial trajectory: an early prefix of the successful path
- full success: the complete successful path
- multiple demos: currently represented by the full successful path for the
  selected template
- failed demo: a counterexample path that violates the relevant procedural,
  causal, or social rule

Trace export is deterministic and saved as `behaviorprompt-trace.json`.

## Verdicts

The evaluator labels configurations as:

- strong behavior-prompt signal
- promising behavior-prompt signal
- weak but positive signal
- needs stronger demonstrations

These labels are for experiment planning only. Real claims require replacing
the simulator with actual game environments, trajectory files, agent adapters,
and reproducible evaluation logs.
