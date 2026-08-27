(function(){
const { Icon } = window.StudySessionProDesignSystem_f5d02b;

function Option({ icon, tone, title, desc, last, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem',
        background: hover ? 'var(--bg-surface-hover)' : 'var(--bg-surface)',
        border: '1px solid ' + (hover ? 'var(--color-primary)' : 'var(--border-color)'),
        borderRadius: 'var(--radius-lg)', cursor: 'pointer', textAlign: 'left', width: '100%',
        fontFamily: 'var(--font-sans)', color: 'var(--text-primary)',
        transition: 'all 0.2s ease',
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? '0 0 0 3px var(--color-primary-glow), 0 4px 12px rgba(0,0,0,0.15)' : 'none',
      }}
    >
      <span style={{
        width: 44, height: 44, borderRadius: 'var(--radius-md)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        background: tone === 'cloud'
          ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.05))'
          : 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(99,102,241,0.05))',
        color: tone === 'cloud' ? 'var(--color-success)' : 'var(--color-primary)',
      }}><Icon name={icon} size={22} /></span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.125rem' }}>
          {title}
          {last ? (
            <span style={{
              display: 'inline-block', marginLeft: '0.4rem', padding: '0.05rem 0.4rem',
              borderRadius: 999, fontSize: '0.5625rem', fontWeight: 800, letterSpacing: '0.04em',
              textTransform: 'uppercase', verticalAlign: 2, color: 'var(--color-primary)',
              background: 'var(--color-primary-subtle)', border: '1px solid var(--color-primary)',
            }}>Last used</span>
          ) : null}
        </span>
        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{desc}</span>
      </span>
      <span style={{
        color: hover ? 'var(--color-primary)' : 'var(--text-tertiary)', flexShrink: 0, display: 'flex',
        transform: hover ? 'translateX(3px)' : 'none', transition: 'all 0.2s ease',
      }}><Icon name="chevron-right" size={18} /></span>
    </button>
  );
}

function StorageModePicker({ onChoose }) {
  const [remember, setRemember] = React.useState(false);
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '1.5rem', background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      animation: 'fadeIn 0.3s ease-out',
    }}>
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 80px rgba(99,102,241,0.08)',
        maxWidth: 520, width: '100%', overflow: 'hidden',
        animation: 'scaleIn 0.4s var(--ease-spring)',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(6,182,212,0.08) 100%)',
          borderBottom: '1px solid var(--border-color)', padding: '2rem 2rem 1.5rem', textAlign: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <Icon name="code-2" size={32} color="var(--color-primary)" />
            <span style={{
              fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>StudySession Pro</span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>Choose where to store your data</p>
        </div>
        <div style={{ padding: '1.5rem 2rem 2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Option icon="hard-drive" tone="local" title="Local Storage" last
            desc="Data saved in your browser. Fast and offline-ready." onClick={onChoose} />
          <Option icon="cloud" tone="cloud" title="Cloud Storage"
            desc="Sign in with Google to sync across devices." onClick={onChoose} />
          <label
            onClick={() => setRemember(v => !v)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.65rem', marginTop: '0.85rem',
              padding: '0.65rem 0.75rem', border: '1px solid transparent',
              borderRadius: 'var(--radius-md)', cursor: 'pointer', userSelect: 'none',
            }}
          >
            <span style={{
              width: 18, height: 18, flexShrink: 0, marginTop: 1, borderRadius: 5,
              border: '1.5px solid ' + (remember ? 'var(--color-primary)' : 'var(--border-color)'),
              background: remember ? 'var(--color-primary)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              transition: 'all var(--transition-fast)',
            }}>{remember ? <Icon name="check" size={13} /> : null}</span>
            <span>
              <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600 }}>Remember my choice</span>
              <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>Skip this screen next time on this device</span>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { StorageModePicker });
})();
