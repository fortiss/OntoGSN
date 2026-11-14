export function createEventBus() {
  const target = new EventTarget();

  function on(type, handler, options) {
    target.addEventListener(type, handler, options);
    return () => target.removeEventListener(type, handler, options);
  }

  function off(type, handler, options) {
    target.removeEventListener(type, handler, options);
  }

  function emit(type, detail) {
    target.dispatchEvent(new CustomEvent(type, { detail }));
  }

  function once(type, handler) {
    const offFn = on(type, (e) => {
      offFn();
      handler(e);
    });
    return offFn;
  }

  return { on, off, once, emit, _target: target };
}

export function emitCompat(bus, type, detail, { alsoWindow = true } = {}) {
  bus?.emit?.(type, detail);
  if (alsoWindow) window.dispatchEvent(new CustomEvent(type, { detail }));
}

export function makeEmitter(bus, opts) {
  return (type, detail) => emitCompat(bus, type, detail, opts);
}


export const bus = createEventBus();
