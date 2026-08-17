/* ============================================================
   ANALYTICS-CHART.JS — Inline-SVG performance visualizations.
   No chart library; pure SVG so it stays buildless. Used as the
   default Analytics detail view (replaced when a user picks an item).
   ============================================================ */

function _ac_escape(s) {
  return typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s);
}

// Which analytics mode is active: 'training' (notebooks), 'snippets', or
// 'practice' (coding). Snippets used to fall through to 'practice', so the
// Snippet Analytics overview charted coding attempts.
function _ac_currentMode() {
  if (typeof activeAnalyticsTab === 'undefined') return 'practice';
  if (activeAnalyticsTab === 'training') return 'training';
  if (activeAnalyticsTab === 'snippets') return 'snippets';
  return 'practice';
}

// Build the score-over-time series for the active mode (chronological).
// 'training' → notebook accuracy; 'snippets' → try-coding scores; 'practice' → coding.
function _ac_series(mode) {
  mode = mode || _ac_currentMode();

  if (mode === 'snippets') {
    // Snippet records carry no epoch field, only `date` + `time` strings, so
    // order by whatever timestamp can be recovered and fall back to insertion
    // order (newest-first) reversed.
    const recs = (state.snippetHistory || []).slice().reverse();
    return recs.map((r, i) => ({
      x: i,
      score: Math.max(0, Math.min(100, Number(r.score) || 0)),
      time: 0,
      label: r.date ? `${r.date}${r.time ? ' ' + r.time : ''}` : (r.snippetTitle || '#' + (i + 1))
    }));
  }

  if (mode === 'training') {
    const recs = (state.notebookHistory || []).map((r) => {
      let c = 0, t = 0;
      (r.sections || []).forEach((s) => { c += s.correct || 0; t += s.total || 0; });
      const score = t > 0 ? Math.round((c / t) * 100) : 0;
      const m = /(\d{10,})/.exec(r.id || '');
      return { score, time: m ? +m[1] : 0, label: r.date || r.notebookTitle || '' };
    }).sort((a, b) => (a.time || 0) - (b.time || 0));
    return recs.map((h, i) => ({
      x: i, score: Math.max(0, Math.min(100, h.score)), time: h.time, label: h.label || '#' + (i + 1),
    }));
  }

  // Through anAttempts(), so archived attempts and attempts on deleted programs
  // are out of the chart exactly as they are out of the counters. They used to
  // be in the chart and out of the counters, on the same screen.
  const hist = (typeof anAttempts === 'function')
    ? anAttempts()
    : (state.history || []).filter((h) => typeof h.score === 'number')
      .slice().sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
  return hist.map((h, i) => ({
    x: i,
    score: Math.max(0, Math.min(100, h.score)),
    time: h.submitTime || h.startTime,
    id: h.id,
    challengeId: h.challengeId,
    duration: Math.max(0, Number(h.duration) || 0),
    label: h.date || (h.startTime ? new Date(h.startTime).toLocaleDateString() : '#' + (i + 1)),
  }));
}

