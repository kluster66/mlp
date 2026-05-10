# Function Reference — MLX Log Parser

---

## `parseLogs()`

### In
No parameters. Reads directly from the DOM: `document.getElementById('logInput').value`.

### Transform
Splits the raw text line by line and applies two regexes on each line:
- `/Iter\s+(\d+):\s+Train loss\s+([\d.]+)/` → populates `trainPoints[]`
- `/Iter\s+(\d+):\s+Val loss\s+([\d.]+)/` → populates `valPoints[]`

If the field is empty or no data is found, displays an error message via `showError()` and stops.

### Out
Returns nothing. Calls `renderResults(trainPoints, valPoints)` if parsing succeeds.

---

## `renderResults(trainPoints, valPoints)`

### In
| Parameter | Type | Description |
|---|---|---|
| `trainPoints` | `{iter: number, loss: number}[]` | Parsed train loss data points |
| `valPoints` | `{iter: number, loss: number}[]` | Parsed val loss data points |

### Transform
Orchestrates the entire rendering pipeline:
1. Makes the `#results` section visible
2. Computes `bestVal`: the point in `valPoints` with the lowest loss
3. Computes `overfitStart`: first point after `bestVal` where `loss > bestVal.loss`
4. Computes `overfitMax`: first consecutive jump >1% starting from `overfitStart`
5. Calls in order: `renderStats`, `renderChart`, `renderVerdict`, `renderTable`, `renderMarkdown`
6. Scrolls the page to `#results`

### Out
Returns nothing. Side effects: full display of the results section in the DOM.

---

## `renderStats(firstVal, lastTrain, bestVal, overfitStart, totalIters)`

### In
| Parameter | Type | Description |
|---|---|---|
| `firstVal` | `{iter, loss}` \| `null` | First val loss data point |
| `lastTrain` | `{iter, loss}` \| `null` | Last train loss data point |
| `bestVal` | `{iter, loss}` \| `null` | Minimum val loss data point |
| `overfitStart` | `{iter, loss}` \| `null` | First detected overfit point |
| `totalIters` | `number` | Total number of train data points |

### Transform
Builds an array of 6 descriptors (`label`, `value`, `cls`) for the key metrics:
- Initial val loss, best val loss, best checkpoint
- Final train loss, overfit start iteration (or "Non"), total iterations

Generates the `.stat-card` HTML and injects it into `#statsGrid`.

### Out
Returns nothing. Side effect: `#statsGrid` innerHTML updated.

---

## `renderChart(trainPoints, valPoints, bestVal, overfitStart, overfitMax)`

### In
| Parameter | Type | Description |
|---|---|---|
| `trainPoints` | `{iter, loss}[]` | Train loss series |
| `valPoints` | `{iter, loss}[]` | Val loss series |
| `bestVal` | `{iter, loss}` \| `null` | Minimum val loss point |
| `overfitStart` | `{iter, loss}` \| `null` | Overfit start point |
| `overfitMax` | `{iter, loss}` \| `null` | 1% overfit threshold point |

### Transform
Draws on `<canvas id="lossChart">` using the Canvas 2D API:
- Handles DPR (Device Pixel Ratio) manually for Retina displays
- Computes min/max ranges for the X axis (iterations) and Y axis (loss)
- Draws a horizontal grid with Y labels, and evenly spaced X labels
- Draws two curves via the internal `drawLine()` helper: train (purple) and val (pink), with dots if fewer than 20 points
- Adds a dashed vertical line at `bestVal`
- If `overfitStart`: yellow circle + `↑ overfit (iter)` label
- If `overfitMax ≠ overfitStart`: red circle + dashed vertical line + `⚠ seuil (iter)` label
- Shows or hides `#overfitStartLegend` and `#overfitMaxLegend`

### Out
Returns nothing. Side effects: canvas redrawn, legend element visibility updated.

---

## `renderVerdict(bestVal, overfitStart, overfitMax, trainPoints, valPoints)`

### In
| Parameter | Type | Description |
|---|---|---|
| `bestVal` | `{iter, loss}` \| `null` | Minimum val loss point |
| `overfitStart` | `{iter, loss}` \| `null` | Overfit start point |
| `overfitMax` | `{iter, loss}` \| `null` | 1% overfit threshold point |
| `trainPoints` | `{iter, loss}[]` | Full train loss series |
| `valPoints` | `{iter, loss}[]` | Full val loss series |

### Transform
Computes a reliability score based on the number of validation points (`n`):
- ≥ 7 → "high", ≥ 4 → "medium", ≥ 2 → "low", < 2 → "very low"

**Overfit detected branch** (`overfitStart` is not null):
- Computes the absolute and relative gap between final and minimum val loss
- Computes overfit duration (in iters) and its percentage of the total run
- Computes the train/val generalisation gap
- Builds an HTML string with metrics and recommendations (checkpoint to use, dataset size, hyperparameters)

