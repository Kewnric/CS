(function(){
const { PanelCard, ProgressRing, Heatmap, DataTable, TierBadge, ScoreBadge, Badge, Icon, Tabs } = window.StudySessionProDesignSystem_f5d02b;

const ROWS = [
  { name: 'Bubble Sort', tier: 'C', score: '18 / 18', perfect: true, when: '2h ago', time: '12:04' },
  { name: 'Binary Search', tier: 'C', score: '15 / 18', perfect: false, when: 'Yesterday', time: '18:41' },
  { name: 'Stack with Array', tier: 'D', score: '18 / 18', perfect: true, when: 'Yesterday', time: '09:22' },
  { name: 'Linked List Reversal', tier: 'A', score: '11 / 18', perfect: false, when: '3 days ago', time: '31:07' },
];

function HeroTile({ label, value, icon, tone }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? 'rgba(99,102,241,0.05)' : 'rgba(0,0,0,0.2)',
        border: '1px solid ' + (hover ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.03)'),
        borderRadius: 'var(--radius-lg)', padding: '1.25rem',
        display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>{label}</span>
        <Icon name={icon} size={16} color={hover ? 'var(--color-primary)' : 'var(--text-tertiary)'} />
      </div>
      <span style={{
        fontSize: '2rem', fontWeight: 900, fontFamily: 'var(--font-mono)', lineHeight: 1, marginTop: 'auto',
        color: tone === 'success' ? 'var(--color-success)' : tone === 'primary' ? 'var(--color-primary-hover)' : 'var(--text-primary)',
        textShadow: tone === 'success' ? '0 0 12px rgba(16,185,129,0.3)' : tone === 'primary' ? '0 0 12px rgba(99,102,241,0.3)' : 'none',
      }}>{value}</span>
    </div>
  );
}

function Trend() {
  const pts = [12, 18, 9, 24, 31, 22, 38, 34, 41, 29, 46, 52];
  const w = 640, h = 150, max = 60;
  const step = w / (pts.length - 1);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + (i * step).toFixed(1) + ' ' + (h - (p / max) * h).toFixed(1)).join(' ');
  return (
    <svg viewBox={'0 0 ' + w + ' ' + h} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6366f1" stopOpacity="0.35" />
          <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={d + ' L ' + w + ' ' + h + ' L 0 ' + h + ' Z'} fill="url(#tg)" />
      <path d={d} fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" className="ac-line" style={{ strokeDasharray: 2000, strokeDashoffset: 0 }} />
      {pts.map((p, i) => (
        <circle key={i} cx={i * step} cy={h - (p / max) * h} r="3" fill="#0b1120" stroke="#818cf8" strokeWidth="2" />
      ))}
    </svg>
  );
}

function Dist() {
  const bars = [['S', 2, '#FFD700'], ['A', 7, '#EF4444'], ['B', 14, '#F97316'], ['C', 31, '#3B82F6'], ['D', 22, '#8B5CF6'], ['E', 11, '#94A3B8']];
  const max = 31;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: '0.5rem', height: 150 }}>
      {bars.map(([l, v, c]) => (
        <div key={l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', flex: 1, height: '100%', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>{v}</span>
          <div style={{ width: '60%', maxWidth: 42, flex: 1, display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ width: '100%', height: (v / max * 100) + '%', minHeight: 3, borderRadius: '6px 6px 0 0', background: c }} />
          </div>
          <span style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>{l}</span>
        </div>
      ))}
    </div>
  );
}

function AnalyticsScreen() {
  const [range, setRange] = React.useState('30 days');
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', position: 'relative' }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at 15% 50%, rgba(99,102,241,0.05), transparent 40%), radial-gradient(circle at 85% 30%, rgba(16,185,129,0.05), transparent 40%)',
      }} />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem 2rem 3rem', position: 'relative', zIndex: 10 }}>
        <header style={{ marginBottom: '2rem', padding: '1rem 0' }}>
          <h1 style={{
            fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '0.5rem',
            display: 'inline-block',
            background: 'linear-gradient(135deg, #f8fafc, #818cf8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Analytics</h1>
          <div style={{ height: 4, width: '40%', background: 'linear-gradient(90deg, var(--color-primary), transparent)', borderRadius: 4, marginTop: 4 }} />
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.95rem', maxWidth: 600, marginTop: '0.75rem' }}>
            Every attempt you have logged, scored and timed.
          </p>
          <div style={{ marginTop: '1rem' }}>
            <Tabs variant="pill" value={range} onChange={setRange} items={[{ label: '7 days' }, { label: '30 days' }, { label: 'All time' }]} />
          </div>
        </header>

        <PanelCard variant="glass" icon="gauge" title="Overview" action={<Badge tone="neutral">87 attempts</Badge>} style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <HeroTile label="Attempts" value="87" icon="activity" />
            <HeroTile label="Perfect runs" value="41" icon="check-circle-2" tone="success" />
            <HeroTile label="Accuracy" value="94%" icon="target" tone="primary" />
            <HeroTile label="Median time" value="14:22" icon="clock" />
          </div>
        </PanelCard>

        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <PanelCard variant="glass" icon="trending-up" title="Attempts per week">
            <Trend />
          </PanelCard>
          <PanelCard variant="glass" icon="layers" title="By difficulty tier">
            <Dist />
          </PanelCard>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'start' }}>
          <PanelCard variant="glass" icon="calendar-days" title="Consistency">
            <Heatmap weeks={30} />
          </PanelCard>
          <PanelCard variant="glass" icon="repeat" title="Review load">
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
              <ProgressRing value={68} size={72} />
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', maxWidth: 160 }}>
                6 of 19 scheduled cards are still due today.
              </div>
            </div>
          </PanelCard>
        </div>

        <PanelCard variant="glass" icon="history" title="Attempt history">
          <DataTable
            rows={ROWS}
            onRowClick={() => {}}
            columns={[
              { key: 'name', label: 'Program' },
              { label: 'Tier', render: r => <TierBadge tier={r.tier} /> },
              { key: 'time', label: 'Duration' },
              { key: 'when', label: 'When' },
              { label: 'Score', align: 'right', render: r => <ScoreBadge perfect={r.perfect}>{r.score}</ScoreBadge> },
            ]}
          />
        </PanelCard>
      </div>
    </div>
  );
}

Object.assign(window, { AnalyticsScreen });
})();
