import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Target, TrendUp, Users, Flag, CaretUp, CaretDown, Minus } from '@phosphor-icons/react';
import * as db from '../services/supabaseService';

// PGA-Style Live Leaderboard Component
// Designed for tracking leaderboard during active rounds

const LiveLeaderboard = ({ currentRound, onRefresh, mode, setMode }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [dataMode, setDataMode] = useState(null); // Track which mode the data is for
  const [currentRoundInfo, setCurrentRoundInfo] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Get current round data - prioritize explicitly set current round
      let roundId = currentRound;
      if (!roundId) {
        // Try to get the explicitly set current round from season
        const currentRoundData = await db.getCurrentRound();
        roundId = currentRoundData?.id;
      }
      // Fallback to last set up round if no current round set
      if (!roundId) {
        const rounds = await db.getSetUpRounds();
        const lastRound = rounds[rounds.length - 1];
        roundId = lastRound?.id;
      }

      if (roundId) {
        const [roundData, roundInfo] = await Promise.all([
          db.getStablefordRoundData(roundId, mode),
          db.getCurrentRound()
        ]);
        setData(roundData);
        setDataMode(mode); // Track which mode this data is for
        setCurrentRoundInfo(roundInfo);
      }
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load live leaderboard:', err);
    } finally {
      setLoading(false);
    }
  }, [currentRound, mode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh every 2 minutes during live tracking
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 120000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Show loading if no data, or if data is for wrong mode (prevents flashing)
  if ((loading && !data) || (loading && dataMode !== mode)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#A9C5B4] text-sm">Loading Live Leaderboard...</p>
        </div>
      </div>
    );
  }

  if (!data || dataMode !== mode) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Flag size={48} weight="duotone" className="text-[#D4AF37]/50 mx-auto mb-4" />
          <p className="text-[#A9C5B4]">No active round found</p>
        </div>
      </div>
    );
  }

  // Transform scorecard data into leaderboard format
  // data.data is an array of rows: [{Hole: 1, Par: 4, SI: 5, 'Player Name': score, ...}, ...]
  const holeRows = (data.data || []).filter(row => row.Hole !== 'TOTAL');
  const totalRow = (data.data || []).find(row => row.Hole === 'TOTAL');
  
  // Get all player names from TOTAL row (this has the backend's sorted data)
  // Filter out metadata columns and players with no scores
  const allPlayerNames = totalRow 
    ? Object.keys(totalRow).filter(key => !['Hole', 'Par', 'SI'].includes(key) && totalRow[key] !== '-' && totalRow[key] !== '' && totalRow[key] !== null && totalRow[key] !== undefined)
    : [];
  
  // Calculate stats for each player
  const playerStats = allPlayerNames.map(name => {
    let total = 0;
    let holesPlayed = 0;
    let playedPar = 0;
    
    for (const row of holeRows) {
      const score = row[name];
      const holePar = parseInt(row.Par, 10) || 0;
      const hasScore = score !== null && score !== undefined && score !== '-' && score !== '';
      if (hasScore) {
        holesPlayed++;
        total += parseInt(score, 10) || 0;
        playedPar += holePar;
      }
    }
    
    // Use backend total from TOTAL row
    const backendTotal = totalRow && totalRow[name] !== undefined && totalRow[name] !== '-' 
      ? parseInt(totalRow[name], 10) 
      : 0;
    
    // For stroke mode, calculate score to par based on holes played
    const scoreToPar = mode === 'stroke' && holesPlayed > 0 ? backendTotal - playedPar : null;
    
    return {
      name,
      total: backendTotal,
      scoreToPar,
      holesPlayed,
      playedPar,
      thru: holesPlayed,
    };
  });
  
  // Sort by score - this determines the ranking
  // Stableford: higher points = better rank, Stroke: lower score to par = better rank
  const players = [...playerStats].sort((a, b) => {
    if (mode === 'stableford') {
      return b.total - a.total; // Descending: higher points first
    } else {
      // Stroke: sort by scoreToPar (more negative = better)
      const aScore = a.scoreToPar ?? 999; // Players without scores go to bottom
      const bScore = b.scoreToPar ?? 999;
      return aScore - bScore; // Ascending: E (-0) beats +2, -2 beats E
    }
  });

  // Assign positions with ties
  players.forEach((player, index) => {
    if (index === 0) {
      player.position = 1;
    } else {
      const prevPlayer = players[index - 1];
      // For stableford compare totals, for stroke compare scoreToPar
      const isTied = mode === 'stableford' 
        ? player.total === prevPlayer.total 
        : player.scoreToPar === prevPlayer.scoreToPar;
      player.position = isTied ? prevPlayer.position : index + 1;
    }
  });

  const getPositionDisplay = (pos, total) => {
    if (pos === 1 && total === 0) return '1';
    return pos;
  };

  const getScoreStyle = (score, par) => {
    const diff = score - par;
    if (diff < -1) return { bg: 'bg-emerald-500', text: 'text-white', label: 'Eagle+' };
    if (diff === -1) return { bg: 'bg-emerald-400', text: 'text-[#051A10]', label: 'Birdie' };
    if (diff === 0) return { bg: 'bg-white', text: 'text-[#051A10]', label: 'Par' };
    if (diff === 1) return { bg: 'bg-[#D4AF37]', text: 'text-[#051A10]', label: 'Bogey' };
    return { bg: 'bg-orange-500', text: 'text-white', label: 'Dbl+' };
  };


  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="max-w-5xl mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-sans font-bold text-[#D4AF37] tracking-tight text-center sm:text-left">
            Live Leaderboard
          </h2>
          <p className="text-sm text-[#A9C5B4] mt-1 text-center sm:text-left">
            {currentRoundInfo ? (
              <>
                <span className="text-[#D4AF37] font-semibold">Round {currentRoundInfo.round_number}</span>
                <span className="mx-1">•</span>
                {currentRoundInfo.courses?.name}
              </>
            ) : (
              data.display_name
            )}
            <span className="mx-1">•</span>
            Auto-updates every 120s
          </p>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 backdrop-blur-md shadow-2xl overflow-hidden">
        {/* Table Header */}
        <div className="bg-[#051A10] border-b border-[#D4AF37]/30 px-4 py-3">
          <div className="grid grid-cols-12 gap-2 items-center text-xs font-semibold text-[#A9C5B4] uppercase tracking-wider">
            <div className="col-span-1 text-center">Pos</div>
            <div className="col-span-4 sm:col-span-3">Player</div>
            <div className="col-span-2 text-center">{mode === 'stableford' ? 'Points' : 'Strokes'}</div>
            <div className="col-span-2 text-center">Thru</div>
            <div className="col-span-3 sm:col-span-4 text-right">Progress</div>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-[#D4AF37]/10">
          {players.map((player, idx) => (
            <motion.div
              key={player.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="grid grid-cols-12 gap-2 items-center px-4 py-3 hover:bg-[#D4AF37]/5 transition-colors"
            >
              {/* Position */}
              <div className="col-span-1 text-center">
                <span className="text-[#D4AF37] font-bold text-lg">
                  {getPositionDisplay(player.position)}
                </span>
              </div>

              {/* Player Name */}
              <div className="col-span-4 sm:col-span-3">
                <p className="text-white font-semibold truncate">{player.name}</p>
              </div>

              {/* Score */}
              <div className="col-span-2 text-center">
                <span className={`inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded-lg text-lg font-bold ${
                  mode === 'stableford' 
                    ? 'bg-[#D4AF37]/20 text-[#D4AF37]' 
                    : player.scoreToPar < 0 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : player.scoreToPar > 0 
                        ? 'bg-orange-500/20 text-orange-400' 
                        : 'bg-white/10 text-white'
                }`}>
                  {mode === 'stableford' 
                    ? player.total 
                    : player.scoreToPar === 0 
                      ? 'E' 
                      : player.scoreToPar > 0 
                        ? `+${player.scoreToPar}` 
                        : player.scoreToPar}
                </span>
              </div>

              {/* Thru */}
              <div className="col-span-2 text-center">
                <span className="text-[#A9C5B4] text-sm">
                  {player.thru === 18 ? 'F' : player.thru === 0 ? '-' : player.thru}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="col-span-3 sm:col-span-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-[#051A10] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F1D67E] rounded-full transition-all duration-500"
                      style={{ width: `${(player.thru / 18) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[#A9C5B4] w-8 text-right">
                    {Math.round((player.thru / 18) * 100)}%
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Last Updated */}
      <p className="text-center text-[10px] text-[#A9C5B4]/50 mt-4">
        Last updated: {lastUpdated?.toLocaleTimeString()}
      </p>
    </motion.div>
  );
};

// Small stat card component
const StatCard = ({ icon, label, value, sub }) => (
  <div className="rounded-lg border border-[#D4AF37]/20 bg-[#0F2C1D]/60 p-3 text-center">
    <div className="text-[#D4AF37] mb-1 flex justify-center">{icon}</div>
    <p className="text-xl font-bold text-white">{value}</p>
    <p className="text-[10px] text-[#A9C5B4] uppercase tracking-wider">
      {label}{sub && <span className="ml-1 text-[#D4AF37]">{sub}</span>}
    </p>
  </div>
);

export default LiveLeaderboard;
