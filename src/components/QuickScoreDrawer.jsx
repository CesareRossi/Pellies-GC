import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Golf, CloudArrowUp, Lock, CheckCircle } from '@phosphor-icons/react';
import * as db from '../services/supabaseService';
import { SelectField, Banner, Button, IconButton, Chip, Spinner } from './common';
import { HoleGrid, HoleStepper } from './scoring/HoleScorePad';
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from '../hooks/useOverlay';

const STORAGE_KEY = 'quickScore_lastPlayer';

function DrawerBody({ onClose, rounds, players, userPlayerId, currentRoundId, onScoresSaved }) {
  const panelRef = useRef(null);
  useBodyScrollLock(true);
  useEscapeKey(true, onClose);
  useFocusTrap(panelRef, true);

  const [selectedRound, setSelectedRound] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [selectedHole, setSelectedHole] = useState(null);
  const [holes, setHoles] = useState([]);
  const [holesLoading, setHolesLoading] = useState(false);
  const [scores, setScores] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [includedPlayers, setIncludedPlayers] = useState(new Set());
  const [roundClosed, setRoundClosed] = useState(false);
  const didInit = useRef(false);

  const activeRounds = useMemo(() => rounds.filter(r => !r.is_closed), [rounds]);

  const liveRound = useMemo(() => {
    return rounds.find(r => r.is_current) ||
           rounds.find(r => r.id === parseInt(currentRoundId)) ||
           rounds.find(r => !r.is_closed);
  }, [rounds, currentRoundId]);

  // Defaults, applied once per open
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
      setHoles([]); setIncludedPlayers(new Set()); setRoundClosed(false);
      setScores({}); setSelectedHole(null); setHolesLoading(false);
      return;
    }

    const round = rounds.find(r => r.id === parseInt(selectedRound));
    setRoundClosed(round?.is_closed || false);
    setHolesLoading(true);

    Promise.all([
      db.getHolesForRound(selectedRound),
      db.getRoundParticipants(selectedRound),
    ]).then(([holesData, participantIds]) => {
      setHoles(holesData || []);
      setIncludedPlayers(new Set(participantIds || []));
      if (selectedPlayer) return db.getScoresForRound(selectedRound);
      return null;
    }).then(scoreData => {
      if (scoreData) {
        const existing = {};
        scoreData
          .filter(s => s.player_id === parseInt(selectedPlayer))
          .forEach(s => { existing[s.hole_number] = s.strokes; });
        setScores(existing);
      } else {
        setScores({});
      }
    }).catch(() => {
      setHoles([]); setScores({});
    }).finally(() => setHolesLoading(false));
  }, [selectedRound, rounds, selectedPlayer]);

  useEffect(() => {
    if (selectedPlayer) localStorage.setItem(STORAGE_KEY, selectedPlayer);
  }, [selectedPlayer]);

  const updateScore = (holeNum, val) => {
    if (val === '' || val === null || val === undefined) {
      setScores(prev => ({ ...prev, [holeNum]: '' }));
      return;
    }
    const n = parseInt(val);
    if (isNaN(n) || n < 1 || n > 20) return;
    setScores(prev => ({ ...prev, [holeNum]: n }));
  };

  const adjustScore = (delta) => {
    if (!selectedHole) return;
    const h = holes.find(hh => hh.hole_number === selectedHole);
    const current = scores[selectedHole];
    const base = current != null && current !== '' ? parseInt(current) : h?.par || 4;
    setScores(prev => ({ ...prev, [selectedHole]: Math.max(1, Math.min(15, base + delta)) }));
  };

  const filledCount = Object.values(scores).filter(v => v !== '' && v != null).length;

  const handleSubmit = async () => {
    if (!selectedRound || !selectedPlayer) { setError('Please select a round and player'); return; }
    if (roundClosed) { setError('This round is closed. Cannot add scores.'); return; }

    const scoresToSave = Object.entries(scores)
      .filter(([, strokes]) => strokes !== '' && strokes != null)
      .map(([holeNum, strokes]) => ({
        round_id: parseInt(selectedRound),
        player_id: parseInt(selectedPlayer),
        hole_number: parseInt(holeNum),
        strokes: parseInt(strokes),
      }));

    if (scoresToSave.length === 0) { setError('No scores to save'); return; }

    setSaving(true); setError(''); setSuccess('');
    try {
      await db.upsertScores(scoresToSave);
      setSuccess(`Saved ${scoresToSave.length} score${scoresToSave.length > 1 ? 's' : ''}`);
      onScoresSaved?.();
    } catch (e) {
      setError(e.message || 'Failed to save scores');
    } finally {
      setSaving(false);
      setTimeout(() => { setError(''); setSuccess(''); }, 4000);
    }
  };

  const availablePlayers = players.filter(p => includedPlayers.has(p.id));
  const roundData = rounds.find(r => r.id === parseInt(selectedRound));
  const currentHole = holes.find(h => h.hole_number === selectedHole);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-[#03110A]/78 backdrop-blur-md"
        onClick={onClose}
      />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Quick Score"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        className="pg-card fixed bottom-0 left-0 right-0 z-[101] flex max-h-[88vh] flex-col rounded-b-none rounded-t-3xl lg:bottom-auto lg:left-1/2 lg:right-auto lg:top-1/2 lg:w-full lg:max-w-md lg:max-h-[90vh] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl"
      >
        {/* Grab handle — mobile only */}
        <div className="flex shrink-0 items-center justify-center pb-1 pt-3 lg:hidden">
          <div className="h-1.5 w-11 rounded-full bg-[#D4AF37]/30" />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#D4AF37]/14 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#D4AF37]">
              <Golf size={18} weight="duotone" />
            </span>
            <div className="min-w-0">
              <h2 className="pg-display text-[16px] text-[#D4AF37]">Quick Score</h2>
              {roundData && (
                <p className="truncate text-[11px] text-[#A9C5B4]">
                  R{roundData.round_number} · {roundData.courses?.name}
                </p>
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
            <Banner tone="error">
              <strong>Round closed.</strong> Scores cannot be added.
            </Banner>
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
              {holesLoading ? (
                <div className="flex items-center justify-center py-10"><Spinner size={32} /></div>
              ) : holes.length === 0 ? (
                <p className="py-6 text-center text-sm text-[#A9C5B4]">No holes available for this round.</p>
              ) : (
                <>
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="pg-eyebrow">Select hole</p>
                    <Chip tone={filledCount ? 'emerald' : 'default'}>{filledCount}/{holes.length} logged</Chip>
                  </div>
                  <HoleGrid
                    holes={holes}
                    scores={scores}
                    selectedHole={selectedHole}
                    onSelectHole={setSelectedHole}
                    beerHole={roundData?.beer_hole}
                    jokerHole={roundData?.joker_hole}
                  />
                </>
              )}
            </div>
          )}

          {selectedHole && !roundClosed && (
            <HoleStepper
              hole={currentHole}
              value={scores[selectedHole]}
              onChange={(v) => updateScore(selectedHole, v)}
              onAdjust={adjustScore}
              beerHole={roundData?.beer_hole}
              jokerHole={roundData?.joker_hole}
            />
          )}

          {error && <Banner tone="error">{error}</Banner>}
          {success && (
            <Banner tone="success">
              <span className="flex items-center gap-1.5"><CheckCircle size={14} weight="fill" />{success}</span>
            </Banner>
          )}
        </div>

        {selectedPlayer && holes.length > 0 && !roundClosed && (
          <div className="shrink-0 border-t border-[#D4AF37]/14 bg-[#0C2416]/80 px-4 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            <Button
              variant="primary"
              size="lg"
              block
              onClick={handleSubmit}
              disabled={saving || filledCount === 0}
              icon={<CloudArrowUp size={18} weight="bold" />}
              data-testid="quick-save-scores"
            >
              {saving ? 'Saving…' : 'Save scores'}
            </Button>
          </div>
        )}

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

const QuickScoreDrawer = ({ isOpen, onClose, rounds, players, userId, userPlayerId = null, currentRoundId = null, onScoresSaved = null }) =>
  createPortal(
    // AnimatePresence must stay mounted for the slide-out to play — the old
    // `if (!isOpen) return null` short-circuit killed the exit animation.
    <AnimatePresence>
      {isOpen && (
        <DrawerBody
          key="quick-score"
          onClose={onClose}
          rounds={rounds}
          players={players}
          userPlayerId={userPlayerId}
          currentRoundId={currentRoundId}
          onScoresSaved={onScoresSaved}
        />
      )}
    </AnimatePresence>,
    document.body
  );

export default QuickScoreDrawer;
