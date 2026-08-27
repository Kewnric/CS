/* @ds-bundle: {"format":4,"namespace":"StudySessionProDesignSystem_f5d02b","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Divider","sourcePath":"components/core/Divider.jsx"},{"name":"EmptyState","sourcePath":"components/core/EmptyState.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"ScoreBadge","sourcePath":"components/core/ScoreBadge.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"TierBadge","sourcePath":"components/core/TierBadge.jsx"},{"name":"DataTable","sourcePath":"components/data/DataTable.jsx"},{"name":"Heatmap","sourcePath":"components/data/Heatmap.jsx"},{"name":"PanelCard","sourcePath":"components/data/PanelCard.jsx"},{"name":"QuickActionCard","sourcePath":"components/data/QuickActionCard.jsx"},{"name":"StatCard","sourcePath":"components/data/StatCard.jsx"},{"name":"Modal","sourcePath":"components/feedback/Modal.jsx"},{"name":"ProgressRing","sourcePath":"components/feedback/ProgressRing.jsx"},{"name":"Skeleton","sourcePath":"components/feedback/Skeleton.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"AnswerBubble","sourcePath":"components/forms/AnswerBubble.jsx"},{"name":"FormLabel","sourcePath":"components/forms/FormLabel.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"SearchInput","sourcePath":"components/forms/SearchInput.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"Breadcrumb","sourcePath":"components/navigation/Breadcrumb.jsx"},{"name":"FileTab","sourcePath":"components/navigation/FileTab.jsx"},{"name":"Pagination","sourcePath":"components/navigation/Pagination.jsx"},{"name":"SidebarLink","sourcePath":"components/navigation/SidebarLink.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"TreeNode","sourcePath":"components/navigation/TreeNode.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"df129728707c","components/core/Button.jsx":"3f979c77f10d","components/core/Card.jsx":"d747af3a5f6a","components/core/Divider.jsx":"d1fa72e9b578","components/core/EmptyState.jsx":"7aee92f82f66","components/core/Icon.jsx":"2a3b1394fc40","components/core/ScoreBadge.jsx":"42df3d96455d","components/core/Tag.jsx":"90b4795aad54","components/core/TierBadge.jsx":"b14a02b1d7bc","components/data/DataTable.jsx":"b82cbf907722","components/data/Heatmap.jsx":"2c3fa3a774ac","components/data/PanelCard.jsx":"d12567f0f883","components/data/QuickActionCard.jsx":"8998624df28e","components/data/StatCard.jsx":"bd60d0cf4537","components/feedback/Modal.jsx":"3f8c38dbb717","components/feedback/ProgressRing.jsx":"2fef80273708","components/feedback/Skeleton.jsx":"aeba7e7a0bb7","components/feedback/Toast.jsx":"2b1d6f127d89","components/forms/AnswerBubble.jsx":"ca7c181e5b2b","components/forms/FormLabel.jsx":"a9a47f484cd1","components/forms/Input.jsx":"0b1cf90914cc","components/forms/SearchInput.jsx":"1fc3a295a0a1","components/forms/Select.jsx":"744a458a530b","components/forms/Textarea.jsx":"c7d665f76db0","components/navigation/Breadcrumb.jsx":"f64c8aca3c54","components/navigation/FileTab.jsx":"a8585196c357","components/navigation/Pagination.jsx":"43c61e704416","components/navigation/SidebarLink.jsx":"f42ccb07c8ce","components/navigation/Tabs.jsx":"427418ace934","components/navigation/TreeNode.jsx":"d61673d0d0c4","ui_kits/studysession/AnalyticsScreen.jsx":"2ac2be860915","ui_kits/studysession/AppShell.jsx":"dde8d49c185b","ui_kits/studysession/HomeScreen.jsx":"c15af799a397","ui_kits/studysession/LibraryScreen.jsx":"dc65982d33fe","ui_kits/studysession/PracticeScreen.jsx":"148b03a9f394","ui_kits/studysession/QuestBoardScreen.jsx":"b578ef3e95a9","ui_kits/studysession/SettingsSheet.jsx":"fc5451806145","ui_kits/studysession/StorageModePicker.jsx":"52d130d8bc8b"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.StudySessionProDesignSystem_f5d02b = window.StudySessionProDesignSystem_f5d02b || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const tones = {
  primary: {
    background: 'var(--color-primary-subtle)',
    color: 'var(--color-primary)',
    border: '1px solid rgba(99,102,241,0.2)'
  },
  success: {
    background: 'var(--color-success-bg)',
    color: 'var(--color-success)',
    border: '1px solid rgba(16,185,129,0.2)'
  },
  warning: {
    background: 'var(--color-warning-bg)',
    color: 'var(--color-warning)',
    border: '1px solid rgba(245,158,11,0.2)'
  },
  danger: {
    background: 'var(--color-danger-bg)',
    color: 'var(--color-danger)',
    border: '1px solid rgba(239,68,68,0.2)'
  },
  neutral: {
    background: 'var(--bg-surface-hover)',
    color: 'var(--text-tertiary)',
    border: '1px solid transparent'
  }
};
function Badge({
  children,
  tone = 'primary',
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.1875rem 0.625rem',
      fontSize: '0.6875rem',
      fontWeight: 700,
      borderRadius: 'var(--radius-full)',
      letterSpacing: '0.02em',
      whiteSpace: 'nowrap',
      ...tones[tone],
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const tint = 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(6,182,212,0.04) 50%, transparent 100%)';
const tintHover = 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(6,182,212,0.08) 50%, rgba(16,185,129,0.04) 100%)';
function Card({
  children,
  variant = 'default',
  interactive,
  onClick,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const clickable = interactive === undefined ? variant === 'default' : interactive;
  const lift = hover && clickable;
  let s = {
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-lg)',
    position: 'relative',
    overflow: 'hidden',
    transition: 'all var(--transition-base)',
    cursor: clickable ? 'pointer' : 'default'
  };
  if (variant === 'default') {
    s = {
      ...s,
      background: (lift ? tintHover : tint) + ', var(--bg-surface' + (lift ? '-hover' : '') + ')',
      border: '1px solid ' + (lift ? 'rgba(99,102,241,0.3)' : 'var(--border-color)'),
      boxShadow: lift ? 'inset 0 1px 1px rgba(255,255,255,0.08), 0 10px 20px rgba(99,102,241,0.1)' : 'var(--shadow-inset-hairline), var(--shadow-sm)',
      transform: lift ? 'translateY(-3px)' : 'none'
    };
  } else if (variant === 'glass') {
    s = {
      ...s,
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(var(--glass-blur))',
      WebkitBackdropFilter: 'blur(var(--glass-blur))',
      border: '1px solid var(--glass-border)',
      boxShadow: 'var(--shadow-md)'
    };
  } else {
    s = {
      ...s,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-color)'
    };
  }
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      ...s,
      ...style
    }
  }, rest), variant === 'default' ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))',
      opacity: lift ? 1 : 0,
      transition: 'opacity var(--transition-base)',
      pointerEvents: 'none'
    }
  }) : null, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Divider.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Divider({
  orientation = 'horizontal',
  style = {},
  ...rest
}) {
  const s = orientation === 'vertical' ? {
    width: 1,
    height: '1.5rem',
    background: 'var(--border-color)',
    margin: '0 var(--space-sm)'
  } : {
    width: '100%',
    height: 1,
    background: 'var(--border-color)',
    margin: 'var(--space-md) 0'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "separator",
    style: {
      ...s,
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Divider });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Divider.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
/* Lucide glyph. The source app loads lucide@0.408.0 from unpkg and calls
   lucide.createIcons() after every render pass; this wraps that for React. */
