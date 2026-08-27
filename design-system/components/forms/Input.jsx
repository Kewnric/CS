import React from 'react';

const base = {
  width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)', padding: '0.625rem 0.75rem',
  fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--text-primary)',
  outline: 'none', transition: 'border-color var(--transition-fast)',
};

export function Input({ mono = false, align, style = {}, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <input
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        ...base,
        ...(mono ? { fontFamily: 'var(--font-mono)' } : null),
        ...(align ? { textAlign: align } : null),
        ...(focus ? { borderColor: 'var(--color-primary)' } : null),
        ...style,
      }}
      {...rest}
    />
  );
}
