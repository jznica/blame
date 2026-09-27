# Blame — a credit-assignment lab

An agent wanders for 200 steps and finally earns a reward. **Which of those steps deserve the credit?**

Blame is an interactive web lab that answers that question visually. Draw a gridworld, pick a learner, and watch reward flow backward through the agent's history as it learns. It compares the three classic answers from reinforcement learning:

| Learner | How it assigns credit |
|---|---|
| **Monte Carlo** | Waits until the episode ends, then credits every step toward the return that followed it. |
| **Q-learning** | Credits only the step it just took (one-step TD). News travels back one cell per success. |
| **SARSA(λ)** | Keeps a fading memory (eligibility trace) of recent steps and shares each surprise along it. |

## Features

- **Blame ribbon**: a bar per time step showing how much credit each step of the current episode received. On the first success in the corridor, Q-learning credits 1 step, SARSA(λ) about 6, Monte Carlo about 58.
- **Three overlays** on the grid: Blame (credit this episode), Memory (what the learner is currently holding responsible), Value (learned state values).
- **Editable world**: paint walls, +1 goals, −1 pits, +0.3 coins; move the start.
- **Live settings**: α, γ, ε, λ, optimistic initial values, and a slippery floor (stochastic transitions).
- **Cell inspector**: tap a cell to see its four action values.
- **Four guided experiments**: one-step vs traces, Monte Carlo on a maze, on- vs off-policy on a cliff, and how γ decides between a near coin and a far goal.
- **Race all three**: trains fresh agents (6 seeds each) on the current map and plots discounted return against the optimal value V*, computed by value iteration.

## Motion and cursor interaction

Every effect restates the core idea: recent steps glow brightest and older ones fade, the way an eligibility trace decays.

- **Backward credit sweep**: when a reward lands, a pulse travels from the goal back along the path, lighting each step in proportion to the credit it got. For Q-learning it dies after one cell; for Monte Carlo it runs the whole path.
- **Ribbon scrubbing**: hover (or drag, on touch) across the ribbon to see where the agent was on that step, which way it moved, and how much credit it earned.
- **Trace-field background**: faint agents random-walk a grid behind the page, leaving trails that decay like eligibility traces. When one reaches a reward, credit flashes backward along its trail. They treat your cursor as a reward and chase it; click any empty space to drop another. They move faster while you scroll.
- **Wordmark**: letters of "Blame" gain weight and colour by closeness to the cursor, like credit falling off with distance. On load, a sweep runs through them from the last letter back to the first.
- **Grid editing**: hover shows a preview of the tool and a tooltip with the cell's value and blame; drag paints with no gaps; right-drag or shift-drag erases; painted cells pop in.
- **Smooth scrolling** with a section bar that appears once you leave the header, highlights the current section, and shows progress as a fading trace.
- **Panels** light up around the cursor; experiment cards tilt slightly; sections rise into place as they scroll in; the race chart draws itself in and has a hover crosshair.
- Respects `prefers-reduced-motion`: smooth scrolling, the background animation, sweeps and reveals are all turned off.

## Run it

No install and no build tools.

- Open `index.html` in any modern browser, or
- serve the folder: `python3 -m http.server` and visit `http://localhost:8000`.

Deep links: `index.html#corridor`, `#maze`, `#cliff`, `#decoy` open a specific experiment.
Keyboard: `Space` play/pause, `s` single step.

## Project layout

```
core.js          Gridworld, value iteration, and the three learners (no DOM; runs in Node or the browser)
index.src.html   Interface source (markup, styles, rendering, controls)
build.sh         Inlines core.js into index.src.html -> index.html
index.html       Built single-file app (this is what you open)
test.js          Headless checks: every map is solvable, every learner improves, the γ lesson behaves as described
```

Rebuild after editing: `./build.sh`. Run tests: `node test.js`.

## Publish with GitHub Pages

1. Push this folder to a public GitHub repository.
2. Repository → Settings → Pages → Deploy from branch → `main`, folder `/ (root)`.
3. The app is live at `https://<username>.github.io/<repo>/`.

## Implementation notes

- **SARSA(λ)** uses replacing traces with a sparse active list, so an update costs O(trace length) rather than O(states × actions).
- **Monte Carlo** is every-visit with a constant step size, updated backward from the episode's end.
- **V\*** (the "best possible" reference line) comes from value iteration on the same map, including slip probability.
- Rewards: +1 goal, −1 pit, +0.3 coin, all terminal; no step cost, so discounting alone rewards speed. Episodes time out after 500 steps.
- Rendering is plain Canvas 2D; the page follows the system light/dark theme.
- The one third-party script is [Lenis](https://github.com/darkroomengineering/lenis) 1.3.26 for smooth scrolling, loaded from jsDelivr. If it can't load (offline), the page falls back to the browser's native smooth scrolling and everything else still works.

## Credits

- Algorithms follow Sutton & Barto, *Reinforcement Learning: An Introduction*, 2nd ed. (chapters 5, 6, 12).
- Smooth scrolling: Lenis by darkroom.engineering (MIT License).
- Fonts: Bricolage Grotesque, IBM Plex Sans, IBM Plex Mono (Google Fonts, SIL Open Font License).
- Built with help from Claude (Anthropic) as a coding assistant.

Built by Jenica A for Hack Atlantic 2026.
