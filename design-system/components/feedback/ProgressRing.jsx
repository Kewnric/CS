import React from 'react';

export function ProgressRing({ value = 0, size = 48, stroke = 4, color = 'var(--color-primary)', showLabel = true, style = {}, ...rest }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div style={{ position: 'relative', width: size, height: size, ...style }} {...rest}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset 1s var(--ease-spring)' }}
        />
      </svg>
      {showLabel ? (
        <span style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: size * 0.26, fontWeight: 800,
          fontFamily: 'var(--font-mono)', color: 'var(--text-primary)',
        }}>{Math.round(pct)}</span>
      ) : null}
    </div>
  );
}
