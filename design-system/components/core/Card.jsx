import React from 'react';

const tint = 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(6,182,212,0.04) 50%, transparent 100%)';
const tintHover = 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(6,182,212,0.08) 50%, rgba(16,185,129,0.04) 100%)';

export function Card({ children, variant = 'default', interactive, onClick, style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const clickable = interactive === undefined ? variant === 'default' : interactive;
  const lift = hover && clickable;

  let s = {
    borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)',
    position: 'relative', overflow: 'hidden',
    transition: 'all var(--transition-base)',
    cursor: clickable ? 'pointer' : 'default',
  };

  if (variant === 'default') {
    s = { ...s,
      background: (lift ? tintHover : tint) + ', var(--bg-surface' + (lift ? '-hover' : '') + ')',
      border: '1px solid ' + (lift ? 'rgba(99,102,241,0.3)' : 'var(--border-color)'),
      boxShadow: lift
        ? 'inset 0 1px 1px rgba(255,255,255,0.08), 0 10px 20px rgba(99,102,241,0.1)'
        : 'var(--shadow-inset-hairline), var(--shadow-sm)',
      transform: lift ? 'translateY(-3px)' : 'none',
    };
  } else if (variant === 'glass') {
    s = { ...s,
      background: 'var(--glass-bg)', backdropFilter: 'blur(var(--glass-blur))',
      WebkitBackdropFilter: 'blur(var(--glass-blur))',
      border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-md)',
    };
  } else {
    s = { ...s, background: 'var(--bg-surface)', border: '1px solid var(--border-color)' };
  }

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...s, ...style }}
      {...rest}
    >
      {variant === 'default' ? (
        <span style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))',
          opacity: lift ? 1 : 0, transition: 'opacity var(--transition-base)',
          pointerEvents: 'none',
        }} />
      ) : null}
      {children}
    </div>
  );
}
