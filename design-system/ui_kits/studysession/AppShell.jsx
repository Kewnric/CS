(function(){
const { SidebarLink, Icon } = window.StudySessionProDesignSystem_f5d02b;

function Sidebar({ route, go }) {
  const [expanded, setExpanded] = React.useState(true);
  const items = [
    { id: 'home', icon: 'home', label: 'Home' },
    { id: 'library', icon: 'library', label: 'Library' },
    { id: 'analytics', icon: 'bar-chart-3', label: 'Analytics' },
    { id: 'admin', icon: 'settings', label: 'Admin' },
    { id: 'visualize', icon: 'git-branch', label: 'Visualize' },
    { id: 'quests', icon: 'scroll-text', label: 'Quest Board' },
    { id: 'search', icon: 'search', label: 'Search' },
  ];
  return (
    <nav style={{
      width: expanded ? 260 : 72, minWidth: expanded ? 260 : 72,
      background: 'var(--bg-nav-solid)', borderRight: '1px solid var(--border-color)',
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.3s var(--ease-standard)', zIndex: 100, overflow: 'hidden',
    }}>
      <div style={{
        padding: '1rem 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', height: 72, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', overflow: 'hidden' }}>
          <button
            onClick={() => setExpanded(v => !v)}
            title="Toggle Sidebar"
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-tertiary)',
              cursor: 'pointer', minWidth: 40, width: 40, height: 40,
              borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', marginLeft: 8,
            }}
          ><Icon name="menu" size={20} /></button>
          <a href="#" onClick={(e) => { e.preventDefault(); go('home'); }} style={{
            display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
            opacity: expanded ? 1 : 0, transition: 'opacity 0.2s ease', whiteSpace: 'nowrap',
          }}>
            <Icon name="code-2" size={24} color="var(--color-primary)" />
            <span style={{
              background: 'linear-gradient(135deg, #e2e8f0, #a5b4fc)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              fontSize: '1.1rem', fontWeight: 800,
            }}>StudySession</span>
          </a>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '1rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {items.map(it => (
          <SidebarLink
            key={it.id} icon={it.icon} label={it.label}
            active={route === it.id} expanded={expanded}
            onClick={(e) => { e.preventDefault(); go(it.id); }}
          />
        ))}
      </div>
    </nav>
  );
}

function SettingsFab({ onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Settings"
      style={{
        position: 'absolute', bottom: 20, right: 20, width: 48, height: 48,
        borderRadius: '50%', background: 'var(--bg-elevated)',
        border: '1px solid ' + (hover ? 'var(--color-primary)' : 'var(--border-color)'),
        color: hover ? 'var(--color-primary)' : 'var(--text-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        boxShadow: hover ? '0 0 20px var(--color-primary-glow)' : 'var(--shadow-lg)',
        transition: 'all var(--transition-fast)', zIndex: 50,
        transform: hover ? 'scale(1.06)' : 'none',
      }}
    ><Icon name="settings" size={20} /></button>
  );
}

Object.assign(window, { Sidebar, SettingsFab });
})();
