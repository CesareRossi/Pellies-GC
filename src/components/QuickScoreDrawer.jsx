import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Golf, CloudArrowUp } from '@phosphor-icons/react';
import * as db from '../services/supabaseService';

const QuickScoreDrawer = ({ isOpen, onClose, rounds, players, userId, userPlayerId = null, currentRoundId = null }) => {
  const [selectedRound, setSelectedRound] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [selectedHole, setSelectedHole] = useState(null);
  const [holes, setHoles] = useState([]);
  const [holesLoading, setHolesLoading] = useState(false);
  const [scores, setScores] = useState({}); // hole_number -> strokes
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [excludedPlayers, setExcludedPlayers] = useState(new Set());
  const [roundClosed, setRoundClosed] = useState(false);

  // Get active (non-closed) rounds only - memoized to prevent dependency array issues
  const activeRounds = useMemo(() => rounds.filter(r => !r.is_closed), [rounds]);
  
  // Get the current/live round from the rounds list
  const liveRound = useMemo(() => {
    return rounds.find(r => r.is_current) || 
           rounds.find(r => r.id === parseInt(currentRoundId)) ||
           rounds.find(r => !r.is_closed);
  }, [rounds, currentRoundId]);

  // Set defaults when drawer opens
  useEffect(() => {
    if (isOpen) {
      // Default round priority: 1) Live/current round, 2) First open round
      let defaultRound = '';
      const liveRoundId = liveRound?.id;
      
      if (liveRoundId && !liveRound?.is_closed) {
        // Live round is open - use it
        defaultRound = liveRoundId;
      } else if (activeRounds.length > 0) {
        // Use first open round
        defaultRound = activeRounds[0].id;
      }
      setSelectedRound(defaultRound ? String(defaultRound) : '');
      
      // Default player: linked player for this user
      if (userPlayerId && players.find(p => p.id === userPlayerId)) {
        setSelectedPlayer(String(userPlayerId));
      } else {
        setSelectedPlayer('');
      }
      
      // Reset UI state but keep any loaded scores
      setSelectedHole(null);
      setError('');
      setSuccess('');
    }
  }, [isOpen, liveRound, activeRounds, userPlayerId, players]);

  useEffect(() => {
    if (!selectedRound) {
      setHoles([]);
      setExcludedPlayers(new Set());
      setRoundClosed(false);
      setScores({});
      setSelectedHole(null);
      setHolesLoading(false);
      return;
    }
    
    const round = rounds.find(r => r.id === parseInt(selectedRound));
    setRoundClosed(round?.is_closed || false);
    setHolesLoading(true);
    
    Promise.all([
      db.getHolesForRound(selectedRound),
      db.getRoundExclusions(selectedRound)
    ]).then(([holesData, exclusionIds]) => {
      setHoles(holesData || []);
      setExcludedPlayers(new Set(exclusionIds || []));
      
      // Load existing scores if player selected
      if (selectedPlayer) {
        return db.getScoresForRound(selectedRound);
      }
      return null;
    }).then(scoreData => {
      if (scoreData) {
        const existingScores = {};
        scoreData.filter(s => s.player_id === parseInt(selectedPlayer)).forEach(s => {
          existingScores[s.hole_number] = s.strokes;
        });
        setScores(existingScores);
      } else {
        setScores({});
      }
    }).catch(() => {
      setHoles([]);
      setScores({});
    }).finally(() => {
      setHolesLoading(false);
    });
  }, [selectedRound, rounds, selectedPlayer, isOpen]);

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
    const newVal = Math.max(1, Math.min(15, base + delta));
    setScores(prev => ({ ...prev, [selectedHole]: newVal }));
  };

  const handleSubmit = async () => {
    if (!selectedRound || !selectedPlayer) {
      setError('Please select a round and player');
      return;
    }
    
    if (roundClosed) {
      setError('This round is closed. Cannot add scores.');
      return;
    }

    // Build scores array from state
    const scoresToSave = Object.entries(scores)
      .filter(([_, strokes]) => strokes !== '' && strokes != null)
      .map(([holeNum, strokes]) => ({
        round_id: parseInt(selectedRound),
        player_id: parseInt(selectedPlayer),
        hole_number: parseInt(holeNum),
        strokes: parseInt(strokes)
      }));

    if (scoresToSave.length === 0) {
      setError('No scores to save');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await db.upsertScores(scoresToSave);
      setSuccess(`Saved ${scoresToSave.length} score${scoresToSave.length > 1 ? 's' : ''}`);
    } catch (e) {
      setError(e.message || 'Failed to save scores');
    } finally {
      setSaving(false);
      setTimeout(() => { setError(''); setSuccess(''); }, 4000);
    }
  };

  const availablePlayers = players.filter(p => !excludedPlayers.has(p.id));

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 lg:left-1/2 lg:-translate-x-1/2 lg:right-auto lg:w-full lg:max-w-md lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:rounded-2xl lg:max-h-[90vh] bg-[#0F2C1D] border-t lg:border border-[#D4AF37]/30 rounded-t-2xl z-[101] max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar - mobile only */}
            <div className="flex items-center justify-center pt-3 pb-2 lg:hidden">
              <div className="w-12 h-1.5 bg-[#D4AF37]/30 rounded-full" />
            </div>
            
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#D4AF37]/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Golf size={24} weight="duotone" className="text-[#D4AF37]" />
                <h2 className="text-lg font-bold text-[#D4AF37]">Quick Score</h2>
              </div>
              <button onClick={onClose} className="p-2 text-[#A9C5B4] hover:text-white">
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Round selector */}
              <div>
                <label className="text-xs text-[#A9C5B4] uppercase tracking-wider block mb-2">Round</label>
                {activeRounds.length === 0 ? (
                  <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-center">
                    <p className="text-red-400 text-sm">No active rounds available</p>
                  </div>
                ) : (
                  <select 
                    value={selectedRound} 
                    onChange={(e) => setSelectedRound(e.target.value)} 
                    className="w-full px-4 py-3 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white focus:outline-none text-sm"
                  >
                    <option value="">Choose round...</option>
                    {activeRounds.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.courses?.name} (Round {r.round_number})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {roundClosed && selectedRound && (
                <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm font-semibold">Round Closed</p>
                  <p className="text-[#A9C5B4] text-xs">This round is closed. Scores cannot be added.</p>
                </div>
              )}

              {/* Player selector */}
              {selectedRound && !roundClosed && (
                <div>
                  <label className="text-xs text-[#A9C5B4] uppercase tracking-wider block mb-2">Player</label>
                  <select 
                    value={selectedPlayer} 
                    onChange={(e) => setSelectedPlayer(e.target.value)} 
                    className="w-full px-4 py-3 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white focus:outline-none text-sm"
                  >
                    <option value="">Choose player...</option>
                    {availablePlayers.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Hole Selector Grid */}
              {selectedPlayer && !roundClosed && (
                <div>
                  <label className="text-xs text-[#A9C5B4] uppercase tracking-wider block mb-2">Select Hole</label>
                  {holesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-8 h-8 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin" />
                    </div>
                  ) : holes.length === 0 ? (
                    <p className="text-[#A9C5B4] text-sm text-center py-4">No holes available for this round</p>
                  ) : (
                  <>
                  {[{label:'Front 9',slice:[0,9]},{label:'Back 9',slice:[9,18]}].map(({label,slice})=>{
                    const sectionHoles = holes.slice(...slice);
                    if (sectionHoles.length === 0) return null;
                    return (
                      <div key={label} className="mb-3">
                        <p className="text-[11px] text-[#A9C5B4] uppercase tracking-wider mb-1">{label}</p>
                        <div className="grid grid-cols-9 gap-2">
                          {sectionHoles.map(h => {
                            const v = scores[h.hole_number];
                            const hasV = v != null && v !== '';
                            const isSelected = selectedHole === h.hole_number;
                            const diff = hasV ? v - h.par : 0;
                            const baseTone = !hasV
                              ? 'bg-[#051A10] border-[#D4AF37]/20 text-white'
                              : diff < 0
                                ? 'bg-emerald-900/40 border-emerald-500/40 text-emerald-300'
                                : diff === 0
                                  ? 'bg-[#051A10] border-[#D4AF37]/40 text-white'
                                  : 'bg-orange-900/30 border-orange-500/40 text-orange-300';
                            return (
                              <button
                                key={h.hole_number}
                                onClick={() => setSelectedHole(h.hole_number)}
                                className={`aspect-square rounded-lg border text-xs font-bold transition-all relative ${
                                  isSelected
                                    ? 'ring-2 ring-[#D4AF37] ring-offset-1 ring-offset-[#0F2C1D] ' + baseTone
                                    : baseTone + ' hover:border-[#D4AF37]/50'
                                }`}
                              >
                                <span className="block text-[10px] opacity-70">{h.hole_number}</span>
                                <span className="block">{hasV ? v : '−'}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  </>
                  )}
                </div>
              )}

              {/* Selected Hole Score Input */}
              {selectedHole && !roundClosed && (
                <div className="bg-[#051A10]/50 rounded-xl p-4 border border-[#D4AF37]/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-[#A9C5B4]">Hole {selectedHole}</span>
                    <span className="text-xs text-[#A9C5B4]">Par {holes.find(h => h.hole_number === selectedHole)?.par} • SI {holes.find(h => h.hole_number === selectedHole)?.stroke_index}</span>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => adjustScore(-1)}
                      className="w-14 h-14 rounded-xl bg-[#051A10] border border-[#D4AF37]/30 text-[#D4AF37] text-2xl font-bold active:bg-[#D4AF37]/20 flex items-center justify-center"
                      disabled={scores[selectedHole] != null && scores[selectedHole] !== '' && scores[selectedHole] <= 1}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const h = holes.find(hh => hh.hole_number === selectedHole);
                        const v = scores[selectedHole];
                        const hasV = v != null && v !== '';
                        updateScore(selectedHole, hasV ? v : h?.par || 4);
                      }}
                      className={`w-20 h-14 rounded-xl border text-2xl font-bold ${
                        (() => {
                          const h = holes.find(hh => hh.hole_number === selectedHole);
                          const v = scores[selectedHole];
                          const hasV = v != null && v !== '';
                          if (!hasV) return 'bg-[#051A10] border-[#D4AF37]/30 text-white';
                          const diff = v - h.par;
                          if (diff < 0) return 'bg-emerald-900/40 border-emerald-500/40 text-emerald-300';
                          if (diff === 0) return 'bg-[#051A10] border-[#D4AF37]/40 text-white';
                          return 'bg-orange-900/30 border-orange-500/40 text-orange-300';
                        })()
                      }`}
                    >
                      {(() => {
                        const v = scores[selectedHole];
                        const hasV = v != null && v !== '';
                        return hasV ? v : '−';
                      })()}
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustScore(1)}
                      className="w-14 h-14 rounded-xl bg-[#051A10] border border-[#D4AF37]/30 text-[#D4AF37] text-2xl font-bold active:bg-[#D4AF37]/20 flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                  {/* Quick set buttons */}
                  <div className="flex justify-center gap-2 mt-3">
                    {[1,2,3,4,5,6,7,8].map(n => (
                      <button
                        key={n}
                        onClick={() => updateScore(selectedHole, n)}
                        className={`w-8 h-8 rounded-lg text-sm font-bold border transition-colors ${
                          scores[selectedHole] === n
                            ? 'bg-[#D4AF37] text-[#051A10] border-[#D4AF37]'
                            : 'bg-[#051A10] text-white border-[#D4AF37]/20 hover:border-[#D4AF37]/50'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {error && (
                <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
              {success && (
                <div className="p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-lg">
                  <p className="text-emerald-400 text-sm">{success}</p>
                </div>
              )}

              {/* Submit button */}
              {selectedPlayer && holes.length > 0 && !roundClosed && (
                <button
                  onClick={handleSubmit}
                  disabled={saving || Object.keys(scores).filter(k => scores[k] !== '' && scores[k] != null).length === 0}
                  className="w-full py-4 bg-[#D4AF37] text-[#051A10] font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
                >
                  {saving ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <CloudArrowUp size={20} weight="bold" />
                      Save Scores
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default QuickScoreDrawer;
