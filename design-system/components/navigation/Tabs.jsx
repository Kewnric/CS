import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function Tabs({ items = [], value, onChange, variant = 'underline', style = {}, ...rest }) {
  const pill = variant === 'pill';
  return (
    <div
      role="tablist"
      style={{
        display: 'flex', gap: pill ? '0.5rem' : '1rem',
        borderBottom: pill ? 'none' : '1px solid var(--border-color)',
        overflowX: 'auto', ...style,
      }}
      {...rest}
    >
      {items.map((it) => {
        const key = it.value ?? it.label;
        const on = key === value;
        const s = pill
          ? {
              padding: '0.375rem 0.875rem', fontSize: '0.8125rem', fontWeight: 600,
              border: '1px solid ' + (on ? 'var(--color-primary)' : 'var(--border-color)'),
              borderRadius: 'var(--radius-full)',
              background: on ? 'var(--color-primary-subtle)' : 'transparent',
              color: on ? 'var(--color-primary)' : 'var(--text-secondary)',
            }
          : {
              padding: '0.75rem 1.5rem', border: 'none',
              borderBottom: '2px solid ' + (on ? 'var(--color-primary)' : 'transparent'),
              background: 'none',
              color: on ? 'var(--color-primary)' : 'var(--text-tertiary)',
              fontWeight: 600, fontSize: '0.95rem',
            };
        return (
          <button
            key={key}
            role="tab"
            aria-selected={on}
            onClick={() => onChange && onChange(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
              whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)',
              transition: 'all var(--transition-fast)', ...s,
            }}
          >
            {it.icon ? <Icon name={it.icon} size={16} /> : null}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