function Icon({
  name,
  size = 16,
  color,
  strokeWidth,
  className = '',
  style = {}
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const host = ref.current;
    if (!host || !window.lucide) return;
    host.innerHTML = '';
    const i = document.createElement('i');
    i.setAttribute('data-lucide', name);
    host.appendChild(i);
    const attrs = {
      width: size,
      height: size
    };
    if (strokeWidth) attrs['stroke-width'] = strokeWidth;
    window.lucide.createIcons({
      nameAttr: 'data-lucide',
      attrs
    });
  }, [name, size, strokeWidth]);
  return /*#__PURE__*/React.createElement("span", {
    ref: ref,
    "aria-hidden": "true",
    className: className,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      color,
      flexShrink: 0,
      ...style
    }
  });
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const base = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  padding: '0.625rem 1.25rem',
  fontFamily: 'var(--font-sans)',
  fontSize: '0.875rem',
  fontWeight: 600,
  lineHeight: 1.25,
  border: 'none',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  transition: 'all var(--transition-fast)',
  whiteSpace: 'nowrap',
  textDecoration: 'none',
  position: 'relative',
  overflow: 'hidden'
};
const variants = {
  primary: {
    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
    color: 'var(--text-on-primary)',
    boxShadow: '0 2px 8px var(--color-primary-glow)'
  },
  secondary: {
    background: 'var(--bg-surface-hover)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)'
  },
  danger: {
    background: 'linear-gradient(135deg, var(--color-danger) 0%, var(--color-danger-hover) 100%)',
    color: '#fff'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    padding: '0.5rem'
  },
  practice: {
    background: 'var(--bg-surface-hover)',
    color: 'var(--color-primary)',
    border: '1px solid var(--border-color)',
    width: '100%'
  }
};
const hovers = {
  primary: {
    background: 'linear-gradient(135deg, var(--color-primary-hover) 0%, var(--color-primary) 100%)',
    boxShadow: '0 4px 16px var(--color-primary-glow)',
    transform: 'translateY(-1px)'
  },
  secondary: {
    background: 'var(--border-color)',
    borderColor: 'var(--text-tertiary)'
  },
  danger: {
    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
    transform: 'translateY(-1px)'
  },
  ghost: {
    background: 'var(--bg-surface-hover)',
    color: 'var(--text-primary)'
  },
  practice: {
    background: 'var(--color-primary-subtle)',
    borderColor: 'var(--color-primary)',
    boxShadow: '0 2px 8px var(--color-primary-glow)'
  }
};
function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconAfter,
  iconOnly = false,
  disabled = false,
  as = 'button',
  href,
  onClick,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const Tag = as === 'a' ? 'a' : 'button';
  const sizeStyle = size === 'sm' ? {
    padding: '0.375rem 0.75rem',
    fontSize: '0.8125rem'
  } : null;
  const iconStyle = iconOnly ? {
    padding: '0.5rem'
  } : null;
  const s = {
    ...base,
    ...variants[variant],
    ...sizeStyle,
    ...iconStyle,
    ...(hover && !disabled ? hovers[variant] : null),
    ...(press && !disabled ? {
      transform: 'scale(0.97)'
    } : null),
    ...(disabled ? {
      opacity: 0.5,
      cursor: 'not-allowed',
      transform: 'none'
    } : null),
    ...style
  };
  const glyph = size === 'sm' ? 15 : 16;
  return /*#__PURE__*/React.createElement(Tag, _extends({
    href: Tag === 'a' ? href : undefined,
    disabled: Tag === 'button' ? disabled : undefined,
    onClick: disabled ? undefined : onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    style: s
  }, rest), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: glyph
  }) : null, iconOnly ? null : children, iconAfter ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconAfter,
    size: glyph
  }) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/EmptyState.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      padding: 'var(--space-2xl)',
      color: 'var(--text-tertiary)',
      textAlign: 'center',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 64,
      height: 64,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(255,255,255,0.03)',
      opacity: 0.5,
      animation: 'float 6s ease-in-out infinite'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 28
  })), title ? /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: '1.125rem',
      color: 'var(--text-secondary)',
      margin: 0
    }
  }, title) : null, description ? /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: '0.95rem',
      opacity: 0.8,
      margin: 0
    }
  }, description) : null, action);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/core/ScoreBadge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function ScoreBadge({
  children,
  perfect = false,
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      padding: '0.25rem 0.625rem',
      borderRadius: 'var(--radius-sm)',
      fontSize: '0.75rem',
      fontWeight: 700,
      background: perfect ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
      color: perfect ? 'var(--color-success)' : 'var(--color-warning)',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { ScoreBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ScoreBadge.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Tag({
  children,
  onRemove,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.25rem',
      padding: '0.25rem 0.5rem',
      fontSize: '0.75rem',
      fontWeight: 600,
      borderRadius: 'var(--radius-sm)',
      background: 'var(--color-primary-subtle)',
      color: 'var(--color-primary)',
      border: '1px solid rgba(99,102,241,0.15)',
      ...style
    }
  }, rest), children, onRemove ? /*#__PURE__*/React.createElement("button", {
    onClick: onRemove,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    "aria-label": "Remove",
    style: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: 0,
      display: 'flex',
      color: hover ? 'var(--color-danger)' : 'inherit',
      opacity: hover ? 1 : 0.6,
      transition: 'opacity var(--transition-fast)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 12
  })) : null);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/core/TierBadge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const tiers = {
  S: {
    background: 'linear-gradient(135deg, #FFD700, #FFA500)',
    color: '#1a1a1a',
    boxShadow: '0 0 8px rgba(255,215,0,0.4)'
  },
  A: {
    background: 'linear-gradient(135deg, #EF4444, #DC2626)',
    color: '#FFFFFF',
    boxShadow: '0 0 8px rgba(239,68,68,0.3)'
  },
  B: {
    background: 'linear-gradient(135deg, #F97316, #EA580C)',
    color: '#1a1a1a',
    boxShadow: '0 0 8px rgba(249,115,22,0.3)'
  },
  C: {
    background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
    color: '#FFFFFF',
    boxShadow: '0 0 8px rgba(59,130,246,0.3)'
  },
  D: {
    background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
    color: '#FFFFFF',
    boxShadow: '0 0 8px rgba(139,92,246,0.3)'
  },
  E: {
    background: 'linear-gradient(135deg, #94A3B8, #64748B)',
    color: '#1a1a1a'
  }
};
function TierBadge({
  tier = 'C',
  label,
  style = {},
  ...rest
}) {
  const key = String(tier).toUpperCase();
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0.125rem 0.5rem',
      fontSize: '0.6rem',
      fontWeight: 800,
      borderRadius: 'var(--radius-full)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      flexShrink: 0,
      lineHeight: 1.4,
      whiteSpace: 'nowrap',
      transition: 'all var(--transition-fast)',
      ...(tiers[key] || tiers.C),
      ...style
    }
  }, rest), label || key);
}
Object.assign(__ds_scope, { TierBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/TierBadge.jsx", error: String((e && e.message) || e) }); }

// components/data/DataTable.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function DataTable({
  columns = [],
  rows = [],
  onRowClick,
  style = {},
  ...rest
}) {
  const [hoverRow, setHoverRow] = React.useState(-1);
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      textAlign: 'left',
      borderCollapse: 'collapse'
    }
  }, /*#__PURE__*/React.createElement("thead", {
    style: {
      background: 'var(--bg-surface-hover)',
      borderBottom: '1px solid var(--border-color)'
    }
  }, /*#__PURE__*/React.createElement("tr", null, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key || c.label,
    style: {
      padding: '0.875rem 1rem',
      fontSize: '0.8125rem',
      fontWeight: 600,
      color: 'var(--text-tertiary)',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      textAlign: c.align || 'left'
    }
  }, c.label)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((r, ri) => /*#__PURE__*/React.createElement("tr", {
    key: ri,
    onClick: () => onRowClick && onRowClick(r, ri),
    onMouseEnter: () => setHoverRow(ri),
    onMouseLeave: () => setHoverRow(-1),
    style: {
      background: hoverRow === ri ? 'var(--bg-surface-hover)' : 'transparent',
      transition: 'background-color var(--transition-fast)',
      cursor: onRowClick ? 'pointer' : 'default'
    }
  }, columns.map((c, ci) => /*#__PURE__*/React.createElement("td", {
    key: c.key || ci,
    style: {
      padding: '0.875rem 1rem',
      fontSize: '0.875rem',
      borderBottom: ri === rows.length - 1 ? 'none' : '1px solid var(--border-color-subtle)',
      verticalAlign: 'middle',
      textAlign: c.align || 'left'
    }
  }, c.render ? c.render(r) : r[c.key])))))));
}
Object.assign(__ds_scope, { DataTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/DataTable.jsx", error: String((e && e.message) || e) }); }

// components/data/Heatmap.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const levelStyle = [{
  background: 'var(--bg-surface-hover)',
  borderColor: 'rgba(255,255,255,0.02)'
}, {
  background: 'rgba(99,102,241,0.2)',
  borderColor: 'rgba(99,102,241,0.3)'
}, {
  background: 'rgba(99,102,241,0.5)',
  borderColor: 'rgba(99,102,241,0.6)'
}, {
  background: 'rgba(99,102,241,0.8)',
  borderColor: 'rgba(99,102,241,0.9)'
}, {
  background: 'var(--color-primary)',
  borderColor: 'var(--color-primary-hover)',
  boxShadow: '0 0 8px var(--color-primary-glow)'
}];
function Heatmap({
  weeks = 26,
  data,
  cell = 14,
  gap = 4,
  style = {},
  ...rest
}) {
  const levels = data || Array.from({
    length: weeks * 7
  }, (_, i) => i * 7919 % 11 > 7 ? i % 5 : i % 3 === 0 ? 1 : 0);
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      overflowX: 'auto',
      scrollbarWidth: 'none',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateRows: 'repeat(7, 1fr)',
      gridAutoFlow: 'column',
      gap,
      width: 'fit-content'
    }
  }, levels.map((lv, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    title: 'Level ' + lv,
    style: {
      width: cell,
      height: cell,
      borderRadius: 4,
      borderWidth: 1,
      borderStyle: 'solid',
      transition: 'all 0.2s var(--ease-spring)',
      ...levelStyle[Math.min(lv, 4)]
    }
  }))));
}
Object.assign(__ds_scope, { Heatmap });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Heatmap.jsx", error: String((e && e.message) || e) }); }

