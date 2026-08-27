import React from 'react';

export function Textarea({ mono = false, style = {}, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <textarea
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        width: '100%', background: 'var(--bg-surface)',
        border: '1px solid ' + (focus ? 'var(--color-primary)' : 'var(--border-color)'),
        borderRadius: 'var(--radius-md)', padding: '0.625rem 0.75rem',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        fontSize: mono ? '0.8125rem' : '0.875rem',
        lineHeight: mono ? 1.6 : 'inherit',
        color: 'var(--text-primary)', outline: 'none', resize: 'vertical',
        minHeight: mono ? 80 : 60, transition: 'border-color var(--transition-fast)',
        ...style,
      }}
      {...rest}
    />
  );
}
