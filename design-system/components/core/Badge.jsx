import React from 'react';

const tones = {
  primary: { background: 'var(--color-primary-subtle)', color: 'var(--color-primary)', border: '1px solid rgba(99,102,241,0.2)' },
  success: { background: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid rgba(16,185,129,0.2)' },
  warning: { background: 'var(--color-warning-bg)', color: 'var(--color-warning)', border: '1px solid rgba(245,158,11,0.2)' },
  danger:  { background: 'var(--color-danger-bg)',  color: 'var(--color-danger)',  border: '1px solid rgba(239,68,68,0.2)' },
  neutral: { background: 'var(--bg-surface-hover)', color: 'var(--text-tertiary)', border: '1px solid transparent' },
};

export function Badge({ children, tone = 'primary', style = {}, ...rest }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '0.1875rem 0.625rem',
      fontSize: '0.6875rem', fontWeight: 700, borderRadius: 'var(--radius-full)',
      letterSpacing: '0.02em', whiteSpace: 'nowrap', ...tones[tone], ...style,
    }} {...rest}>{children}</span>
  );
}
