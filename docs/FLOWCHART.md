# Diagramme de flux — MLX Log Parser

```mermaid
flowchart TD
    USER(["Utilisateur colle une log\net clique 'Analyser'"])
    EXAMPLE(["Utilisateur clique\n'Charger un exemple'"])
    CLEAR(["Utilisateur clique 'Effacer'"])

    LOAD["loadExample()\nInjecte une log fictive\ndans #logInput"]
    CLEARALL["clearAll()\nVide #logInput, masque #results"]

    PARSE["parseLogs()\nLit #logInput\nApplique regex train + val"]

    ERR{"Données\ntrouvées ?"}
    SHOWERR["showError()\nAffiche #errorMsg"]

    RENDER["renderResults()\nCalcule bestVal,\noverfitStart, overfitMax"]

    STATS["renderStats()\nConstruit 6 cartes de métriques"]
    CHART["renderChart()\nDessine le canvas\nDPR + axes + courbes + marqueurs"]
    DRAWLINE["drawLine()\nTrace une courbe sur le canvas"]
    VERDICT["renderVerdict()\nGénère l'analyse HTML\navec score de fiabilité"]
    TABLE["renderTable()\nGénère les lignes de tableau\navec badges"]
    MARKDOWN["renderMarkdown()\nGénère la chaîne GFM\npour Obsidian"]
    BUILDROWS["buildIterRows()\nFusionne train+val\nFiltre les itérations à afficher"]

    OVERFIT{"overfitStart\nnon null ?"}
    OVERFITBRANCH["Calcule écart, durée,\ngap train/val\nGénère recommandations"]
    TREND["Analyse tendance val loss\net convergence train loss\nGénère recommandations"]

    COPY(["Utilisateur clique\n'Copier le Markdown'"])
    EXPORT(["Utilisateur clique\n'Exporter le rapport'"])

    COPYMD["copyMarkdown()\nClipboard API"]
    EXPORTREP["exportReport()\nCapture DOM + canvas base64\nGénère HTML autonome"]

    CLIPBOARD(["Presse-papiers système"])
    DOWNLOAD(["Téléchargement\nmlx-report-YYYY-MM-DD.html"])

    STATSDOM[("#statsGrid")]
    CHARTDOM[("#lossChart")]
    VERDICTDOM[("#verdictBox")]
    TABLEDOM[("#tableBody")]
    MDDOM[("#markdownOut")]

    USER --> PARSE
    EXAMPLE --> LOAD --> PARSE
    CLEAR --> CLEARALL

    PARSE --> ERR
    ERR -->|Non| SHOWERR
    ERR -->|Oui| RENDER

    RENDER --> STATS --> STATSDOM
    RENDER --> CHART
    CHART --> DRAWLINE --> CHARTDOM
    RENDER --> VERDICT
    VERDICT --> OVERFIT
    OVERFIT -->|Oui| OVERFITBRANCH --> VERDICTDOM
    OVERFIT -->|Non| TREND --> VERDICTDOM
    RENDER --> TABLE
    RENDER --> MARKDOWN
    TABLE --> BUILDROWS --> TABLEDOM
    MARKDOWN --> BUILDROWS --> MDDOM

    COPY --> COPYMD --> CLIPBOARD
    EXPORT --> EXPORTREP --> DOWNLOAD
```
