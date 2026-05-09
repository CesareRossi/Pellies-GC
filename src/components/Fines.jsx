import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BeerBottle, Club, Flag, Golf, MinusCircle, PlusCircle, Skull, Trash, Wine, XCircle } from '@phosphor-icons/react';
import * as db from '../services/supabaseService';

const FINE_TYPES = [
  { id: 'ThreePutt', label: '3 Putt', icon: <MinusCircle size={20} />, penalty: '1 Shot' },
  { id: 'FourPutt', label: '4 Putt', icon: <Wine size={20} />, penalty: 'Beer Down' },
  { id: 'BunkerToBunker', label: 'Bunker to Bunker', icon: <Flag size={20} />, penalty: '1 Shot' },
  { id: 'RestingOnClub', label: 'Resting on Club', icon: <Club size={20} />, penalty: '1 Shot' },
  { id: 'Shank', label: 'Shank', icon: <Skull size={20} />, penalty: '1 Shot' },
  { id: 'NotPastLadies', label: 'Not Past Ladies', icon: <XCircle size={20} />, penalty: '1 Shot' },
  { id: 'SandSpecialist', label: 'Sand Specialist', icon: <Golf size={20} />, penalty: '1 Shot' },
];

const Fines = ({ rounds, players, currentRoundId }) => {
  const [selectedRound, setSelectedRound] = useState(currentRoundId || '');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadFines = useCallback(async () => {
    if (!selectedRound) return;
    setLoading(true);
    try {
      const data = await db.getFinesForRound(parseInt(selectedRound));
      setFines(data);
    } catch (e) {
      setError('Failed to load fines');
    } finally {
      setLoading(false);
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
      await db.addFine({
        round_id: parseInt(selectedRound),
        player_id: parseInt(selectedPlayer),
        fine_type: fineType,
        settled: false,
      });
      await loadFines();
    } catch (e) {
      setError('Failed to add fine');
    }
  };

  const removeFine = async (fineId) => {
    try {
      await db.deleteFine(fineId);
      await loadFines();
    } catch (e) {
      setError('Failed to remove fine');
    }
  };

  const settleFine = async (fineId, settled) => {
    try {
      await db.settleFine(fineId, settled);
      await loadFines();
    } catch (e) {
      setError('Failed to update fine');
    }
  };

  // Calculate summary
  const summary = {};
  fines.forEach(fine => {
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
    }
  });

  const activeRounds = rounds.filter(r => !r.is_closed);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto"
    >
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl sm:text-3xl font-sans font-bold text-[#D4AF37] tracking-tight">
          Fines
        </h2>
        <p className="text-sm text-[#A9C5B4] mt-1">
          Track fines for the tour - honesty is key!
        </p>
      </div>

      {/* Selectors */}
      <div className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 backdrop-blur-md p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#A9C5B4] uppercase tracking-wider block mb-2">Round</label>
            <select
              value={selectedRound}
              onChange={(e) => setSelectedRound(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white focus:outline-none text-sm"
            >
              <option value="">Select round...</option>
              {activeRounds.map(r => (
                <option key={r.id} value={r.id}>
                  {r.courses?.name} (Round {r.round_number})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-[#A9C5B4] uppercase tracking-wider block mb-2">Player</label>
            <select
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white focus:outline-none text-sm"
            >
              <option value="">Select player...</option>
              {players.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Fine Buttons */}
      {selectedRound && selectedPlayer && (
        <div className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 backdrop-blur-md p-4 mb-6">
          <h3 className="text-sm font-semibold text-[#D4AF37] uppercase tracking-wider mb-4">
            Add Fine
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {FINE_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => addFine(type.id)}
                className="flex flex-col items-center gap-2 p-3 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 hover:border-[#D4AF37]/50 hover:bg-[#051A10]/80 transition-all active:scale-[0.98]"
              >
                <span className="text-[#D4AF37]">{type.icon}</span>
                <span className="text-xs text-white font-medium text-center">{type.label}</span>
                <span className="text-[10px] text-[#A9C5B4]">{type.penalty}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary - Shows first */}
      {selectedRound && Object.keys(summary).length > 0 && (
        <div className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 backdrop-blur-md overflow-hidden mb-6">
          <div className="bg-[#051A10] border-b border-[#D4AF37]/30 px-4 py-3">
            <h3 className="text-sm font-semibold text-[#D4AF37] uppercase tracking-wider">
              Daily Summary
            </h3>
          </div>
          <div className="divide-y divide-[#D4AF37]/10">
            {Object.entries(summary).map(([playerName, data]) => (
              <div key={playerName} className="flex items-center justify-between px-4 py-3">
                <span className="text-white font-medium">{playerName}</span>
                <div className="flex items-center gap-4 text-sm">
                  {data.shots > 0 && (
                    <span className="text-amber-400">{data.shots} shot{data.shots !== 1 ? 's' : ''}</span>
                  )}
                  {data.beers > 0 && (
                    <span className="text-orange-400">{data.beers} beer{data.beers !== 1 ? 's' : ''}</span>
                  )}
                  <span className="text-[#A9C5B4]">{data.total} total</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Fines List */}
      {selectedRound && (
        <div className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 backdrop-blur-md overflow-hidden">
          <div className="bg-[#051A10] border-b border-[#D4AF37]/30 px-4 py-3">
            <h3 className="text-sm font-semibold text-[#A9C5B4] uppercase tracking-wider">
              Current Fines ({fines.length})
            </h3>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[#A9C5B4] text-sm">Loading...</p>
            </div>
          ) : fines.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[#A9C5B4]">No fines yet. Be good... or be good at it!</p>
            </div>
          ) : (
            <div className="divide-y divide-[#D4AF37]/10">
              {fines.map(fine => {
                const type = FINE_TYPES.find(t => t.id === fine.fine_type);
                return (
                  <div
                    key={fine.id}
                    className={`flex items-center justify-between px-4 py-3 ${fine.settled ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[#D4AF37]">{type?.icon || <Skull size={20} />}</span>
                      <div>
                        <p className="text-white font-medium text-sm">{fine.players?.name}</p>
                        <p className="text-[#A9C5B4] text-xs">{type?.label} • {type?.penalty}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => settleFine(fine.id, !fine.settled)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          fine.settled
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {fine.settled ? 'Settled' : 'Pending'}
                      </button>
                      <button
                        onClick={() => removeFine(fine.id)}
                        className="p-1 text-[#A9C5B4] hover:text-red-400 transition-colors"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default Fines;
