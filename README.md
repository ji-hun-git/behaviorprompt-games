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
- readiness tracking for environments, demos, agent adapters, metrics, and paper
  positioning
- condition comparison, sufficiency matrix, and benchmark coverage views
- classic-inspired game counts across 12 task templates, 1,008 generated
  levels, 276 held-out transfer levels, and 2,990 behavior demo clips
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

## Classic-Inspired Game Bank

The first pass uses classic game patterns as controlled task priors rather than
direct reproductions of the original games.

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