// Smooth area + line trend chart as an SVG string.
function _ac_trendSvg(series) {
  const W = 640,
    H = 260,
    padL = 38,
    padR = 16,
    padT = 18,
    padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = series.length;
  const xAt = (i) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v) => padT + innerH - (v / 100) * innerH;

  // Horizontal gridlines + y labels at 0/25/50/75/100
  let grid = '';
  [0, 25, 50, 75, 100].forEach((v) => {
    const y = yAt(v);
    grid += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--border-color-subtle, rgba(255,255,255,0.06))" stroke-width="1"/>`;
    grid += `<text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--text-tertiary)">${v}</text>`;
  });

  // Dated x axis. padB has always reserved room for this and nothing was ever
  // drawn in it, so "Score over time" carried no time information at all — ten
  // attempts in one sitting looked identical to ten across a month.
  const fmtDay = (t) => {
    const d = new Date(t);
    return (d.getMonth() + 1) + '/' + d.getDate();
  };
  const ticks = Math.min(6, n);
  for (let k = 0; k < ticks; k++) {
    const i = ticks === 1 ? 0 : Math.round((k / (ticks - 1)) * (n - 1));
    const p = series[i];
    if (!p || !p.time) continue;
    const x = xAt(p.x);
    grid += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + innerH}" stroke="var(--border-color-subtle, rgba(255,255,255,0.04))" stroke-width="1"/>`;
    grid += `<text x="${x}" y="${H - 8}" text-anchor="middle" font-size="9.5" fill="var(--text-tertiary)">${fmtDay(p.time)}</text>`;
  }
  // A span label, because six ticks cannot say "these all happened on one day".
  if (n > 1 && series[0].time && series[n - 1].time) {
    const spanDays = Math.max(0, Math.round((series[n - 1].time - series[0].time) / 86400000));
    grid += `<text x="${W - padR}" y="${padT - 5}" text-anchor="end" font-size="9.5" fill="var(--text-tertiary)">${
      spanDays === 0 ? 'all on one day' : spanDays + ' day' + (spanDays !== 1 ? 's' : '')}</text>`;
  }

  const linePts = series.map((p) => `${xAt(p.x).toFixed(1)},${yAt(p.score).toFixed(1)}`).join(' ');
  const areaPts = `${padL},${yAt(0)} ${linePts} ${xAt(n - 1)},${yAt(0)}`;

  const dots = series
    .map((p) => {
      const cx = xAt(p.x).toFixed(1),
        cy = yAt(p.score).toFixed(1);
      const color =
        p.score >= 80
          ? 'var(--color-success)'
          : p.score >= 50
            ? 'var(--color-warning)'
            : 'var(--color-danger)';
      const prog = p.challengeId && typeof state !== 'undefined'
        ? ((state.challenges || []).find((c) => c.id === p.challengeId) || {}).title : null;
      const when = p.time ? new Date(p.time).toLocaleString() : p.label;
      const dur = p.duration ? ' · ' + (typeof anFmtTime === 'function' ? anFmtTime(p.duration) : p.duration + 's') : '';
      const nl = String.fromCharCode(10);
      const tip = (prog ? prog + nl : '') + when + nl + p.score + '%' + dur;
      const click = p.id ? ` style="cursor:pointer" onclick="anOpenReviewById('${p.id}')"` : '';
      return `<circle class="ac-dot" cx="${cx}" cy="${cy}" r="4"${click} fill="${color}" stroke="var(--bg-surface)" stroke-width="1.5"><title>${_ac_escape(tip)}</title></circle>`;
    })
    .join('');

  return `
    <svg class="ac-trend" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Score over time trend chart">
      <defs>
        <linearGradient id="ac-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--color-primary)" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="var(--color-primary)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${grid}
      <polygon points="${areaPts}" fill="url(#ac-area)" />
      <polyline class="ac-line" points="${linePts}" fill="none" stroke="var(--color-primary)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
    </svg>`;
}

// Score distribution bars (0-19, 20-39, 40-59, 60-79, 80-100).
function _ac_distributionSvg(series) {
  const buckets = [0, 0, 0, 0, 0];
  const labels = ['0–19', '20–39', '40–59', '60–79', '80–100'];
  series.forEach((p) => {
    const idx = p.score >= 80 ? 4 : Math.min(4, Math.floor(p.score / 20));
    buckets[idx]++;
  });
  const max = Math.max(1, ...buckets);
  return `
    <div class="ac-dist">
      ${buckets
        .map((c, i) => {
          const pct = Math.round((c / max) * 100);
          const color =
            i >= 4 ? 'var(--color-success)' : i <= 1 ? 'var(--color-danger)' : 'var(--color-warning)';
          // Clicking a bucket filters the history table to it, so "10 attempts
          // scored 0-19" is one click from showing WHICH ten.
          return `<div class="ac-dist-col" title="${labels[i]}: ${c} — click to filter the history" onclick="anFilterBucket(${i})" style="cursor:pointer;">
            <div class="ac-dist-bar-track"><div class="ac-dist-bar" style="height:${pct}%;background:${color}"></div></div>
            <div class="ac-dist-count">${c}</div>
            <div class="ac-dist-label">${labels[i]}</div>
          </div>`;
        })
        .join('')}
    </div>`;
}

