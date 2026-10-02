import React, { useState, useRef, useMemo, useEffect, useCallback, useLayoutEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Check, MagnifyingGlass } from '@phosphor-icons/react';

/* ==========================================================================
   Select — a custom listbox, not a native <select>.

   The native control's option list is drawn by the operating system: on macOS
   it opens as an oversized, light, detached panel that ignores the app's dark
   theme entirely, and no amount of CSS on <option> fixes it consistently
   across platforms. This renders the list ourselves so it matches the rest of
   the UI and can carry a filter box for the long lists (40 rounds, 19
   players).

   Behaviour: Enter/Space/Arrow opens, arrows move, Home/End jump, Enter picks,
   Escape closes, printable characters type-ahead. Lists longer than
   SEARCH_THRESHOLD get a filter field.
   ========================================================================== */

const SEARCH_THRESHOLD = 8;
const VIEWPORT_MARGIN = 10;
const MIN_POPUP_HEIGHT = 160;
// Above ConfirmModal (200), Modal (150) and the drawers (101) so a select
// inside an overlay still opens over it.
const POPUP_Z = 400;

export const Select = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  disabled,
  invalid,
  id,
  className = '',
  'aria-labelledby': ariaLabelledBy,
  ...rest
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(-1);
  const [coords, setCoords] = useState(null);

  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const optionRefs = useRef([]);
  const typeahead = useRef({ buffer: '', at: 0 });

  const reactId = useId();
  const listboxId = `${reactId}-listbox`;

  const selected = options.find((o) => String(o.value) === String(value));
  const showSearch = options.length > SEARCH_THRESHOLD;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => String(o.label).toLowerCase().includes(q));
  }, [options, query]);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    setQuery('');
    setHighlight(-1);
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  /* ---- positioning ---------------------------------------------------
     Always resolved to a `top` that is clamped inside the viewport. Anchoring
     purely to the trigger's bottom edge pushed the list off-screen whenever
     the trigger sat low — e.g. the player picker near the bottom of the
     Quick Score drawer on a phone. */
  const position = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const GAP = 6;

    const spaceBelow = vh - r.bottom - VIEWPORT_MARGIN;
    const spaceAbove = r.top - VIEWPORT_MARGIN;
    const flip = spaceBelow < MIN_POPUP_HEIGHT && spaceAbove > spaceBelow;

    // Height we are allowed in the chosen direction, never below a usable floor
    const available = Math.max(flip ? spaceAbove : spaceBelow, 0) - GAP;
    const maxHeight = Math.max(MIN_POPUP_HEIGHT, Math.min(available, vh - VIEWPORT_MARGIN * 2));

    let top = flip ? r.top - GAP - maxHeight : r.bottom + GAP;
    // Keep the whole popup on screen even if the trigger itself is clipped
    top = Math.min(Math.max(VIEWPORT_MARGIN, top), vh - VIEWPORT_MARGIN - maxHeight);

    const next = {
      left: Math.min(Math.max(VIEWPORT_MARGIN, r.left), Math.max(VIEWPORT_MARGIN, vw - r.width - VIEWPORT_MARGIN)),
      top,
      width: r.width,
      maxHeight,
      flip,
    };

    // Bail out when nothing moved: the settle loop runs every frame and
    // re-rendering on each one restarts the entrance animation, which left the
    // popup frozen at its initial scale (visibly narrower than the trigger).
    setCoords((prev) => {
      if (
        prev &&
        Math.abs(prev.left - next.left) < 0.5 &&
        Math.abs(prev.top - next.top) < 0.5 &&
        Math.abs(prev.width - next.width) < 0.5 &&
        Math.abs(prev.maxHeight - next.maxHeight) < 0.5
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    position();

    // Re-measure for a few frames: a select inside a drawer or modal can open
    // while that overlay is still animating in, so the first rect is stale.
    let raf;
    const until = performance.now() + 350;
    const settle = () => {
      position();
      if (performance.now() < until) raf = requestAnimationFrame(settle);
    };
    raf = requestAnimationFrame(settle);

    const onScroll = () => position();
    const onResize = () => close(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, position, close]);

  /* ---- dismiss ------------------------------------------------------- */
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (popupRef.current?.contains(e.target)) return;
      close(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open, close]);

  /* ---- focus + initial highlight ------------------------------------- */
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => {
      const idx = filtered.findIndex((o) => String(o.value) === String(value));
      setHighlight(idx >= 0 ? idx : 0);
      if (showSearch) searchRef.current?.focus({ preventScroll: true });
      else listRef.current?.focus({ preventScroll: true });
    }, 15);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (highlight < 0) return;
    optionRefs.current[highlight]?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  const pick = (option) => {
    if (option.disabled) return;
    onChange(option.value);
    // Return focus to the trigger: after choosing with the keyboard, focus
    // would otherwise fall back to <body> and Tab would restart at the top
    // of the page.
    close(true);
  };

  const move = (delta) => {
    if (filtered.length === 0) return;
    setHighlight((h) => {
      let next = h;
      for (let i = 0; i < filtered.length; i += 1) {
        next = (next + delta + filtered.length) % filtered.length;
        if (!filtered[next].disabled) return next;
      }
      return h;
    });
  };

  const onKeyDown = (e) => {
    // Overlays listen for Escape on `document`; stop the event here so closing
    // a select inside a modal doesn't also close the modal.
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); return; }
    if (e.key === 'Home') { e.preventDefault(); setHighlight(0); return; }
    if (e.key === 'End') { e.preventDefault(); setHighlight(filtered.length - 1); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const o = filtered[highlight];
      if (o) pick(o);
      return;
    }
    if (e.key === 'Tab') { close(false); return; }

    // Type-ahead when there is no filter field
    if (!showSearch && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now();
      const ta = typeahead.current;
      ta.buffer = now - ta.at > 700 ? e.key : ta.buffer + e.key;
      ta.at = now;
      const idx = filtered.findIndex((o) => String(o.label).toLowerCase().startsWith(ta.buffer.toLowerCase()));
      if (idx >= 0) setHighlight(idx);
    }
  };

  const onTriggerKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={onTriggerKeyDown}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-labelledby={ariaLabelledBy}
        aria-invalid={invalid || undefined}
        className={`pg-select pg-select-trigger ${invalid ? 'pg-input-invalid' : ''} ${open ? 'pg-select-open' : ''} ${className}`}
        {...rest}
      >
        <span className={`block truncate text-left ${selected ? '' : 'text-[#A9C5B4]/55'}`}>
          {selected ? selected.label : placeholder}
        </span>
      </button>

      {open && coords && createPortal(
        <motion.div
          ref={popupRef}
          initial={{ opacity: 0, y: coords.flip ? 4 : -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
          onKeyDown={onKeyDown}
          style={{
            position: 'fixed',
            left: coords.left,
            top: coords.top,
            width: coords.width,
            maxHeight: coords.maxHeight,
            zIndex: POPUP_Z,
          }}
          className="pg-menu flex flex-col"
          data-testid="pg-select-popup"
        >
          {showSearch && (
            <div className="shrink-0 border-b border-[#D4AF37]/12 p-2">
              <div className="relative">
                <MagnifyingGlass
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A9C5B4]/60"
                />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
                  placeholder="Filter…"
                  aria-label="Filter options"
                  className="w-full rounded-lg border border-[#D4AF37]/15 bg-[#03110A] py-1.5 pl-8 pr-2.5 text-[13px] text-white placeholder-[#A9C5B4]/45 focus:border-[#D4AF37]/50 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            aria-activedescendant={highlight >= 0 ? `${reactId}-opt-${highlight}` : undefined}
            className="pg-scroll min-h-0 flex-1 overflow-y-auto py-1 focus:outline-none"
          >
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-[#A9C5B4]/60">No matches</p>
            ) : (
              filtered.map((o, i) => {
                const isSelected = String(o.value) === String(value);
                return (
                  <button
                    key={`${o.value}`}
                    id={`${reactId}-opt-${i}`}
                    ref={(el) => { optionRefs.current[i] = el; }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={o.disabled}
                    data-active={isSelected}
                    data-highlighted={i === highlight}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => pick(o)}
                    className="pg-menu-item disabled:opacity-40"
                  >
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {isSelected && <Check size={14} weight="bold" className="shrink-0 text-[#D4AF37]" />}
                  </button>
                );
              })
            )}
          </div>

          {showSearch && (
            <div className="shrink-0 border-t border-[#D4AF37]/10 px-3 py-1.5">
              <p className="text-[10px] text-[#A9C5B4]/50">{filtered.length} of {options.length}</p>
            </div>
          )}
        </motion.div>,
        document.body
      )}
    </>
  );
};

export default Select;
