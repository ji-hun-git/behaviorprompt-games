# BehaviorPrompt Games

BehaviorPrompt Games is a research environment for testing whether behavior can
act as a prompt for game agents. Instead of giving an agent only a text
instruction, the dashboard frames short in-world demonstrations as prompts and
tracks whether the agent infers goals, causal rules, affordances, and social
conventions.

## Research Console

The first interface includes:

- task-family selection for procedural, causal, and social game settings
- prompt-condition controls for no prompt, text, behavior, and text plus behavior
- demonstration-budget controls for one action, partial trajectories, full
  successes, multiple demos, and failed demos
- a visual grid-world behavior prompt player
- simulated experiment queue management
- JSON benchmark-manifest export and CSV run export
- JSON trajectory trace export with actions, observations, rewards, inventory,
  flags, and success/failure status
- readiness tracking for environments, demos, agent adapters, metrics, and paper
  positioning
- deterministic simulated evaluator using game complexity, prompt sensitivity,
  agent profile, batch size, demo budget, and prompt condition
- condition comparison, sufficiency matrix, and benchmark coverage views
- benchmark catalog counts across 35 templates: 22 classic-inspired games, 13
  CS/RL/POMDP environments, 2,980 generated levels, 812 held-out transfer
  levels, and 8,770 behavior demo clips
- protocol and dataset registry panels for the first paper direction

## First Paper Direction

Working title:

**Behavioral Prompting: Teaching Game Agents Without Language**

Core comparison:

- no prompt
- text prompt
- behavior prompt
- text plus behavior prompt

Core task families:

- procedural goal inference
- causal rule and affordance inference
- social convention inference

Positioning guardrail:

- claim the benchmark and prompt-condition protocol
- do not claim that demonstrations or imitation learning are new
- emphasize failed demos, demo sufficiency, and social-convention inference as
  the sharper research edge

## Benchmark Catalog

The first pass uses classic game patterns and CS benchmark environments as
controlled task priors rather than direct reproductions of the original systems.

Catalog totals:

- 35 benchmark templates
- 22 classic-inspired games
- 13 CS/RL/POMDP environments
- 2,980 generated levels
- 812 held-out transfer levels
- 8,770 behavior demo clips

Classic-inspired templates:

| Game template | Train maps | Held-out maps | Demo clips |
| --- | ---: | ---: | ---: |
| Pong-like Rally | 40 | 16 | 180 |
| Breakout-like Bricks | 56 | 20 | 220 |
| Snake-like Growth | 64 | 24 | 260 |
| Maze Chase | 72 | 28 | 300 |
| Road Crossing | 60 | 24 | 240 |
| Crate Pusher | 80 | 32 | 320 |
| Bomb Maze | 64 | 24 | 280 |
| Builder Swarm | 56 | 20 | 220 |
| Falling Blocks | 48 | 16 | 180 |
| Invader Defense | 52 | 20 | 210 |
| Platform Rescue | 56 | 20 | 220 |
| Dungeon Key Quest | 84 | 32 | 360 |
| Asteroid Field | 66 | 24 | 250 |
| Light Cycle Arena | 54 | 18 | 210 |
| Missile Defense | 58 | 20 | 220 |
| River Route | 62 | 22 | 240 |
| Pyramid Hop | 50 | 18 | 190 |
| Runner Heist | 70 | 26 | 280 |
| Boulder Mine | 72 | 28 | 300 |
| Pinball Control | 48 | 16 | 180 |
| Escort Shooter | 52 | 20 | 210 |
| Mini Golf Angle | 44 | 16 | 170 |

CS/RL/POMDP environment templates:

| Environment template | Train maps | Held-out maps | Demo clips |
| --- | ---: | ---: | ---: |
| RockSample POMDP | 96 | 36 | 420 |
| Tiger POMDP | 48 | 18 | 180 |
| Hallway POMDP | 72 | 28 | 300 |
| Wumpus World | 80 | 32 | 340 |
| FrozenLake | 60 | 24 | 240 |
| Taxi MDP | 72 | 28 | 300 |
| Cliff Walking | 64 | 24 | 260 |
| Four Rooms Gridworld | 76 | 28 | 300 |
| Mountain Car | 56 | 20 | 220 |
| CartPole Balance | 52 | 20 | 210 |
| Acrobot Swing-Up | 56 | 20 | 220 |
| Multi-Armed Bandit | 40 | 16 | 160 |
| MiniGrid DoorKey | 88 | 34 | 380 |

## Logic Notes

The dashboard currently uses a deterministic simulated evaluator for planning
experiments. See [docs/evaluator-logic.md](docs/evaluator-logic.md) for the
inputs, derived scores, and verdict rules.

The Lab view also generates a concrete behavior trace for the selected task,
benchmark template, prompt condition, and demo budget. Trace export is available
as `behaviorprompt-trace.json`.

## Development

Prerequisite:

- Node.js `>=22.13.0`

Commands:

```bash
npm install
npm run dev
npm run lint
npm run build
```

The project uses the Sites-compatible `vinext` starter. The main dashboard lives
in `app/page.tsx`; hosting bindings live in `.openai/hosting.json`.
