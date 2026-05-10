# MLX Log Parser

Visualisation and analysis tool for `mlx_lm.lora` training logs. Single HTML file, no dependencies, no server required.

| File | Language |
|---|---|
| `mlx_log_parser.html` | Français |
| `mlx_log_parser_en.html` | English |

## Usage

1. Open either HTML file in a browser
2. Paste your MLX training log content
3. Click **Analyze** / **Analyser**

## Expected log format

```
Iter 1: Val loss 2.742, Val took 1.153s
Iter 10: Train loss 2.068, Learning Rate 1.000e-05, It/sec 1.809, Tokens/sec 484.562
Iter 100: Val loss 0.759, Val took 0.325s
...
```

Unrecognised lines are ignored — you can paste the raw log as-is.

## Output

- **Statistics**: initial val loss, best val loss, best checkpoint, final train loss, overfit start iteration
- **Chart**: train loss + val loss curve with two overfit markers (see below)
- **Verdict**: analysis with raw metrics (absolute and relative gap, proportion of iterations in overfit, train/val generalisation gap) and a reliability score based on the number of validation points
- **Table**: measurements at validation checkpoints with best / overfit-start / 1%-threshold badges
- **Markdown export**: Markdown table ready to paste into Obsidian
- **HTML export**: self-contained downloadable report (chart embedded as base64)

## Overfitting detection

Two distinct thresholds are shown on the chart and in the verdict:

- **Overfit start** (yellow dot): first validation point after the minimum where val loss ticks up, even slightly. This is where the model starts memorising instead of generalising — the real early signal.
- **1% threshold** (red dot): first consecutive jump >1% between two validation points. Marks when the degradation becomes significant.

The **recommended checkpoint** is always the iteration with the absolute minimum val loss, regardless of the thresholds.

**Detection reliability** depends on the number of validation points in the log (`--steps-per-eval`): low with 2–3 points, high with 7+.
