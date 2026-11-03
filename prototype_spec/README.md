## Prototype Spec Assets

Everything the [spec](../README.md) points to. The prototype itself is in [`docs/`](../docs/), which is the folder GitHub Pages serves.

| Path | What's in it |
| --- | --- |
| [`component-states/`](component-states/) | Screenshots of each component in every state: buttons, chips, checkboxes, text fields, and tee time cards. Taken from the [component states page](https://hqluke.github.io/3650-Case-Study-02/states.html) |
| [`flow/`](flow/) | Screenshots of each step and state of the booking flow at desktop and phone width |
| [`interaction-flow.md`](interaction-flow.md) | The booking flow and the Pay button's states as diagrams |
| [`code-snippets.md`](code-snippets.md) | Annotated code for each state and accessibility hook |
| [`target-size-audit.md`](target-size-audit.md) | Every target's size and spacing at 390 px and 1280 px |
| [`contrast-results.md`](contrast-results.md) | Every color pair checked against WCAG 2.1 AA |
| [`axe-results.md`](axe-results.md) | axe-core results for seven page states |
| [`scripts/`](scripts/) | The scripts that produce the files above |

### Regenerating

Serve the prototype, then run the scripts from the repo root. `capture.sh` and `audit.mjs` drive Chrome through [`chrome-devtools-axi`](https://www.npmjs.com/package/chrome-devtools-axi).

```sh
python3 -m http.server 8765 --directory docs
node prototype_spec/scripts/contrast.mjs > prototype_spec/contrast-results.md
node prototype_spec/scripts/audit.mjs        # target-size-audit.md and axe-results.md
prototype_spec/scripts/capture.sh            # every screenshot
```

The screenshots and audits pin the clock with `?now=2026-11-06T09:30`, so the tee times come out the same on every run.
