import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function Breadcrumb({ items = [], onNavigate, style = {}, ...rest }) {
  return (
    <nav style={{
      display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0',
      fontSize: '0.8125rem', color: 'var(--text-tertiary)', flexWrap: 'wrap',
      borderBottom: '1px solid var(--border-color)', ...style,
    }} {...rest}>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        const label = typeof it === 'string' ? it : it.label;
        return (
          <React.Fragment key={label + i}>
            {last ? (
              <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.8125rem' }}>{label}</span>
            ) : (
              <button
                onClick={() => onNavigate && onNavigate(i)}
                style={{
                  cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600,
                  background: 'none', border: 'none', fontFamily: 'var(--font-sans)',
                  fontSize: '0.8125rem', padding: '0.125rem 0.375rem',
                  borderRadius: 'var(--radius-sm)', transition: 'color var(--transition-fast)',
                }}
              >{label}</button>
            )}
            {last ? null : (
              <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-tertiary)' }}>
                <Icon name="chevron-right" size={12} />
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
