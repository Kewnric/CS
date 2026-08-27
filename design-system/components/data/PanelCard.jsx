import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function PanelCard({ icon, title, action, children, variant = 'surface', style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const glass = variant === 'glass';
  return (
    <section
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: glass ? 'rgba(19,28,49,0.4)' : 'var(--bg-surface)',
        backdropFilter: glass ? 'blur(16px)' : undefined,
        WebkitBackdropFilter: glass ? 'blur(16px)' : undefined,
        border: '1px solid ' + (glass
          ? (hover ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)')
          : (hover ? 'rgba(99,102,241,0.15)' : 'var(--border-color)')),
        borderRadius: 'var(--radius-xl)',
        padding: glass ? '1.75rem' : '1.25rem 1.5rem',
        boxShadow: glass
          ? (hover ? '0 12px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)' : '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)')
          : (hover ? '0 4px 20px rgba(99,102,241,0.04)' : 'none'),
        transform: glass && hover ? 'translateY(-2px)' : 'none',
        transition: 'all 0.25s ease', overflow: 'hidden', ...style,
      }}
      {...rest}
    >
      {title ? (
        <header style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem',
          fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: 'var(--text-tertiary)',
        }}>
          {icon ? <Icon name={icon} size={14} /> : null}
          <span>{title}</span>
          {action ? <span style={{ marginLeft: 'auto' }}>{action}</span> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
