import React from 'react';

const levelStyle = [
  { background: 'var(--bg-surface-hover)', borderColor: 'rgba(255,255,255,0.02)' },
  { background: 'rgba(99,102,241,0.2)', borderColor: 'rgba(99,102,241,0.3)' },
  { background: 'rgba(99,102,241,0.5)', borderColor: 'rgba(99,102,241,0.6)' },
  { background: 'rgba(99,102,241,0.8)', borderColor: 'rgba(99,102,241,0.9)' },
  { background: 'var(--color-primary)', borderColor: 'var(--color-primary-hover)', boxShadow: '0 0 8px var(--color-primary-glow)' },
];

export function Heatmap({ weeks = 26, data, cell = 14, gap = 4, style = {}, ...rest }) {
  const levels = data || Array.from({ length: weeks * 7 }, (_, i) => (i * 7919) % 11 > 7 ? (i % 5) : (i % 3 === 0 ? 1 : 0));
  return (
    <div style={{ overflowX: 'auto', scrollbarWidth: 'none', ...style }} {...rest}>
      <div style={{
        display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gridAutoFlow: 'column',
        gap, width: 'fit-content',
      }}>
        {levels.map((lv, i) => (
          <div key={i} title={'Level ' + lv} style={{
            width: cell, height: cell, borderRadius: 4, borderWidth: 1, borderStyle: 'solid',
            transition: 'all 0.2s var(--ease-spring)', ...levelStyle[Math.min(lv, 4)],
          }} />
        ))}
      </div>
    </div>
  );
}
