/* ============================================================
   SIDEBAR WHEEL — scroll over the sidebar to move between pages
   ------------------------------------------------------------
   Each wheel notch over the sidebar's page links moves a highlight to the
   next (down) or previous (up) page, wrapping round. When the wheel has been
   still for a moment the highlighted page opens, so a quick flick past three
   pages loads only the one it stops on. A trackpad's many small deltas add up
   to notches. When the sidebar is short enough to scroll its own list, the
   wheel scrolls it instead.
   ============================================================ */

const SIDEBAR_WHEEL_SETTLE_MS = 320;
const SIDEBAR_WHEEL_NOTCH = 40;   // px of wheel delta per step

(function sidebarWheelWire() {
  const menu = document.querySelector('#app-sidebar-nav .sidebar-menu');
  if (!menu) return;
  let target = -1, acc = 0, timer = 0;
  const links = () => [...menu.querySelectorAll('.sidebar-link[id^="nav-"]')];
  const clear = () => menu.querySelectorAll('.sidebar-link.is-wheel-target').forEach(l => l.classList.remove('is-wheel-target'));

  menu.addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey) return;                        // a pinch zoom
    if (menu.scrollHeight > menu.clientHeight + 2) return;      // the list scrolls itself
    if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;        // sideways
    e.preventDefault();
    acc += e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    clearTimeout(timer);
    timer = setTimeout(settle, SIDEBAR_WHEEL_SETTLE_MS);
    if (Math.abs(acc) < SIDEBAR_WHEEL_NOTCH) return;
    const step = acc > 0 ? 1 : -1;
    acc = 0;
    const ls = links();
    if (!ls.length) return;
    if (target < 0) {
      const on = ls.findIndex(l => l.classList.contains('active'));
      target = on < 0 ? 0 : on;
    }
    target = (target + step + ls.length) % ls.length;
    clear();
    ls[target].classList.add('is-wheel-target');
  }, { passive: false });

  function settle() {
    timer = 0;
    acc = 0;
    const l = target >= 0 ? links()[target] : null;
    target = -1;
    clear();
    if (l && !l.classList.contains('active')) l.click();
  }
})();
