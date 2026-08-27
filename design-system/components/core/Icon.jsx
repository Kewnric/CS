import React from 'react';

/* Lucide glyph. The source app loads lucide@0.408.0 from unpkg and calls
   lucide.createIcons() after every render pass; this wraps that for React. */
export function Icon({ name, size = 16, color, strokeWidth, className = '', style = {} }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const host = ref.current;
    if (!host || !window.lucide) return;
    host.innerHTML = '';
    const i = document.createElement('i');
    i.setAttribute('data-lucide', name);
    host.appendChild(i);
    const attrs = { width: size, height: size };
    if (strokeWidth) attrs['stroke-width'] = strokeWidth;
    window.lucide.createIcons({ nameAttr: 'data-lucide', attrs });
  }, [name, size, strokeWidth]);
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, color, flexShrink: 0, ...style }}
    />
  );
}
