# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file, zero-dependency HTML tool for visualising and analysing `mlx_lm.lora` training logs. Open `mlx_log_parser.html` directly in a browser — no build step, no server, no npm.

## Architecture

Everything lives in `mlx_log_parser.html`:

- **CSS** (`:root` CSS variables for the dark theme, scoped inside `<style>`)
- **HTML** (input zone → results section hidden by default via `#results { display: none }`)
- **Vanilla JS** (`<script>` at the bottom, no framework, no external JS)

The JS pipeline is:

1. `parseLogs()` — regex-parses raw log text into `trainPoints[]` and `valPoints[]` (`{iter, loss}` objects)
2. `renderResults()` — computes `bestVal`, `overfitStart`, `overfitMax`, then orchestrates all render calls
3. `buildIterRows()` — shared helper that merges train+val points by iteration; used by both `renderTable` and `renderMarkdown`
4. `renderStats()` — fills the stat cards grid
5. `renderChart()` — draws on a `<canvas>` using the 2D API (no Chart.js); handles DPR scaling manually; draws two overfit markers
6. `renderVerdict()` — generates the overfitting analysis with raw metrics and a confidence score
7. `renderTable()` — renders checkpoint rows with three badge types (best / overfit-start / overfit-max)
8. `renderMarkdown()` — builds a Markdown table string for Obsidian export
9. `exportReport()` — generates a self-contained HTML file with the chart embedded as base64

**Overfitting detection** (`renderResults`): two signals are computed from `valPoints[]`:
- `overfitStart`: first val point after `bestVal` where `loss > bestVal.loss` (any upward tick)
- `overfitMax`: first consecutive increase >1% starting from `overfitStart`

Both are `{iter, loss}` objects (or `null`). They are passed to all render functions. `overfitMax` is only drawn/shown when it differs from `overfitStart`.

**Log format expected:**
```
Iter 1: Val loss 2.742, Val took 1.153s
Iter 10: Train loss 2.068, Learning Rate 1.000e-05, It/sec 1.809, ...
```

## Key implementation details

**UI language**: All visible text (labels, button text, verdict messages, error messages, JS inline comments) is in French. Keep new UI-facing strings in French.

**`buildIterRows()` filtering**: The table and Markdown export do not show every train iteration — only iterations where val data exists, plus the first and last train iteration. This is intentional to keep the table scannable.

**`renderVerdict()` confidence scoring**: Reliability is graded by number of val points: ≥7 → "élevée", ≥4 → "moyenne", ≥2 → "faible", <2 → "très faible". The overfitting-absent branch also analyses val trend (last 2 points) and train convergence (last 20% of train points) to give forward-looking recommendations.

**`exportReport()` CSS duplication**: The exported standalone HTML contains its own minified copy of the CSS. If you change styles in the main `<style>` block, mirror the relevant changes in the template string inside `exportReport()`.

**Regex patterns** used in `parseLogs()`:
- Train: `/Iter\s+(\d+):\s+Train loss\s+([\d.]+)/`
- Val: `/Iter\s+(\d+):\s+Val loss\s+([\d.]+)/`

## Development workflow

Open the file in a browser. Edit → save → refresh. No tooling required.

The `loadExample()` function embeds a realistic 500-iteration LoRA run directly in the JS — use it to quickly verify rendering without needing a real log file.
