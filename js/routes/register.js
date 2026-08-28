/* Route: register */
function registerAllRoutes() {
  SpaRouter.register('home', { title: 'StudySession Pro — Dashboard', templateFn: homeTemplate, initFn: homeInit, destroyFn: homeDestroy, sidebarVisible: true, navId: 'nav-home' });
  SpaRouter.register('library', { title: 'StudySession Pro — Library', templateFn: libraryTemplate, initFn: libraryInit, destroyFn: libraryDestroy, sidebarVisible: true, navId: 'nav-library' });
  // One route serves all eight generic wings; the key rides in the hash (#/wing?k=diary).
  SpaRouter.register('wing', { title: 'StudySession Pro — Library', templateFn: wingTemplate, initFn: wingInit, destroyFn: wingDestroy, sidebarVisible: true, navId: 'nav-library' });
  SpaRouter.register('browse', { title: 'StudySession Pro — Coding Library', templateFn: browseTemplate, initFn: browseInit, destroyFn: browseDestroy, sidebarVisible: true, navId: 'nav-library' });
  SpaRouter.register('study', { title: 'StudySession Pro — Notes Library', templateFn: studyTemplate, initFn: studyInit, destroyFn: studyDestroy, sidebarVisible: true, navId: 'nav-library' });
  SpaRouter.register('snippets', { title: 'StudySession Pro — Snippet Library', templateFn: snippetsTemplate, initFn: snippetsInit, destroyFn: snippetsDestroy, sidebarVisible: true, navId: 'nav-library' });
  SpaRouter.register('language', { title: 'StudySession Pro — Language Library', templateFn: languageTemplate, initFn: languageInit, destroyFn: languageDestroy, sidebarVisible: true, navId: 'nav-library' });
  SpaRouter.register('cheatsheet', { title: 'StudySession Pro — Cheat Sheet Library', templateFn: cheatsheetTemplate, initFn: cheatsheetInit, destroyFn: cheatsheetDestroy, sidebarVisible: true, navId: 'nav-library' });
  SpaRouter.register('analytics', { title: 'StudySession Pro — Analytics', templateFn: analyticsTemplate, initFn: analyticsInit, destroyFn: analyticsDestroy, sidebarVisible: true, navId: 'nav-analytics' });
  SpaRouter.register('analytics-coding', { title: 'StudySession Pro — Coding Analytics', templateFn: analyticsCodingTemplate, initFn: analyticsCodingInit, destroyFn: analyticsCodingDestroy, sidebarVisible: true, navId: 'nav-analytics' });
  SpaRouter.register('analytics-notes', { title: 'StudySession Pro — Notes Analytics', templateFn: analyticsNotesTemplate, initFn: analyticsNotesInit, destroyFn: analyticsNotesDestroy, sidebarVisible: true, navId: 'nav-analytics' });
  SpaRouter.register('analytics-snippets', { title: 'StudySession Pro — Snippet Analytics', templateFn: analyticsSnippetsTemplate, initFn: analyticsSnippetsInit, destroyFn: analyticsSnippetsDestroy, sidebarVisible: true, navId: 'nav-analytics' });
  SpaRouter.register('admin', { title: 'StudySession Pro — Admin Hub', templateFn: adminTemplate, initFn: adminInit, destroyFn: adminDestroy, sidebarVisible: true, navId: 'nav-admin' });
  SpaRouter.register('admin-coding', { title: 'StudySession Pro — Coding Admin', templateFn: adminCodingTemplate, initFn: adminCodingInit, destroyFn: adminCodingDestroy, sidebarVisible: true, navId: 'nav-admin' });
  SpaRouter.register('admin-notes', { title: 'StudySession Pro — Notes Admin', templateFn: adminNotesTemplate, initFn: adminNotesInit, destroyFn: adminNotesDestroy, sidebarVisible: true, navId: 'nav-admin' });
  SpaRouter.register('admin-snippets', { title: 'StudySession Pro — Snippets Admin', templateFn: adminSnippetsTemplate, initFn: adminSnippetsInit, destroyFn: adminSnippetsDestroy, sidebarVisible: true, navId: 'nav-admin' });
  SpaRouter.register('admin-language', { title: 'StudySession Pro — Language Admin', templateFn: adminLanguageTemplate, initFn: adminLanguageInit, destroyFn: adminLanguageDestroy, sidebarVisible: true, navId: 'nav-admin' });
  SpaRouter.register('visualization', { title: 'StudySession Pro — Visualization', templateFn: vizTemplate, initFn: vizInit, destroyFn: vizDestroy, sidebarVisible: true, navId: 'nav-mindmap' });
  SpaRouter.register('quests', { title: 'StudySession Pro — Quest Board', templateFn: questTemplate, initFn: questInit, destroyFn: questDestroy, sidebarVisible: true, navId: 'nav-quests' });
  SpaRouter.register('practice', { title: 'StudySession Pro — Practice', templateFn: practiceTemplate, initFn: practiceInit, destroyFn: practiceDestroy, sidebarVisible: false, navId: null });
  SpaRouter.register('practice-set', { title: 'StudySession Pro — Multi-Problem Session', templateFn: practiceSetTemplate, initFn: practiceSetInit, destroyFn: practiceSetDestroy, sidebarVisible: false, navId: null });
  SpaRouter.register('snippet-attempt', { title: 'SQL Practice — StudySession Pro', templateFn: snippetAttemptTemplate, initFn: snippetAttemptInit, destroyFn: snippetAttemptDestroy, sidebarVisible: false, navId: null });
  SpaRouter.register('lang-attempt', { title: 'Language Drill — StudySession Pro', templateFn: langAttemptTemplate, initFn: langAttemptInit, destroyFn: langAttemptDestroy, sidebarVisible: false, navId: null });
  SpaRouter.register('lang-quest', { title: 'Scenario — StudySession Pro', templateFn: langQuestTemplate, initFn: langQuestInit, destroyFn: langQuestDestroy, sidebarVisible: false, navId: null });
  SpaRouter.register('solution', { title: 'StudySession Pro — Solution', templateFn: solutionTemplate, initFn: solutionInit, destroyFn: solutionDestroy, sidebarVisible: false, navId: null });
  SpaRouter.register('notes-practice', { title: 'Notebook Session — StudySession Pro', templateFn: notesPracticeTemplate, initFn: notesPracticeInit, destroyFn: notesPracticeDestroy, sidebarVisible: false, navId: null });
  SpaRouter.register('notes-solution', { title: 'Notebook Results — StudySession Pro', templateFn: notesSolutionTemplate, initFn: notesSolutionInit, destroyFn: notesSolutionDestroy, sidebarVisible: false, navId: null });
}
