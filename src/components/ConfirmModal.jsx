import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { WarningCircle, X } from '@phosphor-icons/react';

/**
 * In-app confirm modal to replace browser window.confirm()
 * Rendered via portal so transformed parents don't break position:fixed
 */
export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', danger = true, onConfirm, onClose }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[#051A10]/80 backdrop-blur-sm"
          onClick={onClose}
          data-testid="confirm-modal"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm mx-4 rounded-xl border border-[#D4AF37]/30 bg-[#0F2C1D] p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className={`mt-0.5 rounded-full p-1.5 ${danger ? 'bg-red-500/20 text-red-400' : 'bg-[#D4AF37]/20 text-[#D4AF37]'}`}>
                <WarningCircle size={20} weight="fill" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-serif text-[#D4AF37] mb-1">{title}</h3>
                <p className="text-sm text-[#A9C5B4] leading-relaxed">{message}</p>
              </div>
              <button onClick={onClose} className="text-[#A9C5B4] hover:text-white -mt-1"><X size={18} /></button>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={onClose}
                data-testid="confirm-cancel"
                className="px-4 py-2 text-sm rounded-lg text-[#A9C5B4] hover:text-white hover:bg-[#163A27] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { onConfirm?.(); onClose?.(); }}
                data-testid="confirm-confirm"
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${danger ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-[#D4AF37] text-[#051A10] hover:bg-[#F1D67E]'}`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
