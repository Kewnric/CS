import React from 'react';

export function Select({ children, style = {}, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <select
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        width: '100%', background: 'var(--bg-surface)',
        border: '1px solid ' + (focus ? 'var(--color-primary)' : 'var(--border-color)'),
        borderRadius: 'var(--radius-md)', padding: '0.625rem 0.75rem',
        fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--text-primary)',
        outline: 'none', cursor: 'pointer', transition: 'border-color var(--transition-fast)',
        ...style,
      }}
      {...rest}
    >{children}</select>
  );
}
