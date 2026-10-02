import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CloudArrowUp, Lock, Golf, CheckCircle } from '@phosphor-icons/react';
import * as db from '../services/supabaseService';
import { PageHeader, Card, SelectField, Banner, Button, Chip, Spinner, EmptyState } from './common';
import { HoleGrid, HoleStepper, ScoreLegend, scoreTone } from './scoring/HoleScorePad';

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
  // Par of the holes actually played, so the +/- figure is honest mid-round
  const playedPar = holes.reduce((a, h) => (typeof scores[h.hole_number] === 'number' ? a + h.par : a), 0);
  const toPar = totalScore - playedPar;

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
      setMsg(`Saved ${filled} hole${filled === 1 ? '' : 's'}.`);
    } catch (err) {
      setMsg('Error: ' + err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 5000);
    }
  };

  const rd = rounds.find(r => r.id === parseInt(selectedRound));
  const openRounds = rounds.filter(r => !r.is_closed);
  const availablePlayers = players.filter(p => includedPlayers.has(p.id));
  const playerName = players.find(p => p.id === parseInt(selectedPlayer))?.name;
  const currentHole = holes.find(h => h.hole_number === selectedHole);
  const progress = holes.length ? Math.round((filled / holes.length) * 100) : 0;

  if (openRounds.length === 0) {
    return (
      <EmptyState
        icon={<Lock size={26} weight="duotone" />}
        title="No open rounds"
        message="Every round is currently closed. An admin can reopen one from Admin → Rounds."
      />
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} data-testid="score-entry" className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Enter scores"
        title="Score Entry"
        icon={<Golf size={26} weight="duotone" />}
        lede="Pick a round and player, then tap a hole to log it."
      />

      <Card className="mb-5 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField
            label="Round"
            value={selectedRound || ''}
            onChange={setSelectedRound}
            options={openRounds.map(r => ({ value: r.id, label: `R${r.round_number} · ${r.courses?.name || 'No course'}` }))}
            data-testid="score-round-select"
          />
          <SelectField
            label="Player"
            value={selectedPlayer || ''}
            onChange={setSelectedPlayer}
            placeholder="Choose player…"
            options={availablePlayers.map(p => ({ value: p.id, label: p.name }))}
            hint={selectedRound && availablePlayers.length === 0 ? 'No players are marked as playing this round.' : undefined}
            data-testid="score-player-select"
          />
        </div>

        {rd && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#D4AF37]/10 pt-3.5">
            <Chip tone="gold">{rd.courses?.name || 'No course'}</Chip>
            <Chip>Par <span className="pg-num text-white">{rd.courses?.par ?? '—'}</span></Chip>
            <Chip>Rating <span className="pg-num text-white">{rd.courses?.rating ?? '—'}</span></Chip>
            <Chip>Slope <span className="pg-num text-white">{rd.courses?.slope ?? '—'}</span></Chip>
            {rd.beer_hole && <Chip tone="rose">🍺 H{rd.beer_hole}</Chip>}
            {rd.joker_hole && <Chip tone="purple">🎭 H{rd.joker_hole}</Chip>}
          </div>
        )}
      </Card>

      {rd?.is_closed && (
        <Banner tone="error" className="mb-5">
          <strong>Round closed.</strong> No new scores can be added or changed.
        </Banner>
      )}

      {!selectedPlayer && !rd?.is_closed && (
        <Card className="px-6 py-12 text-center">
          <Golf size={30} weight="duotone" className="mx-auto mb-3 text-[#D4AF37]/55" />
          <p className="text-sm text-[#A9C5B4]">Choose a player above to start entering scores.</p>
        </Card>
      )}

      {/* Editable scorecard */}
      {selectedPlayer && !rd?.is_closed && (
        <Card className="overflow-hidden">
          {/* Summary strip. Deliberately not sticky: as the first child of the
              card it would float over the hole grid rather than above it. */}
          <div className="border-b border-[#D4AF37]/12 bg-[#0C2416]/80 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="pg-eyebrow">Scoring for</p>
                <p className="truncate text-sm font-bold text-[#D4AF37]">{playerName}</p>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <p className="pg-eyebrow">Holes</p>
                  <p className="pg-num text-sm font-bold text-white">{filled}/{holes.length}</p>
                </div>
                <div>
                  <p className="pg-eyebrow">Strokes</p>
                  <p className="pg-num text-sm font-bold text-white">{totalScore || '—'}</p>
                </div>
                <div>
                  <p className="pg-eyebrow">To par</p>
                  <p
                    className={`pg-num text-sm font-bold ${
                      filled === 0 ? 'text-[#A9C5B4]' : toPar < 0 ? 'text-emerald-300' : toPar > 0 ? 'text-orange-300' : 'text-white'
                    }`}
                  >
                    {filled === 0 ? '—' : toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : toPar}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-[#03110A]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F1D67E]"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>

          {holesLoading ? (
            <div className="flex items-center justify-center py-16"><Spinner /></div>
          ) : holes.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-[#A9C5B4]">No holes configured for this course.</p>
              <p className="mt-1 text-xs text-[#A9C5B4]/65">Set par &amp; SI in Admin → Courses → Holes.</p>
            </div>
          ) : (
            <>
              <div className="p-4 sm:p-5">
                <HoleGrid
                  holes={holes}
                  scores={scores}
                  selectedHole={selectedHole}
                  onSelectHole={setSelectedHole}
                  beerHole={rd?.beer_hole}
                  jokerHole={rd?.joker_hole}
                />
                <ScoreLegend className="mt-4 justify-center" />
              </div>

              {selectedHole && (
                <div className="px-4 pb-4 sm:px-5">
                  <HoleStepper
                    hole={currentHole}
                    value={scores[selectedHole]}
                    onChange={(v) => updateScore(selectedHole, v)}
                    onAdjust={(d) => adjustScore(selectedHole, d, currentHole?.par)}
                    beerHole={rd?.beer_hole}
                    jokerHole={rd?.joker_hole}
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#D4AF37]/12 bg-[#0C2416]/60 px-4 py-3.5 sm:px-5">
                <div className="min-w-0 flex-1">
                  {msg && (
                    <p className={`flex items-center gap-1.5 text-xs ${msg.startsWith('Error') ? 'text-red-300' : 'text-emerald-300'}`}>
                      {!msg.startsWith('Error') && <CheckCircle size={14} weight="fill" />}
                      {msg}
                    </p>
                  )}
                </div>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={saving || filled === 0}
                  icon={<CloudArrowUp size={16} weight="bold" />}
                  data-testid="save-scores-btn"
                >
                  {saving ? 'Saving…' : `Save ${filled || ''} ${filled === 1 ? 'hole' : 'holes'}`.trim()}
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Read-only view for closed rounds */}
      {selectedPlayer && rd?.is_closed && (
        <Card className="overflow-hidden border-red-500/20">
          <div className="flex items-center justify-between border-b border-red-500/12 bg-red-900/12 px-4 py-3">
            <p className="text-sm font-bold text-[#D4AF37]">{playerName}</p>
            <Chip tone="red"><Lock size={10} weight="fill" /> View only</Chip>
          </div>
          <div className="p-4">
            {holes.length > 0 ? (
              <div className="grid grid-cols-9 gap-2">
                {holes.map(h => {
                  const v = scores[h.hole_number];
                  const hasV = v != null && v !== '';
                  const tone = scoreTone(v, h.par);
                  const cls = {
                    empty: 'border-[#D4AF37]/10 bg-[#03110A]/55 text-[#A9C5B4]/55',
                    eagle: 'border-[#D4AF37]/55 bg-[#D4AF37]/18 text-[#F1D67E]',
                    birdie: 'border-emerald-400/45 bg-emerald-500/14 text-emerald-200',
                    par: 'border-white/20 bg-white/6 text-white',
                    bogey: 'border-orange-400/40 bg-orange-500/12 text-orange-200',
                    double: 'border-red-500/40 bg-red-500/12 text-red-200',
                  }[tone];
                  return (
                    <div key={h.hole_number} className="text-center">
                      <div className="pg-num mb-1 text-[10px] text-[#A9C5B4]">H{h.hole_number}</div>
                      <div className="pg-num mb-1 text-[10px] text-[#D4AF37]/55">P{h.par}</div>
                      <div className={`pg-num flex h-10 w-full items-center justify-center rounded-lg border text-sm font-bold ${cls}`}>
                        {hasV ? v : '–'}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-[#A9C5B4]">No hole data available.</p>
            )}
          </div>
          <div className="border-t border-red-500/12 bg-red-900/8 px-4 py-3">
            <p className="text-center text-xs text-[#A9C5B4]">Scores can’t be edited because this round is closed.</p>
          </div>
        </Card>
      )}
    </motion.div>
  );
};

export default ScoreEntry;