// Public: render the default Analytics overview into a container element.
function renderAnalyticsOverview(container) {
  if (!container) container = document.getElementById('analytics-detail-container');
  if (!container) return;

  const mode = _ac_currentMode();
  const isNotes = mode === 'training';
  const isSnippets = mode === 'snippets';
  const modeLabel = isNotes ? 'Notes' : isSnippets ? 'Snippets' : 'Coding';
  const series = _ac_series(mode);
  if (series.length === 0) {
    // The range chips stay on screen. Narrowing to a window with no attempts
    // used to render a bare empty state with no controls in it, so there was no
    // way back to All except reloading the page.
    const chips = (!isNotes && !isSnippets && typeof anRangeChipsHTML === 'function') ? anRangeChipsHTML() : '';
    const ranged = !isNotes && !isSnippets && typeof anRange === 'function' && anRange() !== 'all';
    container.innerHTML = `
      <div class="ac-overview">${chips}</div>
      <div class="empty-state" style="height:70%;display:flex;align-items:center;justify-content:center;flex-direction:column;">
        <div class="empty-state-icon-animated">
          <i data-lucide="line-chart" style="width:48px;height:48px;opacity:0.5;"></i>
          <div class="empty-state-pulse-ring"></div>
        </div>
        <h2>${ranged ? 'Nothing in this range' : (isNotes ? 'No notebook attempts yet' : isSnippets ? 'No snippet attempts yet' : 'No coding attempts yet')}</h2>
        <p style="font-size:0.875rem;color:var(--text-tertiary);margin-top:0.5rem;max-width:320px;text-align:center;">
          ${ranged
            ? 'No attempts fall inside the selected window. Pick a wider range above.'
            : isNotes
            ? 'Take a notebook quiz in the Notes Library and your accuracy trend will appear here. Pick an item on the left to view its history.'
            : isSnippets
              ? 'Do a Try-Coding drill in the Snippet Library and your score trend will appear here. Pick an item on the left to view its history.'
              : 'Run a program in the Coding Library and your score trend will appear here. Pick an item on the left to view its history.'}
        </p>
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
    return;
  }

  const best = Math.max(...series.map((p) => p.score));
  const avg = Math.round(series.reduce((s, p) => s + p.score, 0) / series.length);
  const last = series[series.length - 1].score;

  /* "vs Prev" used to be last.score minus the score before it in the GLOBAL
     list — almost always a different program, so it compared your Celsius run
     against someone else's Circle Area run. The like-for-like comparison is
     against your own previous attempt at the SAME program. */
  const lastPoint = series[series.length - 1];
  let trend = 0, trendWhat = 'no earlier attempt';
  if (lastPoint.challengeId) {
    const same = series.filter((p) => p.challengeId === lastPoint.challengeId);
    if (same.length > 1) {
      trend = last - same[same.length - 2].score;
      trendWhat = 'vs your previous run of it';
    }
  }
  const trendStr = trend > 0 ? `▲ +${trend}` : trend < 0 ? `▼ ${trend}` : '— 0';
  const trendColor =
    trend > 0 ? 'var(--color-success)' : trend < 0 ? 'var(--color-danger)' : 'var(--text-tertiary)';

  // Coding-specific figures the page never showed, from data already stored.
  const progs = (typeof anByProgram === 'function') ? anByProgram() : [];
  const solved = progs.filter((p) => p.solved);
  const firstTry = progs.filter((p) => p.firstTry).length;
  const firstTryPct = progs.length ? Math.round((firstTry / progs.length) * 100) : 0;
  const durations = series.map((p) => p.duration).filter((d) => d > 0);
  const medTime = (typeof anMedian === 'function') ? anMedian(durations) : 0;
  const medStr = medTime ? (typeof anFmtTime === 'function' ? anFmtTime(medTime) : medTime + 's') : '—';
  const avgTries = solved.length
    ? (solved.reduce((s, p) => s + (p.attemptsToSolve || 0), 0) / solved.length).toFixed(1) : '—';

  container.innerHTML = `
    <div class="ac-overview" data-reveal-stagger="80">
      <div class="ac-head" data-reveal>
        <h2 style="margin:0;display:flex;align-items:center;gap:0.5rem;">
          <i data-lucide="activity" style="width:20px;height:20px;color:var(--color-primary);"></i>
          Performance Overview
          <span style="font-size:0.65rem;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;padding:2px 8px;border-radius:999px;background:var(--color-primary-subtle);color:var(--color-primary);">${modeLabel}</span>
        </h2>
        <span style="font-size:0.8125rem;color:var(--text-tertiary);">${series.length} attempt${series.length !== 1 ? 's' : ''}</span>
      </div>
      ${typeof anRangeChipsHTML === 'function' ? anRangeChipsHTML() : ''}
      <div class="ac-kpis" data-reveal>
        <div class="ac-kpi" title="Highest score in this range"><span class="ac-kpi-val" data-count-to="${best}" data-count-suffix="%">0%</span><span class="ac-kpi-lbl">Best</span></div>
        <div class="ac-kpi" title="Mean of every attempt in this range"><span class="ac-kpi-val" data-count-to="${avg}" data-count-suffix="%">0%</span><span class="ac-kpi-lbl">Average</span></div>
        ${isNotes || isSnippets ? `
        <div class="ac-kpi"><span class="ac-kpi-val" data-count-to="${last}" data-count-suffix="%">0%</span><span class="ac-kpi-lbl">Latest</span></div>` : `
        <div class="ac-kpi" title="Programs you scored 100% on at the first attempt"><span class="ac-kpi-val" data-count-to="${firstTryPct}" data-count-suffix="%">0%</span><span class="ac-kpi-lbl">First try</span></div>`}
        ${isNotes || isSnippets ? '' : `
        <div class="ac-kpi" title="Median time on one attempt"><span class="ac-kpi-val">${medStr}</span><span class="ac-kpi-lbl">Median time</span></div>
        <div class="ac-kpi" title="Average attempts needed to reach 100%"><span class="ac-kpi-val">${avgTries}</span><span class="ac-kpi-lbl">Tries to solve</span></div>`}
        <div class="ac-kpi" title="${trendWhat}"><span class="ac-kpi-val" style="color:${trendColor}">${trendStr}</span><span class="ac-kpi-lbl">Last vs prev</span></div>
      </div>
      <div class="ac-card" data-reveal>
        <div class="ac-card-title">Score over time</div>
        ${_ac_trendSvg(series)}
      </div>
      <div class="ac-card" data-reveal>
        <div class="ac-card-title">Score distribution</div>
        ${_ac_distributionSvg(series)}
      </div>
      ${isNotes || isSnippets ? '' : `
      <div class="ac-card" data-reveal>
        <div class="ac-card-title">Activity</div>
        ${typeof anHeatmapHTML === 'function' ? anHeatmapHTML() : ''}
      </div>
      <div class="ac-grid2">
        <div class="ac-card" data-reveal>
          <div class="ac-card-title">Weakest programs <span class="ac-card-hint">click to compare against the solution</span></div>
          ${typeof anWeakestHTML === 'function' ? anWeakestHTML() : ''}
        </div>
        <div class="ac-card" data-reveal>
          <div class="ac-card-title">By topic</div>
          ${typeof anTagsHTML === 'function' ? anTagsHTML() : ''}
        </div>
      </div>
      <div class="ac-card" data-reveal>
        <div class="ac-card-title">Badges</div>
        ${typeof anBadgesHTML === 'function' ? anBadgesHTML() : ''}
      </div>`}
    </div>`;

  if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
  if (window.Motion && typeof Motion.scan === 'function') Motion.scan(container);
}

window.renderAnalyticsOverview = renderAnalyticsOverview;
