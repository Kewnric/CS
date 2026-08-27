import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function SidebarLink({ icon, label, active = false, expanded = true, href = '#', onClick, style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <a
      href={href}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={label}
      style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '0 16px', height: 48,
        color: active ? '#22d3ee' : (hover ? '#e2e8f0' : '#94a3b8'),
        textDecoration: 'none', borderRadius: 'var(--radius-md)', whiteSpace: 'nowrap',
        fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '0.95rem',
        transition: 'all 0.2s var(--ease-standard)', cursor: 'pointer',
        background: active ? 'var(--color-primary-subtle)' : (hover ? 'rgba(148,163,184,0.15)' : 'transparent'),
        border: 'none', textAlign: 'left', width: '100%', overflow: 'hidden',
        position: 'relative', transform: hover && !active ? 'translateX(3px)' : 'none',
        ...style,
      }}
      {...rest}
    >
      {active ? (
        <span style={{
          position: 'absolute', left: 0, top: '25%', bottom: '25%', width: 3,
          background: '#22d3ee', borderRadius: '0 3px 3px 0',
          boxShadow: '2px 0 8px rgba(34,211,238,0.4)',
        }} />
      ) : null}
      <Icon name={icon} size={24} style={{ transform: hover ? 'scale(1.12)' : 'none', transition: 'transform 0.2s var(--ease-spring)' }} />
      <span style={{ opacity: expanded ? 1 : 0, transition: 'opacity 0.2s ease' }}>{label}</span>
    </a>
  );
}
