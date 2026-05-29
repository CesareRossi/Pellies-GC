import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CaretDown } from '@phosphor-icons/react';

const NavDropdown = ({ label, icon, items, activeId, onSelect, testId }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { 
    const h = (e) => { 
      if (ref.current && !ref.current.contains(e.target)) setOpen(false); 
    }; 
    document.addEventListener('mousedown', h); 
    return () => document.removeEventListener('mousedown', h); 
  }, []);
  const active = items.find(i => i.id === activeId);
  return (
    <div ref={ref} className="relative" data-testid={testId}>
      <button 
        onClick={() => setOpen(!open)} 
        data-testid={`${testId}-trigger`} 
        className={`flex items-center gap-2 px-3 py-2 text-sm font-sans transition-all duration-200 rounded-lg whitespace-nowrap border ${
          active 
            ? 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30 shadow-[0_0_0_1px_rgba(212,175,55,0.08)]' 
            : 'text-[#A9C5B4] border-transparent hover:text-white hover:bg-[#FFFFFF]/5 hover:border-[#D4AF37]/15'
        }`}
      >
        {icon}<span>{label}</span>
        <CaretDown size={14} weight="bold" className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ opacity: 0, y: -8 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -8 }} 
            className="absolute top-full left-0 mt-2 min-w-[220px] rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50"
          >
            {items.map(item => (
              <button 
                key={item.id} 
                onClick={() => { onSelect(item.id); setOpen(false); }} 
                className={`w-full text-left px-4 py-3 text-sm font-sans transition-colors duration-150 flex items-center gap-2 ${
                  activeId === item.id 
                    ? 'bg-[#D4AF37]/15 text-[#D4AF37]' 
                    : 'text-[#A9C5B4] hover:bg-[#163A27] hover:text-white'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />{item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NavDropdown;
