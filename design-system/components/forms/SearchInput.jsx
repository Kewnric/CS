import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function SearchInput({ width = 320, placeholder = 'Search…', style = {}, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{ position: 'relative', width, ...style }}>
      <span style={{
        position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
        color: 'var(--text-tertiary)', pointerEvents: 'none', display: 'flex',
      }}><Icon name="search" size={18} /></span>
      <input
        placeholder={placeholder}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          width: '100%', background: 'var(--bg-surface-hover)',
          border: '1px solid ' + (focus ? 'var(--color-primary)' : 'var(--border-color)'),
          borderRadius: 'var(--radius-full)', padding: '0.625rem 1rem 0.625rem 2.5rem',
          fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: 'var(--text-primary)',
          outline: 'none', transition: 'all var(--transition-fast)',
          boxShadow: focus ? '0 0 0 3px var(--color-primary-glow)' : 'none',
        }}
        {...rest}
      />
    </div>
  );
}
