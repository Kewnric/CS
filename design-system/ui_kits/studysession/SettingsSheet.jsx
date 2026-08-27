(function(){
const { Modal, Button, Icon, Divider } = window.StudySessionProDesignSystem_f5d02b;

function SettingsRow({ icon, label, desc, danger, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.875rem', width: '100%',
        padding: '0.75rem 0.875rem', textAlign: 'left', cursor: 'pointer',
        borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)',
        background: hover ? (danger ? 'var(--color-danger-bg)' : 'var(--bg-surface-hover)') : 'transparent',
        border: '1px solid transparent',
        color: hover && danger ? 'var(--color-danger)' : 'var(--text-primary)',
        transition: 'all var(--transition-fast)',
      }}
    >
      <span style={{ display: 'flex', color: danger ? 'inherit' : 'var(--text-secondary)' }}><Icon name={icon} size={18} /></span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600 }}>{label}</span>
        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{desc}</span>
      </span>
      <Icon name="chevron-right" size={16} color="var(--text-tertiary)" />
    </button>
  );
}

function SettingsSheet({ open, onClose, onCycleTheme, onReset }) {
  return (
    <Modal open={open} size="md" onDismiss={onClose} style={{ textAlign: 'left', padding: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Icon name="settings" size={20} /> Settings
        </h2>
        <Button variant="ghost" iconOnly icon="x" aria-label="Close settings" onClick={onClose} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <SettingsRow icon="cloud" label="Storage Mode" desc="Switch between local and cloud sync" />
        <SettingsRow icon="moon" label="Theme" desc="Cycle the color theme" onClick={onCycleTheme} />
        <SettingsRow icon="download" label="Export Data" desc="Download a JSON backup" />
        <SettingsRow icon="upload" label="Import Data" desc="Restore from a backup file" />
        <Divider style={{ margin: '0.35rem 0' }} />
        <SettingsRow icon="trash-2" label="Reset Data" desc="Wipe everything and restore defaults" danger onClick={onReset} />
      </div>
    </Modal>
  );
}

Object.assign(window, { SettingsSheet });
})();
