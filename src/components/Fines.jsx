import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { BeerBottle, Club, Flag, Golf, MinusCircle, Skull, Trash, Wine, XCircle, Lock, Plus } from '@phosphor-icons/react';
import * as db from '../services/supabaseService';
import { PageHeader, Card, SelectField, Banner, Chip, Spinner, SectionLabel } from './common';

const FINE_TYPES = [
  { id: 'ThreePutt', label: '3 Putt', icon: <MinusCircle size={20} />, penalty: '1 Shot' },
  { id: 'FourPutt', label: '4 Putt', icon: <Wine size={20} />, penalty: 'Beer Down' },
  { id: 'BunkerToBunker', label: 'Bunker to Bunker', icon: <Flag size={20} />, penalty: '1 Shot' },
  { id: 'RestingOnClub', label: 'Resting on Club', icon: <Club size={20} />, penalty: '1 Shot' },
  { id: 'Shank', label: 'Shank', icon: <Skull size={20} />, penalty: '1 Shot' },
  { id: 'NotPastLadies', label: 'Not Past Ladies', icon: <XCircle size={20} />, penalty: '1 Shot' },
  { id: 'SandSpecialist', label: 'Sand Specialist', icon: <Golf size={20} />, penalty: '1 Shot' },
];

const Fines = ({ rounds, players, userId, userPlayerId = null, currentRoundId = null }) => {
  const [selectedRound, setSelectedRound] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [settlingId, setSettlingId] = useState(null);
  const hasSetDefaults = useRef(false);
  const finesListRef = useRef(null);

  // Get live round (is_current flag or currentRoundId match)
  const liveRound = useMemo(() => {
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

  const loadFines = useCallback(async ({ silent = false } = {}) => {
    if (!selectedRound) return;
    if (!silent) setLoading(true);
    try {
      const data = await db.getFinesForRound(parseInt(selectedRound));
      setFines(data);
      setError('');
    } catch (e) {
      setError('Failed to load fines');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedRound]);

  useEffect(() => {
    loadFines();
  }, [loadFines]);

  const addFine = async (fineType) => {
    if (!selectedRound || !selectedPlayer) {
      setError('Please select a round and player');
      return;
    }
    try {
      const created = await db.addFine({
        round_id: parseInt(selectedRound),
        player_id: parseInt(selectedPlayer),
        fine_type: fineType,
        settled: false,
      });
      const player = players.find(p => p.id === parseInt(selectedPlayer));
      setFines(prev => [{ ...created, players: { name: player?.name || 'Unknown' } }, ...prev]);
      setError('');
    } catch (e) {
      setError('Failed to add fine');
    }
  };

  const removeFine = async (fineId) => {
    setFines(prev => prev.filter(f => f.id !== fineId));
    setError('');
    try {
      await db.deleteFine(fineId);
    } catch (e) {
      await loadFines({ silent: true });
      setError('Failed to remove fine');
    }
  };

  const settleFine = async (fineId, settled) => {
    const previous = fines.find(f => f.id === fineId);
    if (!previous || settlingId === fineId) return;

    setSettlingId(fineId);
    setError('');
    setFines(prev => prev.map(f => (f.id === fineId ? { ...f, settled } : f)));

    try {
      await db.settleFine(fineId, settled);
    } catch (e) {
      setFines(prev => prev.map(f => (f.id === fineId ? { ...f, settled: previous.settled } : f)));
      setError('Failed to update fine');
    } finally {
      setSettlingId(null);
    }
  };

  const { sortedFines, summaryEntries } = useMemo(() => {
    const summary = {};
    for (const fine of fines) {
      const playerName = fine.players?.name || 'Unknown';
      if (!summary[playerName]) {
        summary[playerName] = { shots: 0, beers: 0, total: 0, fines: [] };
      }
      summary[playerName].total++;
      summary[playerName].fines.push(fine);
      switch (fine.fine_type) {
        case 'ThreePutt':
        case 'BunkerToBunker':
        case 'RestingOnClub':
        case 'Shank':
        case 'NotPastLadies':
        case 'SandSpecialist':
          summary[playerName].shots += 1;
          break;
        case 'FourPutt':
          summary[playerName].beers += 1;
          break;
        default:
          break;
      }
    }

    const sortedFines = [...fines].sort((a, b) => {
      const nameA = a.players?.name || 'Unknown';
      const nameB = b.players?.name || 'Unknown';
      const byName = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      if (byName !== 0) return byName;
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });

    const summaryEntries = Object.entries(summary).sort(([, a], [, b]) => b.total - a.total);

    return { sortedFines, summaryEntries };
  }, [fines]);

  const selectedRoundData = rounds.find(r => r.id === parseInt(selectedRound));
  const isRoundClosed = selectedRoundData?.is_closed;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto"
    >
      <PageHeader
        eyebrow="Tour discipline"
        title="Fines"
        icon={<BeerBottle size={26} weight="duotone" />}
        lede="Track fines for the tour — honesty is key."
      />

      {/* Selectors */}
      <Card className="mb-5 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField
            label="Round"
            value={selectedRound}
            onChange={setSelectedRound}
            placeholder="Select round…"
            options={rounds.map(r => ({
              value: r.id,
              label: `R${r.round_number} \u00b7 ${r.courses?.name || 'No course'}${r.is_closed ? '  (closed)' : ''}`,
            }))}
            data-testid="fines-round-select"
          />
          <SelectField
            label="Player"
            value={selectedPlayer}
            onChange={setSelectedPlayer}
            placeholder="Select player…"
            options={players.map(p => ({ value: p.id, label: p.name }))}
            data-testid="fines-player-select"
          />
        </div>

        {error && <Banner tone="error" className="mt-4">{error}</Banner>}

        {isRoundClosed && (
          <Banner tone="warning" className="mt-4">
            <span className="flex items-center gap-2">
              <Lock size={14} weight="fill" className="shrink-0" />
              This round is closed. Fines can no longer be added.
            </span>
          </Banner>
        )}
      </Card>

      {/* Fine Buttons - Hidden if round is closed */}
      {selectedRound && selectedPlayer && !isRoundClosed && (
        <Card className="mb-5 p-4 sm:p-5">
          <SectionLabel icon={<Plus size={13} weight="bold" />} className="mb-4">Add fine</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
            {FINE_TYPES.map(type => (
              <button
                key={type.id}
                type="button"
                onClick={() => addFine(type.id)}
                className="group flex flex-col items-center gap-1.5 rounded-xl border border-[#D4AF37]/14 bg-[#03110A]/60 p-3.5 transition-all active:scale-[0.97] hover:-translate-y-0.5 hover:border-[#D4AF37]/42 hover:bg-[#D4AF37]/8"
                data-testid={`fine-add-${type.id}`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] transition-transform group-hover:scale-105">
                  {type.icon}
                </span>
                <span className="text-center text-[12px] font-semibold leading-tight text-white">{type.label}</span>
                <span className="text-[10px] text-[#A9C5B4]">{type.penalty}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Summary - Shows first */}
      {selectedRound && summaryEntries.length > 0 && (
        <Card className="mb-5 overflow-hidden">
          <div className="border-b border-[#D4AF37]/16 bg-[#03110A]/55 px-4 py-3">
            <SectionLabel>Round summary</SectionLabel>
          </div>
          <div className="divide-y divide-[#D4AF37]/8">
            {summaryEntries.map(([playerName, data], i) => (
              <div key={playerName} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="pg-num flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/5 text-[11px] font-bold text-[#A9C5B4]">
                    {i + 1}
                  </span>
                  <span className="truncate text-sm font-medium text-white">{playerName}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {data.shots > 0 && <Chip tone="amber">{data.shots} shot{data.shots !== 1 ? 's' : ''}</Chip>}
                  {data.beers > 0 && <Chip tone="rose">{data.beers} beer{data.beers !== 1 ? 's' : ''}</Chip>}
                  <Chip>{data.total} total</Chip>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Current Fines List */}
      {selectedRound && (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[#D4AF37]/16 bg-[#03110A]/55 px-4 py-3">
            <SectionLabel className="flex-1">Current fines</SectionLabel>
            <Chip tone={fines.length ? 'rose' : 'default'}>{fines.length}</Chip>
          </div>

          {loading ? (
            <div className="p-10 text-center">
              <Spinner size={30} className="mx-auto mb-3" />
              <p className="text-sm text-[#A9C5B4]">Loading…</p>
            </div>
          ) : fines.length === 0 ? (
            <div className="p-10 text-center">
              <BeerBottle size={26} weight="duotone" className="mx-auto mb-2.5 text-[#D4AF37]/40" />
              <p className="text-sm text-[#A9C5B4]">No fines yet. Be good… or be good at it.</p>
            </div>
          ) : (
            <div ref={finesListRef} className="divide-y divide-[#D4AF37]/10 max-h-[min(60vh,28rem)] overflow-y-auto">
              {sortedFines.map(fine => {
                const type = FINE_TYPES.find(t => t.id === fine.fine_type);
                const isSettling = settlingId === fine.id;
                return (
                  <div
                    key={fine.id}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 transition-opacity ${fine.settled ? 'opacity-55' : ''} ${isSettling ? 'opacity-70' : ''}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#D4AF37]/10 text-[#D4AF37]">
                        {type?.icon || <Skull size={18} />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-white">{fine.players?.name}</p>
                        <p className="truncate text-[11px] text-[#A9C5B4]">{type?.label} · {type?.penalty}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => settleFine(fine.id, !fine.settled)}
                        disabled={isSettling}
                        aria-pressed={fine.settled}
                        className={`pg-chip min-w-[70px] justify-center transition-colors disabled:cursor-wait ${
                          fine.settled ? 'pg-chip-emerald' : 'pg-chip-amber'
                        }`}
                      >
                        {isSettling ? '…' : fine.settled ? 'Settled' : 'Pending'}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFine(fine.id)}
                        disabled={isSettling}
                        aria-label="Remove fine"
                        className="pg-icon-btn pg-icon-btn-danger h-8 w-8"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </motion.div>
  );
};

export default Fines;
