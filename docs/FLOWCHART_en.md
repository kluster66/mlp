# Flow Diagram — MLX Log Parser

```mermaid
flowchart TD
    USER(["User pastes a log\nand clicks 'Analyser'"])
    EXAMPLE(["User clicks\n'Load example'"])
    CLEAR(["User clicks 'Clear'"])

    LOAD["loadExample()\nInjects a sample log\ninto #logInput"]
    CLEARALL["clearAll()\nClears #logInput, hides #results"]

    PARSE["parseLogs()\nReads #logInput\nApplies train + val regexes"]

    ERR{"Data\nfound?"}
    SHOWERR["showError()\nShows #errorMsg"]

    RENDER["renderResults()\nComputes bestVal,\noverfitStart, overfitMax"]

    STATS["renderStats()\nBuilds 6 metric cards"]
    CHART["renderChart()\nDraws canvas\nDPR + axes + curves + markers"]
    DRAWLINE["drawLine()\nTraces one curve on canvas"]
    VERDICT["renderVerdict()\nGenerates HTML analysis\nwith reliability score"]
    TABLE["renderTable()\nGenerates table rows\nwith badges"]
    MARKDOWN["renderMarkdown()\nGenerates GFM string\nfor Obsidian"]
    BUILDROWS["buildIterRows()\nMerges train+val\nFilters iterations to display"]

    OVERFIT{"overfitStart\nnot null?"}
    OVERFITBRANCH["Computes gap, duration,\ntrain/val generalisation gap\nGenerates recommendations"]
    TREND["Analyses val loss trend\nand train loss convergence\nGenerates recommendations"]

    COPY(["User clicks\n'Copy Markdown'"])
    EXPORT(["User clicks\n'Export report'"])

    COPYMD["copyMarkdown()\nClipboard API"]
    EXPORTREP["exportReport()\nCaptures DOM + base64 canvas\nBuilds standalone HTML"]

    CLIPBOARD(["System clipboard"])
    DOWNLOAD(["Download\nmlx-report-YYYY-MM-DD.html"])

    STATSDOM[("#statsGrid")]
    CHARTDOM[("#lossChart")]
    VERDICTDOM[("#verdictBox")]
    TABLEDOM[("#tableBody")]
    MDDOM[("#markdownOut")]

    USER --> PARSE
    EXAMPLE --> LOAD --> PARSE
    CLEAR --> CLEARALL

    PARSE --> ERR
    ERR -->|No| SHOWERR
    ERR -->|Yes| RENDER

    RENDER --> STATS --> STATSDOM
    RENDER --> CHART
    CHART --> DRAWLINE --> CHARTDOM
    RENDER --> VERDICT
    VERDICT --> OVERFIT
    OVERFIT -->|Yes| OVERFITBRANCH --> VERDICTDOM
    OVERFIT -->|No| TREND --> VERDICTDOM
    RENDER --> TABLE
    RENDER --> MARKDOWN
    TABLE --> BUILDROWS --> TABLEDOM
    MARKDOWN --> BUILDROWS --> MDDOM

    COPY --> COPYMD --> CLIPBOARD
    EXPORT --> EXPORTREP --> DOWNLOAD
```
