import React from 'react';

export function AnswerBubble({ children, state = 'default', size = 'md', onClick, style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const dim = size === 'lg' ? 64 : 32;
  let s = {
    width: dim, height: dim, borderRadius: '50%',
    border: (size === 'lg' ? '3px' : '2px') + ' solid var(--border-color)',
    background: 'var(--bg-surface)', color: 'var(--text-secondary)',
    fontSize: size === 'lg' ? '1.5rem' : '0.75rem', fontWeight: 700,
    fontFamily: 'var(--font-sans)', cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: 0,
    transition: 'all var(--transition-fast)',
  };
  if (state === 'selected') s = { ...s, background: 'var(--color-primary)', borderColor: 'var(--color-primary)', color: '#fff', boxShadow: '0 2px 8px var(--color-primary-glow)' };
  else if (state === 'correct') s = { ...s, background: 'var(--color-success)', borderColor: 'var(--color-success)', color: '#fff', boxShadow: '0 2px 8px rgba(16,185,129,0.3)' };
  else if (state === 'wrong') s = { ...s, background: 'var(--color-danger)', borderColor: 'var(--color-danger)', color: '#fff', boxShadow: '0 2px 8px rgba(239,68,68,0.3)' };
  else if (state === 'expected') s = { ...s, background: 'var(--color-success-bg)', borderColor: 'var(--color-success)', borderStyle: 'dashed', color: 'var(--color-success)' };
  else if (hover) s = { ...s, borderColor: 'var(--color-primary)', color: 'var(--color-primary)', background: 'var(--color-primary-subtle)', transform: 'scale(1.1)' };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...s, ...style }}
      {...rest}
    >{children}</button>
  );
}
