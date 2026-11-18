/* ============================================================
   PROFILE-KEYS.JS — device-kept data that belongs to ONE profile
   ============================================================

   Guest and every account signed in on this device read the same
   localStorage keys for a few things that are the person's own: the
   unfinished attempts (program, practice set, SQL, notebook), the review
   schedule, line marks, the lessons already seen and the quick-action counts.
   An account's copy also rides in its cloud (the stash and prefs documents),
   but the keys themselves were shared, so one profile's unfinished attempt
   was offered in the next -- and merged into, and uploaded to, that next
   account's cloud.

   Now the keys hold one profile's values at a time, and ssp.profileOwner
   says whose ('guest' or 'u:<uid>'). Entering another profile parks the
   values under ssp.profile.<owner> and puts the entering profile's parked
   values back (an account seen here for the first time has none: its cloud
   load fills them). Signing out drops the account's values from the device,
   the same as its library cache. Owner '' means nobody's: they were dropped.

   A device from before this has no owner at all. The values are then taken
   to be Guest's, as the plain library keys are: an account entering first
   parks them for Guest rather than taking them, so nothing is lost and no
   account inherits them.

   Layout, taste and settings are NOT here: they stay the device's, as
   SYNC_PREF_KEYS (firebase-auth.js) describes. Runs under Node: the storage
   is passed in. tools/test-profiles.js
   ============================================================ */

const PROFILE_OWNER_KEY = 'ssp.profileOwner';
const PROFILE_PARK_PREFIX = 'ssp.profile.';
const PROFILE_OWNED_KEYS = [
  // Unfinished attempts (practice.js, practice-set.js, snippet-attempt.js, notes-practice.js)
  'ssp.practiceDrafts', 'ssp.practiceDraft', 'ssp.psetDrafts', 'ssp.sqlAttemptDraft', 'npAttemptInProgress',
  // What this person has done (analytics' review schedule, line marks, demos seen, Home's action counts)
  'anSrsState', 'editorLineMarks', 'demoSeenLessons', 'ssp.actionUse'
];

/** Who is in this tab: 'guest', 'u:<uid>', or '' while nobody has entered yet. */
function profileCurrentId() {
  try {
    if (typeof storageMode === 'undefined') return '';
    if (storageMode === 'local') return 'guest';
    if (storageMode === 'online' && typeof currentFirebaseUser !== 'undefined' && currentFirebaseUser && currentFirebaseUser.uid) {
      return 'u:' + currentFirebaseUser.uid;
    }
  } catch (e) { /* not started */ }
  return '';
}

function _pfkStore(store) {
  if (store) return store;
  try { return localStorage; } catch (e) { return null; }
}

/** The owned keys' values as they are now: { key: raw string }. */
function _pfkRead(st) {
  const out = {};
  PROFILE_OWNED_KEYS.forEach(k => {
    const v = st.getItem(k);
    if (v !== null && v !== undefined) out[k] = v;
  });
  return out;
}

function _pfkClear(st) { PROFILE_OWNED_KEYS.forEach(k => st.removeItem(k)); }

/**
 * Make the owned keys hold profile `id`'s values. Returns true when they
 * changed hands. When parking would not fit, nothing moves (the next profile
 * then sees these values, which is better than losing them).
 */
function profileKeysEnter(id, store) {
  const st = _pfkStore(store);
  if (!st || !id) return false;
  try {
    let owner = st.getItem(PROFILE_OWNER_KEY);
    if (owner === null || owner === undefined) owner = 'guest';   // a device from before owners were kept
    if (owner === id) { st.setItem(PROFILE_OWNER_KEY, id); return false; }
    if (owner) {
      const now = _pfkRead(st);
      if (Object.keys(now).length) st.setItem(PROFILE_PARK_PREFIX + owner, JSON.stringify(now));
      else st.removeItem(PROFILE_PARK_PREFIX + owner);
    }
    let parked = null;
    try { parked = JSON.parse(st.getItem(PROFILE_PARK_PREFIX + id) || 'null'); } catch (e) { parked = null; }
    _pfkClear(st);
    if (parked && typeof parked === 'object') {
      PROFILE_OWNED_KEYS.forEach(k => { if (typeof parked[k] === 'string') st.setItem(k, parked[k]); });
    }
    st.removeItem(PROFILE_PARK_PREFIX + id);
    st.setItem(PROFILE_OWNER_KEY, id);
    return true;
  } catch (e) {
    console.warn('[Profiles] This profile\'s drafts could not be swapped in:', e);
    return false;
  }
}

/** Signing out of `id` on this device: its values go, from the keys and from the parked copies. */
function profileKeysDrop(id, store) {
  const st = _pfkStore(store);
  if (!st || !id) return;
  try {
    st.removeItem(PROFILE_PARK_PREFIX + id);
    // Only values known to be this account's. With no owner yet they are Guest's (see above).
    if (st.getItem(PROFILE_OWNER_KEY) === id) {
      _pfkClear(st);
      st.setItem(PROFILE_OWNER_KEY, '');
    }
  } catch (e) { /* storage blocked: nothing was kept either */ }
}