// components/data/PanelCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function PanelCard({
  icon,
  title,
  action,
  children,
  variant = 'surface',
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const glass = variant === 'glass';
  return /*#__PURE__*/React.createElement("section", _extends({
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      background: glass ? 'rgba(19,28,49,0.4)' : 'var(--bg-surface)',
      backdropFilter: glass ? 'blur(16px)' : undefined,
      WebkitBackdropFilter: glass ? 'blur(16px)' : undefined,
      border: '1px solid ' + (glass ? hover ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)' : hover ? 'rgba(99,102,241,0.15)' : 'var(--border-color)'),
      borderRadius: 'var(--radius-xl)',
      padding: glass ? '1.75rem' : '1.25rem 1.5rem',
      boxShadow: glass ? hover ? '0 12px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)' : '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)' : hover ? '0 4px 20px rgba(99,102,241,0.04)' : 'none',
      transform: glass && hover ? 'translateY(-2px)' : 'none',
      transition: 'all 0.25s ease',
      overflow: 'hidden',
      ...style
    }
  }, rest), title ? /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      marginBottom: '0.875rem',
      fontSize: '0.6875rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--text-tertiary)'
    }
  }, icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 14
  }) : null, /*#__PURE__*/React.createElement("span", null, title), action ? /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto'
    }
  }, action) : null) : null, children);
}
Object.assign(__ds_scope, { PanelCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/PanelCard.jsx", error: String((e && e.message) || e) }); }

// components/data/QuickActionCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const washes = [{
  bg: 'rgba(99,102,241,0.12)',
  fg: '#6366f1'
}, {
  bg: 'rgba(6,182,212,0.12)',
  fg: '#06b6d4'
}, {
  bg: 'rgba(245,158,11,0.12)',
  fg: '#f59e0b'
}, {
  bg: 'rgba(16,185,129,0.12)',
  fg: '#10b981'
}];
function QuickActionCard({
  icon,
  label,
  description,
  index = 0,
  href = '#',
  onClick,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const w = washes[index % washes.length];
  return /*#__PURE__*/React.createElement("a", _extends({
    href: href,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.875rem 1rem',
      background: 'var(--bg-surface-hover)',
      border: '1px solid ' + (hover ? 'var(--color-primary)' : 'var(--border-color)'),
      borderRadius: 'var(--radius-lg)',
      cursor: 'pointer',
      textDecoration: 'none',
      color: 'var(--text-primary)',
      transition: 'all 0.25s var(--ease-spring)',
      transform: hover ? 'translateY(-3px) scale(1.01)' : 'none',
      boxShadow: hover ? '0 6px 20px var(--color-primary-glow)' : 'none',
      position: 'relative',
      overflow: 'hidden',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 'var(--radius-md)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      background: w.bg,
      color: w.fg
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 18,
    style: {
      transform: hover ? 'scale(1.15)' : 'none',
      transition: 'transform 0.2s var(--ease-spring)'
    }
  })), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontWeight: 700,
      fontSize: '0.8125rem'
    }
  }, label), description ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: '0.6875rem',
      color: 'var(--text-tertiary)',
      marginTop: 1
    }
  }, description) : null));
}
Object.assign(__ds_scope, { QuickActionCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/QuickActionCard.jsx", error: String((e && e.message) || e) }); }

// components/data/StatCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const accents = {
  indigo: {
    color: '#6366f1',
    bar: 'linear-gradient(90deg,#6366f1,#818cf8)',
    wash: 'rgba(99,102,241,0.12)'
  },
  green: {
    color: '#10b981',
    bar: 'linear-gradient(90deg,#10b981,#34d399)',
    wash: 'rgba(16,185,129,0.12)'
  },
  amber: {
    color: '#f59e0b',
    bar: 'linear-gradient(90deg,#f59e0b,#fbbf24)',
    wash: 'rgba(245,158,11,0.12)'
  },
  cyan: {
    color: '#06b6d4',
    bar: 'linear-gradient(90deg,#06b6d4,#22d3ee)',
    wash: 'rgba(6,182,212,0.12)'
  }
};
function StatCard({
  icon,
  value,
  label,
  accent = 'indigo',
  atRisk = false,
  onClick,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const a = accents[accent] || accents.indigo;
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(var(--glass-blur))',
      WebkitBackdropFilter: 'blur(var(--glass-blur))',
      border: '1px solid ' + (atRisk ? 'var(--color-warning)' : hover ? 'var(--color-primary)' : 'var(--glass-border)'),
      borderRadius: 'var(--radius-lg)',
      padding: '1.25rem 1rem',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.3s var(--ease-spring)',
      transform: hover ? 'translateY(-4px)' : 'none',
      boxShadow: hover ? 'var(--shadow-lg)' : 'none',
      cursor: onClick ? 'pointer' : 'default',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      borderRadius: '3px 3px 0 0',
      background: a.bar
    }
  }), icon ? /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      margin: '0 auto 0.625rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 'var(--radius-md)',
      color: a.color,
      background: a.wash
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 18,
    style: {
      transform: hover ? 'scale(1.15) rotate(-5deg)' : 'none',
      transition: 'transform 0.3s var(--ease-spring)'
    }
  })) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '1.75rem',
      fontWeight: 800,
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-primary)',
      marginBottom: '0.125rem',
      lineHeight: 1
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.6875rem',
      fontWeight: atRisk ? 800 : 600,
      color: atRisk ? 'var(--color-warning)' : 'var(--text-tertiary)',
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    }
  }, label));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Modal.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Modal({
  open = true,
  title,
  description,
  icon,
  iconColor = 'var(--color-primary)',
  size = 'md',
  actions,
  children,
  onDismiss,
  style = {},
  ...rest
}) {
  if (!open) return null;
  const widths = {
    md: 420,
    lg: 520,
    wide: 900,
    search: 640
  };
  return /*#__PURE__*/React.createElement("div", {
    onClick: e => {
      if (e.target === e.currentTarget && onDismiss) onDismiss();
    },
    style: {
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-lg)',
      zIndex: 1000
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      animation: 'fadeIn 0.28s ease-out both'
    }
  }), /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: 'relative',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-xl)',
      maxWidth: widths[size] || widths.md,
      width: '100%',
      padding: 'var(--space-xl)',
      textAlign: 'center',
      animation: 'modalRise 0.34s var(--ease-expo-out) both',
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 'var(--space-md)',
      display: 'flex',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 48,
    color: iconColor
  })) : null, title ? /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: '1.5rem',
      fontWeight: 800,
      marginBottom: '0.375rem'
    }
  }, title) : null, description ? /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.9rem',
      marginBottom: 'var(--space-xl)',
      lineHeight: 1.5
    }
  }, description) : null, children, actions ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-md)',
      marginTop: children ? 'var(--space-lg)' : 0
    }
  }, actions) : null));
}
Object.assign(__ds_scope, { Modal });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Modal.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ProgressRing.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function ProgressRing({
  value = 0,
  size = 48,
  stroke = 4,
  color = 'var(--color-primary)',
  showLabel = true,
  style = {},
  ...rest
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: 'relative',
      width: size,
      height: size,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    style: {
      transform: 'rotate(-90deg)'
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: "rgba(255,255,255,0.1)",
    strokeWidth: stroke
  }), /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeDasharray: c,
    strokeDashoffset: c * (1 - pct / 100),
    style: {
      transition: 'stroke-dashoffset 1s var(--ease-spring)'
    }
  })), showLabel ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.26,
      fontWeight: 800,
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-primary)'
    }
  }, Math.round(pct)) : null);
}
Object.assign(__ds_scope, { ProgressRing });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ProgressRing.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Skeleton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Skeleton({
  variant = 'line',
  width = '100%',
  height,
  style = {},
  ...rest
}) {
  const h = height ?? (variant === 'block' ? 96 : variant === 'text' ? '0.8em' : 14);
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: 'relative',
      overflow: 'hidden',
      width,
      height: h,
      background: 'var(--bg-surface-hover)',
      borderRadius: 'var(--radius-md)',
      margin: variant === 'text' ? '0.4em 0' : variant === 'line' ? '10px 0' : 0,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      content: '""',
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
      animation: 'shimmer 1.4s infinite'
    }
  }));
}
Object.assign(__ds_scope, { Skeleton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Skeleton.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const tones = {
  info: {
    color: 'var(--color-accent)',
    icon: 'info'
  },
  success: {
    color: 'var(--color-success)',
    icon: 'check-circle-2'
  },
  error: {
    color: 'var(--color-danger)',
    icon: 'alert-circle'
  },
  warning: {
    color: 'var(--color-warning)',
    icon: 'alert-triangle'
  }
};
function Toast({
  tone = 'info',
  title,
  children,
  onClose,
  style = {},
  ...rest
}) {
  const t = tones[tone] || tones.info;
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "status",
    style: {
      pointerEvents: 'auto',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.65rem',
      padding: '0.85rem 1rem',
      borderRadius: 'var(--radius-md)',
      background: 'var(--bg-elevated)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-color)',
      borderLeft: '3px solid ' + t.color,
      boxShadow: 'var(--shadow-lg)',
      fontSize: '0.875rem',
      lineHeight: 1.4,
      maxWidth: 380,
      position: 'relative',
      overflow: 'hidden',
      animation: 'smoothReveal 0.32s var(--ease-expo-out) both',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      marginTop: 1,
      color: t.color,
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: t.icon,
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, title ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      marginBottom: '0.1rem'
    }
  }, title) : null, children), onClose ? /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Dismiss",
    style: {
      flexShrink: 0,
      background: 'none',
      border: 'none',
      color: 'var(--text-tertiary)',
      cursor: 'pointer',
      padding: 2,
      lineHeight: 0,
      borderRadius: 4
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 14
  })) : null);
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/forms/AnswerBubble.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function AnswerBubble({
  children,
  state = 'default',
  size = 'md',
  onClick,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const dim = size === 'lg' ? 64 : 32;
  let s = {
    width: dim,
    height: dim,
    borderRadius: '50%',
    border: (size === 'lg' ? '3px' : '2px') + ' solid var(--border-color)',
    background: 'var(--bg-surface)',
    color: 'var(--text-secondary)',
    fontSize: size === 'lg' ? '1.5rem' : '0.75rem',
    fontWeight: 700,
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    transition: 'all var(--transition-fast)'
  };
  if (state === 'selected') s = {
    ...s,
    background: 'var(--color-primary)',
    borderColor: 'var(--color-primary)',
    color: '#fff',
    boxShadow: '0 2px 8px var(--color-primary-glow)'
  };else if (state === 'correct') s = {
    ...s,
    background: 'var(--color-success)',
    borderColor: 'var(--color-success)',
    color: '#fff',
    boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
  };else if (state === 'wrong') s = {
    ...s,
    background: 'var(--color-danger)',
    borderColor: 'var(--color-danger)',
    color: '#fff',
    boxShadow: '0 2px 8px rgba(239,68,68,0.3)'
  };else if (state === 'expected') s = {
    ...s,
    background: 'var(--color-success-bg)',
    borderColor: 'var(--color-success)',
    borderStyle: 'dashed',
    color: 'var(--color-success)'
  };else if (hover) s = {
    ...s,
    borderColor: 'var(--color-primary)',
    color: 'var(--color-primary)',
    background: 'var(--color-primary-subtle)',
    transform: 'scale(1.1)'
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      ...s,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { AnswerBubble });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/AnswerBubble.jsx", error: String((e && e.message) || e) }); }

// components/forms/FormLabel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function FormLabel({
  children,
  aside,
  htmlFor,
  style = {},
  ...rest
}) {
  const s = {
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '0.375rem',
    ...(aside ? {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    } : {
      display: 'block'
    }),
    ...style
  };
  return /*#__PURE__*/React.createElement("label", _extends({
    htmlFor: htmlFor,
    style: s
  }, rest), children, aside ? /*#__PURE__*/React.createElement("span", null, aside) : null);
}
Object.assign(__ds_scope, { FormLabel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/FormLabel.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const base = {
  width: '100%',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  padding: '0.625rem 0.75rem',
  fontFamily: 'var(--font-sans)',
  fontSize: '0.875rem',
  color: 'var(--text-primary)',
  outline: 'none',
  transition: 'border-color var(--transition-fast)'
};
function Input({
  mono = false,
  align,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("input", _extends({
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      ...base,
      ...(mono ? {
        fontFamily: 'var(--font-mono)'
      } : null),
      ...(align ? {
        textAlign: align
      } : null),
      ...(focus ? {
        borderColor: 'var(--color-primary)'
      } : null),
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/SearchInput.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function SearchInput({
  width = 320,
  placeholder = 'Search…',
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: '1rem',
      top: '50%',
      transform: 'translateY(-50%)',
      color: 'var(--text-tertiary)',
      pointerEvents: 'none',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "search",
    size: 18
  })), /*#__PURE__*/React.createElement("input", _extends({
    placeholder: placeholder,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      width: '100%',
      background: 'var(--bg-surface-hover)',
      border: '1px solid ' + (focus ? 'var(--color-primary)' : 'var(--border-color)'),
      borderRadius: 'var(--radius-full)',
      padding: '0.625rem 1rem 0.625rem 2.5rem',
      fontFamily: 'var(--font-sans)',
      fontSize: '0.9rem',
      color: 'var(--text-primary)',
      outline: 'none',
      transition: 'all var(--transition-fast)',
      boxShadow: focus ? '0 0 0 3px var(--color-primary-glow)' : 'none'
    }
  }, rest)));
}
Object.assign(__ds_scope, { SearchInput });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SearchInput.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Select({
  children,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("select", _extends({
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      width: '100%',
      background: 'var(--bg-surface)',
      border: '1px solid ' + (focus ? 'var(--color-primary)' : 'var(--border-color)'),
      borderRadius: 'var(--radius-md)',
      padding: '0.625rem 0.75rem',
      fontFamily: 'var(--font-sans)',
      fontSize: '0.875rem',
      color: 'var(--text-primary)',
      outline: 'none',
      cursor: 'pointer',
      transition: 'border-color var(--transition-fast)',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Textarea({
  mono = false,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("textarea", _extends({
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      width: '100%',
      background: 'var(--bg-surface)',
      border: '1px solid ' + (focus ? 'var(--color-primary)' : 'var(--border-color)'),
      borderRadius: 'var(--radius-md)',
      padding: '0.625rem 0.75rem',
      fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
      fontSize: mono ? '0.8125rem' : '0.875rem',
      lineHeight: mono ? 1.6 : 'inherit',
      color: 'var(--text-primary)',
      outline: 'none',
      resize: 'vertical',
      minHeight: mono ? 80 : 60,
      transition: 'border-color var(--transition-fast)',
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Breadcrumb.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Breadcrumb({
  items = [],
  onNavigate,
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("nav", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.375rem',
      padding: '0.5rem 0',
      fontSize: '0.8125rem',
      color: 'var(--text-tertiary)',
      flexWrap: 'wrap',
      borderBottom: '1px solid var(--border-color)',
      ...style
    }
  }, rest), items.map((it, i) => {
    const last = i === items.length - 1;
    const label = typeof it === 'string' ? it : it.label;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: label + i
    }, last ? /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--text-primary)',
        fontWeight: 700,
        fontSize: '0.8125rem'
      }
    }, label) : /*#__PURE__*/React.createElement("button", {
      onClick: () => onNavigate && onNavigate(i),
      style: {
        cursor: 'pointer',
        color: 'var(--text-secondary)',
        fontWeight: 600,
        background: 'none',
        border: 'none',
        fontFamily: 'var(--font-sans)',
        fontSize: '0.8125rem',
        padding: '0.125rem 0.375rem',
        borderRadius: 'var(--radius-sm)',
        transition: 'color var(--transition-fast)'
      }
    }, label), last ? null : /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        color: 'var(--text-tertiary)'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "chevron-right",
      size: 12
    })));
  }));
}
Object.assign(__ds_scope, { Breadcrumb });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Breadcrumb.jsx", error: String((e && e.message) || e) }); }

// components/navigation/FileTab.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function FileTab({
  name,
  active = false,
  dirty = false,
  onClick,
  onClose,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.375rem',
      padding: '0 0.875rem',
      fontSize: '0.8125rem',
      fontFamily: 'var(--font-mono)',
      color: active ? 'var(--color-accent)' : hover ? 'var(--text-secondary)' : 'var(--text-tertiary)',
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      borderRight: '1px solid var(--border-color)',
      borderBottom: '2px solid ' + (active ? 'var(--color-accent)' : 'transparent'),
      background: active ? 'rgba(6,182,212,0.08)' : hover ? 'rgba(255,255,255,0.04)' : 'transparent',
      transition: 'color 0.15s, background 0.15s, border-color 0.15s',
      userSelect: 'none',
      minHeight: 38,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      pointerEvents: 'none'
    }
  }, name, dirty ? ' •' : ''), /*#__PURE__*/React.createElement("span", {
    onClick: e => {
      e.stopPropagation();
      onClose && onClose();
    },
    style: {
      fontSize: '0.7rem',
      lineHeight: 1,
      padding: '1px 2px',
      borderRadius: 3,
      color: 'var(--text-tertiary)',
      opacity: hover ? 1 : 0,
      cursor: 'pointer',
      transition: 'opacity 0.15s, background 0.15s'
    }
  }, "\u2715"));
}
Object.assign(__ds_scope, { FileTab });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/FileTab.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Pagination.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function PageBtn({
  children,
  active,
  disabled,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  const on = hover && !active && !disabled;
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    disabled: disabled,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '2rem',
      height: '2rem',
      padding: '0 0.5rem',
      borderRadius: 'var(--radius-md)',
      border: '1px solid ' + (active || on ? 'var(--color-primary)' : 'var(--border-color)'),
      background: active ? 'var(--color-primary)' : on ? 'var(--bg-surface-hover)' : 'transparent',
      color: active ? '#fff' : on ? 'var(--color-primary)' : 'var(--text-secondary)',
      fontSize: '0.8rem',
      fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.35 : 1,
      pointerEvents: active ? 'none' : 'auto',
      transition: 'all 0.18s ease'
    },
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false)
  }, children);
}
function Pagination({
  page = 1,
  pageCount = 1,
  onChange,
  style = {},
  ...rest
}) {
  const go = p => onChange && onChange(Math.min(Math.max(p, 1), pageCount));
  const pages = [];
  for (let i = 1; i <= pageCount; i++) {
    if (i === 1 || i === pageCount || Math.abs(i - page) <= 1) pages.push(i);else if (pages[pages.length - 1] !== '…') pages.push('…');
  }
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.375rem',
      marginTop: '1.25rem',
      padding: '0.5rem 0',
      userSelect: 'none',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(PageBtn, {
    disabled: page <= 1,
    onClick: () => go(page - 1)
  }, "\u2039"), pages.map((p, i) => p === '…' ? /*#__PURE__*/React.createElement("span", {
    key: 'e' + i,
    style: {
      color: 'var(--text-tertiary)',
      fontSize: '0.8rem',
      padding: '0 0.25rem'
    }
  }, "\u2026") : /*#__PURE__*/React.createElement(PageBtn, {
    key: p,
    active: p === page,
    onClick: () => go(p)
  }, p)), /*#__PURE__*/React.createElement(PageBtn, {
    disabled: page >= pageCount,
    onClick: () => go(page + 1)
  }, "\u203A"));
}
Object.assign(__ds_scope, { Pagination });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Pagination.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SidebarLink.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function SidebarLink({
  icon,
  label,
  active = false,
  expanded = true,
  href = '#',
  onClick,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("a", _extends({
    href: href,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    "aria-label": label,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '0 16px',
      height: 48,
      color: active ? '#22d3ee' : hover ? '#e2e8f0' : '#94a3b8',
      textDecoration: 'none',
      borderRadius: 'var(--radius-md)',
      whiteSpace: 'nowrap',
      fontFamily: 'var(--font-sans)',
      fontWeight: 600,
      fontSize: '0.95rem',
      transition: 'all 0.2s var(--ease-standard)',
      cursor: 'pointer',
      background: active ? 'var(--color-primary-subtle)' : hover ? 'rgba(148,163,184,0.15)' : 'transparent',
      border: 'none',
      textAlign: 'left',
      width: '100%',
      overflow: 'hidden',
      position: 'relative',
      transform: hover && !active ? 'translateX(3px)' : 'none',
      ...style
    }
  }, rest), active ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 0,
      top: '25%',
      bottom: '25%',
      width: 3,
      background: '#22d3ee',
      borderRadius: '0 3px 3px 0',
      boxShadow: '2px 0 8px rgba(34,211,238,0.4)'
    }
  }) : null, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 24,
    style: {
      transform: hover ? 'scale(1.12)' : 'none',
      transition: 'transform 0.2s var(--ease-spring)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: expanded ? 1 : 0,
      transition: 'opacity 0.2s ease'
    }
  }, label));
}
Object.assign(__ds_scope, { SidebarLink });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SidebarLink.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Tabs({
  items = [],
  value,
  onChange,
  variant = 'underline',
  style = {},
  ...rest
}) {
  const pill = variant === 'pill';
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "tablist",
    style: {
      display: 'flex',
      gap: pill ? '0.5rem' : '1rem',
      borderBottom: pill ? 'none' : '1px solid var(--border-color)',
      overflowX: 'auto',
      ...style
    }
  }, rest), items.map(it => {
    const key = it.value ?? it.label;
    const on = key === value;
    const s = pill ? {
      padding: '0.375rem 0.875rem',
      fontSize: '0.8125rem',
      fontWeight: 600,
      border: '1px solid ' + (on ? 'var(--color-primary)' : 'var(--border-color)'),
      borderRadius: 'var(--radius-full)',
      background: on ? 'var(--color-primary-subtle)' : 'transparent',
      color: on ? 'var(--color-primary)' : 'var(--text-secondary)'
    } : {
      padding: '0.75rem 1.5rem',
      border: 'none',
      borderBottom: '2px solid ' + (on ? 'var(--color-primary)' : 'transparent'),
      background: 'none',
      color: on ? 'var(--color-primary)' : 'var(--text-tertiary)',
      fontWeight: 600,
      fontSize: '0.95rem'
    };
    return /*#__PURE__*/React.createElement("button", {
      key: key,
      role: "tab",
      "aria-selected": on,
      onClick: () => onChange && onChange(key),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontFamily: 'var(--font-sans)',
        transition: 'all var(--transition-fast)',
        ...s
      }
    }, it.icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: it.icon,
      size: 16
    }) : null, it.label);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TreeNode.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const railColors = ['var(--color-primary)', 'var(--color-accent)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-danger)'];
