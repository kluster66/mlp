# Référence des fonctions — MLX Log Parser

---

## `parseLogs()`

### In
Aucun paramètre. Lit directement le DOM : `document.getElementById('logInput').value`.

### Transform
Découpe le texte brut ligne par ligne et applique deux regex sur chaque ligne :
- `/Iter\s+(\d+):\s+Train loss\s+([\d.]+)/` → alimente `trainPoints[]`
- `/Iter\s+(\d+):\s+Val loss\s+([\d.]+)/` → alimente `valPoints[]`

Si le champ est vide ou qu'aucune donnée n'est trouvée, affiche un message d'erreur via `showError()` et s'arrête.

### Out
Ne renvoie rien. Appelle `renderResults(trainPoints, valPoints)` si le parsing réussit.

---

## `renderResults(trainPoints, valPoints)`

### In
| Paramètre | Type | Description |
|---|---|---|
| `trainPoints` | `{iter: number, loss: number}[]` | Points de train loss parsés |
| `valPoints` | `{iter: number, loss: number}[]` | Points de val loss parsés |

### Transform
Orchestre l'ensemble du pipeline de rendu :
1. Rend la section `#results` visible
2. Calcule `bestVal` : point de `valPoints` avec la loss minimale
3. Calcule `overfitStart` : premier point après `bestVal` où `loss > bestVal.loss`
4. Calcule `overfitMax` : premier saut consécutif >1% à partir de `overfitStart`
5. Appelle dans l'ordre : `renderStats`, `renderChart`, `renderVerdict`, `renderTable`, `renderMarkdown`
6. Fait défiler la page jusqu'à `#results`

### Out
Ne renvoie rien. Effets de bord : affichage complet de la section résultats dans le DOM.

---

## `renderStats(firstVal, lastTrain, bestVal, overfitStart, totalIters)`

### In
| Paramètre | Type | Description |
|---|---|---|
| `firstVal` | `{iter, loss}` \| `null` | Premier point de val loss |
| `lastTrain` | `{iter, loss}` \| `null` | Dernier point de train loss |
| `bestVal` | `{iter, loss}` \| `null` | Point de val loss minimale |
| `overfitStart` | `{iter, loss}` \| `null` | Premier point d'overfit détecté |
| `totalIters` | `number` | Nombre total de points de train |

### Transform
Construit un tableau de 6 descripteurs (`label`, `value`, `cls`) correspondant aux métriques clés :
- Val loss initiale, meilleure val loss, meilleur checkpoint
- Train loss finale, itération de début d'overfit (ou "Non"), total d'itérations

Génère le HTML des cartes `.stat-card` et l'injecte dans `#statsGrid`.

### Out
Ne renvoie rien. Effet de bord : `innerHTML` de `#statsGrid` mis à jour.

---

## `renderChart(trainPoints, valPoints, bestVal, overfitStart, overfitMax)`

### In
| Paramètre | Type | Description |
|---|---|---|
| `trainPoints` | `{iter, loss}[]` | Série train loss |
| `valPoints` | `{iter, loss}[]` | Série val loss |
| `bestVal` | `{iter, loss}` \| `null` | Point minimum de val loss |
| `overfitStart` | `{iter, loss}` \| `null` | Début de l'overfit |
| `overfitMax` | `{iter, loss}` \| `null` | Seuil 1% d'overfit |

### Transform
Dessine sur le `<canvas id="lossChart">` avec l'API Canvas 2D :
- Gère le DPR (Device Pixel Ratio) manuellement pour les écrans Retina
- Calcule les plages min/max des axes X (itérations) et Y (loss)
- Dessine une grille horizontale avec labels Y, et des labels X espacés uniformément (max 6)
- Dessine deux courbes via la sous-fonction interne `drawLine()` : train (violet) et val (rose), avec des points si la série contient moins de 20 valeurs
- Ajoute une ligne verticale pointillée au `bestVal`
- Si `overfitStart` : cercle jaune + label `↑ overfit (iter)`
- Si `overfitMax ≠ overfitStart` : cercle rouge + ligne verticale pointillée + label `⚠ seuil (iter)`
- Affiche ou masque les entrées de légende `#overfitStartLegend` et `#overfitMaxLegend`