**No overfit branch**:
- Analyses the trend over the last 2 val loss points
- Analyses convergence over the last 20% of train loss points
- Builds forward-looking recommendations (continue training, increase dataset size, etc.)

### Out
Returns nothing. Side effects: `#verdictIcon` and `#verdictText` updated in the DOM.

---

## `buildIterRows(trainPoints, valPoints)`

### In
| Parameter | Type | Description |
|---|---|---|
| `trainPoints` | `{iter, loss}[]` | Train loss series |
| `valPoints` | `{iter, loss}[]` | Val loss series |

### Transform
Merges both series into a `Map<iter → {train?, val?}>`. Then applies a row selection filter:
- All iterations where a val loss exists
- The first and last train iteration (to frame the run)

Sorts the selected iterations in ascending order.

### Out
Returns `{ iters: Map, sorted: number[] }`:
- `iters`: the full Map of iter → `{train?, val?}`
- `sorted`: the filtered, sorted array of iterations to display

---

## `renderTable(trainPoints, valPoints, bestVal, overfitStart, overfitMax)`

### In
| Parameter | Type | Description |
|---|---|---|
| `trainPoints` | `{iter, loss}[]` | Train loss series |
| `valPoints` | `{iter, loss}[]` | Val loss series |
| `bestVal` | `{iter, loss}` \| `null` | Best checkpoint |
| `overfitStart` | `{iter, loss}` \| `null` | Overfit start |
| `overfitMax` | `{iter, loss}` \| `null` | 1% threshold |

### Transform
Calls `buildIterRows()` to get the rows to display. For each iteration, determines which badges and status text apply:
- `badge-best` + "← checkpoint recommandé" if `iter === bestVal.iter`
- `badge-overfit-start` + "↑ val loss remonte" if `iter === overfitStart.iter`
- `badge-overfit-max` + "⚠ seuil 1% franchi" if `iter === overfitMax.iter` and `overfitMax ≠ overfitStart`

Applies the `best-row` class to the best checkpoint `<tr>`. Formats numeric values to 3 decimal places, displays `—` when data is missing.

### Out
Returns nothing. Side effect: `#tableBody` innerHTML updated.

---

## `renderMarkdown(trainPoints, valPoints, bestVal, overfitStart)`

### In
| Parameter | Type | Description |
|---|---|---|
| `trainPoints` | `{iter, loss}[]` | Train loss series |
| `valPoints` | `{iter, loss}[]` | Val loss series |
| `bestVal` | `{iter, loss}` \| `null` | Best checkpoint |
| `overfitStart` | `{iter, loss}` \| `null` | Overfit start |

### Transform
Calls `buildIterRows()` to get the same rows as the HTML table. Builds a GFM Markdown string with a table header (`| Iteration | Train loss | Val loss |`). For each row, appends a text suffix in the val loss column: ` ← meilleur checkpoint` or ` ← début overfit` where applicable.

### Out
Returns nothing. Side effect: `#markdownOut` textContent updated with the Markdown string.

---

## `exportReport()`

### In
No parameters. Reads the current DOM state: canvas, verdict, table, stat cards.

### Transform
Captures the displayed data:
- Chart encoded as base64 via `canvas.toDataURL('image/png')`
- Verdict icon and HTML
- `<tbody>` innerHTML
- Labels, values, and CSS classes from each `.stat-card`

Builds a fully self-contained HTML document with inline CSS (minified copy of the main stylesheet), the captured data, and a timestamped footer. Creates a `Blob`, generates a temporary URL via `URL.createObjectURL`, triggers a download named `mlx-report-YYYY-MM-DD.html`, then revokes the URL.

### Out
Returns nothing. Side effect: download of a standalone `.html` file triggered in the browser.

---

## `copyMarkdown(e)`

### In
| Parameter | Type | Description |
|---|---|---|
| `e` | `Event` | Click event from the "Copier le Markdown" button |

### Transform
Reads the `textContent` of `#markdownOut` and copies it to the clipboard via `navigator.clipboard.writeText()`. On success, temporarily changes the button label to "✓ Copié !" for 1.5 seconds, then restores it.

### Out
Returns nothing. Side effects: clipboard updated, button label temporarily changed.

---

## `showError(msg)`

### In
| Parameter | Type | Description |
|---|---|---|
| `msg` | `string` | Error message to display |

### Transform
Writes `msg` to the `textContent` of `#errorMsg` and makes the element visible (`display: block`).

### Out
Returns nothing. Side effect: `#errorMsg` div made visible with the message.

---

## `clearAll()`

### In
No parameters.

### Transform
Clears the `#logInput` textarea, hides the `#results` section, and hides `#errorMsg`.

### Out
Returns nothing. Side effect: full UI reset.

---

## `loadExample()`

### In
No parameters.

### Transform
Injects a realistic fictional training log into the `#logInput` textarea: a 500-iteration LoRA run with 3 validation points (iter 1, 200, 400, 500) showing a descending then rising val loss curve.

### Out
Returns nothing. Side effect: textarea filled with the example log, ready to be analysed.
