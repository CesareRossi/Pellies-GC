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
  const STORAGE_KEY = 'quickFines_lastPlayer';
  const [selectedRound, setSelectedRound] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(() => {
    // Initialize from localStorage if available
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved || '';
  });
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [excludedPlayers, setExcludedPlayers] = useState(new Set());
  const [roundClosed, setRoundClosed] = useState(false);
  const [addingFine, setAddingFine] = useState(null); // Track which fine is being added

  // Get active (non-closed) rounds only
  const activeRounds = useMemo(() => rounds.filter(r => !r.is_closed), [rounds]);
  
  // Get the current/live round from the rounds list
  const liveRound = useMemo(() => {
    return rounds.find(r => r.is_current) || 
           rounds.find(r => r.id === parseInt(currentRoundId)) ||
           rounds.find(r => !r.is_closed);
  }, [rounds, currentRoundId]);

  // Load fines for selected round
  const loadFines = async () => {
    if (!selectedRound) {
      setFines([]);
      return;
    }
    try {
      const data = await db.getFinesForRound(parseInt(selectedRound));
      setFines(data || []);
    } catch (e) {
      setError('Failed to load fines');
    }
  };

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
      
      // Only set default player if none selected from localStorage
      if (!selectedPlayer) {
        // Default to linked player for this user
        if (userPlayerId && players.find(p => p.id === userPlayerId)) {
          setSelectedPlayer(String(userPlayerId));
          localStorage.setItem(STORAGE_KEY, String(userPlayerId));
        }
      }
      
      // Reset UI state but keep player selection
      setFines([]);
      setError('');
      setSuccess('');
    }
  }, [isOpen, liveRound, activeRounds, userPlayerId, players, selectedPlayer]);

  // Load round data when round changes
  useEffect(() => {
    if (!selectedRound) {
      setRoundClosed(false);
      setExcludedPlayers(new Set());
      setFines([]);
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
      setFines(finesData || []);
    }).catch(() => {
      setFines([]);
    }).finally(() => {
      setLoading(false);
    });
  }, [selectedRound, rounds]);

  // Save player selection to localStorage whenever it changes
  useEffect(() => {
    if (selectedPlayer) {
      localStorage.setItem(STORAGE_KEY, selectedPlayer);
    }
  }, [selectedPlayer]);

  // Get player's fines for selected round
  const getPlayerFines = () => {
    return fines.filter(f => f.player_id === parseInt(selectedPlayer));
  };

  // Add fine (always adds new - allows multiple of same type)
  const handleAddFine = async (fineType) => {
    if (!selectedRound || !selectedPlayer) {
      setError('Please select a round and player');
      return;
    }
    
    if (roundClosed) {
      setError('This round is closed. Cannot add fines.');
      return;
    }

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
      if (onFinesSaved) onFinesSaved();
    } catch (e) {
      setError('Failed to add fine');
    } finally {
      setAddingFine(null);
      setTimeout(() => { setError(''); setSuccess(''); }, 3000);
    }
  };

  // Remove specific fine by ID
  const handleRemoveFine = async (fineId, fineType) => {
    try {
      await db.deleteFine(fineId);
      await loadFines();
      setSuccess(`${FINE_TYPES.find(t => t.id === fineType)?.label} removed`);
      if (onFinesSaved) onFinesSaved();
    } catch (e) {
      setError('Failed to remove fine');
    } finally {
      setTimeout(() => { setError(''); setSuccess(''); }, 3000);
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

              {/* Fine Types Grid - Add Fines */}
              {selectedPlayer && !roundClosed && (
                <div>
                  <label className="text-xs text-[#A9C5B4] uppercase tracking-wider block mb-2">Add Fine</label>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-8 h-8 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {FINE_TYPES.map(type => {
                        const Icon = type.icon;
                        const isAdding = addingFine === type.id;
                        return (
                          <button
                            key={type.id}
                            onClick={() => handleAddFine(type.id)}
                            disabled={isAdding}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all relative bg-[#051A10] border-[#D4AF37]/20 text-white hover:border-[#D4AF37]/50 active:scale-[0.98] ${isAdding ? 'opacity-50' : ''}`}
                          >
                            <Icon size={24} weight="duotone" />
                            <div className="text-center">
                              <p className="text-xs font-medium">{type.label}</p>
                              <p className="text-[10px] text-[#A9C5B4]">{type.penalty}</p>
                            </div>
                            {isAdding && (
                              <span className="absolute inset-0 flex items-center justify-center bg-[#0F2C1D]/50 rounded-lg">
                                <div className="w-4 h-4 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Current Fines List */}
              {selectedPlayer && (
                <div>
                  <label className="text-xs text-[#A9C5B4] uppercase tracking-wider block mb-2">
                    Current Fines ({getPlayerFines().length})
                  </label>
                  {getPlayerFines().length === 0 ? (
                    <p className="text-sm text-[#A9C5B4] text-center py-4">No fines yet</p>
                  ) : (
                    <div className="space-y-2">
                      {getPlayerFines().map(fine => {
                        const fineType = FINE_TYPES.find(t => t.id === fine.fine_type);
                        const Icon = fineType?.icon || BeerBottle;
                        return (
                          <div key={fine.id} className="flex items-center justify-between p-3 rounded-lg bg-[#051A10]/50 border border-[#D4AF37]/10">
                            <div className="flex items-center gap-3">
                              <Icon size={18} weight="duotone" className="text-[#D4AF37]" />
                              <div>
                                <p className="text-sm font-medium text-white">{fineType?.label || fine.fine_type}</p>
                                <p className="text-[10px] text-[#A9C5B4]">{fineType?.penalty || ''}</p>
                              </div>
                            </div>
                            {!roundClosed && (
                              <button
                                onClick={() => handleRemoveFine(fine.id, fine.fine_type)}
                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                              >
                                <X size={18} />
                              </button>
                            )}
                          </div>
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
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default QuickFinesDrawer;
