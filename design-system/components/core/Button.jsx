import React from 'react';
import { Icon } from './Icon.jsx';

const base = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
  padding: '0.625rem 1.25rem', fontFamily: 'var(--font-sans)', fontSize: '0.875rem',
  fontWeight: 600, lineHeight: 1.25, border: 'none', borderRadius: 'var(--radius-md)',
  cursor: 'pointer', transition: 'all var(--transition-fast)', whiteSpace: 'nowrap',
  textDecoration: 'none', position: 'relative', overflow: 'hidden',
};

const variants = {
  primary: {
    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
    color: 'var(--text-on-primary)', boxShadow: '0 2px 8px var(--color-primary-glow)',
  },
  secondary: {
    background: 'var(--bg-surface-hover)', color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
  },
  danger: {
    background: 'linear-gradient(135deg, var(--color-danger) 0%, var(--color-danger-hover) 100%)',
    color: '#fff',
  },
  ghost: { background: 'transparent', color: 'var(--text-secondary)', padding: '0.5rem' },
  practice: {
    background: 'var(--bg-surface-hover)', color: 'var(--color-primary)',
    border: '1px solid var(--border-color)', width: '100%',
  },
};

const hovers = {
  primary: {
    background: 'linear-gradient(135deg, var(--color-primary-hover) 0%, var(--color-primary) 100%)',
    boxShadow: '0 4px 16px var(--color-primary-glow)', transform: 'translateY(-1px)',
  },
  secondary: { background: 'var(--border-color)', borderColor: 'var(--text-tertiary)' },
  danger: { boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)', transform: 'translateY(-1px)' },
  ghost: { background: 'var(--bg-surface-hover)', color: 'var(--text-primary)' },
  practice: {
    background: 'var(--color-primary-subtle)', borderColor: 'var(--color-primary)',
    boxShadow: '0 2px 8px var(--color-primary-glow)',
  },
};

export function Button({
  children, variant = 'primary', size = 'md', icon, iconAfter, iconOnly = false,
  disabled = false, as = 'button', href, onClick, style = {}, ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const Tag = as === 'a' ? 'a' : 'button';
  const sizeStyle = size === 'sm' ? { padding: '0.375rem 0.75rem', fontSize: '0.8125rem' } : null;
  const iconStyle = iconOnly ? { padding: '0.5rem' } : null;
  const s = {
    ...base, ...variants[variant], ...sizeStyle, ...iconStyle,
    ...(hover && !disabled ? hovers[variant] : null),
    ...(press && !disabled ? { transform: 'scale(0.97)' } : null),
    ...(disabled ? { opacity: 0.5, cursor: 'not-allowed', transform: 'none' } : null),
    ...style,
  };
  const glyph = size === 'sm' ? 15 : 16;
  return (
    <Tag
      href={Tag === 'a' ? href : undefined}
      disabled={Tag === 'button' ? disabled : undefined}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={s}
      {...rest}
    >
      {icon ? <Icon name={icon} size={glyph} /> : null}
      {iconOnly ? null : children}
      {iconAfter ? <Icon name={iconAfter} size={glyph} /> : null}
    </Tag>
  );
}
