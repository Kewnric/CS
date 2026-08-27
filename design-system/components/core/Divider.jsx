import React from 'react';

export function Divider({ orientation = 'horizontal', style = {}, ...rest }) {
  const s = orientation === 'vertical'
    ? { width: 1, height: '1.5rem', background: 'var(--border-color)', margin: '0 var(--space-sm)' }
    : { width: '100%', height: 1, background: 'var(--border-color)', margin: 'var(--space-md) 0' };
  return <div role="separator" style={{ ...s, ...style }} {...rest} />;
}
