/* ============================================================
   CODING-STARTER-PREFINAL.JS — the Pre-Final problems, as given
   ------------------------------------------------------------
   The exam's own problems, each with the starter code you meet in the exam:
   the structs, the driver, the input and display functions are written, and
   ONE function is left empty. The exercise is that function.

   One file each (main.c), with the starter locked (variant.lockStarter):
   the given code cannot be typed over, so the only place your work can go is
   the empty function -- and any helper you add on lines of your own.

   THE SOURCES ARE NOT HERE. They are real C files in tools/prefinal/<id>/,
   and tools/build-prefinal.js compiles each reference with gcc, runs every
   test and writes coding-starter-prefinal-files.js (CSPF_FILES, CSPF_TESTS).
   Every expected output is what the reference printed, never typed out.

   ADDING ONE: a folder in tools/prefinal/ (starter.c, answer.c, tests.json),
   `node tools/build-prefinal.js`, then an entry in CSP_PROGRAMS below, in
   the order the exam numbers them. Then `node tools/verify-pack.js .`.
   ============================================================ */

/* The first three tests are the exam's three sample outputs, so they become
   the samples, shown as the program's stdin and what it prints. */
function _cspSamples(tests) {
  return (tests || []).slice(0, 3).map((t, i) => ({
    title: 'Sample ' + (i + 1),
    content: 'Input:\n' + String(t.stdin || '').replace(/\s+$/, '') + '\n'
           + 'Output:\n' + String(t.expected || '').replace(/\s+$/, '')
  }));
}

function _cspProgram(p) {
  const src = (typeof CSPF_FILES !== 'undefined' && CSPF_FILES[p.id]) || { starter: '', code: '' };
  const tests = (typeof CSPF_TESTS !== 'undefined' && CSPF_TESTS[p.id]) || [];
  return {
    id: 'starter-' + p.id,
    title: p.title,
    parentId: 'starter-folder-prefinal',
    description: p.description,
    createdAt: 1700000000000,
    variants: [{
      id: 'starter-' + p.id + '-v1',
      name: 'C',
      description: '',
      starterCode: src.starter,
      code: src.code,
      activeFileIndex: 0,
      lockStarter: true,
      files: [{ id: 'starter-' + p.id + '-f1', name: 'main', ext: '.c',
                starterCode: src.starter, code: src.code }],
      samples: _cspSamples(tests),
      tests: tests,
      /* Only what the task cannot be done without -- verify-pack checks
         each one against the reference. */
      minRequirements: ['loop', 'pointer'].map(t => ({ type: t }))
    }]
  };
}

