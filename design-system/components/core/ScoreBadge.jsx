import React from 'react';

export function ScoreBadge({ children, perfect = false, style = {}, ...rest }) {
  return (
    <span style={{
      display: 'inline-flex', padding: '0.25rem 0.625rem', borderRadius: 'var(--radius-sm)',
      fontSize: '0.75rem', fontWeight: 700,
      background: perfect ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
      color: perfect ? 'var(--color-success)' : 'var(--color-warning)',
      ...style,
    }} {...rest}>{children}</span>
  );
}
