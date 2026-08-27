import React from 'react';

function PageBtn({ children, active, disabled, onClick }) {
  const [hover, setHover] = React.useState(false);
  const on = hover && !active && !disabled;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: '2rem', height: '2rem', padding: '0 0.5rem',
        borderRadius: 'var(--radius-md)',
        border: '1px solid ' + (active || on ? 'var(--color-primary)' : 'var(--border-color)'),
        background: active ? 'var(--color-primary)' : (on ? 'var(--bg-surface-hover)' : 'transparent'),
        color: active ? '#fff' : (on ? 'var(--color-primary)' : 'var(--text-secondary)'),
        fontSize: '0.8rem', fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        pointerEvents: active ? 'none' : 'auto',
        transition: 'all 0.18s ease',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >{children}</button>
  );
}

export function Pagination({ page = 1, pageCount = 1, onChange, style = {}, ...rest }) {
  const go = (p) => onChange && onChange(Math.min(Math.max(p, 1), pageCount));
  const pages = [];
  for (let i = 1; i <= pageCount; i++) {
    if (i === 1 || i === pageCount || Math.abs(i - page) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
      marginTop: '1.25rem', padding: '0.5rem 0', userSelect: 'none', ...style,
    }} {...rest}>
      <PageBtn disabled={page <= 1} onClick={() => go(page - 1)}>‹</PageBtn>
      {pages.map((p, i) => p === '…'
        ? <span key={'e' + i} style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', padding: '0 0.25rem' }}>…</span>
        : <PageBtn key={p} active={p === page} onClick={() => go(p)}>{p}</PageBtn>)}
      <PageBtn disabled={page >= pageCount} onClick={() => go(page + 1)}>›</PageBtn>
    </div>
  );
}