function TreeNode({
  label,
  icon,
  kind = 'folder',
  level = 0,
  expanded = false,
  active = false,
  count,
  locked = false,
  onToggle,
  onClick,
  children,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const glyph = icon || (kind === 'folder' ? 'folder' : 'file-code-2');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.625rem 0.75rem',
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer',
      userSelect: 'none',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.2s var(--ease-standard)',
      background: active ? 'var(--bg-surface-hover)' : hover ? 'rgba(148,163,184,0.12)' : 'transparent',
      transform: hover && !active ? 'translateX(2px)' : 'none',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    onClick: e => {
      e.stopPropagation();
      onToggle && onToggle();
    },
    style: {
      width: 18,
      height: 18,
      minWidth: 18,
      color: 'var(--text-tertiary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      visibility: kind === 'folder' ? 'visible' : 'hidden',
      transform: expanded ? 'rotate(90deg)' : 'none',
      transition: 'transform 0.3s var(--ease-spring)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-right",
    size: 18
  })), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: glyph,
    size: 18,
    color: kind === 'folder' ? 'var(--color-accent)' : 'var(--text-tertiary)'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.95rem',
      fontWeight: 600,
      color: active ? 'var(--text-primary)' : 'var(--text-primary)',
      flex: 1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, label), locked ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "lock",
    size: 14,
    color: "var(--color-warning)"
  }) : null, count != null ? /*#__PURE__*/React.createElement("span", {
    style: {
      background: 'var(--bg-surface-hover)',
      padding: '0.125rem 0.375rem',
      borderRadius: '1rem',
      fontSize: '0.625rem',
      fontWeight: 700,
      color: 'var(--text-tertiary)',
      marginLeft: 'auto',
      flexShrink: 0
    }
  }, count) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: 0,
      top: 10 + level * 5 + '%',
      bottom: 10 + level * 5 + '%',
      width: 3,
      background: railColors[Math.min(level, 4)],
      borderRadius: '4px 0 0 4px',
      opacity: 0.8,
      boxShadow: '-2px 0 8px rgba(34,211,238,0.4)'
    }
  })), expanded && children ? /*#__PURE__*/React.createElement("div", {
    style: {
      borderLeft: '2px solid var(--border-color)',
      marginLeft: '1.125rem'
    }
  }, children) : null);
}
Object.assign(__ds_scope, { TreeNode });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TreeNode.jsx", error: String((e && e.message) || e) }); }

