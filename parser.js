// ─── State ────────────────────────────────────────────────
let currentTrainPoints  = [];
let currentValPoints    = [];
let currentBestVal      = null;
let currentOverfitStart = null;
let currentOverfitMax   = null;
let sortState = { col: 'iter', dir: 'asc' };

// ─── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDropzone();
  initSortableTable();
});

function initDropzone() {
  const zone      = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');

  // Prevent browser from opening dropped files
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt =>
    document.addEventListener(evt, e => e.preventDefault())
  );

  zone.addEventListener('dragenter', e => {
    e.preventDefault();
    zone.classList.add('drag-active');
  });
  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-active');
  });
  zone.addEventListener('dragleave', e => {
    if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-active');
  });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-active');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });
}

function initSortableTable() {
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => handleSort(th.dataset.col));
  });
}

// ─── File handling ─────────────────────────────────────────
function handleFile(file) {
  const name = file.name.toLowerCase();
  const isValid = name.endsWith('.log') || name.endsWith('.txt') || name.endsWith('.text') || file.type === 'text/plain';

  if (!isValid) {
    showError(`FORMAT NON SUPPORTÉ — Fichier attendu : .log ou .txt\nReçu : ${file.name} (${file.type || 'type inconnu'})`);
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('logInput').value = e.target.result;
    const sizeKb = (file.size / 1024).toFixed(1);
    document.getElementById('dropzoneFilename').textContent = `✓ ${file.name}  —  ${sizeKb} KB`;
    runAnalysis();
  };
  reader.onerror = () => showError('ERREUR LECTURE — Impossible de lire le fichier sélectionné.');
  reader.readAsText(file, 'utf-8');
}

// ─── Analysis entry points ─────────────────────────────────
function runAnalysis() { parseLogs(); }

function parseLogs() {
  const raw   = document.getElementById('logInput').value.trim();
  const errEl = document.getElementById('errorMsg');
  errEl.style.display = 'none';

  if (!raw) {
    showError('AUCUNE DONNÉE — Importez un fichier ou collez le contenu STDOUT avant d\'exécuter l\'analyse.');
    return;
  }

  const lines       = raw.split('\n');
  const trainPoints = [];
  const valPoints   = [];

  for (const line of lines) {
    // Train: Iter N: Train loss X[, Learning Rate X][, It/sec X]
    const tm = line.match(
      /Iter\s+(\d+):\s+Train loss\s+([\d.]+)(?:.*?Learning Rate\s+([\d.e+\-]+))?(?:.*?It\/sec\s+([\d.]+))?/
    );
    if (tm) {
      trainPoints.push({
        iter:  parseInt(tm[1]),
        loss:  parseFloat(tm[2]),
        lr:    tm[3] ?? null,
        itSec: tm[4] ? parseFloat(tm[4]) : null,
      });
    }

    // Val: Iter N: Val loss X
    const vm = line.match(/Iter\s+(\d+):\s+Val loss\s+([\d.]+)/);
    if (vm) {
      valPoints.push({ iter: parseInt(vm[1]), loss: parseFloat(vm[2]) });
    }
  }

  if (trainPoints.length === 0 && valPoints.length === 0) {
    showError(
      'FORMAT NON RECONNU — Aucune métrique extraite.\n' +
      'Vérifiez que le fichier contient des lignes "Iter X: Train loss" ou "Iter X: Val loss".'
    );
    return;
  }

  currentTrainPoints = trainPoints;
  currentValPoints   = valPoints;
  renderResults(trainPoints, valPoints);
}

