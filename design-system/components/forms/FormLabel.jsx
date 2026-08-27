import React from 'react';

export function FormLabel({ children, aside, htmlFor, style = {}, ...rest }) {
  const s = {
    fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem',
    ...(aside
      ? { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
      : { display: 'block' }),
    ...style,
  };
  return <label htmlFor={htmlFor} style={s} {...rest}>{children}{aside ? <span>{aside}</span> : null}</label>;
}