// ui_kits/studysession/AnalyticsScreen.jsx
try { (() => {
(function () {
  const {
    PanelCard,
    ProgressRing,
    Heatmap,
    DataTable,
    TierBadge,
    ScoreBadge,
    Badge,
    Icon,
    Tabs
  } = window.StudySessionProDesignSystem_f5d02b;
  const ROWS = [{
    name: 'Bubble Sort',
    tier: 'C',
    score: '18 / 18',
    perfect: true,
    when: '2h ago',
    time: '12:04'
  }, {
    name: 'Binary Search',
    tier: 'C',
    score: '15 / 18',
    perfect: false,
    when: 'Yesterday',
    time: '18:41'
  }, {
    name: 'Stack with Array',
    tier: 'D',
    score: '18 / 18',
    perfect: true,
    when: 'Yesterday',
    time: '09:22'
  }, {
    name: 'Linked List Reversal',
    tier: 'A',
    score: '11 / 18',
    perfect: false,
    when: '3 days ago',
    time: '31:07'
  }];
  function HeroTile({
    label,
    value,
    icon,
    tone
  }) {
    const [hover, setHover] = React.useState(false);
    return /*#__PURE__*/React.createElement("div", {
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      style: {
        background: hover ? 'rgba(99,102,241,0.05)' : 'rgba(0,0,0,0.2)',
        border: '1px solid ' + (hover ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.03)'),
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '1rem'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.7rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--text-tertiary)'
      }
    }, label), /*#__PURE__*/React.createElement(Icon, {
      name: icon,
      size: 16,
      color: hover ? 'var(--color-primary)' : 'var(--text-tertiary)'
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '2rem',
        fontWeight: 900,
        fontFamily: 'var(--font-mono)',
        lineHeight: 1,
        marginTop: 'auto',
        color: tone === 'success' ? 'var(--color-success)' : tone === 'primary' ? 'var(--color-primary-hover)' : 'var(--text-primary)',
        textShadow: tone === 'success' ? '0 0 12px rgba(16,185,129,0.3)' : tone === 'primary' ? '0 0 12px rgba(99,102,241,0.3)' : 'none'
      }
    }, value));
  }
  function Trend() {
    const pts = [12, 18, 9, 24, 31, 22, 38, 34, 41, 29, 46, 52];
    const w = 640,
      h = 150,
      max = 60;
    const step = w / (pts.length - 1);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + (i * step).toFixed(1) + ' ' + (h - p / max * h).toFixed(1)).join(' ');
    return /*#__PURE__*/React.createElement("svg", {
      viewBox: '0 0 ' + w + ' ' + h,
      style: {
        width: '100%',
        height: 'auto',
        display: 'block'
      }
    }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
      id: "tg",
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#6366f1",
      stopOpacity: "0.35"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#6366f1",
      stopOpacity: "0"
    }))), /*#__PURE__*/React.createElement("path", {
      d: d + ' L ' + w + ' ' + h + ' L 0 ' + h + ' Z',
      fill: "url(#tg)"
    }), /*#__PURE__*/React.createElement("path", {
      d: d,
      fill: "none",
      stroke: "#818cf8",
      strokeWidth: "2.5",
      strokeLinecap: "round",
      className: "ac-line",
      style: {
        strokeDasharray: 2000,
        strokeDashoffset: 0
      }
    }), pts.map((p, i) => /*#__PURE__*/React.createElement("circle", {
      key: i,
      cx: i * step,
      cy: h - p / max * h,
      r: "3",
      fill: "#0b1120",
      stroke: "#818cf8",
      strokeWidth: "2"
    })));
  }
  function Dist() {
    const bars = [['S', 2, '#FFD700'], ['A', 7, '#EF4444'], ['B', 14, '#F97316'], ['C', 31, '#3B82F6'], ['D', 22, '#8B5CF6'], ['E', 11, '#94A3B8']];
    const max = 31;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-around',
        gap: '0.5rem',
        height: 150
      }
    }, bars.map(([l, v, c]) => /*#__PURE__*/React.createElement("div", {
      key: l,
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.3rem',
        flex: 1,
        height: '100%',
        justifyContent: 'flex-end'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.875rem',
        fontWeight: 700
      }
    }, v), /*#__PURE__*/React.createElement("div", {
      style: {
        width: '60%',
        maxWidth: 42,
        flex: 1,
        display: 'flex',
        alignItems: 'flex-end'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: '100%',
        height: v / max * 100 + '%',
        minHeight: 3,
        borderRadius: '6px 6px 0 0',
        background: c
      }
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.625rem',
        color: 'var(--text-tertiary)',
        fontWeight: 600
      }
    }, l))));
  }
  function AnalyticsScreen() {
    const [range, setRange] = React.useState('30 days');
    return /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        overflowY: 'auto',
        padding: '0.75rem',
        position: 'relative'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(circle at 15% 50%, rgba(99,102,241,0.05), transparent 40%), radial-gradient(circle at 85% 30%, rgba(16,185,129,0.05), transparent 40%)'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 1200,
        margin: '0 auto',
        padding: '1.5rem 2rem 3rem',
        position: 'relative',
        zIndex: 10
      }
    }, /*#__PURE__*/React.createElement("header", {
      style: {
        marginBottom: '2rem',
        padding: '1rem 0'
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        fontSize: '2.25rem',
        fontWeight: 900,
        letterSpacing: '-0.03em',
        marginBottom: '0.5rem',
        display: 'inline-block',
        background: 'linear-gradient(135deg, #f8fafc, #818cf8)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
      }
    }, "Analytics"), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 4,
        width: '40%',
        background: 'linear-gradient(90deg, var(--color-primary), transparent)',
        borderRadius: 4,
        marginTop: 4
      }
    }), /*#__PURE__*/React.createElement("p", {
      style: {
        color: 'var(--text-tertiary)',
        fontSize: '0.95rem',
        maxWidth: 600,
        marginTop: '0.75rem'
      }
    }, "Every attempt you have logged, scored and timed."), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: '1rem'
      }
    }, /*#__PURE__*/React.createElement(Tabs, {
      variant: "pill",
      value: range,
      onChange: setRange,
      items: [{
        label: '7 days'
      }, {
        label: '30 days'
      }, {
        label: 'All time'
      }]
    }))), /*#__PURE__*/React.createElement(PanelCard, {
      variant: "glass",
      icon: "gauge",
      title: "Overview",
      action: /*#__PURE__*/React.createElement(Badge, {
        tone: "neutral"
      }, "87 attempts"),
      style: {
        marginBottom: '1.5rem'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem'
      }
    }, /*#__PURE__*/React.createElement(HeroTile, {
      label: "Attempts",
      value: "87",
      icon: "activity"
    }), /*#__PURE__*/React.createElement(HeroTile, {
      label: "Perfect runs",
      value: "41",
      icon: "check-circle-2",
      tone: "success"
    }), /*#__PURE__*/React.createElement(HeroTile, {
      label: "Accuracy",
      value: "94%",
      icon: "target",
      tone: "primary"
    }), /*#__PURE__*/React.createElement(HeroTile, {
      label: "Median time",
      value: "14:22",
      icon: "clock"
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '3fr 2fr',
        gap: '1.5rem',
        marginBottom: '1.5rem'
      }
    }, /*#__PURE__*/React.createElement(PanelCard, {
      variant: "glass",
      icon: "trending-up",
      title: "Attempts per week"
    }, /*#__PURE__*/React.createElement(Trend, null)), /*#__PURE__*/React.createElement(PanelCard, {
      variant: "glass",
      icon: "layers",
      title: "By difficulty tier"
    }, /*#__PURE__*/React.createElement(Dist, null))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '1.5rem',
        marginBottom: '1.5rem',
        alignItems: 'start'
      }
    }, /*#__PURE__*/React.createElement(PanelCard, {
      variant: "glass",
      icon: "calendar-days",
      title: "Consistency"
    }, /*#__PURE__*/React.createElement(Heatmap, {
      weeks: 30
    })), /*#__PURE__*/React.createElement(PanelCard, {
      variant: "glass",
      icon: "repeat",
      title: "Review load"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: '1.25rem',
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement(ProgressRing, {
      value: 68,
      size: 72
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.8125rem',
        color: 'var(--text-secondary)',
        maxWidth: 160
      }
    }, "6 of 19 scheduled cards are still due today.")))), /*#__PURE__*/React.createElement(PanelCard, {
      variant: "glass",
      icon: "history",
      title: "Attempt history"
    }, /*#__PURE__*/React.createElement(DataTable, {
      rows: ROWS,
      onRowClick: () => {},
      columns: [{
        key: 'name',
        label: 'Program'
      }, {
        label: 'Tier',
        render: r => /*#__PURE__*/React.createElement(TierBadge, {
          tier: r.tier
        })
      }, {
        key: 'time',
        label: 'Duration'
      }, {
        key: 'when',
        label: 'When'
      }, {
        label: 'Score',
        align: 'right',
        render: r => /*#__PURE__*/React.createElement(ScoreBadge, {
          perfect: r.perfect
        }, r.score)
      }]
    }))));
  }
  Object.assign(window, {
    AnalyticsScreen
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/studysession/AnalyticsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/studysession/AppShell.jsx
try { (() => {
(function () {
  const {
    SidebarLink,
    Icon
  } = window.StudySessionProDesignSystem_f5d02b;
  function Sidebar({
    route,
    go
  }) {
    const [expanded, setExpanded] = React.useState(true);
    const items = [{
      id: 'home',
      icon: 'home',
      label: 'Home'
    }, {
      id: 'library',
      icon: 'library',
      label: 'Library'
    }, {
      id: 'analytics',
      icon: 'bar-chart-3',
      label: 'Analytics'
    }, {
      id: 'admin',
      icon: 'settings',
      label: 'Admin'
    }, {
      id: 'visualize',
      icon: 'git-branch',
      label: 'Visualize'
    }, {
      id: 'quests',
      icon: 'scroll-text',
      label: 'Quest Board'
    }, {
      id: 'search',
      icon: 'search',
      label: 'Search'
    }];
    return /*#__PURE__*/React.createElement("nav", {
      style: {
        width: expanded ? 260 : 72,
        minWidth: expanded ? 260 : 72,
        background: 'var(--bg-nav-solid)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s var(--ease-standard)',
        zIndex: 100,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '1rem 0.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        alignItems: 'center',
        height: 72,
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setExpanded(v => !v),
      title: "Toggle Sidebar",
      style: {
        background: 'transparent',
        border: 'none',
        color: 'var(--text-tertiary)',
        cursor: 'pointer',
        minWidth: 40,
        width: 40,
        height: 40,
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "menu",
      size: 20
    })), /*#__PURE__*/React.createElement("a", {
      href: "#",
      onClick: e => {
        e.preventDefault();
        go('home');
      },
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        textDecoration: 'none',
        opacity: expanded ? 1 : 0,
        transition: 'opacity 0.2s ease',
        whiteSpace: 'nowrap'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "code-2",
      size: 24,
      color: "var(--color-primary)"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        background: 'linear-gradient(135deg, #e2e8f0, #a5b4fc)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        fontSize: '1.1rem',
        fontWeight: 800
      }
    }, "StudySession")))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '1rem 0.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }
    }, items.map(it => /*#__PURE__*/React.createElement(SidebarLink, {
      key: it.id,
      icon: it.icon,
      label: it.label,
      active: route === it.id,
      expanded: expanded,
      onClick: e => {
        e.preventDefault();
        go(it.id);
      }
    }))));
  }
  function SettingsFab({
    onClick
  }) {
    const [hover, setHover] = React.useState(false);
    return /*#__PURE__*/React.createElement("button", {
      onClick: onClick,
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      title: "Settings",
      style: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: 'var(--bg-elevated)',
        border: '1px solid ' + (hover ? 'var(--color-primary)' : 'var(--border-color)'),
        color: hover ? 'var(--color-primary)' : 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: hover ? '0 0 20px var(--color-primary-glow)' : 'var(--shadow-lg)',
        transition: 'all var(--transition-fast)',
        zIndex: 50,
        transform: hover ? 'scale(1.06)' : 'none'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "settings",
      size: 20
    }));
  }
  Object.assign(window, {
    Sidebar,
    SettingsFab
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/studysession/AppShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/studysession/HomeScreen.jsx
try { (() => {
(function () {
  const {
    StatCard,
    PanelCard,
    QuickActionCard,
    Heatmap,
    Badge,
    Button,
    Icon,
    TierBadge,
    ScoreBadge
  } = window.StudySessionProDesignSystem_f5d02b;
  function Hero() {
    return /*#__PURE__*/React.createElement("section", {
      style: {
        position: 'relative',
        padding: '2.75rem 2.5rem 2.25rem',
        borderRadius: 'var(--radius-xl)',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(6,182,212,0.07) 50%, rgba(16,185,129,0.05) 100%)',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        animation: 'fadeInUp 0.4s ease-out'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: '-40%',
        right: '-15%',
        width: 360,
        height: 360,
        background: 'radial-gradient(circle, rgba(99,102,241,0.13) 0%, transparent 70%)',
        borderRadius: '50%',
        animation: 'float 8s ease-in-out infinite',
        pointerEvents: 'none'
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        bottom: '-25%',
        left: '-8%',
        width: 280,
        height: 280,
        background: 'radial-gradient(circle, rgba(6,182,212,0.09) 0%, transparent 70%)',
        borderRadius: '50%',
        animation: 'float 6s ease-in-out infinite reverse',
        pointerEvents: 'none'
      }
    }), /*#__PURE__*/React.createElement("button", {
      title: "Show Page Tour",
      style: {
        position: 'absolute',
        top: '1rem',
        right: '1rem',
        width: 34,
        height: 34,
        borderRadius: 'var(--radius-md)',
        background: 'transparent',
        border: '1px solid var(--border-color)',
        color: 'var(--text-tertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 2
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "graduation-cap",
      size: 16
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '2.25rem',
        fontWeight: 800,
        letterSpacing: '-0.03em',
        lineHeight: 1.2,
        marginBottom: '0.5rem',
        position: 'relative',
        zIndex: 1,
        background: 'linear-gradient(135deg, var(--text-primary) 30%, var(--color-primary) 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
      }
    }, "Good evening, Kenric"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '1rem',
        color: 'var(--text-secondary)',
        position: 'relative',
        zIndex: 1
      }
    }, "You have 6 cards due for review and one unfinished session."), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.8125rem',
        color: 'var(--text-tertiary)',
        marginTop: '0.75rem',
        fontWeight: 500,
        position: 'relative',
        zIndex: 1
      }
    }, "Friday, 28 August"), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: '1rem',
        fontStyle: 'italic',
        color: 'var(--text-tertiary)',
        maxWidth: 600,
        position: 'relative',
        zIndex: 1,
        fontSize: '0.875rem'
      }
    }, "\"Whatever you do, work at it with all your heart.\" \u2014 Colossians 3:23"));
  }
  function SrsRow({
    title,
    due,
    tier
  }) {
    const [hover, setHover] = React.useState(false);
    return /*#__PURE__*/React.createElement("div", {
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 0.875rem',
        background: 'var(--bg-surface-hover)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid ' + (hover ? 'var(--color-primary)' : 'var(--border-color)'),
        marginBottom: '0.5rem',
        transition: 'all 0.2s ease',
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement(TierBadge, {
      tier: tier
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.875rem',
        fontWeight: 600,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, title)), /*#__PURE__*/React.createElement(Badge, {
      tone: due === 'Today' ? 'warning' : 'neutral'
    }, due));
  }
  function ActivityRow({
    name,
    score,
    perfect,
    when
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.625rem 0',
        borderTop: '1px solid var(--border-color-subtle)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.875rem',
        fontWeight: 600
      }
    }, name), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.6875rem',
        color: 'var(--text-tertiary)'
      }
    }, when)), /*#__PURE__*/React.createElement(ScoreBadge, {
      perfect: perfect
    }, score));
  }
  function HomeScreen({
    go
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '0.75rem'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 1200,
        margin: '0 auto',
        padding: '1.5rem 2rem 3rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem'
      }
    }, /*#__PURE__*/React.createElement(Hero, null), /*#__PURE__*/React.createElement("section", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '0.875rem'
      },
      className: "stagger-children"
    }, /*#__PURE__*/React.createElement(StatCard, {
      icon: "flame",
      value: "12",
      label: "Day streak",
      accent: "indigo"
    }), /*#__PURE__*/React.createElement(StatCard, {
      icon: "check-circle-2",
      value: "87",
      label: "Solved",
      accent: "green"
    }), /*#__PURE__*/React.createElement(StatCard, {
      icon: "target",
      value: "94%",
      label: "Accuracy",
      accent: "amber"
    }), /*#__PURE__*/React.createElement(StatCard, {
      icon: "clock",
      value: "6.2h",
      label: "This week",
      accent: "cyan"
    })), /*#__PURE__*/React.createElement("section", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) clamp(230px, 24%, 300px)',
        gap: '1.25rem'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement(PanelCard, {
      icon: "calendar-days",
      title: "Practice activity",
      action: /*#__PURE__*/React.createElement(Badge, {
        tone: "neutral"
      }, "26 weeks")
    }, /*#__PURE__*/React.createElement(Heatmap, {
      weeks: 26
    })), /*#__PURE__*/React.createElement(PanelCard, {
      icon: "notebook-pen",
      title: "Continue where you left off"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem'
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '1rem',
        fontWeight: 700
      }
    }, "Bubble Sort \u2014 v2"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.75rem',
        color: 'var(--text-tertiary)',
        marginTop: 2
      }
    }, "Autosaved 4 minutes ago \xB7 2 of 3 files edited")), /*#__PURE__*/React.createElement(Button, {
      icon: "play",
      onClick: () => go('practice')
    }, "Resume")))), /*#__PURE__*/React.createElement(PanelCard, {
      icon: "zap",
      title: "Quick actions"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }
    }, /*#__PURE__*/React.createElement(QuickActionCard, {
      index: 0,
      icon: "play",
      label: "Resume practice",
      description: "Bubble Sort, 4 min left",
      onClick: e => {
        e.preventDefault();
        go('practice');
      }
    }), /*#__PURE__*/React.createElement(QuickActionCard, {
      index: 1,
      icon: "library",
      label: "Browse library",
      description: "87 programs",
      onClick: e => {
        e.preventDefault();
        go('library');
      }
    }), /*#__PURE__*/React.createElement(QuickActionCard, {
      index: 2,
      icon: "scroll-text",
      label: "Quest board",
      description: "3 active",
      onClick: e => {
        e.preventDefault();
        go('quests');
      }
    }), /*#__PURE__*/React.createElement(QuickActionCard, {
      index: 3,
      icon: "bar-chart-3",
      label: "Analytics",
      description: "Last 30 days",
      onClick: e => {
        e.preventDefault();
        go('analytics');
      }
    })))), /*#__PURE__*/React.createElement("section", {
      style: {
        display: 'grid',
        gridTemplateColumns: '3fr 2fr',
        gap: '1.25rem'
      }
    }, /*#__PURE__*/React.createElement(PanelCard, {
      icon: "repeat",
      title: "Due for review",
      action: /*#__PURE__*/React.createElement(Badge, {
        tone: "warning"
      }, "6")
    }, /*#__PURE__*/React.createElement(SrsRow, {
      title: "Linked List Reversal",
      due: "Today",
      tier: "A"
    }), /*#__PURE__*/React.createElement(SrsRow, {
      title: "Matrix Transpose",
      due: "Today",
      tier: "B"
    }), /*#__PURE__*/React.createElement(SrsRow, {
      title: "String Tokeniser",
      due: "Tomorrow",
      tier: "C"
    })), /*#__PURE__*/React.createElement(PanelCard, {
      icon: "history",
      title: "Recent activity"
    }, /*#__PURE__*/React.createElement(ActivityRow, {
      name: "Bubble Sort",
      score: "18 / 18",
      perfect: true,
      when: "2 hours ago"
    }), /*#__PURE__*/React.createElement(ActivityRow, {
      name: "Binary Search",
      score: "15 / 18",
      perfect: false,
      when: "Yesterday"
    }), /*#__PURE__*/React.createElement(ActivityRow, {
      name: "Stack with Array",
      score: "18 / 18",
      perfect: true,
      when: "Yesterday"
    })))));
  }
  Object.assign(window, {
    HomeScreen
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/studysession/HomeScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/studysession/LibraryScreen.jsx
try { (() => {
(function () {
  const {
    TreeNode,
    Card,
    SearchInput,
    Breadcrumb,
    Tabs,
    Badge,
    TierBadge,
    Button,
    Icon,
    EmptyState
  } = window.StudySessionProDesignSystem_f5d02b;
  const TREE = [{
    label: 'Arrays',
    count: 12,
    children: ['Bubble Sort', 'Matrix Transpose', 'Rotate 90°']
  }, {
    label: 'Pointers',
    count: 9,
    children: ['Swap by Reference', 'Dynamic Array']
  }, {
    label: 'Strings',
    count: 14,
    children: ['String Tokeniser', 'Palindrome Check']
  }, {
    label: 'Linked Lists',
    count: 7,
    locked: true,
    children: ['Linked List Reversal']
  }];
  const PROGRAMS = [{
    name: 'Bubble Sort',
    tier: 'C',
    versions: 3,
    solved: true
  }, {
    name: 'Matrix Transpose',
    tier: 'B',
    versions: 2,
    solved: true
  }, {
    name: 'Rotate 90°',
    tier: 'A',
    versions: 1,
    solved: false
  }, {
    name: 'Selection Sort',
    tier: 'D',
    versions: 2,
    solved: true
  }, {
    name: 'Insertion Sort',
    tier: 'D',
    versions: 1,
    solved: false
  }, {
    name: 'Binary Search',
    tier: 'C',
    versions: 4,
    solved: true
  }];
  function LibraryScreen({
    go
  }) {
    const [tab, setTab] = React.useState('Programs');
    const [openFolder, setOpenFolder] = React.useState('Arrays');
    const [active, setActive] = React.useState('Bubble Sort');
    const [query, setQuery] = React.useState('');
    const list = PROGRAMS.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        background: 'transparent',
        padding: '0.5rem',
        gap: '0.25rem'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: '40%',
        maxWidth: 480,
        minWidth: 320,
        flexShrink: 0,
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '1.25rem 1rem',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        fontSize: '1.25rem',
        fontWeight: 800,
        letterSpacing: '-0.02em'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "library",
      size: 22,
      color: "var(--color-primary)"
    }), " Library"), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      iconOnly: true,
      icon: "folder-plus",
      "aria-label": "New folder"
    })), /*#__PURE__*/React.createElement(SearchInput, {
      width: "100%",
      placeholder: "Search programs, snippets, notebooks\u2026",
      value: query,
      onChange: e => setQuery(e.target.value)
    }), /*#__PURE__*/React.createElement(Tabs, {
      value: tab,
      onChange: setTab,
      items: [{
        label: 'Programs',
        icon: 'code-2'
      }, {
        label: 'Snippets',
        icon: 'scissors'
      }, {
        label: 'Notes',
        icon: 'notebook-pen'
      }],
      style: {
        marginBottom: '-1.25rem'
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        overflowY: 'auto',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: 4
      }
    }, TREE.map(node => /*#__PURE__*/React.createElement(TreeNode, {
      key: node.label,
      label: node.label,
      kind: "folder",
      level: 0,
      count: node.count,
      locked: node.locked,
      expanded: openFolder === node.label,
      onToggle: () => setOpenFolder(openFolder === node.label ? null : node.label),
      onClick: () => setOpenFolder(openFolder === node.label ? null : node.label)
    }, node.children.map(c => /*#__PURE__*/React.createElement(TreeNode, {
      key: c,
      label: c,
      kind: "item",
      level: 1,
      active: active === c,
      onClick: () => setActive(c)
    })))))), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 10,
        flexShrink: 0
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0,
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '1.5rem 1.75rem'
      }
    }, /*#__PURE__*/React.createElement(Breadcrumb, {
      items: ['Library', 'Arrays'],
      style: {
        marginBottom: '1rem'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
        gap: '1rem'
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
      style: {
        fontSize: '1.5rem',
        fontWeight: 800,
        letterSpacing: '-0.02em'
      }
    }, "Arrays"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: '0.8125rem',
        color: 'var(--text-tertiary)',
        marginTop: 4
      }
    }, "12 programs \xB7 4 solved this week")), /*#__PURE__*/React.createElement(Button, {
      icon: "plus",
      size: "sm"
    }, "New program")), list.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
      icon: "search-x",
      title: "Nothing matches that",
      description: "Try a shorter search, or clear it to see all 12 programs."
    }) : /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 'var(--space-md)'
      }
    }, list.map(p => /*#__PURE__*/React.createElement(Card, {
      key: p.name,
      onClick: () => go('practice')
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '0.5rem'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '1rem',
        fontWeight: 700,
        lineHeight: 1.3
      }
    }, p.name), /*#__PURE__*/React.createElement(TierBadge, {
      tier: p.tier
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginTop: '0.75rem'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.625rem',
        fontWeight: 700,
        background: 'var(--bg-surface-hover)',
        color: 'var(--text-tertiary)',
        padding: '0.25rem 0.5rem',
        borderRadius: 'var(--radius-sm)'
      }
    }, p.versions, " ", p.versions === 1 ? 'version' : 'versions'), p.solved ? /*#__PURE__*/React.createElement(Badge, {
      tone: "success"
    }, "Solved") : /*#__PURE__*/React.createElement(Badge, {
      tone: "neutral"
    }, "Not attempted"))))))));
  }
  Object.assign(window, {
    LibraryScreen
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/studysession/LibraryScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/studysession/PracticeScreen.jsx
try { (() => {
(function () {
  const {
    FileTab,
    Button,
    Icon,
    AnswerBubble,
    Badge
  } = window.StudySessionProDesignSystem_f5d02b;
  const CODE = {
    'main.c': ['#include <stdio.h>', '', 'void bubble_sort(int a[], int n) {', '    for (int i = 0; i < n - 1; i++) {', '        for (int j = 0; j < n - i - 1; j++) {', '            if (a[j] > a[j + 1]) {', '                int t = a[j];', '                a[j] = a[j + 1];', '                a[j + 1] = t;', '            }', '        }', '    }', '}', '', 'int main(void) {', '    int a[] = {5, 1, 4, 2, 8};', '    bubble_sort(a, 5);', '    for (int i = 0; i < 5; i++) printf("%d ", a[i]);', '    return 0;', '}'],
    'helpers.h': ['#ifndef HELPERS_H', '#define HELPERS_H', '', 'void bubble_sort(int a[], int n);', '', '#endif'],
    'input.txt': ['5', '5 1 4 2 8']
  };
  const KEYWORDS = /\b(include|void|int|for|if|return|else|while|char|float|double|struct|const|unsigned)\b/g;
  function highlight(line) {
    const out = [];
    let rest = line;
    if (rest.trimStart().startsWith('#')) {
      return /*#__PURE__*/React.createElement("span", {
        style: {
          color: '#ff7b72'
        }
      }, line);
    }
    const parts = line.split(/("[^"]*")/g);
    return parts.map((p, i) => {
      if (p.startsWith('"')) return /*#__PURE__*/React.createElement("span", {
        key: i,
        style: {
          color: '#a5d6ff'
        }
      }, p);
      const bits = p.split(KEYWORDS);
      return bits.map((b, j) => KEYWORDS.test(b) ? /*#__PURE__*/React.createElement("span", {
        key: i + '-' + j,
        style: {
          color: '#ff7b72'
        }
      }, b) : /*#__PURE__*/React.createElement("span", {
        key: i + '-' + j
      }, b));
    });
  }
  function Editor({
    file
  }) {
    const lines = CODE[file] || [];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        overflow: 'auto',
        background: 'var(--term-bg)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.8125rem',
        lineHeight: 1.65
      }
    }, /*#__PURE__*/React.createElement("table", {
      style: {
        borderCollapse: 'collapse',
        width: '100%'
      }
    }, /*#__PURE__*/React.createElement("tbody", null, lines.map((l, i) => /*#__PURE__*/React.createElement("tr", {
      key: i
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        width: 46,
        textAlign: 'right',
        paddingRight: 14,
        color: '#484f58',
        userSelect: 'none',
        verticalAlign: 'top',
        background: 'var(--term-bg)'
      }
    }, i + 1), /*#__PURE__*/React.createElement("td", {
      style: {
        color: '#c9d1d9',
        whiteSpace: 'pre',
        paddingRight: 16
      }
    }, highlight(l)))))));
  }
  function Terminal({
    ran
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        height: 150,
        borderTop: '1px solid var(--term-border)',
        background: 'var(--term-surface)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.4rem 0.75rem',
        borderBottom: '1px solid var(--term-border)',
        fontSize: '0.6875rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--term-text-muted)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "terminal",
      size: 13
    }), " Output", /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        fontFamily: 'var(--font-mono)',
        textTransform: 'none',
        letterSpacing: 0
      }
    }, ran ? 'exit 0' : 'idle')), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        overflow: 'auto',
        padding: '0.65rem 0.9rem',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.8125rem',
        lineHeight: 1.7,
        color: 'var(--term-text)'
      }
    }, ran ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        color: 'var(--term-text-muted)'
      }
    }, "$ gcc main.c -o main && ./main"), /*#__PURE__*/React.createElement("div", null, "1 2 4 5 8"), /*#__PURE__*/React.createElement("div", {
      style: {
        color: 'var(--color-success)'
      }
    }, "Process exited with code 0 (34 ms)")) : /*#__PURE__*/React.createElement("div", {
      style: {
        color: 'var(--term-text-muted)'
      }
    }, "Press Run Code to compile main.c.")));
  }
  function PracticeScreen({
    go
  }) {
    const [file, setFile] = React.useState('main.c');
    const [open, setOpen] = React.useState(['main.c', 'helpers.h', 'input.txt']);
    const [ran, setRan] = React.useState(false);
    const [answers, setAnswers] = React.useState({
      1: 'B',
      2: 'A'
    });
    const closeTab = name => {
      const next = open.filter(n => n !== name);
      setOpen(next);
      if (file === name && next.length) setFile(next[0]);
    };
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        background: 'var(--term-bg)',
        color: '#b1bac4',
        height: '100%',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        margin: '0.5rem'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        borderBottom: '1px solid var(--term-border)',
        minHeight: 52,
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm",
      icon: "arrow-left",
      onClick: () => go('library')
    }, "Back"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginLeft: '0.5rem',
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 700,
        fontSize: '0.9rem',
        color: '#e6edf3'
      }
    }, "Bubble Sort"), /*#__PURE__*/React.createElement(Badge, {
      tone: "primary"
    }, "v2")), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        margin: '0 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.65rem',
        fontFamily: 'var(--font-mono)',
        color: 'var(--term-text-muted)'
      }
    }, /*#__PURE__*/React.createElement("span", null, "PROGRESS"), /*#__PURE__*/React.createElement("span", null, "14 / 18")), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 4,
        background: 'rgba(51,65,85,0.6)',
        borderRadius: 99,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: '78%',
        height: '100%',
        background: 'linear-gradient(90deg,#22c55e,#86efac)',
        boxShadow: '0 0 8px rgba(34,197,94,0.5)',
        borderRadius: 99
      }
    }))), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: '0.9rem',
        color: '#e6edf3',
        fontVariantNumeric: 'tabular-nums'
      }
    }, "24:31"), /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm",
      icon: "save"
    }, "Save"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "sm",
      icon: "play",
      onClick: () => setRan(true)
    }, "Run Code")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flex: 1,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 260,
        minWidth: 260,
        borderRight: '1px solid var(--term-border)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        padding: '0.75rem',
        gap: '0.75rem',
        background: 'var(--term-bg)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.6875rem',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--term-text-muted)'
      }
    }, "Questions"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))',
        gap: '0.5rem'
      }
    }, Array.from({
      length: 18
    }, (_, i) => {
      const n = i + 1;
      const state = answers[n] ? 'answered' : n <= 6 ? 'opened' : 'default';
      const isActive = n === 3;
      const color = state === 'answered' ? 'var(--color-success)' : state === 'opened' ? '#8b949e' : '#8b949e';
      return /*#__PURE__*/React.createElement("div", {
        key: n,
        style: {
          aspectRatio: '1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          fontSize: '0.875rem',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          border: '2px solid ' + (isActive ? 'var(--color-primary)' : state === 'answered' ? 'var(--color-success)' : '#21262d'),
          background: state === 'answered' ? 'rgba(16,185,129,0.1)' : 'var(--term-bg)',
          color: isActive ? 'var(--color-primary)' : color,
          boxShadow: isActive ? '0 0 0 3px #0d1117, 0 0 0 5px var(--color-primary)' : 'none'
        }
      }, n);
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.6875rem',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--term-text-muted)',
        marginTop: '0.5rem'
      }
    }, "Question 3"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.8125rem',
        color: '#c9d1d9',
        lineHeight: 1.55
      }
    }, "What is the worst-case time complexity of the inner loop above?"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: '0.375rem'
      }
    }, ['A', 'B', 'C', 'D'].map(k => /*#__PURE__*/React.createElement(AnswerBubble, {
      key: k,
      state: answers[3] === k ? 'selected' : 'default',
      onClick: () => setAnswers({
        ...answers,
        3: k
      })
    }, k)))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'stretch',
        background: 'var(--term-bg)',
        borderBottom: '1px solid var(--term-border)',
        minHeight: 38,
        flexShrink: 0,
        overflowX: 'auto'
      }
    }, open.map(n => /*#__PURE__*/React.createElement(FileTab, {
      key: n,
      name: n,
      active: file === n,
      dirty: n === 'main.c',
      onClick: () => setFile(n),
      onClose: () => closeTab(n)
    })), /*#__PURE__*/React.createElement("button", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        minWidth: 32,
        background: 'none',
        border: 'none',
        color: 'var(--term-text-muted)',
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 14
    }))), /*#__PURE__*/React.createElement(Editor, {
      file: file
    }), /*#__PURE__*/React.createElement(Terminal, {
      ran: ran
    }))));
  }
  Object.assign(window, {
    PracticeScreen
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/studysession/PracticeScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/studysession/QuestBoardScreen.jsx
try { (() => {
(function () {
  const {
    Icon,
    Button
  } = window.StudySessionProDesignSystem_f5d02b;
  const RANK = {
    S: '#ef4444',
    A: '#f97316',
    B: '#a855f7',
    C: '#3b82f6',
    D: '#22c55e',
    E: '#64748b'
  };
  const QUESTS = [{
    id: 1,
    rank: 'S',
    title: 'CLEAR THE ARRAY GAUNTLET',
    desc: 'Solve 5 array programs without a hint',
    prog: 60,
    xp: 900,
    due: '2d'
  }, {
    id: 2,
    rank: 'B',
    title: 'POINTER DISCIPLINE',
    desc: 'Perfect score on 3 pointer snippets',
    prog: 33,
    xp: 400,
    due: '5d'
  }, {
    id: 3,
    rank: 'D',
    title: 'DAILY DRILL',
    desc: 'Any 1 practice session today',
    prog: 100,
    xp: 80,
    due: 'today'
  }, {
    id: 4,
    rank: 'C',
    title: 'REVIEW BACKLOG',
    desc: 'Clear 6 due review cards',
    prog: 16,
    xp: 220,
    due: '3d'
  }];
  function StatusBar() {
    const stats = [{
      icon: 'swords',
      v: 4,
      l: 'Active'
    }, {
      icon: 'check',
      v: 37,
      l: 'Done',
      c: '#10b981'
    }, {
      icon: 'x',
      v: 2,
      l: 'Failed',
      c: '#ef4444'
    }];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '1.25rem',
        padding: '0.55rem 1.25rem',
        background: 'rgba(7,12,28,0.85)',
        border: '1px solid rgba(51,65,85,0.5)',
        borderRadius: 'var(--radius-md)',
        backdropFilter: 'blur(12px)',
        flexShrink: 0,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.1rem',
        minWidth: 64
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.6rem',
        fontWeight: 700,
        letterSpacing: '1.5px',
        color: '#475569',
        fontFamily: 'var(--font-display)'
      }
    }, "SYSTEM"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '1.1rem',
        fontWeight: 900,
        color: '#22c55e',
        fontFamily: 'var(--font-display)',
        textShadow: '0 0 12px rgba(34,197,94,0.5)',
        letterSpacing: '1px'
      }
    }, "LV 24")), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.3rem'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.7rem',
        fontWeight: 700,
        color: 'var(--color-primary)',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-display)'
      }
    }, "Systems Apprentice"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.7rem',
        color: '#64748b',
        fontFamily: 'var(--font-mono)'
      }
    }, "4,120 / 5,000 XP")), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 4,
        background: 'rgba(51,65,85,0.6)',
        borderRadius: 99,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: '82%',
        height: '100%',
        background: 'linear-gradient(90deg,#22c55e,#86efac)',
        borderRadius: 99,
        boxShadow: '0 0 8px rgba(34,197,94,0.5)'
      }
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: '0.75rem',
        flexShrink: 0
      }
    }, stats.map(s => /*#__PURE__*/React.createElement("div", {
      key: s.l,
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.1rem',
        minWidth: 36
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: s.icon,
      size: 14,
      color: "#64748b"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.95rem',
        fontWeight: 700,
        color: s.c || 'var(--text-primary)',
        fontFamily: 'var(--font-display)',
        lineHeight: 1
      }
    }, s.v), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.55rem',
        color: '#475569',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }
    }, s.l)))));
  }
  function RankBadge({
    rank
  }) {
    return /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: 6,
        fontSize: '0.7rem',
        fontWeight: 900,
        fontFamily: 'var(--font-display)',
        color: RANK[rank],
        background: RANK[rank] + '1f',
        border: '1px solid ' + RANK[rank] + '59',
        flexShrink: 0
      }
    }, rank);
  }
  function QuestCard({
    q,
    active,
    onClick
  }) {
    const [hover, setHover] = React.useState(false);
    return /*#__PURE__*/React.createElement("div", {
      onClick: onClick,
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      style: {
        padding: '0.7rem 0.9rem',
        borderRadius: 8,
        marginBottom: 4,
        cursor: 'pointer',
        background: active ? RANK[q.rank] + '12' : hover ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.5)',
        border: '1px solid ' + (active ? RANK[q.rank] + '4d' : 'rgba(51,65,85,0.35)'),
        borderLeft: '3px solid ' + RANK[q.rank],
        transition: 'background 150ms ease-out, border-color 150ms ease-out'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '0.3rem'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        fontSize: '0.82rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-display)',
        letterSpacing: '0.3px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, q.title), /*#__PURE__*/React.createElement(RankBadge, {
      rank: q.rank
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-mono)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        marginBottom: '0.4rem'
      }
    }, q.desc), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginTop: '0.4rem'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        height: 3,
        background: 'rgba(51,65,85,0.6)',
        borderRadius: 99,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: q.prog + '%',
        height: '100%',
        background: RANK[q.rank],
        borderRadius: 99,
        transition: 'width 0.4s ease-out'
      }
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.65rem',
        color: '#64748b',
        fontFamily: 'var(--font-mono)',
        flexShrink: 0
      }
    }, q.prog, "%")));
  }
  function QuestBoardScreen() {
    const [sel, setSel] = React.useState(1);
    const [tab, setTab] = React.useState('ACTIVE');
    const q = QUESTS.find(x => x.id === sel);
    const tabs = [['ACTIVE', 4], ['COMPLETED', 37], ['FAILED', 2]];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        gap: '0.4rem',
        overflow: 'hidden',
        padding: '0.5rem'
      }
    }, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flex: 1,
        gap: '0.4rem',
        minHeight: 0,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 340,
        minWidth: 340,
        background: 'rgba(7,12,28,0.6)',
        border: '1px solid rgba(51,65,85,0.5)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1rem 0.5rem',
        gap: '0.5rem'
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        fontSize: '0.85rem',
        fontWeight: 900,
        textTransform: 'uppercase',
        letterSpacing: '1.5px',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        margin: 0,
        fontFamily: 'var(--font-display)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "scroll-text",
      size: 15,
      color: "var(--color-primary)"
    }), " Quest Board"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: '0.25rem'
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      iconOnly: true,
      icon: "arrow-up-down",
      size: "sm",
      "aria-label": "Sort"
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      iconOnly: true,
      icon: "plus",
      size: "sm",
      "aria-label": "New quest"
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        padding: '0 1rem 0.5rem'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        left: '1.75rem',
        top: '30%',
        color: '#64748b',
        display: 'flex'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "search",
      size: 13
    })), /*#__PURE__*/React.createElement("input", {
      placeholder: "filter quests\u2026",
      style: {
        width: '100%',
        padding: '0.45rem 0.75rem 0.45rem 2.25rem',
        background: 'rgba(15,23,42,0.8)',
        border: '1px solid rgba(51,65,85,0.6)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--text-primary)',
        fontSize: '0.82rem',
        fontFamily: 'var(--font-mono)',
        outline: 'none',
        boxSizing: 'border-box'
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        padding: '0 1rem',
        borderBottom: '1px solid rgba(51,65,85,0.4)'
      }
    }, tabs.map(([t, n]) => /*#__PURE__*/React.createElement("button", {
      key: t,
      onClick: () => setTab(t),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.5rem 0.75rem',
        background: 'transparent',
        border: 'none',
        borderBottom: '2px solid ' + (tab === t ? 'var(--color-primary)' : 'transparent'),
        color: tab === t ? 'var(--color-primary)' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: '0.72rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
        fontFamily: 'var(--font-display)',
        marginBottom: -1
      }
    }, t, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 16,
        height: 16,
        padding: '0 4px',
        background: 'var(--color-primary)',
        color: '#000',
        borderRadius: 99,
        fontSize: '0.6rem',
        fontWeight: 800,
        fontFamily: 'var(--font-mono)'
      }
    }, n)))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        overflowY: 'auto',
        padding: '0.5rem'
      }
    }, QUESTS.map(x => /*#__PURE__*/React.createElement(QuestCard, {
      key: x.id,
      q: x,
      active: x.id === sel,
      onClick: () => setSel(x.id)
    })))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0,
        background: 'rgba(7,12,28,0.6)',
        border: '1px solid rgba(51,65,85,0.5)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem 1.5rem',
        overflowY: 'auto'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1rem',
        marginBottom: '1rem'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.4rem',
        marginBottom: '0.5rem',
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement(RankBadge, {
      rank: q.rank
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.65rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '1px',
        color: '#64748b',
        fontFamily: 'var(--font-display)'
      }
    }, "Rank ", q.rank, " \xB7 ", q.xp, " XP \xB7 due in ", q.due)), /*#__PURE__*/React.createElement("h1", {
      style: {
        fontSize: '1.25rem',
        fontWeight: 900,
        fontFamily: 'var(--font-display)',
        letterSpacing: '0.5px',
        margin: 0,
        lineHeight: 1.25
      }
    }, q.title), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: '0.82rem',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-mono)',
        marginTop: '0.5rem'
      }
    }, q.desc)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem'
      }
    }, /*#__PURE__*/React.createElement(Button, {
      icon: "swords"
    }, "Continue"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: '0.3rem'
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm",
      iconOnly: true,
      icon: "pencil",
      "aria-label": "Edit"
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm",
      iconOnly: true,
      icon: "trash-2",
      "aria-label": "Abandon"
    })))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1.25rem'
      }
    }, [['Progress', q.prog + '%'], ['Reward', q.xp + ' XP'], ['Penalty', '-120 XP'], ['Deadline', 'in ' + q.due]].map(([l, v]) => /*#__PURE__*/React.createElement("div", {
      key: l,
      style: {
        padding: '0.75rem 0.9rem',
        background: 'rgba(15,23,42,0.5)',
        border: '1px solid rgba(51,65,85,0.35)',
        borderRadius: 'var(--radius-md)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.65rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '1px',
        color: '#475569',
        fontFamily: 'var(--font-display)'
      }
    }, l), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '1.1rem',
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        marginTop: 4
      }
    }, v)))), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.65rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '1px',
        color: '#475569',
        fontFamily: 'var(--font-display)',
        marginBottom: '0.6rem'
      }
    }, "Objectives"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem'
      }
    }, [['Bubble Sort', true], ['Selection Sort', true], ['Insertion Sort', true], ['Matrix Transpose', false], ['Rotate 90°', false]].map(([n, done]) => /*#__PURE__*/React.createElement("div", {
      key: n,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        padding: '0.5rem 0.75rem',
        background: 'rgba(15,23,42,0.5)',
        border: '1px solid rgba(51,65,85,0.35)',
        borderRadius: 'var(--radius-md)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.8rem',
        color: done ? 'var(--text-secondary)' : 'var(--text-primary)',
        textDecoration: done ? 'line-through' : 'none'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: done ? 'check-circle-2' : 'circle',
      size: 15,
      color: done ? '#22c55e' : '#475569'
    }), n))))));
  }
  Object.assign(window, {
    QuestBoardScreen
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/studysession/QuestBoardScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/studysession/SettingsSheet.jsx
try { (() => {
(function () {
  const {
    Modal,
    Button,
    Icon,
    Divider
  } = window.StudySessionProDesignSystem_f5d02b;
  function SettingsRow({
    icon,
    label,
    desc,
    danger,
    onClick
  }) {
    const [hover, setHover] = React.useState(false);
    return /*#__PURE__*/React.createElement("button", {
      onClick: onClick,
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.875rem',
        width: '100%',
        padding: '0.75rem 0.875rem',
        textAlign: 'left',
        cursor: 'pointer',
        borderRadius: 'var(--radius-md)',
        fontFamily: 'var(--font-sans)',
        background: hover ? danger ? 'var(--color-danger-bg)' : 'var(--bg-surface-hover)' : 'transparent',
        border: '1px solid transparent',
        color: hover && danger ? 'var(--color-danger)' : 'var(--text-primary)',
        transition: 'all var(--transition-fast)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        color: danger ? 'inherit' : 'var(--text-secondary)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: icon,
      size: 18
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: 600
      }
    }, label), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: '0.75rem',
        color: 'var(--text-tertiary)'
      }
    }, desc)), /*#__PURE__*/React.createElement(Icon, {
      name: "chevron-right",
      size: 16,
      color: "var(--text-tertiary)"
    }));
  }
  function SettingsSheet({
    open,
    onClose,
    onCycleTheme,
    onReset
  }) {
    return /*#__PURE__*/React.createElement(Modal, {
      open: open,
      size: "md",
      onDismiss: onClose,
      style: {
        textAlign: 'left',
        padding: 'var(--space-lg)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-md)'
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        fontSize: '1.25rem',
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "settings",
      size: 20
    }), " Settings"), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      iconOnly: true,
      icon: "x",
      "aria-label": "Close settings",
      onClick: onClose
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }
    }, /*#__PURE__*/React.createElement(SettingsRow, {
      icon: "cloud",
      label: "Storage Mode",
      desc: "Switch between local and cloud sync"
    }), /*#__PURE__*/React.createElement(SettingsRow, {
      icon: "moon",
      label: "Theme",
      desc: "Cycle the color theme",
      onClick: onCycleTheme
    }), /*#__PURE__*/React.createElement(SettingsRow, {
      icon: "download",
      label: "Export Data",
      desc: "Download a JSON backup"
    }), /*#__PURE__*/React.createElement(SettingsRow, {
      icon: "upload",
      label: "Import Data",
      desc: "Restore from a backup file"
    }), /*#__PURE__*/React.createElement(Divider, {
      style: {
        margin: '0.35rem 0'
      }
    }), /*#__PURE__*/React.createElement(SettingsRow, {
      icon: "trash-2",
      label: "Reset Data",
      desc: "Wipe everything and restore defaults",
      danger: true,
      onClick: onReset
    })));
  }
  Object.assign(window, {
    SettingsSheet
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/studysession/SettingsSheet.jsx", error: String((e && e.message) || e) }); }

// ui_kits/studysession/StorageModePicker.jsx
try { (() => {
(function () {
  const {
    Icon
  } = window.StudySessionProDesignSystem_f5d02b;
  function Option({
    icon,
    tone,
    title,
    desc,
    last,
    onClick
  }) {
    const [hover, setHover] = React.useState(false);
    return /*#__PURE__*/React.createElement("button", {
      onClick: onClick,
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem 1.25rem',
        background: hover ? 'var(--bg-surface-hover)' : 'var(--bg-surface)',
        border: '1px solid ' + (hover ? 'var(--color-primary)' : 'var(--border-color)'),
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        fontFamily: 'var(--font-sans)',
        color: 'var(--text-primary)',
        transition: 'all 0.2s ease',
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? '0 0 0 3px var(--color-primary-glow), 0 4px 12px rgba(0,0,0,0.15)' : 'none'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 44,
        height: 44,
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: tone === 'cloud' ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.05))' : 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(99,102,241,0.05))',
        color: tone === 'cloud' ? 'var(--color-success)' : 'var(--color-primary)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: icon,
      size: 22
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: '0.95rem',
        fontWeight: 700,
        marginBottom: '0.125rem'
      }
    }, title, last ? /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-block',
        marginLeft: '0.4rem',
        padding: '0.05rem 0.4rem',
        borderRadius: 999,
        fontSize: '0.5625rem',
        fontWeight: 800,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        verticalAlign: 2,
        color: 'var(--color-primary)',
        background: 'var(--color-primary-subtle)',
        border: '1px solid var(--color-primary)'
      }
    }, "Last used") : null), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: '0.75rem',
        color: 'var(--text-tertiary)',
        lineHeight: 1.4
      }
    }, desc)), /*#__PURE__*/React.createElement("span", {
      style: {
        color: hover ? 'var(--color-primary)' : 'var(--text-tertiary)',
        flexShrink: 0,
        display: 'flex',
        transform: hover ? 'translateX(3px)' : 'none',
        transition: 'all 0.2s ease'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevron-right",
      size: 18
    })));
  }
  function StorageModePicker({
    onChoose
  }) {
    const [remember, setRemember] = React.useState(false);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        animation: 'fadeIn 0.3s ease-out'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 80px rgba(99,102,241,0.08)',
        maxWidth: 520,
        width: '100%',
        overflow: 'hidden',
        animation: 'scaleIn 0.4s var(--ease-spring)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(6,182,212,0.08) 100%)',
        borderBottom: '1px solid var(--border-color)',
        padding: '2rem 2rem 1.5rem',
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        marginBottom: '0.75rem'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "code-2",
      size: 32,
      color: "var(--color-primary)"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '1.5rem',
        fontWeight: 900,
        letterSpacing: '-0.02em',
        background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
      }
    }, "StudySession Pro")), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: '0.875rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.5
      }
    }, "Choose where to store your data")), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '1.5rem 2rem 2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }
    }, /*#__PURE__*/React.createElement(Option, {
      icon: "hard-drive",
      tone: "local",
      title: "Local Storage",
      last: true,
      desc: "Data saved in your browser. Fast and offline-ready.",
      onClick: onChoose
    }), /*#__PURE__*/React.createElement(Option, {
      icon: "cloud",
      tone: "cloud",
      title: "Cloud Storage",
      desc: "Sign in with Google to sync across devices.",
      onClick: onChoose
    }), /*#__PURE__*/React.createElement("label", {
      onClick: () => setRemember(v => !v),
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.65rem',
        marginTop: '0.85rem',
        padding: '0.65rem 0.75rem',
        border: '1px solid transparent',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        userSelect: 'none'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 18,
        height: 18,
        flexShrink: 0,
        marginTop: 1,
        borderRadius: 5,
        border: '1.5px solid ' + (remember ? 'var(--color-primary)' : 'var(--border-color)'),
        background: remember ? 'var(--color-primary)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        transition: 'all var(--transition-fast)'
      }
    }, remember ? /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 13
    }) : null), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: '0.8125rem',
        fontWeight: 600
      }
    }, "Remember my choice"), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: '0.6875rem',
        color: 'var(--text-tertiary)'
      }
    }, "Skip this screen next time on this device"))))));
  }
  Object.assign(window, {
    StorageModePicker
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/studysession/StorageModePicker.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Divider = __ds_scope.Divider;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.ScoreBadge = __ds_scope.ScoreBadge;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.TierBadge = __ds_scope.TierBadge;

__ds_ns.DataTable = __ds_scope.DataTable;

__ds_ns.Heatmap = __ds_scope.Heatmap;

__ds_ns.PanelCard = __ds_scope.PanelCard;

__ds_ns.QuickActionCard = __ds_scope.QuickActionCard;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.Modal = __ds_scope.Modal;

__ds_ns.ProgressRing = __ds_scope.ProgressRing;

__ds_ns.Skeleton = __ds_scope.Skeleton;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.AnswerBubble = __ds_scope.AnswerBubble;

__ds_ns.FormLabel = __ds_scope.FormLabel;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.SearchInput = __ds_scope.SearchInput;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.Breadcrumb = __ds_scope.Breadcrumb;

__ds_ns.FileTab = __ds_scope.FileTab;

__ds_ns.Pagination = __ds_scope.Pagination;

__ds_ns.SidebarLink = __ds_scope.SidebarLink;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.TreeNode = __ds_scope.TreeNode;

})();
