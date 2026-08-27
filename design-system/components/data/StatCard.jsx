import React from 'react';
import { Icon } from '../core/Icon.jsx';

const accents = {
  indigo: { color: '#6366f1', bar: 'linear-gradient(90deg,#6366f1,#818cf8)', wash: 'rgba(99,102,241,0.12)' },
  green:  { color: '#10b981', bar: 'linear-gradient(90deg,#10b981,#34d399)', wash: 'rgba(16,185,129,0.12)' },
  amber:  { color: '#f59e0b', bar: 'linear-gradient(90deg,#f59e0b,#fbbf24)', wash: 'rgba(245,158,11,0.12)' },
  cyan:   { color: '#06b6d4', bar: 'linear-gradient(90deg,#06b6d4,#22d3ee)', wash: 'rgba(6,182,212,0.12)' },
};

export function StatCard({ icon, value, label, accent = 'indigo', atRisk = false, onClick, style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const a = accents[accent] || accents.indigo;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--glass-bg)', backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid ' + (atRisk ? 'var(--color-warning)' : (hover ? 'var(--color-primary)' : 'var(--glass-border)')),
        borderRadius: 'var(--radius-lg)', padding: '1.25rem 1rem', textAlign: 'center',
        position: 'relative', overflow: 'hidden',
        transition: 'all 0.3s var(--ease-spring)',
        transform: hover ? 'translateY(-4px)' : 'none',
        boxShadow: hover ? 'var(--shadow-lg)' : 'none',
        cursor: onClick ? 'pointer' : 'default', ...style,
      }}
      {...rest}
    >
      <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '3px 3px 0 0', background: a.bar }} />
      {icon ? (
        <div style={{
          width: 36, height: 36, margin: '0 auto 0.625rem', display: 'flex',
          alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)',
          color: a.color, background: a.wash,
        }}>
          <Icon name={icon} size={18} style={{ transform: hover ? 'scale(1.15) rotate(-5deg)' : 'none', transition: 'transform 0.3s var(--ease-spring)' }} />
        </div>
      ) : null}
      <div style={{
        fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-mono)',
        color: 'var(--text-primary)', marginBottom: '0.125rem', lineHeight: 1,
      }}>{value}</div>
      <div style={{
        fontSize: '0.6875rem', fontWeight: atRisk ? 800 : 600,
        color: atRisk ? 'var(--color-warning)' : 'var(--text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>{label}</div>
    </div>
  );
}
