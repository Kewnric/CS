import React from 'react';

export function Skeleton({ variant = 'line', width = '100%', height, style = {}, ...rest }) {
  const h = height ?? (variant === 'block' ? 96 : variant === 'text' ? '0.8em' : 14);
  return (
    <div style={{
      position: 'relative', overflow: 'hidden', width, height: h,
      background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)',
      margin: variant === 'text' ? '0.4em 0' : variant === 'line' ? '10px 0' : 0,
      ...style,
    }} {...rest}>
      <div style={{
        content: '""', position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
        animation: 'shimmer 1.4s infinite',
      }} />
    </div>
  );
}
