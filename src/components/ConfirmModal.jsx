import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { WarningCircle, Check, X } from '@phosphor-icons/react';
import { Button, IconButton } from './common';
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from '../hooks/useOverlay';

/**
 * In-app confirm dialog, replacing window.confirm().
 * Portalled so a transformed ancestor can't break position:fixed, and
 * scroll-locked / focus-trapped like every other overlay in the app.
 */
function ConfirmBody({ title, message, confirmLabel, danger, busy, confirmDisabled, closeOnConfirm, onConfirm, onClose }) {
  const panelRef = useRef(null);
  useBodyScrollLock(true);
  useEscapeKey(!busy, onClose);
  useFocusTrap(panelRef, true);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#03110A]/82 p-4 backdrop-blur-md"
      onClick={busy ? undefined : onClose}
      data-testid="confirm-modal"
    >
      <motion.div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        initial={{ scale: 0.95, y: 14, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.97, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="pg-card w-full max-w-sm p-5"
      >
        <div className="mb-4 flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
              danger
                ? 'border-red-500/30 bg-red-500/14 text-red-400'
                : 'border-[#D4AF37]/30 bg-[#D4AF37]/14 text-[#D4AF37]'
            }`}
          >
            {danger ? <WarningCircle size={20} weight="fill" /> : <Check size={20} weight="bold" />}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="pg-display mb-1 text-[16px] text-white">{title}</h3>
            <p className="text-[13px] leading-relaxed text-[#A9C5B4]">{message}</p>
          </div>
          {!busy && (
            <IconButton label="Close" onClick={onClose} className="-mr-1 -mt-1" data-overlay-close="true">
              <X size={17} />
            </IconButton>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy} data-testid="confirm-cancel">
            Cancel
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm?.();
              if (closeOnConfirm && !busy) onClose?.();
            }}
            disabled={busy || confirmDisabled}
            data-testid="confirm-confirm"
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = true,
  busy = false,
  confirmDisabled = false,
  closeOnConfirm = true,
  onConfirm,
  onClose,
}) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <ConfirmBody
          key="confirm"
          title={title}
          message={message}
          confirmLabel={confirmLabel}
          danger={danger}
          busy={busy}
          confirmDisabled={confirmDisabled}
          closeOnConfirm={closeOnConfirm}
          onConfirm={onConfirm}
          onClose={onClose}
        />
      )}
    </AnimatePresence>,
    document.body
  );
}
