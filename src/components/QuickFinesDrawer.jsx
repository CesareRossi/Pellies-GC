import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BeerBottle, MinusCircle, Wine, Flag, Club, Skull, XCircle, Golf, Trash, Lock, Plus } from '@phosphor-icons/react';
import * as db from '../services/supabaseService';
import { SelectField, Banner, IconButton, Chip, Spinner } from './common';
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from '../hooks/useOverlay';

const FINE_TYPES = [
  { id: 'ThreePutt', label: '3 Putt', icon: MinusCircle, penalty: '1 Shot' },
  { id: 'FourPutt', label: '4 Putt', icon: Wine, penalty: 'Beer Down' },
  { id: 'BunkerToBunker', label: 'Bunker to Bunker', icon: Flag, penalty: '1 Shot' },
  { id: 'RestingOnClub', label: 'Resting on Club', icon: Club, penalty: '1 Shot' },
  { id: 'Shank', label: 'Shank', icon: Skull, penalty: '1 Shot' },
  { id: 'NotPastLadies', label: 'Not Past Ladies', icon: XCircle, penalty: '1 Shot' },
  { id: 'SandSpecialist', label: 'Sand Specialist', icon: Golf, penalty: '1 Shot' },
];

const STORAGE_KEY = 'quickFines_lastPlayer';

