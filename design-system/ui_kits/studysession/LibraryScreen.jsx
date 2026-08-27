(function(){
const { TreeNode, Card, SearchInput, Breadcrumb, Tabs, Badge, TierBadge, Button, Icon, EmptyState } = window.StudySessionProDesignSystem_f5d02b;

const TREE = [
  { label: 'Arrays', count: 12, children: ['Bubble Sort', 'Matrix Transpose', 'Rotate 90°'] },
  { label: 'Pointers', count: 9, children: ['Swap by Reference', 'Dynamic Array'] },
  { label: 'Strings', count: 14, children: ['String Tokeniser', 'Palindrome Check'] },
  { label: 'Linked Lists', count: 7, locked: true, children: ['Linked List Reversal'] },
];

const PROGRAMS = [
  { name: 'Bubble Sort', tier: 'C', versions: 3, solved: true },
  { name: 'Matrix Transpose', tier: 'B', versions: 2, solved: true },
  { name: 'Rotate 90°', tier: 'A', versions: 1, solved: false },
  { name: 'Selection Sort', tier: 'D', versions: 2, solved: true },
  { name: 'Insertion Sort', tier: 'D', versions: 1, solved: false },
  { name: 'Binary Search', tier: 'C', versions: 4, solved: true },
];

function LibraryScreen({ go }) {
  const [tab, setTab] = React.useState('Programs');
  const [openFolder, setOpenFolder] = React.useState('Arrays');
  const [active, setActive] = React.useState('Bubble Sort');
  const [query, setQuery] = React.useState('');
  const list = PROGRAMS.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', background: 'transparent', padding: '0.5rem', gap: '0.25rem' }}>
      <div style={{
        width: '40%', maxWidth: 480, minWidth: 320, flexShrink: 0,
        background: 'var(--bg-surface)', borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column',
        height: '100%', overflow: 'hidden',
      }}>
        <div style={{ padding: '1.25rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              <Icon name="library" size={22} color="var(--color-primary)" /> Library
            </h1>
            <Button variant="ghost" iconOnly icon="folder-plus" aria-label="New folder" />
          </div>
          <SearchInput width="100%" placeholder="Search programs, snippets, notebooks…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Tabs value={tab} onChange={setTab} items={[
            { label: 'Programs', icon: 'code-2' },
            { label: 'Snippets', icon: 'scissors' },
            { label: 'Notes', icon: 'notebook-pen' },
          ]} style={{ marginBottom: '-1.25rem' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {TREE.map(node => (
            <TreeNode
              key={node.label} label={node.label} kind="folder" level={0}
              count={node.count} locked={node.locked}
              expanded={openFolder === node.label}
              onToggle={() => setOpenFolder(openFolder === node.label ? null : node.label)}
              onClick={() => setOpenFolder(openFolder === node.label ? null : node.label)}
            >
              {node.children.map(c => (
                <TreeNode key={c} label={c} kind="item" level={1} active={active === c} onClick={() => setActive(c)} />
              ))}
            </TreeNode>
          ))}
        </div>
      </div>

      <div style={{ width: 10, flexShrink: 0 }} />

      <div style={{
        flex: 1, minWidth: 0, background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-color)',
        display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto',
      }}>
        <div style={{ padding: '1.5rem 1.75rem' }}>
          <Breadcrumb items={['Library', 'Arrays']} style={{ marginBottom: '1rem' }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Arrays</h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginTop: 4 }}>12 programs · 4 solved this week</p>
            </div>
            <Button icon="plus" size="sm">New program</Button>
          </div>
          {list.length === 0 ? (
            <EmptyState icon="search-x" title="Nothing matches that" description="Try a shorter search, or clear it to see all 12 programs." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
              {list.map(p => (
                <Card key={p.name} onClick={() => go('practice')}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.3 }}>{p.name}</div>
                    <TierBadge tier={p.tier} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <span style={{
                      fontSize: '0.625rem', fontWeight: 700, background: 'var(--bg-surface-hover)',
                      color: 'var(--text-tertiary)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)',
                    }}>{p.versions} {p.versions === 1 ? 'version' : 'versions'}</span>
                    {p.solved ? <Badge tone="success">Solved</Badge> : <Badge tone="neutral">Not attempted</Badge>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LibraryScreen });
})();
