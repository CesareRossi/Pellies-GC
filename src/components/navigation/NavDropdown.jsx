import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { CaretDown, Check, MagnifyingGlass } from '@phosphor-icons/react';

/**
 * Nav dropdown.
 *
 * Rendered through a portal and positioned with fixed coordinates so it can
 * never be clipped by the nav bar's rounded/overflow container, and so a long
 * menu (the Individual Rounds list runs to 39 entries) gets a scroll area that
 * is capped to the viewport instead of running off the bottom of the page.
 *
 * Keyboard: Enter/Space/ArrowDown opens, Up/Down moves, Home/End jump,
 * Enter selects, Escape closes and returns focus to the trigger.
 * Menus with more than SEARCH_THRESHOLD items get a filter box.
 */

const SEARCH_THRESHOLD = 8;
const MENU_MIN_WIDTH = 236;
const VIEWPORT_MARGIN = 12;

const NavDropdown = ({ label, icon, items, activeId, onSelect, testId, align = 'left' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(-1);
  const [coords, setCoords] = useState(null);

  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const itemRefs = useRef([]);

  const active = items.find((i) => String(i.id) === String(activeId));
  const showSearch = items.length > SEARCH_THRESHOLD;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => String(i.label).toLowerCase().includes(q));
  }, [items, query]);

  const close = useCallback(
    (returnFocus = true) => {
      setOpen(false);
      setQuery('');
      setHighlight(-1);
      if (returnFocus) triggerRef.current?.focus({ preventScroll: true });
    },
    []
  );

  /* ---- positioning -------------------------------------------------- */
  const position = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const width = Math.max(MENU_MIN_WIDTH, r.width);
    const spaceBelow = window.innerHeight - r.bottom - VIEWPORT_MARGIN;
    const spaceAbove = r.top - VIEWPORT_MARGIN;
    // Flip above the trigger when there is clearly more room up there
    const flip = spaceBelow < 220 && spaceAbove > spaceBelow;

    let left = align === 'right' ? r.right - width : r.left;
    left = Math.min(Math.max(VIEWPORT_MARGIN, left), window.innerWidth - width - VIEWPORT_MARGIN);

    setCoords({
      left,
      top: flip ? undefined : r.bottom + 8,
      bottom: flip ? window.innerHeight - r.top + 8 : undefined,
      width,
      maxHeight: Math.max(180, (flip ? spaceAbove : spaceBelow) - 8),
      flip,
    });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    position();
    // Scrolling just repositions; a resize closes. The mobile and desktop nav
    // bars are separate trees toggled with `lg:hidden`, so crossing the
    // breakpoint hides the trigger while its portalled menu would linger.
    const onScroll = () => position();
    const onResize = () => close(false);
    window.addEventListener('resize', onResize);
    // capture:true so scrolling of any ancestor repositions the menu too
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, position, close]);

  /* ---- outside click / escape ---------------------------------------- */
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      close(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  /* ---- focus the right thing on open --------------------------------- */
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (showSearch) {
        searchRef.current?.focus({ preventScroll: true });
      } else {
        const idx = filtered.findIndex((i) => String(i.id) === String(activeId));
        setHighlight(idx >= 0 ? idx : 0);
      }
    }, 20);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the highlighted row in view as the user arrows through a long list
  useEffect(() => {
    if (highlight < 0) return;
    itemRefs.current[highlight]?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  const choose = (item) => {
    onSelect(item.id);
    close(false);
  };

  const onMenuKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (filtered.length === 0 ? -1 : (h + 1) % filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (filtered.length === 0 ? -1 : (h - 1 + filtered.length) % filtered.length));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setHighlight(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setHighlight(filtered.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[highlight] ?? (filtered.length === 1 ? filtered[0] : null);
      if (item) choose(item);
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  const onTriggerKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const triggerClass = [
    'group relative flex items-center gap-2 rounded-[10px] border px-3 py-2 text-sm font-medium',
    'whitespace-nowrap transition-all duration-200',
    active || open
      ? 'border-[#D4AF37]/35 bg-[#D4AF37]/14 text-[#D4AF37] shadow-[0_0_0_1px_rgba(212,175,55,0.08)]'
      : 'border-transparent text-[#A9C5B4] hover:border-[#D4AF37]/18 hover:bg-white/5 hover:text-white',
  ].join(' ');

  return (
    <div className="relative" data-testid={testId}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={onTriggerKeyDown}
        data-testid={`${testId}-trigger`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={triggerClass}
      >
        {icon}
        <span className="min-w-0 truncate">{label}</span>
        {active && (
          <span className="hidden xl:inline max-w-[108px] truncate text-[11px] text-[#D4AF37]/70">
            · {active.label}
          </span>
        )}
        <CaretDown
          size={13}
          weight="bold"
          className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Deliberately mounted/unmounted outright rather than via an exit
          animation: under React 19 + framer-motion 12 the exit callback can
          stall, leaving the menu in the DOM at opacity 0 where it still
          swallows clicks. */}
      {createPortal(
        <>
          {open && coords && (
            <motion.div
              ref={menuRef}
              role="menu"
              aria-label={label}
              onKeyDown={onMenuKeyDown}
              initial={{ opacity: 0, y: coords.flip ? 6 : -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'fixed',
                left: coords.left,
                top: coords.top,
                bottom: coords.bottom,
                width: coords.width,
                maxHeight: coords.maxHeight,
                zIndex: 120,
              }}
              className="pg-menu flex flex-col"
              data-testid={`${testId}-menu`}
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
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setHighlight(0);
                      }}
                      placeholder="Filter…"
                      aria-label={`Filter ${label}`}
                      data-testid={`${testId}-search`}
                      className="w-full rounded-lg border border-[#D4AF37]/15 bg-[#03110A] py-1.5 pl-8 pr-2.5 text-[13px] text-white placeholder-[#A9C5B4]/45 focus:border-[#D4AF37]/50 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="pg-scroll min-h-0 flex-1 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-[#A9C5B4]/60">No matches</p>
                ) : (
                  filtered.map((item, i) => {
                    const isActive = String(item.id) === String(activeId);
                    return (
                      <button
                        key={item.id}
                        ref={(el) => {
                          itemRefs.current[i] = el;
                        }}
                        type="button"
                        role="menuitem"
                        data-active={isActive}
                        data-highlighted={i === highlight}
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => choose(item)}
                        className="pg-menu-item"
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            isActive ? 'bg-[#D4AF37]' : 'bg-current opacity-35'
                          }`}
                        />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {isActive && <Check size={14} weight="bold" className="shrink-0 text-[#D4AF37]" />}
                      </button>
                    );
                  })
                )}
              </div>

              {showSearch && (
                <div className="shrink-0 border-t border-[#D4AF37]/10 px-3 py-1.5">
                  <p className="text-[10px] text-[#A9C5B4]/50">
                    {filtered.length} of {items.length}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </>,
        document.body
      )}
    </div>
  );
};

export default NavDropdown;
