import React from 'react';
import { Icon } from './Icon.jsx';

export function EmptyState({ icon = 'inbox', title, description, action, style = {}, ...rest }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '1rem', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)', textAlign: 'center', ...style,
    }} {...rest}>
      <span style={{
        width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(255,255,255,0.03)', opacity: 0.5,
        animation: 'float 6s ease-in-out infinite',
      }}><Icon name={icon} size={28} /></span>
      {title ? <h2 style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', margin: 0 }}>{title}</h2> : null}
      {description ? <p style={{ fontSize: '0.95rem', opacity: 0.8, margin: 0 }}>{description}</p> : null}
      {action}
    </div>
  );
}
