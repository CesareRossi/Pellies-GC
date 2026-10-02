import { useEffect, useRef } from 'react';

let lockCount = 0;
let savedScrollY = 0;

/**
 * Locks page scroll while an overlay (modal / drawer) is open.
 *
 * Reference-counted so nested overlays — e.g. a ConfirmModal opened from
 * inside the Edit Round modal — don't unlock the page when the inner one
 * closes. On iOS, `overflow: hidden` alone doesn't hold, so we also pin the
 * body and restore the scroll position on release.
 */
export function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;

    if (lockCount === 0) {
      savedScrollY = window.scrollY;
      const scrollbar = window.innerWidth - document.documentElement.clientWidth;
      document.body.classList.add('pg-scroll-locked');
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      // Compensate for the vanished scrollbar so the layout doesn't jump
      if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.classList.remove('pg-scroll-locked');
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        document.body.style.paddingRight = '';
        window.scrollTo(0, savedScrollY);
      }
    };
  }, [active]);
}

/** Calls `handler` when Escape is pressed, while `active`. */
export function useEscapeKey(active, handler) {
  const saved = useRef(handler);
  saved.current = handler;

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        saved.current?.();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);
}

/**
 * Keeps focus inside `ref` while `active`, and restores it to whatever was
 * focused before the overlay opened. Without this, tabbing out of a modal
 * lands on the page behind it.
 */
export function useFocusTrap(ref, active) {
  useEffect(() => {
    if (!active || !ref.current) return undefined;

    const previouslyFocused = document.activeElement;
    const node = ref.current;

    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const focusables = () =>
      Array.from(node.querySelectorAll(selector)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );

    // Move focus in on open, preferring the first real control over the close button
    const initial = focusables();
    if (initial.length) {
      const preferred = initial.find((el) => !el.hasAttribute('data-overlay-close')) || initial[0];
      preferred.focus({ preventScroll: true });
    }

    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [ref, active]);
}
