// Touch owns its pointers from contact to release. Mouse and pen use the desktop driver.
export function installTouch(surface, {orbit, pan, zoom, tap, rebase}) {
  const contacts = new Map();
  let multiple = false;
  const point = event => ({x:event.clientX, y:event.clientY});
  const distance = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
  function pair() {
    const [a,b] = contacts.values();
    return {x:(a.last.x+b.last.x)/2, y:(a.last.y+b.last.y)/2, span:distance(a.last,b.last)};
  }
  function reset() {
    for (const id of contacts.keys()) {
      if (surface.hasPointerCapture(id)) surface.releasePointerCapture(id);
    }
    contacts.clear();
    multiple = false;
  }
  surface.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    const start = point(event);
    contacts.set(event.pointerId, {start, last:start, dragging:false, time:event.timeStamp});
    multiple ||= contacts.size > 1;
    surface.setPointerCapture(event.pointerId);
    rebase();
  });
  surface.addEventListener('pointermove', event => {
    const contact = contacts.get(event.pointerId);
    if (!contact) return;
    const before = contacts.size === 2 ? pair() : null;
    const last = contact.last;
    contact.last = point(event);
    if (before) {
      const after = pair();
      if (before.span > 1 && after.span > 1) zoom(before.span / after.span);
      pan(after.x-before.x, after.y-before.y);
    } else if (contacts.size === 1) {
      contact.dragging ||= distance(contact.start,contact.last) > 9;
      if (contact.dragging) orbit(contact.last.x-last.x, contact.last.y-last.y);
    }
  });
  surface.addEventListener('pointerup', event => {
    const contact = contacts.get(event.pointerId);
    if (!contact) return;
    if (!multiple && !contact.dragging && distance(contact.start,point(event)) <= 9 && event.timeStamp-contact.time <= 450) tap(event);
    contacts.delete(event.pointerId);
    for (const other of contacts.values()) other.start = other.last;
    if (!contacts.size) { multiple = false; rebase(); }
  });
  surface.addEventListener('pointercancel', event => { if (contacts.has(event.pointerId)) reset(); });
  surface.addEventListener('lostpointercapture', event => { if (contacts.has(event.pointerId)) reset(); });
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  return {reset, touching:() => contacts.size > 0};
}
