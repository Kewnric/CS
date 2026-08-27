import React from 'react';

export function FileTab({ name, active = false, dirty = false, onClick, onClose, style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0 0.875rem',
        fontSize: '0.8125rem', fontFamily: 'var(--font-mono)',
        color: active ? 'var(--color-accent)' : (hover ? 'var(--text-secondary)' : 'var(--text-tertiary)'),
        whiteSpace: 'nowrap', cursor: 'pointer',
        borderRight: '1px solid var(--border-color)',
        borderBottom: '2px solid ' + (active ? 'var(--color-accent)' : 'transparent'),
        background: active ? 'rgba(6,182,212,0.08)' : (hover ? 'rgba(255,255,255,0.04)' : 'transparent'),
        transition: 'color 0.15s, background 0.15s, border-color 0.15s',
        userSelect: 'none', minHeight: 38, ...style,
      }}
      {...rest}
    >
      <span style={{ pointerEvents: 'none' }}>{name}{dirty ? ' •' : ''}</span>
      <span
        onClick={(e) => { e.stopPropagation(); onClose && onClose(); }}
        style={{
          fontSize: '0.7rem', lineHeight: 1, padding: '1px 2px', borderRadius: 3,
          color: 'var(--text-tertiary)', opacity: hover ? 1 : 0, cursor: 'pointer',
          transition: 'opacity 0.15s, background 0.15s',
        }}
      >✕</span>
    </div>
  );
}
