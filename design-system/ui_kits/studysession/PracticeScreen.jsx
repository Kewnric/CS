(function(){
const { FileTab, Button, Icon, AnswerBubble, Badge } = window.StudySessionProDesignSystem_f5d02b;

const CODE = {
  'main.c': [
    '#include <stdio.h>',
    '',
    'void bubble_sort(int a[], int n) {',
    '    for (int i = 0; i < n - 1; i++) {',
    '        for (int j = 0; j < n - i - 1; j++) {',
    '            if (a[j] > a[j + 1]) {',
    '                int t = a[j];',
    '                a[j] = a[j + 1];',
    '                a[j + 1] = t;',
    '            }',
    '        }',
    '    }',
    '}',
    '',
    'int main(void) {',
    '    int a[] = {5, 1, 4, 2, 8};',
    '    bubble_sort(a, 5);',
    '    for (int i = 0; i < 5; i++) printf("%d ", a[i]);',
    '    return 0;',
    '}',
  ],
  'helpers.h': ['#ifndef HELPERS_H', '#define HELPERS_H', '', 'void bubble_sort(int a[], int n);', '', '#endif'],
  'input.txt': ['5', '5 1 4 2 8'],
};

const KEYWORDS = /\b(include|void|int|for|if|return|else|while|char|float|double|struct|const|unsigned)\b/g;

function highlight(line) {
  const out = [];
  let rest = line;
  if (rest.trimStart().startsWith('#')) {
    return <span style={{ color: '#ff7b72' }}>{line}</span>;
  }
  const parts = line.split(/("[^"]*")/g);
  return parts.map((p, i) => {
    if (p.startsWith('"')) return <span key={i} style={{ color: '#a5d6ff' }}>{p}</span>;
    const bits = p.split(KEYWORDS);
    return bits.map((b, j) => KEYWORDS.test(b)
      ? <span key={i + '-' + j} style={{ color: '#ff7b72' }}>{b}</span>
      : <span key={i + '-' + j}>{b}</span>);
  });
}

function Editor({ file }) {
  const lines = CODE[file] || [];
  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--term-bg)', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', lineHeight: 1.65 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td style={{
                width: 46, textAlign: 'right', paddingRight: 14, color: '#484f58',
                userSelect: 'none', verticalAlign: 'top', background: 'var(--term-bg)',
              }}>{i + 1}</td>
              <td style={{ color: '#c9d1d9', whiteSpace: 'pre', paddingRight: 16 }}>{highlight(l)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Terminal({ ran }) {
  return (
    <div style={{
      height: 150, borderTop: '1px solid var(--term-border)', background: 'var(--term-surface)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem',
        borderBottom: '1px solid var(--term-border)', fontSize: '0.6875rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--term-text-muted)',
      }}>
        <Icon name="terminal" size={13} /> Output
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', textTransform: 'none', letterSpacing: 0 }}>
          {ran ? 'exit 0' : 'idle'}
        </span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0.65rem 0.9rem', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', lineHeight: 1.7, color: 'var(--term-text)' }}>
        {ran ? (
          <>
            <div style={{ color: 'var(--term-text-muted)' }}>$ gcc main.c -o main && ./main</div>
            <div>1 2 4 5 8</div>
            <div style={{ color: 'var(--color-success)' }}>Process exited with code 0 (34 ms)</div>
          </>
        ) : (
          <div style={{ color: 'var(--term-text-muted)' }}>Press Run Code to compile main.c.</div>
        )}
      </div>
    </div>
  );
}

function PracticeScreen({ go }) {
  const [file, setFile] = React.useState('main.c');
  const [open, setOpen] = React.useState(['main.c', 'helpers.h', 'input.txt']);
  const [ran, setRan] = React.useState(false);
  const [answers, setAnswers] = React.useState({ 1: 'B', 2: 'A' });

  const closeTab = (name) => {
    const next = open.filter(n => n !== name);
    setOpen(next);
    if (file === name && next.length) setFile(next[0]);
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--term-bg)',
      color: '#b1bac4', height: '100%', borderRadius: 'var(--radius-xl)', overflow: 'hidden',
      border: '1px solid var(--border-color)', margin: '0.5rem',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem',
        borderBottom: '1px solid var(--term-border)', minHeight: 52, flexShrink: 0,
      }}>
        <Button variant="ghost" size="sm" icon="arrow-left" onClick={() => go('library')}>Back</Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem', minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#e6edf3' }}>Bubble Sort</span>
          <Badge tone="primary">v2</Badge>
        </div>
        <div style={{ flex: 1, margin: '0 1rem', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--term-text-muted)' }}>
            <span>PROGRESS</span><span>14 / 18</span>
          </div>
          <div style={{ height: 4, background: 'rgba(51,65,85,0.6)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: '78%', height: '100%', background: 'linear-gradient(90deg,#22c55e,#86efac)', boxShadow: '0 0 8px rgba(34,197,94,0.5)', borderRadius: 99 }} />
          </div>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#e6edf3', fontVariantNumeric: 'tabular-nums' }}>24:31</span>
        <Button variant="secondary" size="sm" icon="save">Save</Button>
        <Button variant="primary" size="sm" icon="play" onClick={() => setRan(true)}>Run Code</Button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{
          width: 260, minWidth: 260, borderRight: '1px solid var(--term-border)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '0.75rem',
          gap: '0.75rem', background: 'var(--term-bg)',
        }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--term-text-muted)' }}>Questions</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))', gap: '0.5rem' }}>
            {Array.from({ length: 18 }, (_, i) => {
              const n = i + 1;
              const state = answers[n] ? 'answered' : (n <= 6 ? 'opened' : 'default');
              const isActive = n === 3;
              const color = state === 'answered' ? 'var(--color-success)' : state === 'opened' ? '#8b949e' : '#8b949e';
              return (
                <div key={n} style={{
                  aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.875rem',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  border: '2px solid ' + (isActive ? 'var(--color-primary)' : state === 'answered' ? 'var(--color-success)' : '#21262d'),
                  background: state === 'answered' ? 'rgba(16,185,129,0.1)' : 'var(--term-bg)',
                  color: isActive ? 'var(--color-primary)' : color,
                  boxShadow: isActive ? '0 0 0 3px #0d1117, 0 0 0 5px var(--color-primary)' : 'none',
                }}>{n}</div>
              );
            })}
          </div>
          <div style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--term-text-muted)', marginTop: '0.5rem' }}>Question 3</div>
          <div style={{ fontSize: '0.8125rem', color: '#c9d1d9', lineHeight: 1.55 }}>
            What is the worst-case time complexity of the inner loop above?
          </div>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {['A', 'B', 'C', 'D'].map(k => (
              <AnswerBubble key={k} state={answers[3] === k ? 'selected' : 'default'} onClick={() => setAnswers({ ...answers, 3: k })}>{k}</AnswerBubble>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            display: 'flex', alignItems: 'stretch', background: 'var(--term-bg)',
            borderBottom: '1px solid var(--term-border)', minHeight: 38, flexShrink: 0, overflowX: 'auto',
          }}>
            {open.map(n => (
              <FileTab key={n} name={n} active={file === n} dirty={n === 'main.c'} onClick={() => setFile(n)} onClose={() => closeTab(n)} />
            ))}
            <button style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, minWidth: 32,
              background: 'none', border: 'none', color: 'var(--term-text-muted)', cursor: 'pointer',
            }}><Icon name="plus" size={14} /></button>
          </div>
          <Editor file={file} />
          <Terminal ran={ran} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PracticeScreen });
})();
