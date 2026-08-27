(function(){
const { StatCard, PanelCard, QuickActionCard, Heatmap, Badge, Button, Icon, TierBadge, ScoreBadge } = window.StudySessionProDesignSystem_f5d02b;

function Hero() {
  return (
    <section style={{
      position: 'relative', padding: '2.75rem 2.5rem 2.25rem',
      borderRadius: 'var(--radius-xl)',
      background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(6,182,212,0.07) 50%, rgba(16,185,129,0.05) 100%)',
      border: '1px solid var(--border-color)', overflow: 'hidden',
      animation: 'fadeInUp 0.4s ease-out',
    }}>
      <span style={{
        position: 'absolute', top: '-40%', right: '-15%', width: 360, height: 360,
        background: 'radial-gradient(circle, rgba(99,102,241,0.13) 0%, transparent 70%)',
        borderRadius: '50%', animation: 'float 8s ease-in-out infinite', pointerEvents: 'none',
      }} />
      <span style={{
        position: 'absolute', bottom: '-25%', left: '-8%', width: 280, height: 280,
        background: 'radial-gradient(circle, rgba(6,182,212,0.09) 0%, transparent 70%)',
        borderRadius: '50%', animation: 'float 6s ease-in-out infinite reverse', pointerEvents: 'none',
      }} />
      <button title="Show Page Tour" style={{
        position: 'absolute', top: '1rem', right: '1rem', width: 34, height: 34,
        borderRadius: 'var(--radius-md)', background: 'transparent',
        border: '1px solid var(--border-color)', color: 'var(--text-tertiary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2,
      }}><Icon name="graduation-cap" size={16} /></button>
      <div style={{
        fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.2,
        marginBottom: '0.5rem', position: 'relative', zIndex: 1,
        background: 'linear-gradient(135deg, var(--text-primary) 30%, var(--color-primary) 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>Good evening, Kenric</div>
      <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', position: 'relative', zIndex: 1 }}>
        You have 6 cards due for review and one unfinished session.
      </div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginTop: '0.75rem', fontWeight: 500, position: 'relative', zIndex: 1 }}>
        Friday, 28 August
      </div>
      <div style={{ marginTop: '1rem', fontStyle: 'italic', color: 'var(--text-tertiary)', maxWidth: 600, position: 'relative', zIndex: 1, fontSize: '0.875rem' }}>
        "Whatever you do, work at it with all your heart." — Colossians 3:23
      </div>
    </section>
  );
}

function SrsRow({ title, due, tier }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.75rem 0.875rem', background: 'var(--bg-surface-hover)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid ' + (hover ? 'var(--color-primary)' : 'var(--border-color)'),
        marginBottom: '0.5rem', transition: 'all 0.2s ease', cursor: 'pointer',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
        <TierBadge tier={tier} />
        <span style={{ fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      </span>
      <Badge tone={due === 'Today' ? 'warning' : 'neutral'}>{due}</Badge>
    </div>
  );
}

function ActivityRow({ name, score, perfect, when }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.625rem 0', borderTop: '1px solid var(--border-color-subtle)',
    }}>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{name}</span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>{when}</span>
      </span>
      <ScoreBadge perfect={perfect}>{score}</ScoreBadge>
    </div>
  );
}

function HomeScreen({ go }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0.75rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem 2rem 3rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <Hero />
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.875rem' }} className="stagger-children">
          <StatCard icon="flame" value="12" label="Day streak" accent="indigo" />
          <StatCard icon="check-circle-2" value="87" label="Solved" accent="green" />
          <StatCard icon="target" value="94%" label="Accuracy" accent="amber" />
          <StatCard icon="clock" value="6.2h" label="This week" accent="cyan" />
        </section>
        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) clamp(230px, 24%, 300px)', gap: '1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
            <PanelCard icon="calendar-days" title="Practice activity" action={<Badge tone="neutral">26 weeks</Badge>}>
              <Heatmap weeks={26} />
            </PanelCard>
            <PanelCard icon="notebook-pen" title="Continue where you left off">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 700 }}>Bubble Sort — v2</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>Autosaved 4 minutes ago · 2 of 3 files edited</div>
                </div>
                <Button icon="play" onClick={() => go('practice')}>Resume</Button>
              </div>
            </PanelCard>
          </div>
          <PanelCard icon="zap" title="Quick actions">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <QuickActionCard index={0} icon="play" label="Resume practice" description="Bubble Sort, 4 min left" onClick={(e) => { e.preventDefault(); go('practice'); }} />
              <QuickActionCard index={1} icon="library" label="Browse library" description="87 programs" onClick={(e) => { e.preventDefault(); go('library'); }} />
              <QuickActionCard index={2} icon="scroll-text" label="Quest board" description="3 active" onClick={(e) => { e.preventDefault(); go('quests'); }} />
              <QuickActionCard index={3} icon="bar-chart-3" label="Analytics" description="Last 30 days" onClick={(e) => { e.preventDefault(); go('analytics'); }} />
            </div>
          </PanelCard>
        </section>
        <section style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.25rem' }}>
          <PanelCard icon="repeat" title="Due for review" action={<Badge tone="warning">6</Badge>}>
            <SrsRow title="Linked List Reversal" due="Today" tier="A" />
            <SrsRow title="Matrix Transpose" due="Today" tier="B" />
            <SrsRow title="String Tokeniser" due="Tomorrow" tier="C" />
          </PanelCard>
          <PanelCard icon="history" title="Recent activity">
            <ActivityRow name="Bubble Sort" score="18 / 18" perfect when="2 hours ago" />
            <ActivityRow name="Binary Search" score="15 / 18" perfect={false} when="Yesterday" />
            <ActivityRow name="Stack with Array" score="18 / 18" perfect when="Yesterday" />
          </PanelCard>
        </section>
      </div>
    </div>
  );
}

Object.assign(window, { HomeScreen });
})();
