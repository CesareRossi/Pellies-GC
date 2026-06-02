import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CaretDown, Flag, Crown, ChartBar, Users, BeerBottle } from '@phosphor-icons/react';
import * as db from '../services/supabaseService';

// Calculate worst scores for a round from stableford data
function calculateWorstScores(roundData, playerHandicaps) {
  if (!roundData?.data || roundData.data.length === 0) return null;
  
  // The data is table format - last row is TOTALS
  const totalRow = roundData.data[roundData.data.length - 1];
  if (!totalRow || totalRow.Hole !== 'TOTAL') return null;
  
  // Extract player names from the total row keys (excluding Hole, Par, SI)
  const playerNames = Object.keys(totalRow).filter(k => k !== 'Hole' && k !== 'Par' && k !== 'SI');
  
  let worstNett = null;
  let worstGross = null;
  
  playerNames.forEach(name => {
    const total = totalRow[name] || 0;
    const handicap = playerHandicaps?.[name] || 0;
    const nett = total - handicap;
    
    // Worst Nett (highest nett score for stableford = lowest points)
    if (!worstNett || nett < worstNett.nett) {
      worstNett = { name, nett, total };
    }
    
    // Worst Gross (highest total strokes) - for stableford this is inverted (lowest points = worst)
    if (!worstGross || total < worstGross.total) {
      worstGross = { name, total };
    }
  });
  
  return { worstNett, worstGross };
}

function RoundFinesRow({ round, rounds, index }) {
  const [open, setOpen] = useState(false);
  const [roundData, setRoundData] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadRoundData = async () => {
      if (!round.round_id) return;
      setLoading(true);
      try {
        // Get individual round data for worst scores
        const data = await db.getStablefordRoundData(round.round_id, 'stableford');
        if (!mounted) return;
        setRoundData(data);
        
        // TEAM COMMENTED OUT: Get team data for losing team
        // TEAM COMMENTED OUT: const teams = await db.getTeamRoundData(round.round_id, 'stableford');
        // TEAM COMMENTED OUT: if (!mounted) return;
        // TEAM COMMENTED OUT: if (teams?.data && teams.data.length > 0) {
        // TEAM COMMENTED OUT:   // The data is table format - last row is TOTALS with team names as keys
        // TEAM COMMENTED OUT:   const totalRow = teams.data[teams.data.length - 1];
        // TEAM COMMENTED OUT:   if (totalRow && totalRow.Team === 'Total') {
        // TEAM COMMENTED OUT:     // Extract team names (keys that don't start with underscore or are Team/Par/SI)
        // TEAM COMMENTED OUT:     const teamNames = Object.keys(totalRow).filter(k => k !== 'Team' && k !== 'Par' && k !== 'SI' && !k.endsWith('_contributor'));
        // TEAM COMMENTED OUT:     
        // TEAM COMMENTED OUT:     // Find team with lowest score (losing team for stableford)
        // TEAM COMMENTED OUT:     let losingTeam = null;
        // TEAM COMMENTED OUT:     teamNames.forEach(teamName => {
        // TEAM COMMENTED OUT:       const total = totalRow[teamName] || 0;
        // TEAM COMMENTED OUT:       if (!losingTeam || total < losingTeam.total) {
        // TEAM COMMENTED OUT:         // Parse player names from "Player1 and Player2" format
        // TEAM COMMENTED OUT:         const players = teamName.split(' and ');
        // TEAM COMMENTED OUT:         losingTeam = { 
        // TEAM COMMENTED OUT:           name: teamName, 
        // TEAM COMMENTED OUT:           total,
        // TEAM COMMENTED OUT:           players
        // TEAM COMMENTED OUT:         };
        // TEAM COMMENTED OUT:       }
        // TEAM COMMENTED OUT:     });
        // TEAM COMMENTED OUT:     setTeamData(losingTeam);
        // TEAM COMMENTED OUT:   }
        // TEAM COMMENTED OUT: }
      } catch (e) {
        console.error('Failed to load round fines data', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadRoundData();
    return () => { mounted = false; };
  }, [round.round_id]);

  const worstScores = roundData ? calculateWorstScores(roundData, roundData.player_handicaps) : null;
  const hasFines = worstScores?.worstNett || worstScores?.worstGross || teamData;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} 
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-xl border border-amber-500/20 bg-[#0F2C1D]/80 overflow-hidden backdrop-blur-md"
    >
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-500/5 transition-colors text-left"
      >
        <Flag size={18} className="text-amber-400" weight="duotone" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="text-base font-sans text-amber-400">Round {round.round_number}</p>
            <p className="text-xs text-[#A9C5B4] truncate">{round.course}</p>
          </div>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} className="text-[#A9C5B4] flex-shrink-0">
          <CaretDown size={16} />
        </motion.div>
      </button>

      {/* Fines Detail */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-amber-500/10">
              {loading ? (
                <div className="text-center py-4">
                  <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mx-auto" />
                </div>
              ) : !hasFines ? (
                <p className="text-[#A9C5B4] text-sm text-center py-4">No fines for this round yet</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Losing Team */}
                  {teamData && (
                    <div className="rounded-lg bg-[#051A10]/60 border border-rose-500/20 px-3 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Users size={16} className="text-rose-400" />
                        <p className="text-[10px] text-rose-400/80 uppercase tracking-wider">Losing Team</p>
                      </div>
                      <p className="text-white text-sm font-semibold">{teamData.name}</p>
                      <p className="text-[10px] text-[#A9C5B4]">{teamData.players.join(' & ')}</p>
                      <p className="text-rose-400 text-xs mt-1 font-medium">Buys first round 🍻</p>
                    </div>
                  )}
                  
                  {/* Worst Nett */}
                  {worstScores?.worstNett && (
                    <div className="rounded-lg bg-[#051A10]/60 border border-purple-500/20 px-3 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <ChartBar size={16} className="text-purple-400" />
                        <p className="text-[10px] text-purple-400/80 uppercase tracking-wider">Worst Nett</p>
                      </div>
                      <p className="text-white text-sm font-semibold">{worstScores.worstNett.name}</p>
                      <p className="text-[10px] text-[#A9C5B4]">{worstScores.worstNett.total} gross, {worstScores.worstNett.nett} nett</p>
                      <p className="text-purple-400 text-xs mt-1 font-medium">Funky Hat 🎩</p>
                    </div>
                  )}
                  
                  {/* Worst Gross */}
                  {worstScores?.worstGross && (
                    <div className="rounded-lg bg-[#051A10]/60 border border-amber-500/20 px-3 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Crown size={16} className="text-amber-400" />
                        <p className="text-[10px] text-amber-400/80 uppercase tracking-wider">Worst Gross</p>
                      </div>
                      <p className="text-white text-sm font-semibold">{worstScores.worstGross.name}</p>
                      <p className="text-[10px] text-[#A9C5B4]">{worstScores.worstGross.total} strokes</p>
                      <p className="text-amber-400 text-xs mt-1 font-medium">Special Hat 👑</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function TourFines({ rounds }) {
  const completedRounds = rounds.filter(r => r.has_scores);
  
  if (completedRounds.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-[0.15em] flex items-center gap-2">
          <BeerBottle size={18} weight="duotone" />
          Tour Fines
        </h3>
        <p className="text-[11px] text-[#A9C5B4]/60 italic hidden sm:block">Click any round to see fines</p>
      </div>
      
      <div className="space-y-2">
        {completedRounds.map((round, i) => (
          <RoundFinesRow 
            key={round.round_number} 
            round={round} 
            rounds={rounds}
            index={i} 
          />
        ))}
      </div>
    </div>
  );
}