// ─── Core rendering orchestration ─────────────────────────
function renderResults(trainPoints, valPoints) {
  document.getElementById('results').style.display = 'block';

  // Best val
  let bestVal = null;
  if (valPoints.length > 0) {
    bestVal = valPoints.reduce((a, b) => a.loss < b.loss ? a : b);
  }

  // overfitStart: first point after minimum where val loss rises
  let overfitStart = null;
  if (bestVal) {
    const bestIdx = valPoints.findIndex(p => p.iter === bestVal.iter);
    for (let i = bestIdx + 1; i < valPoints.length; i++) {
      if (valPoints[i].loss > bestVal.loss) { overfitStart = valPoints[i]; break; }
    }
  }

  // overfitMax: first consecutive jump >1% starting from overfitStart
  let overfitMax = null;
  if (overfitStart) {
    const startIdx = valPoints.findIndex(p => p.iter === overfitStart.iter);
    const prev = valPoints[startIdx - 1];
    if (prev && overfitStart.loss > prev.loss * 1.01) {
      overfitMax = overfitStart;
    } else {
      for (let i = startIdx + 1; i < valPoints.length; i++) {
        if (valPoints[i].loss > valPoints[i - 1].loss * 1.01) { overfitMax = valPoints[i]; break; }
      }
    }
  }

  // Persist to state for sort re-renders
  currentBestVal      = bestVal;
  currentOverfitStart = overfitStart;
  currentOverfitMax   = overfitMax;

  renderStats(trainPoints, valPoints, bestVal, overfitStart);
  renderChart(trainPoints, valPoints, bestVal, overfitStart, overfitMax);
  renderVerdict(bestVal, overfitStart, overfitMax, trainPoints, valPoints);
  renderTable(trainPoints, valPoints, bestVal, overfitStart, overfitMax);
  renderMarkdown(trainPoints, valPoints, bestVal, overfitStart);

  document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Dashboard / Stats cards ───────────────────────────────
function renderStats(trainPoints, valPoints, bestVal, overfitStart) {
  const lastTrain = trainPoints.length > 0 ? trainPoints[trainPoints.length - 1] : null;
  const lastVal   = valPoints.length   > 0 ? valPoints[valPoints.length - 1]     : null;

  const avgTrainLoss = trainPoints.length > 0
    ? (trainPoints.reduce((s, p) => s + p.loss, 0) / trainPoints.length)
    : null;

  const itSecValues = trainPoints.map(p => p.itSec).filter(v => v !== null);
  const avgItSec    = itSecValues.length > 0
    ? (itSecValues.reduce((s, v) => s + v, 0) / itSecValues.length)
    : null;

  const progression = lastTrain ? lastTrain.iter : (lastVal ? lastVal.iter : null);

  const cards = [
    {
      label: 'Avg Train Loss',
      value: avgTrainLoss !== null ? avgTrainLoss.toFixed(3) : '—',
      sub:   trainPoints.length > 0 ? `${trainPoints.length} points` : '',
      cls:   'yellow',
    },
    {
      label: 'Last Val Loss',
      value: lastVal ? lastVal.loss.toFixed(3) : '—',
      sub:   lastVal ? `iter ${lastVal.iter}` : '',
      cls:   'pink',
    },
    {
      label: 'Best Val Loss',
      value: bestVal ? bestVal.loss.toFixed(3) : '—',
      sub:   bestVal ? `checkpoint iter ${bestVal.iter}` : '',
      cls:   'green',
    },
    {
      label: 'Progression',
      value: progression !== null ? progression : '—',
      sub:   'itérations totales',
      cls:   'accent',
    },
    {
      label: 'Avg It/sec',
      value: avgItSec !== null ? avgItSec.toFixed(2) : '—',
      sub:   avgItSec !== null ? `${itSecValues.length} mesures` : 'non capturé',
      cls:   'white',
    },
    {
      label: 'Overfit start',
      value: overfitStart ? `iter ${overfitStart.iter}` : 'Non détecté',
      sub:   overfitStart ? `val loss ${overfitStart.loss.toFixed(3)}` : '',
      cls:   overfitStart ? 'red' : 'green',
    },
  ];

  document.getElementById('statsGrid').innerHTML = cards.map(c => `
    <div class="stat-card ${c.cls}">
      <div class="stat-label">${c.label}</div>
      <div class="stat-value ${c.cls}">${c.value}</div>
      ${c.sub ? `<div class="stat-sub">${c.sub}</div>` : ''}
    </div>
  `).join('');
}

// ─── Chart (canvas 2D) ────────────────────────────────────
function renderChart(trainPoints, valPoints, bestVal, overfitStart, overfitMax) {
  const canvas = document.getElementById('lossChart');
  const ctx    = canvas.getContext('2d');

  const dpr  = window.devicePixelRatio || 1;
  const rect  = canvas.parentElement.getBoundingClientRect();
  const W     = rect.width - 48;
  const H     = 220;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  const allLoss = [...trainPoints.map(p => p.loss), ...valPoints.map(p => p.loss)];
  const allIter = [...trainPoints.map(p => p.iter), ...valPoints.map(p => p.iter)];
  const minIter = Math.min(...allIter);
  const maxIter = Math.max(...allIter);
  const maxLoss = Math.max(...allLoss) * 1.05;

  const pad = { top: 20, right: 20, bottom: 40, left: 50 };
  const cW  = W - pad.left - pad.right;
  const cH  = H - pad.top  - pad.bottom;

  const toX = iter => pad.left + ((iter - minIter) / (maxIter - minIter || 1)) * cW;
  const toY = loss => pad.top  + (1 - loss / (maxLoss || 1)) * cH;

  // Grid lines
  ctx.strokeStyle = '#1c1c28';
  ctx.lineWidth   = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (i / 4) * cH;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cW, y);
    ctx.stroke();
    ctx.fillStyle  = '#6b6b8a';
    ctx.font       = '10px JetBrains Mono';
    ctx.textAlign  = 'right';
    ctx.fillText((maxLoss * (1 - i / 4)).toFixed(2), pad.left - 6, y + 4);
  }

  // X axis labels
  ctx.textAlign  = 'center';
  ctx.fillStyle  = '#6b6b8a';
  ctx.font       = '10px JetBrains Mono';
  const sortedIters = [...new Set([...trainPoints, ...valPoints].map(p => p.iter))].sort((a, b) => a - b);
  const labelStep   = Math.max(1, Math.floor(sortedIters.length / 6));
  sortedIters.forEach((iter, idx) => {
    if (idx % labelStep === 0 || idx === sortedIters.length - 1) {
      ctx.fillText(iter, toX(iter), H - pad.bottom + 18);
    }
  });

  // Best val vertical marker
  if (bestVal) {
    const bx = toX(bestVal.iter);
    ctx.strokeStyle = 'rgba(124,107,255,0.3)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(bx, pad.top);
    ctx.lineTo(bx, pad.top + cH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle  = 'rgba(124,107,255,0.7)';
    ctx.font       = '9px JetBrains Mono';
    ctx.textAlign  = 'center';
    ctx.fillText(`best (${bestVal.iter})`, bx, pad.top - 5);
  }

  // Draw line helper
  function drawLine(points, color) {
    if (points.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = toX(p.iter);
      const y = toY(p.loss);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    if (points.length < 20) {
      points.forEach(p => {
        ctx.beginPath();
        ctx.arc(toX(p.iter), toY(p.loss), 3.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });
    }
  }

  drawLine(trainPoints, '#7c6bff');
  drawLine(valPoints,   '#ff6b9d');

  document.getElementById('overfitStartLegend').style.display = overfitStart ? 'flex' : 'none';
  document.getElementById('overfitMaxLegend').style.display   = (overfitMax && overfitMax !== overfitStart) ? 'flex' : 'none';

  // Overfit start marker
  if (overfitStart) {
    const ox = toX(overfitStart.iter);
    const oy = toY(overfitStart.loss);
    ctx.beginPath();
    ctx.arc(ox, oy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd166';
    ctx.fill();
    ctx.fillStyle  = 'rgba(255,209,102,0.85)';
    ctx.font       = '9px JetBrains Mono';
    ctx.textAlign  = 'center';
    ctx.fillText(`↑ overfit (${overfitStart.iter})`, ox, oy - 10);
  }

  // Overfit max marker (>1% threshold)
  if (overfitMax && overfitMax !== overfitStart) {
    const ox = toX(overfitMax.iter);
    const oy = toY(overfitMax.loss);
    ctx.strokeStyle = 'rgba(255,107,107,0.35)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(ox, pad.top);
    ctx.lineTo(ox, pad.top + cH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(ox, oy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ff6b6b';
    ctx.fill();
    ctx.fillStyle  = 'rgba(255,107,107,0.85)';
    ctx.font       = '9px JetBrains Mono';
    ctx.textAlign  = 'center';
    ctx.fillText(`⚠ seuil (${overfitMax.iter})`, ox, oy - 10);
  }
}

// ─── Verdict / Overfitting analysis ───────────────────────
function renderVerdict(bestVal, overfitStart, overfitMax, trainPoints, valPoints) {
  const icon = document.getElementById('verdictIcon');
  const text = document.getElementById('verdictText');

  if (!bestVal) {
    icon.textContent = 'ℹ️';
    text.innerHTML   = 'Pas assez de données de validation pour analyser l\'overfitting.';
    return;
  }

  const n         = valPoints.length;
  const lastTrain = trainPoints[trainPoints.length - 1];
  const lastVal   = valPoints[valPoints.length - 1];

  const [confidence, confColor] =
    n >= 7 ? ['élevée',      'var(--green)']   :
    n >= 4 ? ['moyenne',     'var(--yellow)']  :
    n >= 2 ? ['faible',      'var(--accent2)'] :
             ['très faible', 'var(--red)'];

  const confNote = `<span style="font-size:.78rem;color:var(--muted)">Fiabilité de la détection : <span style="color:${confColor}">${confidence}</span> (${n} point${n > 1 ? 's' : ''} de validation)</span>`;

  if (overfitStart) {
    const gap              = lastVal.loss - bestVal.loss;
    const relGap           = gap / bestVal.loss;
    const lastIter         = lastTrain ? lastTrain.iter : lastVal.iter;
    const overfitDuration  = lastIter - overfitStart.iter;
    const overfitPct       = lastIter > 0 ? (overfitDuration / lastIter * 100).toFixed(0) : '?';
    const genGap           = lastTrain ? bestVal.loss - lastTrain.loss : null;
    const startGap         = overfitStart.loss - bestVal.loss;

    const recs = [
      `Utilise le checkpoint <strong>iter ${bestVal.iter}</strong> (val loss : ${bestVal.loss.toFixed(3)})`,
    ];
    if (genGap !== null && genGap > 0.5) {
      recs.push(`Gap train/val élevé (<strong>${genGap.toFixed(3)}</strong>) — dataset probablement trop petit ou trop répétitif`);
    }
    recs.push('Pour la prochaine run : réduire <strong>--learning-rate</strong>, <strong>--num-layers</strong>, ou augmenter le dataset');

    const maxLine = overfitMax && overfitMax !== overfitStart
      ? `→ Seuil 1% franchi à l'iter <strong>${overfitMax.iter}</strong> (val loss : ${overfitMax.loss.toFixed(3)})<br>`
      : '';

    icon.textContent = '⚠️';
    text.innerHTML = `Overfitting commence à l'iter <strong>${overfitStart.iter}</strong> (+${startGap.toFixed(3)} depuis le minimum).<br>
    ${maxLine}<br>
    → Val loss min : <strong>${bestVal.loss.toFixed(3)}</strong> (iter ${bestVal.iter})<br>
    → Val loss finale : <strong>${lastVal.loss.toFixed(3)}</strong> (+${gap.toFixed(3)}, +${(relGap * 100).toFixed(1)}%)<br>
    → En overfit sur les <strong>${overfitDuration} dernières iters</strong> (${overfitPct}% du total)<br>
    ${genGap !== null ? `→ Gap de généralisation train/val : <strong>${genGap.toFixed(3)}</strong><br>` : ''}
    <br><strong>Recommandations :</strong><br>
    ${recs.map(r => `→ ${r}`).join('<br>')}
    <br><br>${confNote}`;

  } else {
    const valTrend   = n >= 2 ? lastVal.loss - valPoints[n - 2].loss : null;
    const tLen       = trainPoints.length;
    const trainTrend = tLen >= 4
      ? trainPoints[tLen - 1].loss - trainPoints[Math.floor(tLen * 0.8)].loss
      : null;

    const recs = [];
    if (valTrend !== null && valTrend < -0.01) {
      recs.push('La val loss est encore en descente — entraîne avec <strong>plus d\'itérations</strong>');
    } else if (valTrend !== null && Math.abs(valTrend) <= 0.01) {
      recs.push('La val loss se stabilise — le modèle approche sa limite sur ce dataset');
      recs.push('Envisager d\'augmenter le dataset ou d\'ajuster <strong>--num-layers</strong>');
    } else {
      recs.push('Envisager <strong>plus d\'itérations</strong> pour continuer à améliorer le modèle');
    }
    if (trainTrend !== null && Math.abs(trainTrend) < 0.005) {
      recs.push('La train loss a convergé — continuer ne fera probablement pas baisser la val loss davantage');
    }

    icon.textContent = '✅';
    text.innerHTML   = `Pas d'overfitting détecté. La val loss est stable ou décroissante.<br><br>
    <strong>Recommandations :</strong><br>
    ${recs.map(r => `→ ${r}`).join('<br>')}
    <br><br>${confNote}`;
  }
}

// ─── Table helpers ─────────────────────────────────────────
function buildIterRows(trainPoints, valPoints) {
  const iters = new Map();

  trainPoints.forEach(p => {
    if (!iters.has(p.iter)) iters.set(p.iter, {});
    const row  = iters.get(p.iter);
    row.train  = p.loss;
    if (p.itSec !== null) row.itSec = p.itSec;
    if (p.lr    !== null) row.lr    = p.lr;
  });

  valPoints.forEach(p => {
    if (!iters.has(p.iter)) iters.set(p.iter, {});
    iters.get(p.iter).val = p.loss;
  });

  const valIters  = new Set(valPoints.map(p => p.iter));
  const showIters = new Set();
  for (const iter of iters.keys()) {
    if (valIters.has(iter)) showIters.add(iter);
  }
  if (trainPoints.length > 0) {
    showIters.add(trainPoints[0].iter);
    showIters.add(trainPoints[trainPoints.length - 1].iter);
  }

  const sorted = [...showIters].sort((a, b) => a - b);
  return { iters, sorted };
}

// ─── Sort handler ──────────────────────────────────────────
function handleSort(col) {
  sortState.dir = (sortState.col === col && sortState.dir === 'asc') ? 'desc' : 'asc';
  sortState.col = col;

  document.querySelectorAll('th.sortable').forEach(th => {
    const icon = th.querySelector('.sort-icon');
    if (th.dataset.col === col) {
      icon.textContent = sortState.dir === 'asc' ? '↑' : '↓';
      th.classList.add('sorted');
    } else {
      icon.textContent = '↕';
      th.classList.remove('sorted');
    }
  });

  if (currentTrainPoints.length > 0 || currentValPoints.length > 0) {
    renderTable(currentTrainPoints, currentValPoints, currentBestVal, currentOverfitStart, currentOverfitMax);
  }
}

// ─── Render: table ─────────────────────────────────────────
function renderTable(trainPoints, valPoints, bestVal, overfitStart, overfitMax) {
  const tbody = document.getElementById('tableBody');
  const { iters, sorted } = buildIterRows(trainPoints, valPoints);

  sorted.sort((a, b) => {
    const rA = iters.get(a) || {};
    const rB = iters.get(b) || {};
    let vA, vB;
    switch (sortState.col) {
      case 'train': vA = rA.train ?? Infinity;               vB = rB.train ?? Infinity;               break;
      case 'val':   vA = rA.val   ?? Infinity;               vB = rB.val   ?? Infinity;               break;
      case 'itSec': vA = rA.itSec ?? -1;                     vB = rB.itSec ?? -1;                     break;
      case 'lr':    vA = rA.lr ? parseFloat(rA.lr) : -1;     vB = rB.lr ? parseFloat(rB.lr) : -1;     break;
      default:      vA = a; vB = b;
    }
    return sortState.dir === 'asc' ? vA - vB : vB - vA;
  });

  tbody.innerHTML = sorted.map(iter => {
    const row            = iters.get(iter) || {};
    const isBest         = bestVal      && iter === bestVal.iter      && row.val !== undefined;
    const isOverfitStart = overfitStart && iter === overfitStart.iter && row.val !== undefined;
    const isOverfitMax   = overfitMax   && iter === overfitMax.iter   && row.val !== undefined && overfitMax !== overfitStart;

    let badge = '';
    if (isBest)          badge += `<span class="badge badge-best">best</span>`;
    if (isOverfitStart)  badge += `<span class="badge badge-overfit-start">↑ overfit</span>`;
    if (isOverfitMax)    badge += `<span class="badge badge-overfit-max">⚠ seuil 1%</span>`;

    const status = isBest         ? '← checkpoint recommandé'
                 : isOverfitMax   ? '⚠ seuil 1% franchi'
                 : isOverfitStart ? '↑ val loss remonte'
                 : '';

    return `<tr class="${isBest ? 'best-row' : ''}">
      <td>${iter}${badge}</td>
      <td>${row.train !== undefined ? row.train.toFixed(3) : '<span class="cell-muted">—</span>'}</td>
      <td>${row.val   !== undefined ? row.val.toFixed(3)   : '<span class="cell-muted">—</span>'}</td>
      <td>${row.itSec !== undefined ? row.itSec.toFixed(3) : '<span class="cell-muted">—</span>'}</td>
      <td class="cell-muted">${row.lr ?? '—'}</td>
      <td class="cell-muted">${status}</td>
    </tr>`;
  }).join('');
}

// ─── Render: markdown export ───────────────────────────────
function renderMarkdown(trainPoints, valPoints, bestVal, overfitStart) {
  const { iters, sorted } = buildIterRows(trainPoints, valPoints);

  let md  = '| Itération | Train Loss | Val Loss |\n';
  md     += '|---|---|---|\n';

  sorted.forEach(iter => {
    const row            = iters.get(iter) || {};
    const isBest         = bestVal      && iter === bestVal.iter      && row.val !== undefined;
    const isOverfitStart = overfitStart && iter === overfitStart.iter && row.val !== undefined;
    const suffix = isBest ? ' ← best checkpoint' : isOverfitStart ? ' ← début overfit' : '';
    md += `| ${iter} | ${row.train !== undefined ? row.train.toFixed(3) : '—'} | ${row.val !== undefined ? row.val.toFixed(3) + suffix : '—'} |\n`;
  });

  document.getElementById('markdownOut').textContent = md;
}

// ─── Export standalone HTML report ────────────────────────
function exportReport() {
  const chartImg   = document.getElementById('lossChart').toDataURL('image/png');
  const verdictIcon = document.getElementById('verdictIcon').textContent;
  const verdictText = document.getElementById('verdictText').innerHTML;
  const tableRows   = document.getElementById('tableBody').innerHTML;

  const statsCards = Array.from(document.querySelectorAll('#statsGrid .stat-card')).map(card => {
    const label   = card.querySelector('.stat-label').textContent;
    const valueEl = card.querySelector('.stat-value');
    const sub     = card.querySelector('.stat-sub');
    const cls     = [...valueEl.classList].find(c => c !== 'stat-value') || '';
    return { label, value: valueEl.textContent, sub: sub ? sub.textContent : '', cls };
  });

  const date    = new Date();
  const dateStr = date.toLocaleDateString('fr-FR');
  const timeStr = date.toLocaleTimeString('fr-FR');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MLX Training Report — ${dateStr}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Syne:wght@400;700;800&display=swap');
  :root{--bg:#0a0a0f;--surface:#13131a;--surface2:#1c1c28;--border:#2a2a3d;--accent:#7c6bff;--accent2:#ff6b9d;--green:#4effa0;--yellow:#ffd166;--red:#ff6b6b;--text:#e8e8f0;--muted:#6b6b8a}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:'Syne',sans-serif;padding:2rem;max-width:1000px;margin:0 auto}
  h1{font-size:1.6rem;font-weight:800;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:.25rem}
  .subtitle{color:var(--muted);font-size:.8rem;font-family:'JetBrains Mono',monospace;margin-bottom:2rem}
  .section-title{font-size:.7rem;font-family:'JetBrains Mono',monospace;color:var(--muted);letter-spacing:.14em;text-transform:uppercase;margin-bottom:1rem}
  .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:2rem}
  .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:1rem 1.2rem;position:relative;overflow:hidden}
  .stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px}
  .stat-card.green::before{background:var(--green)}.stat-card.accent::before{background:var(--accent)}.stat-card.yellow::before{background:var(--yellow)}.stat-card.red::before{background:var(--red)}.stat-card.pink::before{background:var(--accent2)}.stat-card.white::before{background:var(--text)}
  .stat-label{font-size:.68rem;font-family:'JetBrains Mono',monospace;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.5rem}
  .stat-value{font-size:1.4rem;font-weight:800;font-family:'JetBrains Mono',monospace;line-height:1}
  .stat-sub{font-size:.68rem;font-family:'JetBrains Mono',monospace;color:var(--muted);margin-top:.35rem}
  .stat-value.green{color:var(--green)}.stat-value.accent{color:var(--accent)}.stat-value.yellow{color:var(--yellow)}.stat-value.red{color:var(--red)}.stat-value.pink{color:var(--accent2)}.stat-value.white{color:var(--text)}
  .chart-container{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1.5rem;margin-bottom:2rem}
  .chart-container img{width:100%;display:block}
  .verdict{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:1.2rem 1.5rem;margin-bottom:2rem;display:flex;align-items:flex-start;gap:1rem}
  .verdict-icon{font-size:1.5rem;flex-shrink:0;margin-top:.1rem}
  .verdict-text{font-size:.88rem;line-height:1.7}.verdict-text strong{color:var(--accent)}
  .table-container{background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:2rem;overflow-x:auto}
  table{width:100%;border-collapse:collapse;font-family:'JetBrains Mono',monospace;font-size:.82rem}
  thead{background:var(--surface2)}
  th{padding:.75rem 1.1rem;text-align:left;font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:600;border-bottom:1px solid var(--border)}
  td{padding:.6rem 1.1rem;border-bottom:1px solid var(--border);color:var(--text)}
  tr:last-child td{border-bottom:none}
  tr.best-row td{background:rgba(124,107,255,.08)}
  tr.best-row td:first-child{border-left:3px solid var(--accent)}
  .badge{display:inline-block;font-size:.6rem;padding:.15rem .5rem;border-radius:4px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-left:.5rem}
  .badge-best{background:rgba(124,107,255,.2);color:var(--accent)}.badge-overfit-start{background:rgba(255,209,102,.2);color:var(--yellow)}.badge-overfit-max{background:rgba(255,107,107,.15);color:var(--red)}
  .cell-muted{color:var(--muted);font-size:.75rem}
  .footer{color:var(--muted);font-family:'JetBrains Mono',monospace;font-size:.68rem;padding-top:1rem;border-top:1px solid var(--border);text-align:center}
</style>
</head>
<body>
<h1>MLX Training Report</h1>
<p class="subtitle">// généré le ${dateStr} à ${timeStr}</p>

<p class="section-title">▸ Tableau de bord</p>
<div class="stats-grid">
${statsCards.map(s => `  <div class="stat-card ${s.cls}"><div class="stat-label">${s.label}</div><div class="stat-value ${s.cls}">${s.value}</div>${s.sub ? `<div class="stat-sub">${s.sub}</div>` : ''}</div>`).join('\n')}
</div>

<p class="section-title">▸ Courbe de loss</p>
<div class="chart-container"><img src="${chartImg}" alt="Courbe de loss"></div>

<p class="section-title">▸ Analyse d'overfitting</p>
<div class="verdict">
  <div class="verdict-icon">${verdictIcon}</div>
  <div class="verdict-text">${verdictText}</div>
</div>

<p class="section-title">▸ Journal des itérations</p>
<div class="table-container">
  <table>
    <thead><tr><th>Itération</th><th>Train Loss</th><th>Val Loss</th><th>It/sec</th><th>Learning Rate</th><th>Statut</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</div>

<p class="footer">MLX Training Analytics</p>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `mlx-report-${date.toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Utilities ─────────────────────────────────────────────
function copyMarkdown(e) {
  const md = document.getElementById('markdownOut').textContent;
  navigator.clipboard.writeText(md).then(() => {
    const btn = e.target;
    btn.textContent = '✓ Copié !';
    setTimeout(() => { btn.textContent = 'Copier le Markdown'; }, 1500);
  });
}

function showError(msg) {
  const el        = document.getElementById('errorMsg');
  el.textContent  = msg;
  el.style.display = 'block';
}

function clearAll() {
  document.getElementById('logInput').value    = '';
  document.getElementById('results').style.display  = 'none';
  document.getElementById('errorMsg').style.display = 'none';
  document.getElementById('dropzoneFilename').textContent = '';
  document.getElementById('fileInput').value = '';
  currentTrainPoints  = [];
  currentValPoints    = [];
  currentBestVal      = null;
  currentOverfitStart = null;
  currentOverfitMax   = null;
  sortState = { col: 'iter', dir: 'asc' };
}

function loadExample() {
  clearAll();
  document.getElementById('logInput').value = `Loading pretrained model
Loading datasets
Training
Trainable parameters: 0.108% (3.473M/3212.750M)
Starting training..., iters: 500
Iter 1: Val loss 2.742, Val took 1.153s
Iter 10: Train loss 2.068, Learning Rate 1.000e-05, It/sec 1.809, Tokens/sec 484.562
Iter 20: Train loss 0.961, Learning Rate 1.000e-05, It/sec 3.986, Tokens/sec 1039.830
Iter 30: Train loss 0.787, Learning Rate 1.000e-05, It/sec 3.320, Tokens/sec 1080.973
Iter 40: Train loss 0.654, Learning Rate 1.000e-05, It/sec 3.729, Tokens/sec 1064.889
Iter 50: Train loss 0.666, Learning Rate 1.000e-05, It/sec 4.057, Tokens/sec 1081.265
Iter 60: Train loss 0.584, Learning Rate 1.000e-05, It/sec 3.679, Tokens/sec 1110.599
Iter 70: Train loss 0.573, Learning Rate 1.000e-05, It/sec 3.975, Tokens/sec 1074.935
Iter 80: Train loss 0.474, Learning Rate 1.000e-05, It/sec 3.773, Tokens/sec 1065.967
Iter 90: Train loss 0.428, Learning Rate 1.000e-05, It/sec 3.697, Tokens/sec 1069.804
Iter 100: Train loss 0.410, Learning Rate 1.000e-05, It/sec 3.877, Tokens/sec 1023.583
Iter 100: Saved adapter weights to adapters/adapters.safetensors
Iter 110: Train loss 0.378, Learning Rate 1.000e-05, It/sec 3.628, Tokens/sec 1091.297
Iter 120: Train loss 0.335, Learning Rate 1.000e-05, It/sec 3.881, Tokens/sec 1036.922
Iter 130: Train loss 0.288, Learning Rate 1.000e-05, It/sec 3.656, Tokens/sec 1050.686
Iter 140: Train loss 0.215, Learning Rate 1.000e-05, It/sec 3.565, Tokens/sec 1082.571
Iter 150: Train loss 0.210, Learning Rate 1.000e-05, It/sec 3.338, Tokens/sec 935.665
Iter 160: Train loss 0.139, Learning Rate 1.000e-05, It/sec 3.703, Tokens/sec 1025.337
Iter 170: Train loss 0.117, Learning Rate 1.000e-05, It/sec 4.038, Tokens/sec 1015.108
Iter 180: Train loss 0.131, Learning Rate 1.000e-05, It/sec 3.405, Tokens/sec 1050.594
Iter 190: Train loss 0.093, Learning Rate 1.000e-05, It/sec 3.603, Tokens/sec 1064.450
Iter 200: Val loss 0.759, Val took 0.325s
Iter 200: Train loss 0.099, Learning Rate 1.000e-05, It/sec 3.883, Tokens/sec 1016.117
Iter 200: Saved adapter weights to adapters/adapters.safetensors
Iter 210: Train loss 0.089, Learning Rate 1.000e-05, It/sec 3.894, Tokens/sec 1073.671
Iter 220: Train loss 0.075, Learning Rate 1.000e-05, It/sec 3.811, Tokens/sec 1045.292
Iter 230: Train loss 0.076, Learning Rate 1.000e-05, It/sec 3.588, Tokens/sec 1002.436
Iter 240: Train loss 0.067, Learning Rate 1.000e-05, It/sec 3.364, Tokens/sec 1032.173
Iter 250: Train loss 0.055, Learning Rate 1.000e-05, It/sec 3.751, Tokens/sec 1050.722
Iter 260: Train loss 0.074, Learning Rate 1.000e-05, It/sec 3.739, Tokens/sec 1031.233
Iter 270: Train loss 0.051, Learning Rate 1.000e-05, It/sec 3.905, Tokens/sec 1082.087
Iter 280: Train loss 0.053, Learning Rate 1.000e-05, It/sec 3.432, Tokens/sec 1023.888
Iter 290: Train loss 0.061, Learning Rate 1.000e-05, It/sec 3.744, Tokens/sec 1020.739
Iter 300: Train loss 0.049, Learning Rate 1.000e-05, It/sec 3.817, Tokens/sec 1029.354
Iter 400: Val loss 0.910, Val took 0.330s
Iter 400: Train loss 0.040, Learning Rate 1.000e-05, It/sec 3.865, Tokens/sec 1048.550
Iter 500: Val loss 0.950, Val took 0.327s
Iter 500: Train loss 0.038, Learning Rate 1.000e-05, It/sec 3.833, Tokens/sec 1065.236
Saved final weights to adapters/adapters.safetensors.`;
}
