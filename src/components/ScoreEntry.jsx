import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CloudArrowUp } from '@phosphor-icons/react';
import * as db from '../services/supabaseService';

const ScoreEntry = ({ rounds, players, userId, userPlayerId = null, currentRoundId = null }) => {
  const [selectedRound, setSelectedRound] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [holes, setHoles] = useState([]);
  const [holesLoading, setHolesLoading] = useState(false);
  const [scores, setScores] = useState({});
  const [selectedHole, setSelectedHole] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [includedPlayers, setIncludedPlayers] = useState(new Set());
  const hasSetDefaults = useRef(false);

  // Get live round (is_current flag or currentRoundId match)
  const liveRound = useMemo(() => {
    // Priority: 1) Round with is_current flag, 2) Round matching currentRoundId, 3) First open round
    return rounds.find(r => r.is_current) ||
           rounds.find(r => r.id === parseInt(currentRoundId)) ||
           rounds.find(r => !r.is_closed);
  }, [rounds, currentRoundId]);

  // Set round default once when component mounts with data
  useEffect(() => {
    if (hasSetDefaults.current) return;
    if (rounds.length === 0) return;

    hasSetDefaults.current = true;

    // Set round default priority: 1) Live round if open, 2) First open round
    let defaultRound = null;
    if (liveRound && !liveRound.is_closed) {
      defaultRound = liveRound.id;
    } else {
      const openRounds = rounds.filter(r => !r.is_closed);
      defaultRound = openRounds[0]?.id || rounds[0]?.id;
    }
    if (defaultRound) setSelectedRound(defaultRound);
  }, [rounds, liveRound]);

  // Set player default whenever userPlayerId becomes available
  useEffect(() => {
    if (!userPlayerId) return;
    if (players.length === 0) return;
    if (selectedPlayer) return; // Don't override if already selected

    const linkedPlayer = players.find(p => p.id === userPlayerId);
    if (linkedPlayer) {
      setSelectedPlayer(userPlayerId);
    }
  }, [userPlayerId, players, selectedPlayer]);

  useEffect(() => {
    if (!selectedRound) return;
    setHolesLoading(true);
    setHoles([]);
    setIncludedPlayers(new Set());

    Promise.all([
      db.getHolesForRound(selectedRound),
      db.getRoundParticipants(selectedRound)
    ]).then(([holesData, participantIds]) => {
      setHoles(holesData || []);
      setIncludedPlayers(new Set(participantIds || []));
    }).catch(() => {
      setHoles([]);
    }).finally(() => {
      setHolesLoading(false);
    });

    // Only reset player/scores when round actually changes (not initial mount)
    if (hasSetDefaults.current) {
      setSelectedPlayer(null);
    }
    setSelectedHole(null);
    setScores({});
  }, [selectedRound]);

  useEffect(() => {
    if (!selectedRound || !selectedPlayer) { setScores({}); setSelectedHole(null); return; }
    setScores({}); // Clear while loading
    db.getScoresForRound(selectedRound).then(data => {
      const ps = {};
      data.filter(s => s.player_id === parseInt(selectedPlayer)).forEach(s => { ps[s.hole_number] = s.strokes; });
      setScores(ps);
    }).catch(() => setScores({}));
  }, [selectedRound, selectedPlayer]);

  const updateScore = (hole, val) => {
    const n = val === '' ? '' : parseInt(val);
    if (val !== '' && (isNaN(n) || n < 0 || n > 20)) return;
    setScores(p => ({ ...p, [hole]: n }));
  };

  const adjustScore = (hole, delta, par) => {
    const current = scores[hole];
    const base = current != null && current !== '' ? parseInt(current) : par || 4;
    const newVal = Math.max(1, Math.min(15, base + delta));
    setScores(p => ({ ...p, [hole]: newVal }));
  };

  const totalScore = Object.values(scores).reduce((a, b) => (typeof b === 'number' ? a + b : a), 0);
  const totalPar = holes.reduce((a, h) => a + h.par, 0);
  const filled = Object.values(scores).filter(v => typeof v === 'number' && v > 0).length;

  const handleSave = async () => {
    if (!selectedPlayer || !selectedRound || filled === 0) return;
    setSaving(true);
    setMsg('');
    try {
      const scoreRows = Object.entries(scores).filter(([, v]) => typeof v === 'number' && v > 0).map(([hole, strokes]) => ({
        round_id: parseInt(selectedRound),
        player_id: parseInt(selectedPlayer),
        hole_number: parseInt(hole),
        strokes
      }));
      await db.upsertScores(scoreRows);
      setMsg(`Saved ${filled} holes!`);
    } catch (err) {
      setMsg('Error: ' + err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 5000);
    }
  };

  const rd = rounds.find(r => r.id === parseInt(selectedRound));

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} data-testid="score-entry">
      <div className="text-center mb-8"><h2 className="text-3xl font-sans text-[#D4AF37] mb-2">Score Entry</h2></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 max-w-2xl mx-auto">
        <div>
          <label className="text-xs text-[#A9C5B4] uppercase tracking-wider block mb-2">Round</label>
          <select value={selectedRound || ''} onChange={e => setSelectedRound(e.target.value)} className="w-full px-4 py-3 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white focus:outline-none text-sm">
            {rounds.filter(r => !r.is_closed).map(r => <option key={r.id} value={r.id}>{r.courses?.name} (Round {r.round_number})</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-[#A9C5B4] uppercase tracking-wider block mb-2">Player</label>
          <select value={selectedPlayer || ''} onChange={e => setSelectedPlayer(e.target.value)} className="w-full px-4 py-3 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white focus:outline-none text-sm">
            <option value="">Choose player...</option>
            {players.filter(p => includedPlayers.has(p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      {rd && <div className="flex flex-wrap justify-center gap-4 mb-6 text-xs text-[#A9C5B4]">
        <span>Course: <strong className="text-white">{rd.courses?.name}</strong></span>
        <span>Par: <strong className="text-white">{rd.courses?.par}</strong></span>
        <span>Rating: <strong className="text-white">{rd.courses?.rating}</strong></span>
        <span>Slope: <strong className="text-white">{rd.courses?.slope}</strong></span>
      </div>}
      {rd?.is_closed && (
        <div className="max-w-2xl mx-auto rounded-xl border border-red-500/30 bg-red-900/20 p-5 text-center mb-6">
          <p className="text-red-300 text-sm font-semibold mb-1">Round Closed</p>
          <p className="text-[#A9C5B4] text-xs">This round has been closed. No new scores can be added or changed.</p>
        </div>
      )}
      {selectedPlayer && !rd?.is_closed && (
        <div className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 overflow-hidden shadow-2xl max-w-3xl mx-auto">
          <div className="p-4 border-b border-[#D4AF37]/10 flex items-center justify-between">
            <h3 className="text-sm text-white"><span className="text-[#D4AF37] font-bold">{players.find(p => p.id === parseInt(selectedPlayer))?.name}</span></h3>
            <div className="text-xs text-[#A9C5B4]">{filled}/{holes.length} holes &middot; Total: <span className={`font-bold ${totalScore - totalPar < 0 ? 'text-emerald-400' : totalScore - totalPar > 0 ? 'text-orange-400' : 'text-white'}`}>{totalScore || '-'}</span>{totalScore > 0 && <span className="ml-1">({totalScore - totalPar >= 0 ? '+' : ''}{totalScore - totalPar})</span>}</div>
          </div>

          {/* Hole Selector Grid */}
          {holesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin" />
            </div>
          ) : holes.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[#A9C5B4] text-sm">No holes configured for this course</p>
            </div>
          ) : (
            <>
              <div className="p-4">
                {[{ label: 'Front 9', slice: [0, 9] }, { label: 'Back 9', slice: [9, 18] }].map(({ label, slice }) => {
                  const sectionHoles = holes.slice(...slice);
                  if (sectionHoles.length === 0) return null;
                  return (
                    <div key={label} className="mb-4">
                      <p className="text-xs text-[#A9C5B4] uppercase tracking-wider mb-2">{label}</p>
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
                              className={`aspect-square rounded-lg border text-sm font-bold transition-all relative ${
                                isSelected
                                  ? 'ring-2 ring-[#D4AF37] ring-offset-1 ring-offset-[#0F2C1D] ' + baseTone
                                  : baseTone + ' hover:border-[#D4AF37]/50'
                              }`}
                              title={`Par ${h.par}, SI ${h.stroke_index}`}
                            >
                              <span className="block text-xs opacity-70">{h.hole_number}</span>
                              <span className="block text-sm">{hasV ? v : '−'}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Hole Score Input */}
              {selectedHole && (
                <div className="px-4 pb-4">
                  <div className="bg-[#051A10]/50 rounded-xl p-4 border border-[#D4AF37]/20">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-[#A9C5B4]">Hole {selectedHole}</span>
                      <span className="text-xs text-[#A9C5B4]">Par {holes.find(h => h.hole_number === selectedHole)?.par} • SI {holes.find(h => h.hole_number === selectedHole)?.stroke_index}</span>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => adjustScore(selectedHole, -1, holes.find(h => h.hole_number === selectedHole)?.par)}
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
                        onClick={() => adjustScore(selectedHole, 1, holes.find(h => h.hole_number === selectedHole)?.par)}
                        className="w-14 h-14 rounded-xl bg-[#051A10] border border-[#D4AF37]/30 text-[#D4AF37] text-2xl font-bold active:bg-[#D4AF37]/20 flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                    {/* Quick set buttons */}
                    <div className="flex justify-center gap-2 mt-3">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
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
                </div>
              )}

              <div className="p-4 border-t border-[#D4AF37]/10 flex items-center justify-between gap-3">
                {msg && <p className={`text-xs flex-1 ${msg.includes('Error') ? 'text-red-400' : 'text-emerald-400'}`}>{msg}</p>}
                <button onClick={handleSave} disabled={saving || filled === 0} className="flex items-center gap-2 px-6 py-2.5 bg-[#D4AF37] text-[#051A10] font-bold text-sm rounded-lg hover:bg-[#F1D67E] transition-colors disabled:opacity-40 ml-auto" data-testid="save-scores-btn">
                  <CloudArrowUp size={16} weight="bold" /> {saving ? 'Saving...' : 'Save Scores'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {/* Read-only view for closed rounds - show existing scores */}
      {selectedPlayer && rd?.is_closed && (
        <div className="rounded-xl border border-red-500/20 bg-[#0F2C1D]/90 overflow-hidden shadow-2xl max-w-3xl mx-auto">
          <div className="p-4 border-b border-red-500/10 flex items-center justify-between bg-red-900/10">
            <h3 className="text-sm text-white"><span className="text-[#D4AF37] font-bold">{players.find(p => p.id === parseInt(selectedPlayer))?.name}</span></h3>
            <span className="px-2 py-1 text-[10px] bg-red-500/20 text-red-400 rounded border border-red-500/30">Round Closed - View Only</span>
          </div>
          <div className="p-4">
            {holes.length > 0 ? (
              <div className="grid grid-cols-9 gap-3">
                {holes.map(h => {
                  const v = scores[h.hole_number];
                  const hasV = v != null && v !== '';
                  const diff = hasV ? v - h.par : 0;
                  const tone = !hasV ? 'bg-[#051A10]/50 border-[#D4AF37]/10 text-[#A9C5B4]' : diff < 0 ? 'bg-emerald-900/30 border-emerald-500/30 text-emerald-300' : diff === 0 ? 'bg-[#051A10] border-[#D4AF37]/20 text-white' : 'bg-orange-900/20 border-orange-500/30 text-orange-300';
                  return (
                    <div key={h.hole_number} className="text-center">
                      <div className="text-[10px] text-[#A9C5B4] mb-1">H{h.hole_number}</div>
                      <div className="text-[10px] text-[#D4AF37]/60 mb-1">P{h.par}</div>
                      <div className={`w-full h-10 flex items-center justify-center rounded-lg border text-sm font-bold ${tone}`}>
                        {hasV ? v : '-'}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-[#A9C5B4] text-sm py-4">No hole data available</p>
            )}
          </div>
          <div className="p-4 border-t border-red-500/10 bg-red-900/5">
            <p className="text-center text-xs text-[#A9C5B4]">Scores cannot be edited because this round is closed.</p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ScoreEntry;
