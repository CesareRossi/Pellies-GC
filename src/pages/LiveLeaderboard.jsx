import React from 'react';
import { motion } from 'framer-motion';
import LiveLeaderboard from '../components/LiveLeaderboard';

const LiveLeaderboardPage = ({ currentRound, onRefresh, mode, setMode, roundsVersion }) => {
  return (
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
      <LiveLeaderboard currentRound={currentRound} onRefresh={onRefresh} mode={mode} setMode={setMode} roundsVersion={roundsVersion} />
    </motion.div>
  );
};

export default LiveLeaderboardPage;
