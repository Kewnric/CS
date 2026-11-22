/* ============================================================
   IO.JS — Import / Export Handlers
   ============================================================ */

const IO_READS_PACKED_CS = true;   // the cheat sheets may be stored compressed (store-codec.js)
const IO_HAS_TRAINING = true;      // exports, imports and resets the fields in train-store.js

function handleDataExport() {
  const data = {
    // New tree system
    nodes: state.nodes,
    expandedNodes: state.expandedNodes,
    // Legacy (backward compat)
    categories: getNodeNamesForScope('challenge'),
    snippetCategories: getNodeNamesForScope('snippet'),
    notebookCategories: getNodeNamesForScope('notebook'),
    // Existing
    categoryRequirements: state.categoryRequirements,
    snippetProgress: state.snippetProgress,
    badges: state.badges,
    snippets: state.snippets,
    notebooks: state.notebooks,
    notebookHistory: state.notebookHistory,
    snippetHistory: state.snippetHistory || [],
    challenges: state.challenges,
    codingSets: state.codingSets || [],
    history: state.history,
    activeAttempts: state.activeAttempts,
    review: state.review || {},
    deadlines: state.deadlines || {},
    events: state.events || [],
    langWords: state.langWords || [],
    langSets: state.langSets || [],
    langScenarios: state.langScenarios || [],
    langHistory: state.langHistory || [],
    typeItems: state.typeItems || [],
    typeHistory: state.typeHistory || [],
    wings: state.wings || {},
    /* THE PARKED LIBRARY AND THE MISTAKE LOG. Both are saved and both are
       synced, and neither was in a backup. codingStash is whatever the
       starter-pack switch put aside -- for someone whose own programs are
       parked, that is their entire library, and an export taken before a
       reset or a move to a new device silently did not contain it. */
    codingPackLayout: state.codingPackLayout || 0,
    langRun: state.langRun || null,
    codingStash: state.codingStash || null,
    mistakes: Array.isArray(state.mistakes) ? state.mistakes : [],
    // Freeground, templates, training, Codex (js/train-store.js).
    ...(typeof trainFieldsWrite === 'function' ? trainFieldsWrite() : {})
  };
  // The cheat sheets live in their own localStorage key rather than in
  // `state`, which is exactly why they were missing from every backup taken
  // so far. They are a library on the Library board like any other.
  try {
    const ck = typeof getCheatStorageKey === 'function' ? getCheatStorageKey() : 'cheatsheetLibrary';
    const cheats = JSON.parse((typeof storeDecode === 'function' ? storeDecode(localStorage.getItem(ck)) : localStorage.getItem(ck)));
    if (cheats && cheats.sheets) data.cheatsheets = cheats.sheets;
  } catch (e) { /* nothing saved yet */ }
  if (typeof viz !== 'undefined') {
    data.viz = { nodes: viz.nodes, links: viz.links, pan: viz.pan, zoom: viz.zoom, fogEnabled: viz.fogEnabled, panesSwapped: viz.panesSwapped, tabsCollapsed: viz.tabsCollapsed, toolbarCollapsed: viz.toolbarCollapsed, flowyDragEnabled: viz.flowyDragEnabled, globeModeEnabled: viz.globeModeEnabled, snapEnabled: viz.snapEnabled, defaultLinkArrowType: viz.defaultLinkArrowType };
  }
  if (typeof brain !== 'undefined') {
    data.brain = { versions: brain.versions, folders: brain.folders, activeVersionId: brain.activeVersionId };
  }
  if (typeof questState !== 'undefined') {
    data.quests = { quests: questState.quests, player: questState.player, lastLoginDate: questState.lastLoginDate };
  }
  const finish = (json) => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code_platform_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMessage("Export Complete", "Your data has been downloaded as a JSON backup file.");
  };
  /* Covers and other pictures are saved as references to the picture store
     (js/media-store.js), which only this device has. The backup gets the
     pictures themselves, so it is complete on its own. */
  const json = JSON.stringify(data);
  if (typeof mediaInlineText === 'function' && json.indexOf('media:') !== -1) {
    mediaInlineText(json).then(finish, (err) => {
      console.warn('[Export] Pictures could not be added; exporting without them.', err);
      finish(json);
    });
  } else {
    finish(json);
  }
}

function handleDataImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.name.endsWith('.json') && file.type !== 'application/json') {
    showMessage("Error", "Please select a valid .json backup file.", true);
    e.target.value = '';
    return;
  }

  showConfirm("Import Data", "This will overwrite all your current data (folders, challenges, snippets, history, badges). Are you sure?", () => {
    // Show loading state
    const importLabel = document.querySelector('label[for="import-input"], label .sidebar-label');
    const exportBtn = document.getElementById('export-btn-sidebar');
    if (exportBtn) exportBtn.disabled = true;

    const reader = new FileReader();

    reader.onerror = () => {
      if (exportBtn) exportBtn.disabled = false;
      showMessage("Error", "Failed to read the file. Please try again.", true);
    };

    reader.onload = async (event) => {
      try {
        let parsed;
        try {
          parsed = JSON.parse(event.target.result);
        } catch (parseErr) {
          showMessage("Error", `Could not parse the file — it may be corrupted or not a valid JSON backup.\n\nDetails: ${parseErr.message}`, true);
          if (exportBtn) exportBtn.disabled = false;
          return;
        }

        if (!parsed || typeof parsed !== 'object') {
          showMessage("Error", "Invalid backup file format.", true);
          if (exportBtn) exportBtn.disabled = false;
          return;
        }

        if (!parsed.challenges || !Array.isArray(parsed.challenges)) {
          showMessage("Error", "Invalid backup file: missing or malformed 'challenges' field. This may not be a StudySession Pro backup.", true);
          if (exportBtn) exportBtn.disabled = false;
          return;
        }
        if ((parsed.snippets && !Array.isArray(parsed.snippets)) ||
            (parsed.notebooks && !Array.isArray(parsed.notebooks)) ||
            (parsed.history && !Array.isArray(parsed.history)) ||
            (parsed.badges && !Array.isArray(parsed.badges)) ||
            (parsed.nodes && !Array.isArray(parsed.nodes))) {
          showMessage("Error", "Invalid backup file: one or more fields have unexpected types. The file may be corrupted.", true);
          if (exportBtn) exportBtn.disabled = false;
          return;
        }

        /* Pictures in the backup go to the picture store before anything is
           written, so a backup with many of them still fits the 5 MB of saved
           data (js/media-store.js). On any failure they simply stay inline. */
        if (typeof mediaAbsorbBackup === 'function') {
          try { await mediaAbsorbBackup(parsed); } catch (err) { console.warn('[Import] Pictures stay inside the save:', err); }
        }

        /* The state below replaces whatever could not be read, so this is the
           point at which writing is safe again. Before it, saveData is a no-op
           -- see _loadFailed -- and the import would appear to work and then be
           gone on the next load. */
        if (typeof allowSavingAgain === 'function') allowSavingAgain();

        state.challenges = migrateLegacyData(parsed.challenges);
        state.codingSets = parsed.codingSets || [];
        state.snippets = parsed.snippets || [];
        state.notebooks = parsed.notebooks || [];
        state.categoryRequirements = parsed.categoryRequirements || {};
        state.snippetProgress = parsed.snippetProgress || {};
        state.badges = parsed.badges || [];
        state.notebookHistory = parsed.notebookHistory || [];
        state.snippetHistory = parsed.snippetHistory || [];
        state.history = parsed.history || [];
        state.activeAttempts = parsed.activeAttempts || {};
        state.review = parsed.review || {};
        state.deadlines = parsed.deadlines || {};
        state.events = parsed.events || [];
        state.langWords = parsed.langWords || [];
        state.langSets = parsed.langSets || [];
        state.langScenarios = parsed.langScenarios || [];
        state.langHistory = parsed.langHistory || [];
        // Kept when the backup predates the typing library, by the rule below.
        state.typeItems = Array.isArray(parsed.typeItems) ? parsed.typeItems : (state.typeItems || []);
        state.typeHistory = Array.isArray(parsed.typeHistory) ? parsed.typeHistory : (state.typeHistory || []);
        state.wings = (parsed.wings && typeof parsed.wings === 'object') ? parsed.wings : {};
        /* Kept rather than cleared when the backup predates the field. An
           import replaces your data, but a file written before the parked
           library was ever recorded says nothing about it -- reading that
           silence as "delete it" would throw away a whole library the backup
           never claimed to replace. Same rule the cloud load uses. */
        /* Defaulted to 0 rather than preserved: a backup without the stamp means
           the layout was never checked against this build, and letting the
           migration run once on import is exactly right. */
        state.codingPackLayout = parsed.codingPackLayout || 0;
        state.langRun = parsed.langRun || null;
        state.codingStash = parsed.codingStash || state.codingStash || null;
        state.mistakes = Array.isArray(parsed.mistakes) ? parsed.mistakes
          : (Array.isArray(state.mistakes) ? state.mistakes : []);
        // Same rule: a backup from before these sections keeps what you have.
        if (typeof trainFieldsRead === 'function') trainFieldsRead(parsed, { keepMissing: true });

        if (parsed.nodes && parsed.nodes.length > 0) {
          state.nodes = parsed.nodes;
          state.expandedNodes = parsed.expandedNodes || [];
        } else {
          state.categories = parsed.categories || ['Basics'];
          state.snippetCategories = parsed.snippetCategories || [];
          state.notebookCategories = parsed.notebookCategories || ['General'];
          state.nodes = migrateCategoriesToNodes(parsed);
          state.expandedNodes = [];
        }

        saveData();

        if (Array.isArray(parsed.cheatsheets)) {
          try {
            localStorage.setItem(typeof getCheatStorageKey === 'function' ? getCheatStorageKey() : 'cheatsheetLibrary', JSON.stringify({ sheets: parsed.cheatsheets }));
            if (typeof csLoad === 'function') csLoad();
          } catch (e) { /* storage full — the reload below will show what landed */ }
        }
        if (parsed.viz && typeof viz !== 'undefined') {
          viz.nodes = parsed.viz.nodes || []; viz.links = parsed.viz.links || [];
          viz.pan = parsed.viz.pan || { x: 0, y: 0 }; viz.zoom = parsed.viz.zoom || 1;
          viz.fogEnabled = !!parsed.viz.fogEnabled; viz.panesSwapped = !!parsed.viz.panesSwapped;
          viz.tabsCollapsed = !!parsed.viz.tabsCollapsed; viz.toolbarCollapsed = !!parsed.viz.toolbarCollapsed;
          viz.flowyDragEnabled = !!parsed.viz.flowyDragEnabled; viz.globeModeEnabled = !!parsed.viz.globeModeEnabled;
          viz.snapEnabled = !!parsed.viz.snapEnabled;
          if (parsed.viz.defaultLinkArrowType !== undefined) viz.defaultLinkArrowType = parsed.viz.defaultLinkArrowType;
          if (typeof vizSave === 'function') vizSave();
        }
        if (parsed.brain && typeof brain !== 'undefined') {
          brain.versions = parsed.brain.versions || []; brain.folders = parsed.brain.folders || [];
          brain.activeVersionId = parsed.brain.activeVersionId || null;
          if (typeof brainSave === 'function') brainSave();
        }
        if (parsed.quests && typeof questState !== 'undefined') {
          questState.quests = (typeof migrateQuest === 'function')
            ? (parsed.quests.quests || []).map(migrateQuest) : (parsed.quests.quests || []);
          if (parsed.quests.player) questState.player = parsed.quests.player;
          if (parsed.quests.lastLoginDate) questState.lastLoginDate = parsed.quests.lastLoginDate;
          if (typeof saveQuestData === 'function') saveQuestData();
        }

        if (exportBtn) exportBtn.disabled = false;
        showMessage("Success", `Data imported successfully — ${state.challenges.length} programs, ${state.snippets.length} snippets, ${state.notebooks.length} notebooks loaded. The page will now reload.`);
        setTimeout(() => { window.location.hash = '#/home'; window.location.reload(); }, 1400);
      } catch (err) {
        console.error('[Import] Unexpected error:', err);
        if (exportBtn) exportBtn.disabled = false;
        showMessage("Error", `Import failed unexpectedly: ${err.message || String(err)}`, true);
      }
    };

    reader.readAsText(file);
  });

  e.target.value = '';
}

