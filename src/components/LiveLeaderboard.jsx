import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Target, Flag, Lock } from '@phosphor-icons/react';
import * as db from '../services/supabaseService';
import { Card, Button, Chip, LiveChip, LoadingState, EmptyState, Segmented, Banner } from './common';

// PGA-Style Live Leaderboard Component
// Designed for tracking leaderboard during active rounds

const LiveLeaderboard = ({ currentRound, onRefresh, mode, setMode, roundsVersion = 0, userId, userPlayerId, allPlayers }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [dataMode, setDataMode] = useState(null); // Track which mode the data is for
  const [currentRoundInfo, setCurrentRoundInfo] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [closingRound, setClosingRound] = useState(false);
  const [closeError, setCloseError] = useState('');
  const [availableRounds, setAvailableRounds] = useState([]);
  const [selectedRoundId, setSelectedRoundId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Get all open rounds (not closed)
      const allRounds = await db.getRounds();
      const openRounds = allRounds.filter(r => !r.is_closed && r.is_setup);
      setAvailableRounds(openRounds);

      // Determine which round to show
      let roundId = selectedRoundId;
      
      if (!roundId && openRounds.length > 0) {
        // If user is logged in and has a player_id, find the round they're playing in
        if (userPlayerId && allPlayers.length > 0) {
          const userPlayer = allPlayers.find(p => p.id === userPlayerId);
          if (userPlayer) {
            // Check which round the user is participating in
            for (const round of openRounds) {
              const participants = await db.getRoundParticipants(round.id);
              if (participants.includes(userPlayerId)) {
                roundId = round.id;
                break;
              }
            }
          }
        }
        
        // If still no round selected, default to first open round
        if (!roundId) {
          roundId = openRounds[0].id;
        }
        
        setSelectedRoundId(roundId);
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
  }, [currentRound, mode, selectedRoundId, userPlayerId, allPlayers]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const closeRound = async () => {
    if (!selectedRoundId) return;
    setClosingRound(true);
    setCloseError('');
    try {
      // Same rule as Admin → Rounds: every player marked as playing must have
      // every hole before the round can be locked. The "thru 18" check above
      // only sees players who already have scores, so it can't catch someone
      // who was never entered at all.
      const check = await db.getRoundCompletion(selectedRoundId);
      if (!check.complete) {
        const list = check.incomplete.slice(0, 4).map((p) => `${p.name} (${p.scored}/${p.total})`).join(', ');
        const more = check.incomplete.length > 4 ? ` +${check.incomplete.length - 4} more` : '';
        setCloseError(
          check.participantCount === 0
            ? 'Nobody is marked as playing this round yet.'
            : `Can’t close yet — incomplete scorecards: ${list}${more}.`
        );
        return;
      }
      await db.updateRound(selectedRoundId, { is_closed: true });
      setSelectedRoundId(null); // Reset to trigger selection of next available round
      if (onRefresh) onRefresh();
      loadData();
    } catch (err) {
      console.error('Failed to close round:', err);
      setCloseError('Failed to close round. Please try again.');
    } finally {
      setClosingRound(false);
    }
  };

  // Refresh when roundsVersion changes (e.g., after score save)
  useEffect(() => {
    if (roundsVersion > 0) {
      loadData();
    }
  }, [roundsVersion, loadData]);

  // Show loading if no data, or if data is for wrong mode (prevents flashing)
  if ((loading && !data) || (loading && dataMode !== mode)) {
    return <LoadingState label="Loading live leaderboard…" />;
  }

  if (!data || dataMode !== mode) {
    return (
      <EmptyState
        icon={<Flag size={26} weight="duotone" />}
        title="No active round"
        message="Open a round in Admin → Rounds and mark it live to track it here."
      />
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


  // Determine if round is finished (all players have completed 18 holes)
  const isRoundFinished = players.length > 0 && players.every(p => p.thru === 18);

  const handleRoundChange = (roundId) => {
    setSelectedRoundId(roundId);
  };

  const leaderTotal = players[0]?.total ?? 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <p className="pg-eyebrow pg-eyebrow-gold">Live scoring</p>
            {!currentRoundInfo?.is_closed && <LiveChip />}
          </div>
          <h2 className="pg-display pg-gold-text text-[26px] sm:text-[32px]">Live Leaderboard</h2>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {currentRoundInfo ? (
              <>
                <Chip tone="gold">Round {currentRoundInfo.round_number}</Chip>
                <Chip>{currentRoundInfo.courses?.name}</Chip>
              </>
            ) : (
              <Chip>{data.display_name}</Chip>
            )}
            <Chip>{players.length} player{players.length === 1 ? '' : 's'}</Chip>
            <Chip>Auto-updates every 120s</Chip>
          </div>
        </div>

        {isRoundFinished && !currentRoundInfo?.is_closed && (
          <Button
            variant="primary"
            onClick={closeRound}
            disabled={closingRound}
            icon={<Lock size={15} weight="fill" />}
            data-testid="live-close-round"
          >
            {closingRound ? 'Checking…' : 'Close round'}
          </Button>
        )}
      </div>

      {closeError && (
        <div className="mb-4">
          <Banner tone="warning" data-testid="live-close-error">{closeError}</Banner>
        </div>
      )}

      {/* Round picker — a real segmented control rather than loose pills */}
      {availableRounds.length > 1 && (
        <div className="pg-scroll -mx-1 mb-4 overflow-x-auto px-1 pb-1">
          <Segmented
            ariaLabel="Choose round"
            size="sm"
            className="w-max"
            value={selectedRoundId}
            onChange={handleRoundChange}
            options={availableRounds.map(r => ({
              value: r.id,
              label: `R${r.round_number} · ${r.courses?.name || 'Unknown'}`,
            }))}
          />
        </div>
      )}

      {/* Leaderboard */}
      <Card className="overflow-hidden">
        <div className="border-b border-[#D4AF37]/22 bg-[#03110A]/70 px-3 py-2.5 sm:px-4">
          <div className="grid grid-cols-12 items-center gap-1 sm:gap-2">
            <div className="pg-eyebrow col-span-2 text-center">Pos</div>
            <div className="pg-eyebrow col-span-4 sm:col-span-3">Player</div>
            <div className="pg-eyebrow col-span-2 truncate text-center">{mode === 'stableford' ? 'Pts' : 'Strk'}</div>
            <div className="pg-eyebrow col-span-2 text-center">Thru</div>
            <div className="pg-eyebrow col-span-2 hidden text-right sm:col-span-3 sm:block">Progress</div>
          </div>
        </div>

        {players.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Target size={28} weight="duotone" className="mx-auto mb-3 text-[#D4AF37]/40" />
            <p className="text-sm text-[#A9C5B4]">No scores logged for this round yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#D4AF37]/8">
            {players.map((player, idx) => {
              const isLeader = player.position === 1;
              const behind = mode === 'stableford' ? leaderTotal - player.total : null;
              return (
                <motion.div
                  key={player.name}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(idx, 12) * 0.025 }}
                  className={`grid grid-cols-12 items-center gap-1 px-3 py-2.5 transition-colors hover:bg-[#D4AF37]/6 sm:gap-2 sm:px-4 ${
                    isLeader ? 'bg-[#D4AF37]/8' : ''
                  }`}
                  data-testid={`live-row-${idx}`}
                >
                  <div className="col-span-2 text-center">
                    <span
                      className={`pg-num inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-[13px] font-bold ${
                        isLeader
                          ? 'bg-gradient-to-b from-[#F1D67E] to-[#D4AF37] text-[#051A10]'
                          : player.position <= 3
                          ? 'border border-[#D4AF37]/35 bg-[#D4AF37]/12 text-[#D4AF37]'
                          : 'text-[#A9C5B4]'
                      }`}
                    >
                      {getPositionDisplay(player.position)}
                    </span>
                  </div>

                  <div className="col-span-4 min-w-0 sm:col-span-3">
                    <p className="truncate text-[13.5px] font-semibold text-white">{player.name}</p>
                    {behind > 0 && (
                      <p className="pg-num text-[10px] text-[#A9C5B4]/70">−{behind} back</p>
                    )}
                  </div>

                  <div className="col-span-2 text-center">
                    <span
                      className={`pg-num inline-flex min-w-[3rem] items-center justify-center rounded-lg px-2 py-1 text-[16px] font-bold ${
                        mode === 'stableford'
                          ? 'bg-[#D4AF37]/16 text-[#D4AF37]'
                          : player.scoreToPar < 0
                          ? 'bg-emerald-500/16 text-emerald-300'
                          : player.scoreToPar > 0
                          ? 'bg-orange-500/16 text-orange-300'
                          : 'bg-white/8 text-white'
                      }`}
                    >
                      {mode === 'stableford'
                        ? player.total
                        : player.scoreToPar === 0
                        ? 'E'
                        : player.scoreToPar > 0
                        ? `+${player.scoreToPar}`
                        : player.scoreToPar}
                    </span>
                  </div>

                  <div className="col-span-2 text-center">
                    <span className={`pg-num text-[13px] font-semibold ${player.thru === 18 ? 'text-emerald-300' : 'text-[#A9C5B4]'}`}>
                      {player.thru === 18 ? 'F' : player.thru === 0 ? '–' : player.thru}
                    </span>
                  </div>

                  <div className="col-span-2 hidden sm:col-span-3 sm:block">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#03110A]">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F1D67E]"
                          initial={{ width: 0 }}
                          animate={{ width: `${(player.thru / 18) * 100}%` }}
                          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                      <span className="pg-num w-8 text-right text-[10px] text-[#A9C5B4]">
                        {Math.round((player.thru / 18) * 100)}%
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>

      <p className="mt-3 text-center text-[10.5px] text-[#A9C5B4]/50">
        Last updated {lastUpdated?.toLocaleTimeString()}
      </p>
    </motion.div>
  );
};

export default LiveLeaderboard;
