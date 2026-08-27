import React from 'react';
import { Icon } from '../core/Icon.jsx';

const railColors = ['var(--color-primary)', 'var(--color-accent)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-danger)'];

export function TreeNode({
  label, icon, kind = 'folder', level = 0, expanded = false, active = false,
  count, locked = false, onToggle, onClick, children, style = {}, ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const glyph = icon || (kind === 'folder' ? 'folder' : 'file-code-2');
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.75rem',
          borderRadius: 'var(--radius-md)', cursor: 'pointer', userSelect: 'none',
          position: 'relative', overflow: 'hidden',
          transition: 'all 0.2s var(--ease-standard)',
          background: active ? 'var(--bg-surface-hover)' : (hover ? 'rgba(148,163,184,0.12)' : 'transparent'),
          transform: hover && !active ? 'translateX(2px)' : 'none',
          ...style,
        }}
        {...rest}
      >
        <span
          onClick={(e) => { e.stopPropagation(); onToggle && onToggle(); }}
          style={{
            width: 18, height: 18, minWidth: 18, color: 'var(--text-tertiary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            visibility: kind === 'folder' ? 'visible' : 'hidden',
            transform: expanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.3s var(--ease-spring)',
          }}
        ><Icon name="chevron-right" size={18} /></span>
        <Icon name={glyph} size={18} color={kind === 'folder' ? 'var(--color-accent)' : 'var(--text-tertiary)'} />
        <span style={{
          fontSize: '0.95rem', fontWeight: 600,
          color: active ? 'var(--text-primary)' : 'var(--text-primary)',
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{label}</span>
        {locked ? <Icon name="lock" size={14} color="var(--color-warning)" /> : null}
        {count != null ? (
          <span style={{
            background: 'var(--bg-surface-hover)', padding: '0.125rem 0.375rem',
            borderRadius: '1rem', fontSize: '0.625rem', fontWeight: 700,
            color: 'var(--text-tertiary)', marginLeft: 'auto', flexShrink: 0,
          }}>{count}</span>
        ) : null}
        <span style={{
          position: 'absolute', right: 0, top: (10 + level * 5) + '%', bottom: (10 + level * 5) + '%',
          width: 3, background: railColors[Math.min(level, 4)],
          borderRadius: '4px 0 0 4px', opacity: 0.8,
          boxShadow: '-2px 0 8px rgba(34,211,238,0.4)',
        }} />
      </div>
      {expanded && children ? (
        <div style={{ borderLeft: '2px solid var(--border-color)', marginLeft: '1.125rem' }}>{children}</div>
      ) : null}
    </div>
  );
}