function handleDataReset() {
  showConfirm("Reset All Data", "⚠️ This will permanently delete ALL your programs, snippets, notebooks, and history. This cannot be undone.\n\nAre you sure you want to continue?", () => {
    showConfirm("Final Confirmation", "🚨 Last chance — are you absolutely certain? All data will be replaced with defaults and CANNOT be recovered.", () => {
      /* RESET EMPTIES THE PROFILE IN THIS TAB, AND NO OTHER. Guest and the
         signed-in account keep their canvas, brain, quest board and cheat
         sheets in keys of their own (Guest's plain, the account's *_online).
         This used to remove both sets by name: resetting a cloud account
         deleted Guest's visualization -- and the picture clean-up below,
         finding nothing that used them any more, deleted Guest's pictures --
         and resetting Guest emptied the account's device copy while
         ssp.cloudCopy still vouched for it, so the next sign-in opened without
         them and saved that to the cloud. The keys now come from the tab's
         mode (constants.js), and only while it agrees with the mode the app
         runs in: a tab not told it is online would name Guest's keys. */
      const mode = typeof storageMode !== 'undefined' ? storageMode : null;
      let tabMode = null;
      try { tabMode = sessionStorage.getItem('storageMode'); } catch (e) { /* blocked: refused below */ }
      if (!mode || mode !== tabMode) {
        showMessage("Nothing Was Reset", "This tab could not tell which profile it is in, so nothing was deleted. Reload the page and try again.", true);
        return;
      }
      const online = mode === 'online';
      const uid = online && typeof currentFirebaseUser !== 'undefined' && currentFirebaseUser ? currentFirebaseUser.uid : null;

      /* Memory first: every field this profile owns, the canvas, brain, quests
         and sheets included (they live outside `state`). Left as they were,
         the cloud save below uploaded them again and the reset never reached
         the account's cloud. */
      if (typeof _flushAllInMemoryDomains === 'function') _flushAllInMemoryDomains();

      // Build the canonical default seed (shared with first-time boot)
      const seed = buildDefaultSeed();

      state = {
        view: 'browse',
        categories: getNodeNamesForScopeFromNodes(seed.nodes, 'challenge'),
        snippetCategories: getNodeNamesForScopeFromNodes(seed.nodes, 'snippet'),
        notebookCategories: getNodeNamesForScopeFromNodes(seed.nodes, 'notebook'),
        nodes: seed.nodes,
        expandedNodes: seed.expandedNodes,
        activeNodeId: null,
        categoryRequirements: seed.categoryRequirements,
        snippetProgress: seed.snippetProgress,
        badges: seed.badges,
        snippets: seed.snippets,
        notebooks: seed.notebooks,
        notebookHistory: seed.notebookHistory,
        snippetHistory: [],
        challenges: seed.challenges,
        codingSets: [],
        history: seed.history,
        activeAttempts: seed.activeAttempts,
        review: seed.review || {},
        deadlines: {},
        events: [],
        langWords: [],
        langSets: [],
        langScenarios: [],
        langHistory: [],
        typeItems: [],
        typeHistory: [],
        wings: {},
        // Named rather than left out, so a reset states what it clears.
        codingPackLayout: 0,
        langRun: null,
        codingStash: null,
        mistakes: [],
        activeChallenge: null,
        activeVariant: null,
        userCode: '',
        sessionData: null,
        timeLimit: 0,
        lastDiffs: []
      };
      if (typeof trainFieldsReset === 'function') trainFieldsReset();

      // This profile's canvas, brain, quest board and cheat sheets; the other profiles' stay.
      const ownKeys = [getVizStorageKey(), getBrainStorageKey(), getQuestStorageKey(), getCheatStorageKey()];
      // Guest's boards from before v3, which loadQuestData still reads for Guest.
      if (!online) ownKeys.push('questBoardData_v2', 'questBoardData');
      ownKeys.forEach(key => localStorage.removeItem(key));
      localStorage.removeItem('sidebarExpanded');
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('tutorial_done_')) localStorage.removeItem(key);
      });
      // Stickers: this profile's placements and the pictures only it uses (IndexedDB).
      if (typeof stkResetAll === 'function') stkResetAll();
      // The account's pictures that only this device has go with its library (media-store.js).
      if (uid && typeof MEDIA_ONLY_KEY === 'string') localStorage.removeItem(MEDIA_ONLY_KEY + uid);

      /* The empty library, written now: the picture clean-up below reads the
         saves on the device, and must see this one empty. */
      saveData();
      try { _flushSaveData(); } catch (e) { /* the reload's own save covers it */ }

      /* Signed in: the account's cloud gets the reset too, and the reload waits
         for it (a reload cuts a save off, and the next open would then load the
         old library back from the cloud). Capped, so an unreachable cloud still
         reloads. */
      const cloud = uid && typeof saveToFirestore === 'function'
        ? Promise.race([
          saveToFirestore(uid).catch(e => console.warn('[Reset] cloud copy not reset', e)),
          new Promise(r => setTimeout(r, 15000))
        ])
        : Promise.resolve();

      // Clear the tab's session data, but PRESERVE storageMode and Firebase's own
      // sign-in (firebase-auth.js) so the user doesn't get bounced back to the
      // picker on the reload.
      const savedStorageMode = sessionStorage.getItem('storageMode');
      if (typeof sessionClearKeepingSignIn === 'function') sessionClearKeepingSignIn();
      else sessionStorage.clear();
      if (savedStorageMode) sessionStorage.setItem('storageMode', savedStorageMode);

      showMessage("Success", "Data has been reset to defaults. The page will now reload.");
      /* The covers and images no save on this device uses any more
         (js/media-store.js), finished before the reload. The other profiles'
         saves are still here, so their pictures stay. */
      const pictures = typeof mediaGc === 'function'
        ? mediaGc({ now: true }).catch(e => console.warn('[Reset] pictures not cleared', e)) : Promise.resolve();
      Promise.all([pictures, cloud, new Promise(r => setTimeout(r, 1200))]).then(() => window.location.reload());
    }); // inner confirm
  }); // outer confirm
}

// Helper for handleDataReset — derives legacy category-name list from new tree nodes.
function getNodeNamesForScopeFromNodes(nodes, scope) {
  return nodes.filter(n => n.type === 'folder' && n.scope === scope && n.parentId === null).map(n => n.name);
}