const CSP_PROGRAMS = [
  {
    id: 'pf-concert-gate',
    title: 'Concert Gate Queue (ADT List V1: insertPrio())',
    description:
      'Fans are lining up at the SM Seaside Arena gate for tonight\'s concert. The gate line has room '
      + 'for 10 fans. VIP ticket holders enter ahead of everyone with a Regular ticket, but among '
      + 'themselves VIPs are still served in the order they arrived. Each ticket can be scanned only '
      + 'once. The line is an ADT List using the array implementation, <strong>Version 1</strong>.<br><br>'
      + '<strong>Implement <code>queueFan()</code>.</strong> It receives a pointer to the list and the '
      + 'arriving <code>Fan</code>. Each Fan holds a <code>FullName</code> (first and last name) and a '
      + '<code>Ticket</code> (code and type). In this order:<br>'
      + '1. If a fan with the same ticket code is already in line, do not add the fan, and return '
      + '<code>-1</code>.<br>'
      + '2. If the line is full, do not add the fan, and return <code>0</code>.<br>'
      + '3. Otherwise: a VIP goes directly behind the last VIP already in line, ahead of every Regular '
      + 'fan; a Regular fan goes at the end of the line. Return <code>1</code>.<br><br>'
      + '<code>loadEarlyFans</code> puts the first fans in line through your <code>queueFan</code> too, '
      + 'so the starting line is only right once your function is.'
  },
  {
    id: 'pf-library-returns',
    title: 'Library Book Returns (ADT List V2: deleteAllInstance())',
    description:
      'The university library tracks every book currently on loan. Each loan record holds the '
      + 'borrower\'s details and the book\'s details. When students come to the counter to return '
      + 'their books, the librarian clears all of that borrower\'s loans in one step. The loans are an '
      + 'ADT List using the array implementation, <strong>Version 2</strong>.<br><br>'
      + '<strong>Implement <code>returnAllBooks()</code>.</strong> It receives the list and a borrower '
      + 'ID.<br>'
      + '• Remove every loan whose borrower ID matches exactly, shifting the remaining loans up to fill '
      + 'each gap and decreasing the count.<br>'
      + '• The other loans keep their original order.<br>'
      + '• Return the number of loans removed, or <code>0</code> if the borrower has no active loans.'
      + '<br><br>'
      + 'Two of a borrower\'s loans can sit side by side: after a shift, the loan that moved into the '
      + 'gap has not been checked yet.'
  },
  {
    id: 'pf-phone-repair',
    title: 'Phone Repair Tracker (ADT List V2: update())',
    description:
      'A gadget repair shop tracks every phone left for repair. Each job record holds the customer\'s '
      + 'details, the device\'s details, and the job\'s current status. A job always moves through the '
      + 'same stages in order: RECEIVED, then REPAIRING, then READY, then CLAIMED. When a technician '
      + 'updates a job, the system must find it and change its status, but only if the change follows '
      + 'the proper order. The jobs are an ADT List using the array implementation, '
      + '<strong>Version 2</strong>.<br><br>'
      + '<strong>Implement <code>updateJobStatus()</code>.</strong> It receives the list, a job ID and '
      + 'the new status. The four statuses are the constants <code>RECEIVED</code> (0), '
      + '<code>REPAIRING</code> (1), <code>READY</code> (2) and <code>CLAIMED</code> (3).<br>'
      + '1. Search for the job whose ID matches exactly. If no job has that ID, return '
      + '<code>-1</code>.<br>'
      + '2. A job may only move <strong>forward one step at a time</strong>, and never past '
      + '<code>CLAIMED</code>. If the new status breaks this rule, leave the job unchanged and return '
      + '<code>-2</code>.<br>'
      + '3. Otherwise, update the job\'s status <strong>in the list</strong> and return the job\'s '
      + 'index.'
  },
  {
    id: 'pf-scholarship',
    title: 'Scholarship Shortlist (ADT List V3: insertSorted())',
    description:
      'The university\'s scholarship office interviews applicants for its merit scholarship. There are '
      + 'only a limited number of interview slots, set by the office for each round and given out '
      + 'first-come, first-served. Applicants on the shortlist are interviewed in order of their total '
      + 'entrance exam score, highest first, and applicants with the same total keep the order in which '
      + 'they applied. The shortlist is an ADT List using the array implementation, '
      + '<strong>Version 3</strong>, and its size is the number of interview slots.<br><br>'
      + '<strong>Implement <code>addApplicant()</code>.</strong> It receives a pointer to the list and '
      + 'the <code>Applicant</code> to add. An Applicant holds a <code>StudentInfo</code> '
      + '(<code>idNo</code>, <code>name</code>) and a <code>Scores</code> struct (<code>math</code>, '
      + '<code>science</code>, <code>english</code>). In this order:<br>'
      + '1. If an applicant with the same ID number is already on the shortlist, do not add them, and '
      + 'return <code>-1</code>.<br>'
      + '2. If the shortlist is full (<code>count</code> has reached <code>arrSize</code>), do not add '
      + 'them, and return <code>0</code>.<br>'
      + '3. Otherwise, insert the applicant in order of total score (math + science + english), highest '
      + 'first. The applicant goes <strong>after</strong> anyone with the same total. Return '
      + '<code>1</code>.'
  }
];

function codingStarterPreFinal() {
  return {
    nodes: [{ id: 'starter-folder-prefinal', type: 'folder', name: 'Pre-Final',
              parentId: null, scope: 'challenge', order: 1 }],
    challenges: CSP_PROGRAMS.map(_cspProgram)
  };
}
