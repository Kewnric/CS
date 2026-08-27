import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function Modal({
  open = true, title, description, icon, iconColor = 'var(--color-primary)',
  size = 'md', actions, children, onDismiss, style = {}, ...rest
}) {
  if (!open) return null;
  const widths = { md: 420, lg: 520, wide: 900, search: 640 };
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && onDismiss) onDismiss(); }}
      style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 'var(--space-lg)', zIndex: 1000,
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        animation: 'fadeIn 0.28s ease-out both',
      }} />
      <div style={{
        position: 'relative', background: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-xl)', maxWidth: widths[size] || widths.md, width: '100%',
        padding: 'var(--space-xl)', textAlign: 'center',
        animation: 'modalRise 0.34s var(--ease-expo-out) both', ...style,
      }} {...rest}>
        {icon ? (
          <div style={{ marginBottom: 'var(--space-md)', display: 'flex', justifyContent: 'center' }}>
            <Icon name={icon} size={48} color={iconColor} />
          </div>
        ) : null}
        {title ? <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.375rem' }}>{title}</h2> : null}
        {description ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 'var(--space-xl)', lineHeight: 1.5 }}>{description}</p>
        ) : null}
        {children}
        {actions ? (
          <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: children ? 'var(--space-lg)' : 0 }}>{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
