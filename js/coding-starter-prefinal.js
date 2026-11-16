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

   THE REFERENCES ARE WRITTEN THE WAY THE TEACHER WRITES THEM -- memmove for
   every shift, an empty-body for loop to search, one return at the end --
   following tools/prefinal/teacher-style.c. The reference is the boss bar's
   target, so it should be the answer the course actually teaches.

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

function _cspProgram(p, parentId) {
  const src = (typeof CSPF_FILES !== 'undefined' && CSPF_FILES[p.id]) || { starter: '', code: '' };
  const tests = (typeof CSPF_TESTS !== 'undefined' && CSPF_TESTS[p.id]) || [];
  return {
    id: 'starter-' + p.id,
    title: p.title,
    parentId: parentId,
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

/* ── Alternatives ─────────────────────────────────────────────
   The same exam shape, V1 and V2 only, over every other operation an ADT
   List question can be built on -- in case the real paper is not a repeat.
   In four groups: inserting, deleting, searching/updating, and operations
   on the whole list (including the ones that hand back a NEW list, where V1
   and V2 genuinely differ). Sources: tools/prefinal/alternatives/. */
const CSP_ALTERNATIVES = [
  /* ── Inserting ── */
  {
    id: 'pfa-recent-calls',
    title: 'Recent Calls (ADT List V1: insertFirst())',
    description:
      'A phone keeps its 5 most recent calls, newest on top. The log is an ADT List using the array '
      + 'implementation, <strong>Version 1</strong> (<code>MAX</code> is 5).<br><br>'
      + '<strong>Implement <code>logCall()</code>.</strong> It receives a pointer to the list and the new '
      + '<code>Call</code>.<br>'
      + '1. If the log is full, forget the oldest call (the <strong>last</strong> one) first, to make room.<br>'
      + '2. Put the new call at the <strong>front</strong> (index 0).<br>'
      + '3. Return <code>1</code>, or <code>0</code> if a call had to be dropped.<br><br>'
      + '<code>loadEarlyCalls</code> logs the earlier calls through your function, oldest first.'
  },
  {
    id: 'pfa-playlist',
    title: 'Playlist Builder (ADT List V2: insertAt())',
    description:
      'A music app lets the listener drop a song into any spot of a playlist of up to 8 songs. The '
      + 'playlist is an ADT List using the array implementation, <strong>Version 2</strong>.<br><br>'
      + '<strong>Implement <code>insertSongAt()</code>.</strong> It receives the list, the '
      + '<code>Song</code>, and <code>pos</code>, the position the listener sees (the first song is '
      + 'position 1). In this order:<br>'
      + '1. If <code>pos</code> is not between 1 and count + 1, return <code>-1</code>.<br>'
      + '2. If the playlist is full, return <code>0</code>.<br>'
      + '3. Otherwise insert the song so it becomes song number <code>pos</code>, and return '
      + '<code>1</code>.<br><br>'
      + 'Position count + 1 is allowed: it means "at the end".'
  },
  {
    id: 'pfa-class-roster',
    title: 'Class Roster (ADT List V1: insertSorted())',
    description:
      'A class roster of up to 8 students is kept in alphabetical order of last name. Students with '
      + 'the same last name stay in the order they enrolled. The roster is an ADT List using the array '
      + 'implementation, <strong>Version 1</strong>.<br><br>'
      + '<strong>Implement <code>enrollStudent()</code>.</strong> It receives a pointer to the list and '
      + 'the <code>Student</code>.<br>'
      + '1. If the roster is full, return <code>-1</code>.<br>'
      + '2. Otherwise insert the student so last names stay in alphabetical order (compare them with '
      + '<code>strcmp</code>). A student goes <strong>after</strong> anyone with the same last name. '
      + 'Return the index the student was placed at.<br><br>'
      + '<code>loadEarlyEnrollees</code> enrolls the early students through your function too.'
  },
  {
    id: 'pfa-er-triage',
    title: 'ER Triage (ADT List V2: insertPrio())',
    description:
      'An emergency room sees patients by triage level: <code>CRITICAL</code> (1) first, then '
      + '<code>URGENT</code> (2), then <code>STANDARD</code> (3). Patients on the same level are seen '
      + 'in the order they arrived. The queue holds 8 and is an ADT List using the array '
      + 'implementation, <strong>Version 2</strong>.<br><br>'
      + '<strong>Implement <code>admitPatient()</code>.</strong> It receives the list and the arriving '
      + '<code>Patient</code>. In this order:<br>'
      + '1. If the level is not 1, 2 or 3, return <code>-1</code>.<br>'
      + '2. If the queue is full, return <code>0</code>.<br>'
      + '3. Otherwise insert the patient behind everyone on the same level or a more urgent one, and '
      + 'return their place in the queue (the first place is <code>1</code>).<br><br>'
      + 'This is insertPrio with three levels instead of two.'
  },
  {
    id: 'pfa-org-signup',
    title: 'Org Sign-up (ADT List V1: insertLastUnique())',
    description:
      'A student org takes up to 6 members, first come, first served, and nobody can sign up twice. '
      + 'The member list is an ADT List using the array implementation, <strong>Version 1</strong>.'
      + '<br><br>'
      + '<strong>Implement <code>signUp()</code>.</strong> It receives a pointer to the list and the '
      + '<code>Member</code>. In this order:<br>'
      + '1. If a member with the same ID number is already in the list, return <code>-1</code>.<br>'
      + '2. If the list is full, return <code>0</code>.<br>'
      + '3. Otherwise add the member at the <strong>end</strong> and return <code>1</code>.'
  },
  {
    id: 'pfa-bus-stops',
    title: 'Bus Route Stops (ADT List V2: insertAfter())',
    description:
      'A bus route is a list of up to 7 stops in the order the bus passes them. New stops are added '
      + 'right after an existing one. The route is an ADT List using the array implementation, '
      + '<strong>Version 2</strong>.<br><br>'
      + '<strong>Implement <code>addStopAfter()</code>.</strong> It receives the list, the new '
      + '<code>Stop</code>, and the code of the stop it goes after. In this order:<br>'
      + '1. If no stop has that code, return <code>-1</code>.<br>'
      + '2. If the route is full, return <code>0</code>.<br>'
      + '3. Otherwise insert the new stop directly after it, and return the new stop\'s number on the '
      + 'route (the first stop is <code>1</code>).'
  },

  /* ── Deleting ── */
  {
    id: 'pfa-print-queue',
    title: 'Print Queue (ADT List V2: deleteFirst())',
    description:
      'A shared printer prints jobs in the order they were sent. The queue is an ADT List using the '
      + 'array implementation, <strong>Version 2</strong>.<br><br>'
      + '<strong>Implement <code>printNext()</code>.</strong> It receives the list and returns a '
      + '<code>PrintJob</code>.<br>'
      + '• If the queue has jobs, remove the <strong>first</strong> one and return it. The rest move up '
      + 'and keep their order.<br>'
      + '• If the queue is empty, return a dummy job: owner <code>"NONE"</code>, document '
      + '<code>"NONE"</code>, <code>0</code> pages.'
  },
  {
    id: 'pfa-undo-history',
    title: 'Undo History (ADT List V1: deleteLast())',
    description:
      'A text editor records every edit, oldest first. Undo takes back the most recent ones. The '
      + 'history is an ADT List using the array implementation, <strong>Version 1</strong>.<br><br>'
      + '<strong>Implement <code>undoActions()</code>.</strong> It receives a pointer to the list and '
      + 'the number of steps to undo.<br>'
      + '• Remove edits from the <strong>end</strong> of the list, one per step, until the steps run '
      + 'out or the list is empty.<br>'
      + '• Return how many edits were actually undone. Zero or negative steps undo nothing.'
  },
  {
    id: 'pfa-valet-line',
    title: 'Valet Line (ADT List V1: deleteAt())',
    description:
      'A valet keeps the parked cars in a line. When an owner comes back, the car at their position '
      + 'leaves. The line is an ADT List using the array implementation, <strong>Version 1</strong>.'
      + '<br><br>'
      + '<strong>Implement <code>removeCarAt()</code>.</strong> It receives a pointer to the list, '
      + '<code>pos</code> (the first car is position 1), and a <code>Car*</code> to hand the removed '
      + 'car back through.<br>'
      + '1. If <code>pos</code> is not between 1 and count, change nothing and return <code>0</code>.<br>'
      + '2. Otherwise copy that car into <code>*removed</code>, remove it from the line (the cars '
      + 'behind it move up), and return <code>1</code>.'
  },
  {
    id: 'pfa-canteen-orders',
    title: 'Canteen Orders (ADT List V2: deleteElem())',
    description:
      'A canteen keeps pending orders oldest first. When a dish is ready, it goes to the oldest order '
      + 'for that dish. The orders are an ADT List using the array implementation, '
      + '<strong>Version 2</strong>.<br><br>'
      + '<strong>Implement <code>serveDish()</code>.</strong> It receives the list and a dish name, and '
      + 'returns an <code>Order</code>.<br>'
      + '• Find the <strong>first</strong> order whose dish matches exactly. Remove it from the list '
      + '(the others keep their order) and return it.<br>'
      + '• If no order has that dish, return a dummy: order number <code>0</code>, dish '
      + '<code>"NONE"</code>, customer <code>"NONE"</code>.'
  },
  {
    id: 'pfa-flight-cancel',
    title: 'Flight Cancellation (ADT List V1: deleteAllInstance())',
    description:
      'An airline counter has a check-in list for several flights. When a flight is cancelled, all of '
      + 'its passengers are taken off the list to be rebooked. The list is an ADT List using the array '
      + 'implementation, <strong>Version 1</strong>.<br><br>'
      + '<strong>Implement <code>cancelFlight()</code>.</strong> It receives a pointer to the list and '
      + 'a flight code.<br>'
      + '• Remove <strong>every</strong> passenger whose flight matches exactly. The others keep their '
      + 'order.<br>'
      + '• Return how many passengers were removed (<code>0</code> if none).<br><br>'
      + 'Two passengers of the same flight can be side by side.'
  },
  {
    id: 'pfa-attendance-taps',
    title: 'Attendance Taps (ADT List V2: removeDuplicates())',
    description:
      'An RFID gate logs every tap, and some students tap more than once. Only each student\'s '
      + '<strong>first</strong> tap should count. The log is an ADT List using the array implementation, '
      + '<strong>Version 2</strong>.<br><br>'
      + '<strong>Implement <code>removeDuplicateTaps()</code>.</strong> It receives the list.<br>'
      + '• Keep the first tap of each ID number and remove every later tap with the same ID.<br>'
      + '• The taps that stay keep their order.<br>'
      + '• Return how many taps were removed.'
  },
  {
    id: 'pfa-varsity-cut',
    title: 'Varsity Cut (ADT List V2: deleteIf())',
    description:
      'After tryouts, every athlete whose total score is below the cutoff is cut from the pool. The '
      + 'pool is an ADT List using the array implementation, <strong>Version 2</strong>.<br><br>'
      + '<strong>Implement <code>removeBelowCutoff()</code>.</strong> It receives the list and the '
      + 'cutoff.<br>'
      + '• Remove every athlete whose total (speed + agility + skill) is <strong>below</strong> the '
      + 'cutoff. A total equal to the cutoff stays.<br>'
      + '• The athletes who stay keep their order.<br>'
      + '• Return how many were removed.<br><br>'
      + 'This can be done in one pass, with no shifting at all.'
  },

  /* ── Searching and updating ── */
  {
    id: 'pfa-bookstore-shelf',
    title: 'Bookstore Shelf (ADT List V1: locate())',
    description:
      'A bookstore shelf has numbered slots, starting at 1. Customers ask for a book by ISBN. The shelf '
      + 'is an ADT List using the array implementation, <strong>Version 1</strong>.<br><br>'
      + '<strong>Implement <code>locateBook()</code>.</strong> It receives the list <strong>by '
      + 'value</strong> and an ISBN.<br>'
      + '• Return the <strong>slot number</strong> of the book whose ISBN matches exactly (the first '
      + 'slot is 1, not 0).<br>'
      + '• Return <code>0</code> if the book is not on the shelf.<br><br>'
      + 'The list comes in as <code>List L</code>, not a pointer, so its members are read with a dot.'
  },
  {
    id: 'pfa-registrar-lookup',
    title: 'Registrar Lookup (ADT List V2: retrieve())',
    description:
      'The registrar looks up a student record by ID number. The records are an ADT List using the '
      + 'array implementation, <strong>Version 2</strong>.<br><br>'
      + '<strong>Implement <code>findStudent()</code>.</strong> It receives the list and an ID number, '
      + 'and returns a <code>Student</code>.<br>'
      + '• If a record has exactly that ID, return a copy of it. The list does not change.<br>'
      + '• Otherwise return a dummy record: ID, first name, last name and course all '
      + '<code>"XXXX"</code>, year level <code>0</code>.'
  },
  {
    id: 'pfa-org-census',
    title: 'Org Census (ADT List V2: count())',
    description:
      'The org officers want head counts by course, and sometimes by year level too. The members are an '
      + 'ADT List using the array implementation, <strong>Version 2</strong>.<br><br>'
      + '<strong>Implement <code>countMembers()</code>.</strong> It receives the list, a course and a '
      + 'year.<br>'
      + '• Count the members whose course matches exactly.<br>'
      + '• If <code>year</code> is <code>0</code>, count every year level; otherwise count only '
      + 'members in that year.<br>'
      + '• Return the count. The list does not change.'
  },
  {
    id: 'pfa-top-seller',
    title: 'Top Seller (ADT List V1: findMax())',
    description:
      'A sales team ranks its agents by total sales over three months. The team is an ADT List using '
      + 'the array implementation, <strong>Version 1</strong>.<br><br>'
      + '<strong>Implement <code>findTopSeller()</code>.</strong> It receives the list <strong>by '
      + 'value</strong>.<br>'
      + '• Return the <strong>index</strong> of the agent with the highest total (jan + feb + mar).<br>'
      + '• If two agents tie for the highest, return the one that comes <strong>first</strong>.<br>'
      + '• Return <code>-1</code> if the list is empty.'
  },
  {
    id: 'pfa-store-stock',
    title: 'Store Stock (ADT List V1: update())',
    description:
      'A sari-sari store adjusts its stock after every delivery (a positive change) and every sale (a '
      + 'negative change). The inventory is an ADT List using the array implementation, '
      + '<strong>Version 1</strong>.<br><br>'
      + '<strong>Implement <code>adjustStock()</code>.</strong> It receives a pointer to the list, a '
      + 'product code and the change. In this order:<br>'
      + '1. If no product has that code exactly, return <code>-1</code>.<br>'
      + '2. If the change would make the stock go below zero, leave it unchanged and return '
      + '<code>-2</code>.<br>'
      + '3. Otherwise apply the change and return the product\'s index.'
  },
  {
    id: 'pfa-quiz-leaderboard',
    title: 'Quiz Bee Leaderboard (ADT List V2: update() + insertSorted())',
    description:
      'A quiz bee leaderboard is kept highest points first. A team that ties with others goes '
      + '<strong>behind</strong> the teams already on that score. The board is an ADT List using the '
      + 'array implementation, <strong>Version 2</strong>.<br><br>'
      + '<strong>Implement <code>addPoints()</code>.</strong> It receives the list, a team name and the '
      + 'points to add (which can be negative).<br>'
      + '1. If no team has that name exactly, return <code>-1</code>.<br>'
      + '2. Otherwise add the points and move the team to its correct place, so the board stays '
      + 'highest first. Return its new rank (the top is rank 1).<br><br>'
      + 'Changing the score can move the team up or down. Taking it out and putting it back in its '
      + 'sorted place handles both.'
  },
  {
    id: 'pfa-recent-apps',
    title: 'Recent Apps (ADT List V1: moveToFront())',
    description:
      'A phone\'s app switcher shows the most recently used app first. Opening an app moves it to the '
      + 'front. The switcher is an ADT List using the array implementation, <strong>Version 1</strong>.'
      + '<br><br>'
      + '<strong>Implement <code>openApp()</code>.</strong> It receives a pointer to the list and an app '
      + 'name.<br>'
      + '• If the app is in the list, move it to the <strong>front</strong>. The apps that were ahead '
      + 'of it each move back one; the ones behind it stay where they are. Return its old position '
      + '(the first is 1).<br>'
      + '• If the app is not in the list, change nothing and return <code>0</code>.'
  },

  /* ── The whole list ── */
  {
    id: 'pfa-bus-unloading',
    title: 'Bus Unloading (ADT List V1: reverse())',
    description:
      'A bus boards passengers from the front and unloads them in the opposite order. The passenger '
      + 'list is an ADT List using the array implementation, <strong>Version 1</strong>.<br><br>'
      + '<strong>Implement <code>reverseList()</code>.</strong> It receives a pointer to the list and '
      + 'reverses it <strong>in place</strong>: the last passenger becomes the first, and so on. No '
      + 'second list.'
  },
  {
    id: 'pfa-fun-run-results',
    title: 'Fun Run Results (ADT List V2: sort())',
    description:
      'Fun run times are typed in as the runners hand in their bibs, not in finishing order. The '
      + 'results are an ADT List using the array implementation, <strong>Version 2</strong>.<br><br>'
      + '<strong>Implement <code>sortByTime()</code>.</strong> It receives the list and sorts it '
      + '<strong>in place</strong>, fastest time first. Runners with the same time keep the order they '
      + 'were typed in.<br><br>'
      + '<code>toSeconds()</code> is provided: it turns a <code>Time</code> into a number of seconds '
      + 'you can compare.'
  },
  {
    id: 'pfa-graduating-split',
    title: 'Graduating Batch (ADT List V2: split into a new list)',
    description:
      'At the end of the year, the 4th-year students are moved out of the student list into a list of '
      + 'their own. Both are ADT Lists using the array implementation, <strong>Version 2</strong>.'
      + '<br><br>'
      + '<strong>Implement <code>extractGraduates()</code>.</strong> It receives the list and returns a '
      + '<strong>new</strong> <code>ListV2</code>.<br>'
      + '• Create the new list with <code>initListV2</code>. If that fails, return <code>NULL</code> '
      + 'and leave the student list alone.<br>'
      + '• Move every student with year level 4 into the new list, in their order.<br>'
      + '• Remove them from the original list; the students who stay keep their order.<br><br>'
      + 'In V2, a new list means new memory. <code>main</code> frees both lists.'
  },
  {
    id: 'pfa-course-roster',
    title: 'Course Roster (ADT List V1: filter into a new list)',
    description:
      'The department head asks for one course\'s roster without changing the master list. Both are '
      + 'ADT Lists using the array implementation, <strong>Version 1</strong>.<br><br>'
      + '<strong>Implement <code>getRoster()</code>.</strong> It receives the master list <strong>by '
      + 'value</strong> and a course, and returns a <strong>new</strong> <code>List</code>.<br>'
      + '• The new list holds every student whose course matches exactly, in master-list order.<br>'
      + '• The master list does not change.<br><br>'
      + 'In V1, a whole <code>List</code> can be returned by value. No <code>malloc</code> is needed.'
  },
  {
    id: 'pfa-clinic-merge',
    title: 'Clinic Schedules (ADT List V1: merge())',
    description:
      'Two clinic branches each keep their appointments sorted by time. The day\'s schedule merges '
      + 'them into one list, still sorted by time. All three are ADT Lists using the array '
      + 'implementation, <strong>Version 1</strong>.<br><br>'
      + '<strong>Implement <code>mergeSchedules()</code>.</strong> It receives both branch lists by '
      + 'value and returns a <strong>new</strong> <code>List</code>.<br>'
      + '• Earliest appointment first. Both lists are already sorted, so do not sort: walk them '
      + 'side by side.<br>'
      + '• When two appointments have the same time, the one from the first list goes first.<br><br>'
      + '<code>minutesOf()</code> is provided: it turns a <code>Time</code> into minutes after midnight.'
  },
  {
    id: 'pfa-subject-union',
    title: 'All Our Subjects (ADT List V1: union())',
    description:
      'Two friends combine their subject lists so they can plan a shared study schedule. All lists are '
      + 'ADT Lists using the array implementation, <strong>Version 1</strong>.<br><br>'
      + '<strong>Implement <code>unionSubjects()</code>.</strong> It receives both lists by value and '
      + 'returns a <strong>new</strong> <code>List</code>.<br>'
      + '• Every subject either student takes, each subject code only <strong>once</strong>.<br>'
      + '• First the first student\'s subjects in their order, then the second student\'s subjects '
      + 'that are not already in, in their order.<br><br>'
      + '<code>findSubject()</code> is provided: it returns a subject\'s index in a list, or '
      + '<code>-1</code>.'
  },
  {
    id: 'pfa-mutual-follows',
    title: 'Mutual Follows (ADT List V2: intersection())',
    description:
      'A social app shows two users the accounts they both follow. All lists are ADT Lists using the '
      + 'array implementation, <strong>Version 2</strong>.<br><br>'
      + '<strong>Implement <code>mutualFollows()</code>.</strong> It receives both lists and returns a '
      + '<strong>new</strong> <code>ListV2</code>.<br>'
      + '• Create the new list with <code>initListV2</code>, and return <code>NULL</code> if that '
      + 'fails.<br>'
      + '• It holds every account that is in <strong>both</strong> lists, in the first list\'s order, '
      + 'each handle only once.<br><br>'
      + '<code>findAccountV2()</code> is provided: it returns an account\'s index, or <code>-1</code>.'
  },
  {
    id: 'pfa-cart-backup',
    title: 'Cart Backup (ADT List V2: copy())',
    description:
      'Before a cashier edits a customer\'s cart, the system keeps a backup copy of it. The cart is an '
      + 'ADT List using the array implementation, <strong>Version 2</strong>.<br><br>'
      + '<strong>Implement <code>copyCart()</code>.</strong> It receives the list and returns a '
      + '<strong>new</strong>, separate <code>ListV2</code> with the same items in the same order. '
      + 'Return <code>NULL</code> if there is no memory.<br><br>'
      + 'After the copy, items are removed from the cart only. The backup must not change. In V2, '
      + '<code>backup = cart</code> would copy the pointer, not the list.'
  },
  {
    id: 'pfa-queue-reset',
    title: 'End-of-Day Reset (ADT List V1: makeNull())',
    description:
      'At closing time a bank clears its ticket queue so the next morning starts fresh. The queue is an '
      + 'ADT List using the array implementation, <strong>Version 1</strong>.<br><br>'
      + '<strong>Implement <code>makeNull()</code>.</strong> It receives a pointer to the list, empties '
      + 'it, and returns how many tickets it held.<br><br>'
      + 'The same list is reused the next morning, so it must accept new tickets again.'
  }
];

function codingStarterPreFinal() {
  return {
    nodes: [
      { id: 'starter-folder-prefinal', type: 'folder', name: 'Pre-Final',
        parentId: null, scope: 'challenge', order: 1 },
      { id: 'starter-folder-prefinal-alt', type: 'folder', name: 'Alternatives',
        parentId: 'starter-folder-prefinal', scope: 'challenge', order: 0 }
    ],
    challenges: CSP_PROGRAMS.map(p => _cspProgram(p, 'starter-folder-prefinal'))
      .concat(CSP_ALTERNATIVES.map(p => _cspProgram(p, 'starter-folder-prefinal-alt')))
  };
}
