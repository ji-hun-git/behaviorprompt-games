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
- condition comparison, sufficiency matrix, and benchmark coverage views
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
