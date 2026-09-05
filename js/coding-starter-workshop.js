/* ============================================================
   CODING-STARTER-WORKSHOP.JS — the coursework shape, three times
   ------------------------------------------------------------
   Everything else in the pack is "write this program". These are not: you are
   handed a header, a driver that already works, utility functions someone
   else wrote, and ONE file with a stub in it. The exercise is to fill the
   stub in so the driver's output matches.

   That is the shape real coursework has, and it exercises something the other
   folders cannot -- reading code you did not write well enough to add to it.
   The driver is not yours to change; if the output is wrong, the stub is
   wrong.

   THE THREE ARE DELIBERATELY THE SAME PROBLEM AT THREE DEPTHS:

     RSVP       delete from an ARRAY list, and shift to close the gap
     Lobby      delete from a LINKED list, and relink to close the gap --
                the same task where there is no shifting, only pointers, and
                where deleting consecutive nodes catches everyone
     Flights    walk a linked list, COUNT the matches, then allocate exactly
                that much and fill it -- the count-then-allocate pattern

   Every expected output here was produced by compiling the reference and
   running it, not by transcribing a handout: see
   coding-starter-workshop-files.js.
   ============================================================ */

/** A handout-shaped program: several given files and one to fill in. */
function _cswProgram(id, title, description, folder) {
  const files = (typeof CSW_FILES !== 'undefined' && CSW_FILES[id]) || [];
  const tests = (typeof CSW_TESTS !== 'undefined' && CSW_TESTS[id]) || [];
  /* The file with a stub is the one being marked, and it goes first so the
     editor opens on the thing you are meant to write. */
  const ordered = files.slice().sort((a, b) => {
    const aStub = a.starterCode !== a.code ? 0 : 1;
    const bStub = b.starterCode !== b.code ? 0 : 1;
    return aStub - bStub;
  });
  const first = ordered[0] || { starterCode: '', code: '' };

  return {
    id: 'starter-' + id,
    title: title,
    parentId: 'starter-folder-' + folder,
    description: description,
    createdAt: 1700000000000,
    variants: [{
      id: 'starter-' + id + '-v1',
      name: 'C',
      description: '',
      starterCode: first.starterCode,
      code: first.code,
      activeFileIndex: 0,
      /* Everything you were GIVEN is locked. The stub is the one file whose
         starter differs from its reference, and it is the only one you can
         type in -- which is the exercise stated in the tab bar rather than in
         a paragraph someone has to read. */
      files: ordered.map((f, i) => ({
        id: 'starter-' + id + '-f' + (i + 1),
        name: f.name, ext: f.ext,
        starterCode: f.starterCode, code: f.code,
        locked: f.starterCode === f.code
      })),
      samples: [],
      tests: tests,
      minRequirements: []
    }]
  };
}

