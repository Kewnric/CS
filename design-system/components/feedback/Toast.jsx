import React from 'react';
import { Icon } from '../core/Icon.jsx';

const tones = {
  info: { color: 'var(--color-accent)', icon: 'info' },
  success: { color: 'var(--color-success)', icon: 'check-circle-2' },
  error: { color: 'var(--color-danger)', icon: 'alert-circle' },
  warning: { color: 'var(--color-warning)', icon: 'alert-triangle' },
};

export function Toast({ tone = 'info', title, children, onClose, style = {}, ...rest }) {
  const t = tones[tone] || tones.info;
  return (
    <div role="status" style={{
      pointerEvents: 'auto', display: 'flex', alignItems: 'flex-start', gap: '0.65rem',
      padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)',
      background: 'var(--bg-elevated)', color: 'var(--text-primary)',
      border: '1px solid var(--border-color)', borderLeft: '3px solid ' + t.color,
      boxShadow: 'var(--shadow-lg)', fontSize: '0.875rem', lineHeight: 1.4,
      maxWidth: 380, position: 'relative', overflow: 'hidden',
      animation: 'smoothReveal 0.32s var(--ease-expo-out) both', ...style,
    }} {...rest}>
      <span style={{ flexShrink: 0, marginTop: 1, color: t.color, display: 'flex' }}>
        <Icon name={t.icon} size={18} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title ? <div style={{ fontWeight: 700, marginBottom: '0.1rem' }}>{title}</div> : null}
        {children}
      </div>
      {onClose ? (
        <button onClick={onClose} aria-label="Dismiss" style={{
          flexShrink: 0, background: 'none', border: 'none', color: 'var(--text-tertiary)',
          cursor: 'pointer', padding: 2, lineHeight: 0, borderRadius: 4,
        }}><Icon name="x" size={14} /></button>
      ) : null}
    </div>
  );
}