### Out
Ne renvoie rien. Effets de bord : canvas redessiné, visibilité des éléments de légende mise à jour.

---

## `drawLine(points, color)` *(interne à `renderChart`)*

### In
| Paramètre | Type | Description |
|---|---|---|
| `points` | `{iter, loss}[]` | Série de points à tracer |
| `color` | `string` | Couleur CSS de la ligne |

### Transform
Trace un chemin `lineTo` sur le contexte canvas parent (`ctx`). Si la série contient moins de 20 points, ajoute un cercle de rayon 3,5 px à chaque coordonnée pour les rendre individuellement visibles.

### Out
Ne renvoie rien. Effet de bord : tracé sur le canvas hérité de `renderChart`.

---

## `renderVerdict(bestVal, overfitStart, overfitMax, trainPoints, valPoints)`

### In
| Paramètre | Type | Description |
|---|---|---|
| `bestVal` | `{iter, loss}` \| `null` | Point de val loss minimale |
| `overfitStart` | `{iter, loss}` \| `null` | Début de l'overfit |
| `overfitMax` | `{iter, loss}` \| `null` | Seuil 1% d'overfit |
| `trainPoints` | `{iter, loss}[]` | Série complète train loss |
| `valPoints` | `{iter, loss}[]` | Série complète val loss |

### Transform
Calcule un score de fiabilité selon le nombre de points de validation (`n`) :
- ≥ 7 → "élevée", ≥ 4 → "moyenne", ≥ 2 → "faible", < 2 → "très faible"

**Branche overfit détecté** (`overfitStart` non null) :
- Calcule l'écart absolu et relatif entre val loss finale et minimale
- Calcule la durée d'overfit en itérations et son pourcentage du run
- Calcule le gap de généralisation train/val
- Compose un texte HTML avec métriques chiffrées et recommandations (checkpoint à utiliser, taille du dataset, hyperparamètres)

