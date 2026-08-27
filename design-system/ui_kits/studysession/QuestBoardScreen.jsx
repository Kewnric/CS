(function(){
const { Icon, Button } = window.StudySessionProDesignSystem_f5d02b;

const RANK = { S: '#ef4444', A: '#f97316', B: '#a855f7', C: '#3b82f6', D: '#22c55e', E: '#64748b' };

const QUESTS = [
  { id: 1, rank: 'S', title: 'CLEAR THE ARRAY GAUNTLET', desc: 'Solve 5 array programs without a hint', prog: 60, xp: 900, due: '2d' },
  { id: 2, rank: 'B', title: 'POINTER DISCIPLINE', desc: 'Perfect score on 3 pointer snippets', prog: 33, xp: 400, due: '5d' },
  { id: 3, rank: 'D', title: 'DAILY DRILL', desc: 'Any 1 practice session today', prog: 100, xp: 80, due: 'today' },
  { id: 4, rank: 'C', title: 'REVIEW BACKLOG', desc: 'Clear 6 due review cards', prog: 16, xp: 220, due: '3d' },
];

function StatusBar() {
  const stats = [{ icon: 'swords', v: 4, l: 'Active' }, { icon: 'check', v: 37, l: 'Done', c: '#10b981' }, { icon: 'x', v: 2, l: 'Failed', c: '#ef4444' }];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '0.55rem 1.25rem',
      background: 'rgba(7,12,28,0.85)', border: '1px solid rgba(51,65,85,0.5)',
      borderRadius: 'var(--radius-md)', backdropFilter: 'blur(12px)', flexShrink: 0,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', minWidth: 64 }}>
        <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '1.5px', color: '#475569', fontFamily: 'var(--font-display)' }}>SYSTEM</span>
        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#22c55e', fontFamily: 'var(--font-display)', textShadow: '0 0 12px rgba(34,197,94,0.5)', letterSpacing: '1px' }}>LV 24</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--font-display)' }}>Systems Apprentice</span>
          <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>4,120 / 5,000 XP</span>
        </div>
        <div style={{ height: 4, background: 'rgba(51,65,85,0.6)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: '82%', height: '100%', background: 'linear-gradient(90deg,#22c55e,#86efac)', borderRadius: 99, boxShadow: '0 0 8px rgba(34,197,94,0.5)' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
        {stats.map(s => (
          <div key={s.l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem', minWidth: 36 }}>
            <Icon name={s.icon} size={14} color="#64748b" />
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: s.c || 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>{s.v}</span>
            <span style={{ fontSize: '0.55rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankBadge({ rank }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 22, height: 22, borderRadius: 6, fontSize: '0.7rem', fontWeight: 900,
      fontFamily: 'var(--font-display)', color: RANK[rank],
      background: RANK[rank] + '1f', border: '1px solid ' + RANK[rank] + '59', flexShrink: 0,
    }}>{rank}</span>
  );
}

function QuestCard({ q, active, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '0.7rem 0.9rem', borderRadius: 8, marginBottom: 4, cursor: 'pointer',
        background: active ? RANK[q.rank] + '12' : (hover ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.5)'),
        border: '1px solid ' + (active ? RANK[q.rank] + '4d' : 'rgba(51,65,85,0.35)'),
        borderLeft: '3px solid ' + RANK[q.rank],
        transition: 'background 150ms ease-out, border-color 150ms ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
        <span style={{
          flex: 1, fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)',
          fontFamily: 'var(--font-display)', letterSpacing: '0.3px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{q.title}</span>
        <RankBadge rank={q.rank} />
      </div>
      <div style={{
        fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.4rem',
      }}>{q.desc}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
        <div style={{ flex: 1, height: 3, background: 'rgba(51,65,85,0.6)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: q.prog + '%', height: '100%', background: RANK[q.rank], borderRadius: 99, transition: 'width 0.4s ease-out' }} />
        </div>
        <span style={{ fontSize: '0.65rem', color: '#64748b', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{q.prog}%</span>
      </div>
    </div>
  );
}

function QuestBoardScreen() {
  const [sel, setSel] = React.useState(1);
  const [tab, setTab] = React.useState('ACTIVE');
  const q = QUESTS.find(x => x.id === sel);
  const tabs = [['ACTIVE', 4], ['COMPLETED', 37], ['FAILED', 2]];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '0.4rem', overflow: 'hidden', padding: '0.5rem' }}>
      <StatusBar />
      <div style={{ display: 'flex', flex: 1, gap: '0.4rem', minHeight: 0, overflow: 'hidden' }}>
        <div style={{
          width: 340, minWidth: 340, background: 'rgba(7,12,28,0.6)',
          border: '1px solid rgba(51,65,85,0.5)', borderRadius: 'var(--radius-md)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem 0.5rem', gap: '0.5rem' }}>
            <h2 style={{
              fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1.5px',
              display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0, fontFamily: 'var(--font-display)',
            }}><Icon name="scroll-text" size={15} color="var(--color-primary)" /> Quest Board</h2>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <Button variant="ghost" iconOnly icon="arrow-up-down" size="sm" aria-label="Sort" />
              <Button variant="ghost" iconOnly icon="plus" size="sm" aria-label="New quest" />
            </div>
          </div>
          <div style={{ position: 'relative', padding: '0 1rem 0.5rem' }}>
            <span style={{ position: 'absolute', left: '1.75rem', top: '30%', color: '#64748b', display: 'flex' }}><Icon name="search" size={13} /></span>
            <input placeholder="filter quests…" style={{
              width: '100%', padding: '0.45rem 0.75rem 0.45rem 2.25rem',
              background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.6)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
              fontSize: '0.82rem', fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box',
            }} />
          </div>
          <div style={{ display: 'flex', padding: '0 1rem', borderBottom: '1px solid rgba(51,65,85,0.4)' }}>
            {tabs.map(([t, n]) => (
              <button key={t} onClick={() => setTab(t)} style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.75rem',
                background: 'transparent', border: 'none',
                borderBottom: '2px solid ' + (tab === t ? 'var(--color-primary)' : 'transparent'),
                color: tab === t ? 'var(--color-primary)' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.8px', fontFamily: 'var(--font-display)', marginBottom: -1,
              }}>
                {t}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 16, height: 16, padding: '0 4px', background: 'var(--color-primary)',
                  color: '#000', borderRadius: 99, fontSize: '0.6rem', fontWeight: 800, fontFamily: 'var(--font-mono)',
                }}>{n}</span>
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
            {QUESTS.map(x => <QuestCard key={x.id} q={x} active={x.id === sel} onClick={() => setSel(x.id)} />)}
          </div>
        </div>

        <div style={{
          flex: 1, minWidth: 0, background: 'rgba(7,12,28,0.6)',
          border: '1px solid rgba(51,65,85,0.5)', borderRadius: 'var(--radius-md)',
          padding: '1.25rem 1.5rem', overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                <RankBadge rank={q.rank} />
                <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', fontFamily: 'var(--font-display)' }}>Rank {q.rank} · {q.xp} XP · due in {q.due}</span>
              </div>
              <h1 style={{
                fontSize: '1.25rem', fontWeight: 900, fontFamily: 'var(--font-display)',
                letterSpacing: '0.5px', margin: 0, lineHeight: 1.25,
              }}>{q.title}</h1>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '0.5rem' }}>{q.desc}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <Button icon="swords">Continue</Button>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <Button variant="secondary" size="sm" iconOnly icon="pencil" aria-label="Edit" />
                <Button variant="secondary" size="sm" iconOnly icon="trash-2" aria-label="Abandon" />
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[['Progress', q.prog + '%'], ['Reward', q.xp + ' XP'], ['Penalty', '-120 XP'], ['Deadline', 'in ' + q.due]].map(([l, v]) => (
              <div key={l} style={{
                padding: '0.75rem 0.9rem', background: 'rgba(15,23,42,0.5)',
                border: '1px solid rgba(51,65,85,0.35)', borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#475569', fontFamily: 'var(--font-display)' }}>{l}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: 4 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#475569', fontFamily: 'var(--font-display)', marginBottom: '0.6rem' }}>Objectives</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {[['Bubble Sort', true], ['Selection Sort', true], ['Insertion Sort', true], ['Matrix Transpose', false], ['Rotate 90°', false]].map(([n, done]) => (
              <div key={n} style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.75rem',
                background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.35)',
                borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem',
                color: done ? 'var(--text-secondary)' : 'var(--text-primary)',
                textDecoration: done ? 'line-through' : 'none',
              }}>
                <Icon name={done ? 'check-circle-2' : 'circle'} size={15} color={done ? '#22c55e' : '#475569'} />
                {n}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { QuestBoardScreen });
})();