function codingStarterWorkshops() {
  const nodes = [
    /* A sub-folder of Lists, not a tier of its own. All three are list
       exercises, and they are MET as a practice set -- see the workshops set
       in coding-starter.js -- so they do not need a top-level slot as well. */
    { id: 'starter-folder-ws', type: 'folder', name: 'B · Workshops', parentId: 'starter-folder-8', scope: 'challenge', order: 1 }
  ];

  const challenges = [

    _cswProgram('ws-rsvp', 'Workshop · RSVP and waitlist',
      'A workshop registration system holds two <code>ArrayList</code>s: the registered participants and '
      + 'a waitlist. <code>listUtils.h</code> defines the structures, and <code>initList</code>, '
      + '<code>findParticipant</code>, <code>appendItem</code>, <code>displayList</code> and '
      + '<code>signUp</code> are written for you.<br><br>'
      + '<strong>Fill in two functions in <code>cancel.c</code>.</strong><br><br>'
      + '<code>bool removeAt(ArrayList *list, int index)</code> — delete the element at <code>index</code> '
      + 'and shift everything after it one place left. Return <code>true</code>, or <code>false</code> if '
      + 'the index is out of bounds.<br><br>'
      + '<code>void cancel(ArrayList *regList, ArrayList *waitList, const char *name)</code>:<br>'
      + '• Search the registered list first. If found, remove them, print '
      + '<code>"%s removed from registered list.\\n"</code>, and then promote the FIRST person on the '
      + 'waitlist (if there is one) into the registered list, printing '
      + '<code>"%s promoted from waitlist to registered.\\n"</code>.<br>'
      + '• Otherwise search the waitlist. If found, remove them and print '
      + '<code>"%s removed from waitlist.\\n"</code>.<br>'
      + '• If in neither, print <code>"Error: %s is not registered or waitlisted.\\n"</code>.<br><br>'
      + 'Call the provided utilities freely — <code>findParticipant</code> and <code>appendItem</code> '
      + 'especially. <code>MAX</code> is 5 and every name is unique.<br><br>'
      + '<em>The driver reads a test number 1-5 on stdin and runs that scenario.</em>',
      'ws'),

    _cswProgram('ws-lobby', 'Workshop · Gaming server cleanup',
      'A game lobby keeps its active players in a LINKED LIST. Players whose ping is too high lag the '
      + 'whole lobby and must be disconnected.<br><br>'
      + '<strong>Implement <code>kickLaggers(PlayerList* server, int maxPing)</code></strong> in the '
      + 'student area at the bottom of <code>main.c</code>.<br><br>'
      + '• Walk the list. A player whose ping is STRICTLY greater than <code>maxPing</code> is removed '
      + 'from the list and their node <code>free</code>d.<br>'
      + '• Print exactly <code>"Kicked: %s (Ping: %d)\\n"</code> for each one.<br>'
      + '• Removing several in a row must not skip anyone — the classic bug here is advancing off a node '
      + 'you just freed, or stepping past the node that moved up into its place.<br><br>'
      + '<strong>Single Entry, Single Exit.</strong> No early <code>return</code>, no <code>break</code>. '
      + 'The way through is to keep hold of the next node BEFORE freeing the current one, and to track '
      + 'the previous node so you can relink around a deletion.<br><br>'
      + 'Input is the ping threshold, then a count, then that many lines of '
      + '<code>ID username ping</code>.',
      'ws'),

    _cswProgram('ws-flights', 'Workshop · Flight connections on a budget',
      'A flight network is a single linked list of <code>FlightNode</code>, each holding a source hub, a '
      + 'destination hub, a cost and a <code>next</code> pointer.<br><br>'
      + '<strong>Implement <code>findBudgetFlights</code></strong> in <code>flightSearch.c</code>:<br><br>'
      + '<code>FlightSearchResult findBudgetFlights(FlightNode **network, int totalHubs, int sourceHub, '
      + 'int destHub, int maxBudget)</code><br><br>'
      + '• Validate everything first — NULL network, negative or out-of-range hub ids, a negative '
      + 'budget. Any of those returns a result with <code>count</code> 0 and <code>flights</code> NULL.<br>'
      + '• Walk the whole list and COUNT the flights from <code>sourceHub</code> to <code>destHub</code> '
      + 'costing at or below <code>maxBudget</code>.<br>'
      + '• If none, return the empty result.<br>'
      + '• Otherwise <code>malloc</code> an array of exactly that many <code>FlightNode *</code>, walk '
      + 'the list a second time to fill it, and return it.<br><br>'
      + 'Do not modify or copy the nodes — store POINTERS to the ones already there. '
      + '<code>totalHubs</code> is only for validation, and the driver frees the array you return.<br><br>'
      + 'This is the count-then-allocate pattern: you cannot size the array until you know how many '
      + 'matches there are, so you walk the list twice rather than guessing or growing.',
      'ws')
  ];

  return { challenges: challenges, nodes: nodes };
}