**Branche pas d'overfit** :
- Analyse la tendance sur les 2 derniers points de val loss
- Analyse la convergence sur les 20 derniers % de train loss
- Compose des recommandations prospectives (continuer l'entraînement, augmenter le dataset, etc.)

### Out
Ne renvoie rien. Effets de bord : `#verdictIcon` et `#verdictText` mis à jour dans le DOM.

---

## `buildIterRows(trainPoints, valPoints)`

### In
| Paramètre | Type | Description |
|---|---|---|
| `trainPoints` | `{iter, loss}[]` | Série train loss |
| `valPoints` | `{iter, loss}[]` | Série val loss |

### Transform
Fusionne les deux séries dans une `Map<iter → {train?, val?}>`. Applique ensuite un filtre de sélection :
- Toutes les itérations où une val loss existe
- La première et la dernière itération de train (pour encadrer le run)

Trie les itérations retenues par ordre croissant.

### Out
Retourne `{ iters: Map, sorted: number[] }` :
- `iters` : la Map complète `iter → {train?, val?}`
- `sorted` : le tableau filtré et trié des itérations à afficher

---

## `renderTable(trainPoints, valPoints, bestVal, overfitStart, overfitMax)`

### In
| Paramètre | Type | Description |
|---|---|---|
| `trainPoints` | `{iter, loss}[]` | Série train loss |
| `valPoints` | `{iter, loss}[]` | Série val loss |
| `bestVal` | `{iter, loss}` \| `null` | Meilleur checkpoint |
| `overfitStart` | `{iter, loss}` \| `null` | Début overfit |
| `overfitMax` | `{iter, loss}` \| `null` | Seuil 1% |

### Transform
Appelle `buildIterRows()` pour obtenir les lignes à afficher. Pour chaque itération, détermine les badges et le texte de statut applicables :
- `badge-best` + "← checkpoint recommandé" si `iter === bestVal.iter`
- `badge-overfit-start` + "↑ val loss remonte" si `iter === overfitStart.iter`
- `badge-overfit-max` + "⚠ seuil 1% franchi" si `iter === overfitMax.iter` et `overfitMax ≠ overfitStart`

Applique la classe `best-row` sur le `<tr>` du meilleur checkpoint. Formate les valeurs numériques à 3 décimales, affiche `—` si la donnée est absente.

### Out
Ne renvoie rien. Effet de bord : `innerHTML` de `#tableBody` mis à jour.

---

## `renderMarkdown(trainPoints, valPoints, bestVal, overfitStart)`

### In
| Paramètre | Type | Description |
|---|---|---|
| `trainPoints` | `{iter, loss}[]` | Série train loss |
| `valPoints` | `{iter, loss}[]` | Série val loss |
| `bestVal` | `{iter, loss}` \| `null` | Meilleur checkpoint |
| `overfitStart` | `{iter, loss}` \| `null` | Début overfit |

### Transform
Appelle `buildIterRows()` pour obtenir les mêmes lignes que le tableau HTML. Construit une chaîne Markdown avec en-tête de tableau GFM (`| Itération | Train loss | Val loss |`). Ajoute un suffixe dans la colonne val loss : ` ← meilleur checkpoint` ou ` ← début overfit` selon le cas.

### Out
Ne renvoie rien. Effet de bord : `textContent` de `#markdownOut` mis à jour avec la chaîne Markdown.

---

## `exportReport()`

### In
Aucun paramètre. Lit l'état courant du DOM : canvas, verdict, tableau, cartes de stats.

### Transform
Capture les données affichées :
- Chart encodé en base64 via `canvas.toDataURL('image/png')`
- Icône et HTML du verdict
- `innerHTML` du `<tbody>` du tableau
- Labels, valeurs et classes CSS de chaque `.stat-card`

Construit un document HTML autonome avec CSS inline (copie minifiée du CSS principal), les données capturées et un footer horodaté. Crée un `Blob`, génère une URL temporaire via `URL.createObjectURL`, déclenche un téléchargement nommé `mlx-report-YYYY-MM-DD.html`, puis révoque l'URL.

### Out
Ne renvoie rien. Effet de bord : téléchargement d'un fichier `.html` autonome déclenché dans le navigateur.

---

## `copyMarkdown(e)`

### In
| Paramètre | Type | Description |
|---|---|---|
| `e` | `Event` | Événement click du bouton "Copier le Markdown" |

### Transform
Lit le `textContent` de `#markdownOut` et le copie dans le presse-papiers via `navigator.clipboard.writeText()`. Change temporairement le label du bouton en "✓ Copié !" pendant 1,5 secondes puis le restaure.

### Out
Ne renvoie rien. Effets de bord : presse-papiers mis à jour, label du bouton modifié temporairement.

---

## `showError(msg)`

### In
| Paramètre | Type | Description |
|---|---|---|
| `msg` | `string` | Message d'erreur à afficher |

### Transform
Écrit `msg` dans le `textContent` de `#errorMsg` et rend l'élément visible (`display: block`).

### Out
Ne renvoie rien. Effet de bord : `div#errorMsg` rendue visible avec le message.

---

## `clearAll()`

### In
Aucun paramètre.

### Transform
Vide le textarea `#logInput`, masque la section `#results` et masque `#errorMsg`.

### Out
Ne renvoie rien. Effet de bord : remise à zéro complète de l'interface.

---

## `loadExample()`

### In
Aucun paramètre.

### Transform
Injecte dans le textarea `#logInput` une log d'entraînement fictive mais réaliste : run LoRA de 500 itérations avec 3 points de validation (iter 1, 200, 400, 500) montrant une descente puis une remontée de val loss.

### Out
Ne renvoie rien. Effet de bord : textarea rempli avec la log d'exemple, prêt à être analysé.
