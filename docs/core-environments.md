# Core Environments

The app now includes a deterministic benchmark engine for the three core task
families. These are not just UI estimates: the engine executes action sequences
against explicit gridworld rules and returns rollout logs.

## Included Environments

| Environment | Family | Rule |
| --- | --- | --- |
| DoorKey Gridworld | procedural | Collect the key before opening the locked door, then reach the goal. |
| SwitchBridge Gridworld | causal | Activate the lever before crossing the bridge over the hazard. |
| Ownership Gridworld | social | Ask the owner for permission before opening the owned chest. |

## Prompt Conditions

The engine runs the same environments under:

- no prompt
- text prompt
- behavior prompt
- text plus behavior prompt

Each condition maps to a different deterministic policy plan. No-prompt plans
usually try a direct route and can violate the task rule. Text, behavior, and
hybrid plans use the relevant prerequisite, intervention, or social interaction
before completing the task.

## Rollout Outputs

Each episode records:

- environment id and name
- family
- prompt condition
- seed
- success
- total reward
- steps used
- violation count
- terminal reason
- per-step actions, observations, inventory, flags, rewards, and violations

Use **Run Core Engine Batch** in the dashboard to produce these results, then
export them as `behaviorprompt-core-engine-results.json`.
