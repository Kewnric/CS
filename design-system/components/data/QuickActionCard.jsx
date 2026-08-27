import React from 'react';
import { Icon } from '../core/Icon.jsx';

const washes = [
  { bg: 'rgba(99,102,241,0.12)', fg: '#6366f1' },
  { bg: 'rgba(6,182,212,0.12)', fg: '#06b6d4' },
  { bg: 'rgba(245,158,11,0.12)', fg: '#f59e0b' },
  { bg: 'rgba(16,185,129,0.12)', fg: '#10b981' },
];

export function QuickActionCard({ icon, label, description, index = 0, href = '#', onClick, style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const w = washes[index % washes.length];
  return (
    <a
      href={href}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem',
        background: 'var(--bg-surface-hover)',
        border: '1px solid ' + (hover ? 'var(--color-primary)' : 'var(--border-color)'),
        borderRadius: 'var(--radius-lg)', cursor: 'pointer', textDecoration: 'none',
        color: 'var(--text-primary)', transition: 'all 0.25s var(--ease-spring)',
        transform: hover ? 'translateY(-3px) scale(1.01)' : 'none',
        boxShadow: hover ? '0 6px 20px var(--color-primary-glow)' : 'none',
        position: 'relative', overflow: 'hidden', ...style,
      }}
      {...rest}
    >
      <span style={{
        width: 36, height: 36, borderRadius: 'var(--radius-md)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        background: w.bg, color: w.fg,
      }}>
        <Icon name={icon} size={18} style={{ transform: hover ? 'scale(1.15)' : 'none', transition: 'transform 0.2s var(--ease-spring)' }} />
      </span>
      <span>
        <span style={{ display: 'block', fontWeight: 700, fontSize: '0.8125rem' }}>{label}</span>
        {description ? <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-tertiary)', marginTop: 1 }}>{description}</span> : null}
      </span>
    </a>
  );
}
