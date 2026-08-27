import React from 'react';
import { Icon } from './Icon.jsx';

export function Tag({ children, onRemove, style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      padding: '0.25rem 0.5rem', fontSize: '0.75rem', fontWeight: 600,
      borderRadius: 'var(--radius-sm)', background: 'var(--color-primary-subtle)',
      color: 'var(--color-primary)', border: '1px solid rgba(99,102,241,0.15)', ...style,
    }} {...rest}>
      {children}
      {onRemove ? (
        <button
          onClick={onRemove}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          aria-label="Remove"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex',
            color: hover ? 'var(--color-danger)' : 'inherit',
            opacity: hover ? 1 : 0.6, transition: 'opacity var(--transition-fast)',
          }}
        ><Icon name="x" size={12} /></button>
      ) : null}
    </span>
  );
}
