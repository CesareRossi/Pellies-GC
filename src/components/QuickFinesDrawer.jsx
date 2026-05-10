import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BeerBottle, CloudArrowUp, MinusCircle, Wine, Flag, Club, Skull, XCircle, Golf } from '@phosphor-icons/react';
import * as db from '../services/supabaseService';

const FINE_TYPES = [
  { id: 'ThreePutt', label: '3 Putt', icon: MinusCircle, penalty: '1 Shot' },
  { id: 'FourPutt', label: '4 Putt', icon: Wine, penalty: 'Beer Down' },
  { id: 'BunkerToBunker', label: 'Bunker to Bunker', icon: Flag, penalty: '1 Shot' },
  { id: 'RestingOnClub', label: 'Resting on Club', icon: Club, penalty: '1 Shot' },
  { id: 'Shank', label: 'Shank', icon: Skull, penalty: '1 Shot' },
  { id: 'NotPastLadies', label: 'Not Past Ladies', icon: XCircle, penalty: '1 Shot' },
  { id: 'SandSpecialist', label: 'Sand Specialist', icon: Golf, penalty: '1 Shot' },
];

const QuickFinesDrawer = ({ isOpen, onClose, rounds, players, userId, userPlayerId = null, currentRoundId = null, onFinesSaved = null }) => {
  const [selectedRound, setSelectedRound] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [selectedFines, setSelectedFines] = useState(new Set()); // Set of fine_type IDs
  const [existingFines, setExistingFines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [excludedPlayers, setExcludedPlayers] = useState(new Set());
  const [roundClosed, setRoundClosed] = useState(false);

  // Get active (non-closed) rounds only
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
        defaultRound = liveRoundId;
      } else if (activeRounds.length > 0) {
        defaultRound = activeRounds[0].id;
      }
      setSelectedRound(defaultRound ? String(defaultRound) : '');
      
      // Default player: linked player for this user
      if (userPlayerId && players.find(p => p.id === userPlayerId)) {
        setSelectedPlayer(String(userPlayerId));
      } else {
        setSelectedPlayer('');
      }
      
      // Reset UI state
      setSelectedFines(new Set());
      setExistingFines([]);
      setError('');
      setSuccess('');
    }
  }, [isOpen, liveRound, activeRounds, userPlayerId, players]);

  // Load existing fines when round/player changes
  useEffect(() => {
    if (!selectedRound) {
      setRoundClosed(false);
      setExcludedPlayers(new Set());
      setExistingFines([]);
      setSelectedFines(new Set());
      setLoading(false);
      return;
    }
    
    const round = rounds.find(r => r.id === parseInt(selectedRound));
    setRoundClosed(round?.is_closed || false);
    setLoading(true);
    
    Promise.all([
      db.getRoundExclusions(selectedRound),
      db.getFinesForRound(parseInt(selectedRound))
    ]).then(([exclusionIds, finesData]) => {
      setExcludedPlayers(new Set(exclusionIds || []));
      setExistingFines(finesData || []);
      
      // If player is selected, pre-select their existing fines
      if (selectedPlayer) {
        const playerFines = (finesData || []).filter(f => f.player_id === parseInt(selectedPlayer));
        setSelectedFines(new Set(playerFines.map(f => f.fine_type)));
      } else {
        setSelectedFines(new Set());
      }
    }).catch(() => {
      setExistingFines([]);
      setSelectedFines(new Set());
    }).finally(() => {
      setLoading(false);
    });
  }, [selectedRound, rounds, selectedPlayer]);

  const toggleFine = (fineType) => {
    if (roundClosed) return;
    setSelectedFines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fineType)) {
        newSet.delete(fineType);
      } else {
        newSet.add(fineType);
      }
      return newSet;
    });
  };

  const handleSubmit = async () => {
    if (!selectedRound || !selectedPlayer) {
      setError('Please select a round and player');
      return;
    }
    
    if (roundClosed) {
      setError('This round is closed. Cannot add fines.');
      return;
    }

    const finesToAdd = Array.from(selectedFines);
    if (finesToAdd.length === 0) {
      setError('No fines selected');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Add all selected fines
      for (const fineType of finesToAdd) {
        // Check if fine already exists
        const exists = existingFines.some(f => 
          f.player_id === parseInt(selectedPlayer) && f.fine_type === fineType
        );
        if (!exists) {
          await db.addFine({
            round_id: parseInt(selectedRound),
            player_id: parseInt(selectedPlayer),
            fine_type: fineType,
            settled: false,
          });
        }
      }
      
      setSuccess(`Added ${finesToAdd.length} fine${finesToAdd.length > 1 ? 's' : ''}`);
      
      // Refresh fines data
      const updatedFines = await db.getFinesForRound(parseInt(selectedRound));
      setExistingFines(updatedFines || []);
      
      // Trigger data refresh
      if (onFinesSaved) {
        onFinesSaved();
      }
    } catch (e) {
      setError(e.message || 'Failed to save fines');
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
                <BeerBottle size={24} weight="duotone" className="text-[#D4AF37]" />
                <h2 className="text-lg font-bold text-[#D4AF37]">Quick Fines</h2>
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
                  <p className="text-[#A9C5B4] text-xs">This round is closed. Fines cannot be added.</p>
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

              {/* Fine Types Grid */}
              {selectedPlayer && !roundClosed && (
                <div>
                  <label className="text-xs text-[#A9C5B4] uppercase tracking-wider block mb-2">Select Fines</label>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-8 h-8 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {FINE_TYPES.map(type => {
                        const Icon = type.icon;
                        const isSelected = selectedFines.has(type.id);
                        const alreadyExists = existingFines.some(f => 
                          f.player_id === parseInt(selectedPlayer) && f.fine_type === type.id
                        );
                        return (
                          <button
                            key={type.id}
                            onClick={() => toggleFine(type.id)}
                            disabled={alreadyExists}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all relative ${
                              alreadyExists
                                ? 'bg-emerald-900/20 border-emerald-500/30 opacity-60 cursor-not-allowed'
                                : isSelected
                                  ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]'
                                  : 'bg-[#051A10] border-[#D4AF37]/20 text-white hover:border-[#D4AF37]/50'
                            }`}
                          >
                            <Icon size={24} weight="duotone" />
                            <div className="text-center">
                              <p className="text-xs font-medium">{type.label}</p>
                              <p className="text-[10px] text-[#A9C5B4]">{type.penalty}</p>
                            </div>
                            {alreadyExists && (
                              <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
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

              {/* Submit button - sticky at bottom */}
              {selectedPlayer && !roundClosed && (
                <div className="sticky bottom-0 left-0 right-0 bg-[#0F2C1D]/95 backdrop-blur-sm pt-3 pb-4 px-4 -mx-4 border-t border-[#D4AF37]/20 z-10">
                  <button
                    onClick={handleSubmit}
                    disabled={saving || selectedFines.size === 0}
                    className="w-full py-4 bg-[#D4AF37] text-[#051A10] font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform shadow-lg"
                  >
                    {saving ? (
                      <span>Saving...</span>
                    ) : (
                      <>
                        <CloudArrowUp size={20} weight="bold" />
                        Save Fines ({selectedFines.size})
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default QuickFinesDrawer;
