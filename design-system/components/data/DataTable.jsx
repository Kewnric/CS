import React from 'react';

export function DataTable({ columns = [], rows = [], onRowClick, style = {}, ...rest }) {
  const [hoverRow, setHoverRow] = React.useState(-1);
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', ...style,
    }} {...rest}>
      <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
        <thead style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-color)' }}>
          <tr>
            {columns.map((c) => (
              <th key={c.key || c.label} style={{
                padding: '0.875rem 1rem', fontSize: '0.8125rem', fontWeight: 600,
                color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em',
                textAlign: c.align || 'left',
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr
              key={ri}
              onClick={() => onRowClick && onRowClick(r, ri)}
              onMouseEnter={() => setHoverRow(ri)}
              onMouseLeave={() => setHoverRow(-1)}
              style={{
                background: hoverRow === ri ? 'var(--bg-surface-hover)' : 'transparent',
                transition: 'background-color var(--transition-fast)',
                cursor: onRowClick ? 'pointer' : 'default',
              }}
            >
              {columns.map((c, ci) => (
                <td key={c.key || ci} style={{
                  padding: '0.875rem 1rem', fontSize: '0.875rem',
                  borderBottom: ri === rows.length - 1 ? 'none' : '1px solid var(--border-color-subtle)',
                  verticalAlign: 'middle', textAlign: c.align || 'left',
                }}>{c.render ? c.render(r) : r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
