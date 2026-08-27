import React from 'react';

const tiers = {
  S: { background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#1a1a1a', boxShadow: '0 0 8px rgba(255,215,0,0.4)' },
  A: { background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#FFFFFF', boxShadow: '0 0 8px rgba(239,68,68,0.3)' },
  B: { background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#1a1a1a', boxShadow: '0 0 8px rgba(249,115,22,0.3)' },
  C: { background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: '#FFFFFF', boxShadow: '0 0 8px rgba(59,130,246,0.3)' },
  D: { background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', color: '#FFFFFF', boxShadow: '0 0 8px rgba(139,92,246,0.3)' },
  E: { background: 'linear-gradient(135deg, #94A3B8, #64748B)', color: '#1a1a1a' },
};

export function TierBadge({ tier = 'C', label, style = {}, ...rest }) {
  const key = String(tier).toUpperCase();
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '0.125rem 0.5rem', fontSize: '0.6rem', fontWeight: 800,
      borderRadius: 'var(--radius-full)', letterSpacing: '0.08em',
      textTransform: 'uppercase', flexShrink: 0, lineHeight: 1.4, whiteSpace: 'nowrap',
      transition: 'all var(--transition-fast)', ...(tiers[key] || tiers.C), ...style,
    }} {...rest}>{label || key}</span>
  );
}
