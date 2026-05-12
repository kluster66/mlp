# MLX Log Parser

Outil de visualisation et d'analyse des logs d'entraînement `mlx_lm.lora`. Fichier HTML autonome, aucune dépendance, aucun serveur requis — ouvrir directement dans un navigateur.

| Fichier | Langue |
|---|---|
| `mlx_log_parser.html` | Français |
| `mlx_log_parser_en.html` | English |

## Architecture

Tout réside dans un seul fichier HTML :

| Composant | Rôle |
|---|---|
| `mlx_log_parser.html` | Interface principale en français : CSS, HTML, JavaScript vanilla dans un seul fichier |
| `mlx_log_parser_en.html` | Version anglaise du même outil |

Le pipeline JS est : `parseLogs()` → `renderResults()` → `renderStats()` + `renderChart()` + `renderVerdict()` + `renderTable()` + `renderMarkdown()`.

## Prérequis

Aucun. Un navigateur moderne suffit (Chrome, Firefox, Safari, Edge).

## Installation

Aucune installation. Télécharger ou cloner le dépôt, puis ouvrir `mlx_log_parser.html` dans un navigateur.

## Utilisation

1. Ouvrir `mlx_log_parser.html` dans un navigateur
2. Coller le contenu d'une log `mlx_lm.lora` dans la zone de texte
3. Cliquer **Analyser**

Format de log attendu :
```
Iter 1: Val loss 2.742, Val took 1.153s
Iter 10: Train loss 2.068, Learning Rate 1.000e-05, It/sec 1.809, Tokens/sec 484.562
Iter 100: Val loss 0.759, Val took 0.325s
...
```

Les lignes non reconnues sont ignorées — coller la log brute telle quelle.

## Résultats produits

- **Statistiques** : val loss initiale, meilleure val loss, meilleur checkpoint, train loss finale, itération de début d'overfit
- **Graphique** : courbes train loss + val loss avec deux marqueurs d'overfit
- **Verdict** : analyse avec métriques chiffrées (écart absolu et relatif, proportion des itérations en overfit, gap de généralisation train/val) et un score de fiabilité selon le nombre de points de validation
- **Tableau** : mesures aux checkpoints de validation avec badges meilleur / overfit-start / seuil 1%
- **Export Markdown** : tableau Markdown prêt à coller dans Obsidian
- **Export HTML** : rapport autonome téléchargeable (graphique embarqué en base64)

## Détection de l'overfitting

Deux seuils distincts sont affichés sur le graphique et dans le verdict :

- **Début overfit** (point jaune) : premier point de validation après le minimum où la val loss remonte, même légèrement.
- **Seuil 1%** (point rouge) : premier saut consécutif >1% entre deux points de validation consécutifs.

Le **checkpoint recommandé** est toujours l'itération avec la val loss absolument minimale.

La **fiabilité de la détection** dépend du nombre de points de validation dans la log (`--steps-per-eval`) : faible avec 2–3 points, élevée avec 7+.

## Documentation

- [docs/FUNCTIONS.md](docs/FUNCTIONS.md) — référence complète de toutes les fonctions (français)
- [docs/FLOWCHART.md](docs/FLOWCHART.md) — diagramme de flux Mermaid (français)
- [docs/FUNCTIONS_en.md](docs/FUNCTIONS_en.md) — function reference (English)
- [docs/FLOWCHART_en.md](docs/FLOWCHART_en.md) — flow diagram (English)