function DrawerBody({ onClose, rounds, players, userPlayerId, currentRoundId, onFinesSaved }) {
  const panelRef = useRef(null);
  useBodyScrollLock(true);
  useEscapeKey(true, onClose);
  useFocusTrap(panelRef, true);

  const [selectedRound, setSelectedRound] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [includedPlayers, setIncludedPlayers] = useState(new Set());
  const [roundClosed, setRoundClosed] = useState(false);
  const [addingFine, setAddingFine] = useState(null);
  const didInit = useRef(false);

  const activeRounds = useMemo(() => rounds.filter(r => !r.is_closed), [rounds]);

  const liveRound = useMemo(() => {
    return rounds.find(r => r.is_current) ||
           rounds.find(r => r.id === parseInt(currentRoundId)) ||
           rounds.find(r => !r.is_closed);
  }, [rounds, currentRoundId]);

  const loadFines = useCallback(async () => {
    if (!selectedRound) { setFines([]); return; }
    try {
      const data = await db.getFinesForRound(parseInt(selectedRound));
      setFines(data || []);
    } catch (e) {
      setError('Failed to load fines');
    }
  }, [selectedRound]);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    let defaultRound = '';
    if (liveRound?.id && !liveRound?.is_closed) defaultRound = liveRound.id;
    else if (activeRounds.length > 0) defaultRound = activeRounds[0].id;
    setSelectedRound(defaultRound ? String(defaultRound) : '');

    if (!selectedPlayer && userPlayerId && players.find(p => p.id === userPlayerId)) {
      setSelectedPlayer(String(userPlayerId));
      localStorage.setItem(STORAGE_KEY, String(userPlayerId));
    }
  }, [liveRound, activeRounds, userPlayerId, players, selectedPlayer]);

  useEffect(() => {
    if (!selectedRound) {
      setRoundClosed(false); setIncludedPlayers(new Set()); setFines([]); setLoading(false);
      return;
    }
    const round = rounds.find(r => r.id === parseInt(selectedRound));
    setRoundClosed(round?.is_closed || false);
    setLoading(true);

    Promise.all([
      db.getRoundParticipants(selectedRound),
      db.getFinesForRound(parseInt(selectedRound)),
    ]).then(([participantIds, finesData]) => {
      setIncludedPlayers(new Set(participantIds || []));
      setFines(finesData || []);
    }).catch(() => setFines([]))
      .finally(() => setLoading(false));
  }, [selectedRound, rounds]);

  useEffect(() => {
    if (selectedPlayer) localStorage.setItem(STORAGE_KEY, selectedPlayer);
  }, [selectedPlayer]);

  const playerFines = fines.filter(f => f.player_id === parseInt(selectedPlayer));

  // Count per type so each tile can show a tally badge
  const countsByType = playerFines.reduce((acc, f) => {
    acc[f.fine_type] = (acc[f.fine_type] || 0) + 1;
    return acc;
  }, {});

  const handleAddFine = async (fineType) => {
    if (!selectedRound || !selectedPlayer) { setError('Please select a round and player'); return; }
    if (roundClosed) { setError('This round is closed. Cannot add fines.'); return; }

    try {
      setAddingFine(fineType);
      await db.addFine({
        round_id: parseInt(selectedRound),
        player_id: parseInt(selectedPlayer),
        fine_type: fineType,
        settled: false,
      });
      await loadFines();
      setSuccess(`${FINE_TYPES.find(t => t.id === fineType)?.label} added`);
      onFinesSaved?.();
    } catch (e) {
      setError('Failed to add fine');
    } finally {
      setAddingFine(null);
      setTimeout(() => { setError(''); setSuccess(''); }, 3000);
    }
  };

  const handleRemoveFine = async (fineId, fineType) => {
    try {
      await db.deleteFine(fineId);
      await loadFines();
      setSuccess(`${FINE_TYPES.find(t => t.id === fineType)?.label} removed`);
      onFinesSaved?.();
    } catch (e) {
      setError('Failed to remove fine');
    } finally {
      setTimeout(() => { setError(''); setSuccess(''); }, 3000);
    }
  };

  const availablePlayers = players.filter(p => includedPlayers.has(p.id));
  const roundData = rounds.find(r => r.id === parseInt(selectedRound));

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-[#03110A]/78 backdrop-blur-md"
        onClick={onClose}
      />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Quick Fines"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        className="pg-card fixed bottom-0 left-0 right-0 z-[101] flex max-h-[88vh] flex-col rounded-b-none rounded-t-3xl lg:bottom-auto lg:left-1/2 lg:right-auto lg:top-1/2 lg:w-full lg:max-w-md lg:max-h-[90vh] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl"
      >
        <div className="flex shrink-0 items-center justify-center pb-1 pt-3 lg:hidden">
          <div className="h-1.5 w-11 rounded-full bg-[#D4AF37]/30" />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#D4AF37]/14 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/12 text-rose-300">
              <BeerBottle size={18} weight="duotone" />
            </span>
            <div className="min-w-0">
              <h2 className="pg-display text-[16px] text-[#D4AF37]">Quick Fines</h2>
              {roundData && (
                <p className="truncate text-[11px] text-[#A9C5B4]">R{roundData.round_number} · {roundData.courses?.name}</p>
              )}
            </div>
          </div>
          <IconButton label="Close" onClick={onClose} data-overlay-close="true"><X size={19} /></IconButton>
        </div>

        <div className="pg-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {activeRounds.length === 0 ? (
            <Banner tone="error">No active rounds available.</Banner>
          ) : (
            <SelectField
              label="Round"
              value={selectedRound}
              onChange={setSelectedRound}
              placeholder="Choose round…"
              options={activeRounds.map(r => ({ value: r.id, label: `R${r.round_number} · ${r.courses?.name || 'No course'}` }))}
            />
          )}

          {roundClosed && selectedRound && (
            <Banner tone="error"><strong>Round closed.</strong> Fines cannot be added.</Banner>
          )}

          {selectedRound && !roundClosed && (
            <SelectField
              label="Player"
              value={selectedPlayer}
              onChange={setSelectedPlayer}
              placeholder="Choose player…"
              options={availablePlayers.map(p => ({ value: p.id, label: p.name }))}
            />
          )}

          {selectedPlayer && !roundClosed && (
            <div>
              <p className="pg-eyebrow mb-2.5">Tap to add</p>
              <div className="grid grid-cols-2 gap-2">
                {FINE_TYPES.map(type => {
                  const Icon = type.icon;
                  const count = countsByType[type.id] || 0;
                  const busy = addingFine === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => handleAddFine(type.id)}
                      disabled={busy}
                      className="group relative flex items-center gap-2.5 rounded-xl border border-[#D4AF37]/16 bg-[#03110A]/65 p-3 text-left transition-all active:scale-[0.98] hover:border-[#D4AF37]/42 hover:bg-[#D4AF37]/8 disabled:opacity-55"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#D4AF37]/10 text-[#D4AF37]">
                        {busy ? <Spinner size={15} /> : <Icon size={17} weight="duotone" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold text-white">{type.label}</span>
                        <span className="block text-[10px] text-[#A9C5B4]">{type.penalty}</span>
                      </span>
                      {count > 0 ? (
                        <span className="pg-num flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/22 px-1.5 text-[10px] font-bold text-rose-200">
                          {count}
                        </span>
                      ) : (
                        <Plus size={13} weight="bold" className="shrink-0 text-[#A9C5B4]/35 group-hover:text-[#D4AF37]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedPlayer && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="pg-eyebrow">This round</p>
                <Chip tone={playerFines.length ? 'rose' : 'default'}>{playerFines.length} fine{playerFines.length === 1 ? '' : 's'}</Chip>
              </div>
              {loading ? (
                <div className="flex justify-center py-6"><Spinner size={28} /></div>
              ) : playerFines.length === 0 ? (
                <p className="rounded-xl border border-[#D4AF37]/10 bg-[#03110A]/45 py-5 text-center text-xs text-[#A9C5B4]">
                  Clean round so far.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {playerFines.map(f => {
                    const type = FINE_TYPES.find(t => t.id === f.fine_type);
                    const Icon = type?.icon || Skull;
                    return (
                      <div
                        key={f.id}
                        className="flex items-center gap-2.5 rounded-lg border border-[#D4AF37]/10 bg-[#03110A]/55 px-3 py-2"
                      >
                        <Icon size={15} weight="duotone" className="shrink-0 text-[#D4AF37]" />
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-white">{type?.label || f.fine_type}</span>
                        <span className="shrink-0 text-[10px] text-[#A9C5B4]">{type?.penalty}</span>
                        {!roundClosed && (
                          <IconButton
                            label={`Remove ${type?.label || 'fine'}`}
                            tone="danger"
                            className="h-7 w-7"
                            onClick={() => handleRemoveFine(f.id, f.fine_type)}
                          >
                            <Trash size={13} />
                          </IconButton>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {error && <Banner tone="error">{error}</Banner>}
          {success && <Banner tone="success">{success}</Banner>}
        </div>

        {roundClosed && (
          <div className="shrink-0 border-t border-red-500/18 bg-red-900/12 px-4 py-3">
            <p className="flex items-center justify-center gap-1.5 text-xs text-red-200">
              <Lock size={12} weight="fill" /> This round is locked
            </p>
          </div>
        )}
      </motion.div>
    </>
  );
}

const QuickFinesDrawer = ({ isOpen, onClose, rounds, players, userId, userPlayerId = null, currentRoundId = null, onFinesSaved = null }) =>
  createPortal(
    <AnimatePresence>
      {isOpen && (
        <DrawerBody
          key="quick-fines"
          onClose={onClose}
          rounds={rounds}
          players={players}
          userPlayerId={userPlayerId}
          currentRoundId={currentRoundId}
          onFinesSaved={onFinesSaved}
        />
      )}
    </AnimatePresence>,
    document.body
  );

export default QuickFinesDrawer;
