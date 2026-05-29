import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import Overview from '../pages/Overview';
import LiveLeaderboard from '../pages/LiveLeaderboard';
import LeagueLeaderboard from '../pages/LeagueLeaderboard';
import TeamLeaderboard from '../pages/TeamLeaderboard';
import PlayerStats from '../pages/PlayerStats';
import Awards from '../pages/Awards';
import ScoreEntry from '../pages/ScoreEntry';
import Fines from '../pages/Fines';
import Rules from '../pages/Rules';
import Admin from '../pages/Admin';
import SeasonWizard from '../pages/SeasonWizard';
import RoundScorecard from '../pages/RoundScorecard';
import RoundTeamScorecard from '../pages/RoundTeamScorecard';

const AppRoutes = ({ user, profile, rounds, players, currentSeason, canScore, isAdmin, isApprovedUser }) => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/auth" element={<div>Auth Modal</div>} />
      
      {/* Protected routes */}
      <Route path="/" element={<ProtectedRoute user={user} profile={profile}><Overview /></ProtectedRoute>} />
      
      <Route path="/live" element={<ProtectedRoute user={user} profile={profile}><LiveLeaderboard /></ProtectedRoute>} />
      
      <Route path="/leaderboards/league" element={<ProtectedRoute user={user} profile={profile}><LeagueLeaderboard /></ProtectedRoute>} />
      <Route path="/leaderboards/team" element={<ProtectedRoute user={user} profile={profile}><TeamLeaderboard /></ProtectedRoute>} />
      
      <Route path="/stats" element={<ProtectedRoute user={user} profile={profile}><PlayerStats /></ProtectedRoute>} />
      <Route path="/awards" element={<ProtectedRoute user={user} profile={profile}><Awards /></ProtectedRoute>} />
      <Route path="/rules" element={<ProtectedRoute user={user} profile={profile}><Rules /></ProtectedRoute>} />
      
      {/* Role-based routes */}
      <Route path="/scores" element={<ProtectedRoute user={user} profile={profile}><ScoreEntry /></ProtectedRoute>} />
      <Route path="/fines" element={<ProtectedRoute user={user} profile={profile}><Fines /></ProtectedRoute>} />
      
      <Route path="/admin" element={<ProtectedRoute user={user} profile={profile} requiredRole="admin"><Admin /></ProtectedRoute>} />
      <Route path="/season-wizard" element={<ProtectedRoute user={user} profile={profile} requiredRole="admin"><SeasonWizard /></ProtectedRoute>} />
      
      {/* Dynamic round routes */}
      <Route path="/rounds/:roundId/scorecard" element={<ProtectedRoute user={user} profile={profile}><RoundScorecard /></ProtectedRoute>} />
      <Route path="/rounds/:roundId/teams" element={<ProtectedRoute user={user} profile={profile}><RoundTeamScorecard /></ProtectedRoute>} />
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
