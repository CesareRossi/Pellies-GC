import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check, Plus, Trash, Flag, MapPin, UsersThree, Golf, PencilSimple } from '@phosphor-icons/react';
import * as db from '../services/supabaseService';
import { formatHandicap } from '../lib/utils';
import ConfirmModal from './ConfirmModal';

const steps = ['Welcome', 'Players', 'Courses', 'Rounds', 'Teams', 'Complete'];

const Field = ({ label, type = 'text', value, onChange, placeholder }) => (
  <div>
    <label className="text-xs text-[#A9C5B4] uppercase tracking-wider block mb-1">{label}</label>
    <input type={type} value={value ?? ''} onChange={e => onChange(type === 'number' ? (e.target.value === '' ? null : parseFloat(e.target.value)) : e.target.value)}
      className="w-full px-4 py-2.5 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white placeholder-[#A9C5B4]/50 focus:border-[#D4AF37]/50 focus:outline-none text-sm"
      placeholder={placeholder} step={type === 'number' ? 'any' : undefined} />
  </div>
);

export default function SeasonWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [players, setPlayers] = useState([]);
  const [newPlayer, setNewPlayer] = useState({ name: '', handicap: null });
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [courses, setCourses] = useState([]);
  const [newCourse, setNewCourse] = useState({ name: '', par: 72, rating: null, slope: null });
  const [rounds, setRounds] = useState([]);
  const [editingCourseHoles, setEditingCourseHoles] = useState(null); // course id
  const [courseHolesDraft, setCourseHolesDraft] = useState([]);
  const [teams, setTeams] = useState([]);
  const [newTeam, setNewTeam] = useState({ player1: '', player2: '' });

  useEffect(() => {
    db.getAllPlayers().then(setPlayers).catch(() => {});
    db.getCourses(true).then(setCourses).catch(() => {});
    db.getRounds().then(setRounds).catch(() => {});
  }, []);

  useEffect(() => {
    if (step === 4) db.getAllTeams().then(setTeams).catch(() => {});
  }, [step]);

  const next = () => setStep(s => Math.min(s + 1, steps.length - 1));
  const prev = () => setStep(s => Math.max(s - 1, 0));

  // === PLAYERS ===
  const addPlayer = async () => {
    if (!newPlayer.name.trim()) return;
    setSaving(true); setMsg('');
    try {
      const p = await db.createPlayer(newPlayer);
      setPlayers(prev => [...prev, p].sort((a, b) => a.name.localeCompare(b.name)));
      setNewPlayer({ name: '', handicap: null });
      setMsg('Player added!');
    } catch (e) { setMsg(e.message); }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000); }
  };

  const updatePlayer = async (playerId, updates) => {
    setSaving(true); setMsg('');
    try {
      await db.updatePlayer(playerId, updates);
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, ...updates } : p));
      setEditingPlayer(null);
      setMsg('Player updated!');
    } catch (e) { setMsg(e.message); }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000); }
  };

  const deletePlayer = async (playerId) => {
    const player = players.find(p => p.id === playerId);
    setConfirmDialog({
      open: true,
      title: 'Remove Player?',
      message: `This will disable ${player.name} and remove all of their scores and any teams they're part of. This can't be undone.`,
      onConfirm: async () => {
        setSaving(true); setMsg('');
        try {
          await db.deletePlayer(playerId);
          setPlayers(prev => prev.filter(p => p.id !== playerId));
          // Remove from teams
          await db.deleteTeamsByPlayer(playerId);
          setTeams(await db.getAllTeams());
          setMsg('Player removed successfully!');
          setTimeout(() => setMsg(''), 3000);
        } catch (e) { setMsg(e.message); }
        finally { setSaving(false); }
      }
    });
  };

  const togglePlayerActive = async (playerId) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    
    const action = player.is_active ? 'disable' : 'enable';
    const message = player.is_active 
      ? `This will remove ${player.name} from the league and disable their account. They won't appear in teams or leaderboards.`
      : `This will re-enable ${player.name} and restore their access to the league.`;
    
    setConfirmDialog({
      open: true,
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Player?`,
      message: message,
      danger: player.is_active,
      onConfirm: async () => {
        setSaving(true); setMsg('');
        try {
          if (player.is_active) {
            await db.disablePlayer(playerId);
          } else {
            await db.enablePlayer(playerId);
          }
          setPlayers(prev => prev.map(p => p.id === playerId ? { 
            ...p, 
            is_active: !p.is_active,
            deleted_at: !p.is_active ? null : p.deleted_at 
          } : p));
          
          // If disabling player, remove them from teams
          if (player.is_active) {
            await db.deleteTeamsByPlayer(playerId);
            setTeams(await db.getAllTeams());
          }
          
          setMsg(`Player ${action}d successfully!`);
          setTimeout(() => setMsg(''), 3000);
        } catch (e) { setMsg(e.message); }
        finally { setSaving(false); }
      }
    });
  };

  // === COURSES ===
  const addCourse = async () => {
    if (!newCourse.name.trim()) return;
    setSaving(true); setMsg('');
    try {
      const c = await db.createCourse(newCourse);
      setCourses(prev => [...prev, c]);
      setNewCourse({ name: '', par: 72, rating: null, slope: null });
    } catch (e) { setMsg(e.message); }
    finally { setSaving(false); }
  };

  const openCourseHoles = async (courseId) => {
    setEditingCourseHoles(courseId);
    setMsg('');
    try {
      const existing = await db.getCourseHoles(courseId);
      if (existing.length > 0) {
        setCourseHolesDraft(existing.map(h => ({ hole_number: h.hole_number, par: h.par, stroke_index: h.stroke_index })));
      } else {
        setCourseHolesDraft(Array.from({ length: 18 }, (_, i) => ({ hole_number: i + 1, par: 4, stroke_index: i + 1 })));
      }
    } catch {
      setCourseHolesDraft(Array.from({ length: 18 }, (_, i) => ({ hole_number: i + 1, par: 4, stroke_index: i + 1 })));
    }
  };

  const updateCourseHole = (idx, field, value) => {
    setCourseHolesDraft(prev => prev.map((h, i) => i === idx ? { ...h, [field]: parseInt(value) || 0 } : h));
  };

  const saveCourseHoles = async () => {
    if (!editingCourseHoles) return;
    setSaving(true); setMsg('');
    try {
      const rows = courseHolesDraft.map(h => ({ course_id: editingCourseHoles, hole_number: h.hole_number, par: h.par, stroke_index: h.stroke_index }));
      await db.upsertCourseHoles(rows);
      setMsg('Course holes saved!'); setTimeout(() => setMsg(''), 3000);
    } catch (e) { setMsg(e.message); }
    finally { setSaving(false); }
  };

  const toggleCourseActive = async (c) => {
    try { await db.setCourseActive(c.id, !c.is_active); setCourses(await db.getCourses(true)); }
    catch (e) { setMsg(e.message); }
  };

  // === ROUNDS ===
  // v5: a round inherits its holes from the selected course — no per-round holes needed
  const addRound = async (courseId) => {
    if (!courseId) return;
    setSaving(true); setMsg('');
    try {
      const existingRounds = await db.getRounds();
      const nextNum = existingRounds.length > 0 ? Math.max(...existingRounds.map(r => r.round_number)) + 1 : 1;
      const r = await db.createRound({ round_number: nextNum, course_id: parseInt(courseId), is_setup: true });
      const fullRound = { ...r, courses: courses.find(c => c.id === parseInt(courseId)) };
      setRounds(prev => [...prev, fullRound]);
    } catch (e) { setMsg(e.message); }
    finally { setSaving(false); }
  };

  const updateRoundSpecial = async (roundId, field, value) => {
    const val = value === '' ? null : parseInt(value);
    try {
      await db.updateRound(roundId, { [field]: val });
      setRounds(prev => prev.map(r => r.id === roundId ? { ...r, [field]: val } : r));
    } catch (e) { setMsg(e.message); }
  };

  const deleteRound = async (roundId) => {
    const round = rounds.find(r => r.id === roundId);
    setConfirmDialog({
      open: true,
      title: 'Delete Round?',
      message: `This will permanently delete Round ${round.round_number} and all associated scores and teams. This action cannot be undone.`,
      onConfirm: async () => {
        setSaving(true); setMsg('');
        try {
          await db.deleteRound(roundId);
          setRounds(await db.getRounds());
          setMsg('Round deleted successfully!');
          setTimeout(() => setMsg(''), 3000);
        } catch (e) { setMsg(e.message); }
        finally { setSaving(false); }
      }
    });
  };

  // === TEAMS (season-wide) ===
  const addTeam = async () => {
    if (!newTeam.player1 || !newTeam.player2) return;
    setSaving(true); setMsg('');
    try {
      await db.createTeam({ player1_id: parseInt(newTeam.player1), player2_id: parseInt(newTeam.player2) });
      setTeams(await db.getAllTeams());
      setNewTeam({ player1: '', player2: '' });
    } catch (e) { setMsg(e.message); }
    finally { setSaving(false); }
  };

  const setupRounds = rounds.filter(r => r.is_setup);
  const seasonTeams = teams.filter(t => !t.round_id);
  const activeCourses = courses.filter(c => c.is_active);
  
  // Sort players: enabled first, then disabled
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.is_active && !b.is_active) return -1;
    if (!a.is_active && b.is_active) return 1;
    return a.name.localeCompare(b.name);
  });

  // Helper function to check if a player is already in a team
  const isPlayerInTeam = (playerId) => {
    return seasonTeams.some(team => 
      team.player1?.id === parseInt(playerId) || team.player2?.id === parseInt(playerId)
    );
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i <= step ? 'bg-[#D4AF37] text-[#051A10]' : 'bg-[#051A10] text-[#A9C5B4] border border-[#D4AF37]/20'}`}>
                {i < step ? <Check size={14} weight="bold" /> : i + 1}
              </div>
              {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i < step ? 'bg-[#D4AF37]' : 'bg-[#D4AF37]/20'}`} />}
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-[#A9C5B4] uppercase tracking-wider mb-6">{steps[step]}</p>

        <div className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 backdrop-blur-md p-6 shadow-2xl">
          {msg && <div className={`mb-4 text-xs ${msg.toLowerCase().includes('error') ? 'text-red-400' : 'text-emerald-400'}`}>{msg}</div>}

          {/* STEP 0: Welcome */}
          {step === 0 && (
            <div className="text-center py-8">
              <Golf size={48} weight="duotone" className="text-[#D4AF37] mx-auto mb-4" />
              <h2 className="text-2xl font-sans text-[#D4AF37] mb-3">Season Setup Wizard</h2>
              <p className="text-[#A9C5B4] text-sm max-w-md mx-auto mb-6">
                Set up your league: add players, courses (with hole par &amp; SI), rounds, and season-wide team pairings.
              </p>
              <p className="text-[#A9C5B4]/70 text-xs">Currently configured: {players.length} players &middot; {activeCourses.length} active courses &middot; {setupRounds.length} rounds &middot; {seasonTeams.length} teams</p>
            </div>
          )}

          {/* STEP 1: Players */}
          {step === 1 && (
            <div>
              <h3 className="text-sm text-[#A9C5B4] uppercase tracking-wider mb-4 flex items-center gap-2"><Flag size={16} className="text-[#D4AF37]" /> Players ({players.length})</h3>
              <div className="space-y-2 mb-4">
                {sortedPlayers.map(p => (
                  <div key={p.id} className={`rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10 text-sm ${!p.is_active ? 'opacity-50' : ''}`}>
                    {editingPlayer?.id === p.id ? (
                      <div className="p-3 space-y-2">
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={editingPlayer.name} 
                            onChange={e => setEditingPlayer(prev => ({ ...prev, name: e.target.value }))}
                            className="flex-1 px-2 py-1 rounded bg-[#051A10] border border-[#D4AF37]/20 text-white text-sm focus:outline-none" 
                          />
                          <input 
                            type="number" 
                            value={editingPlayer.handicap ?? ''} 
                            onChange={e => setEditingPlayer(prev => ({ ...prev, handicap: e.target.value === '' ? null : parseFloat(e.target.value) }))}
                            className="w-20 px-2 py-1 rounded bg-[#051A10] border border-[#D4AF37]/20 text-white text-sm text-center focus:outline-none" 
                            step="any" 
                          />
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => updatePlayer(p.id, { name: editingPlayer.name, handicap: editingPlayer.handicap })}
                            disabled={saving || !editingPlayer.name.trim()}
                            className="px-2 py-1 bg-emerald-500 text-white text-xs rounded hover:bg-emerald-600 disabled:opacity-40"
                          >
                            Save
                          </button>
                          <button 
                            onClick={() => setEditingPlayer(null)}
                            className="px-2 py-1 bg-[#A9C5B4] text-white text-xs rounded hover:bg-[#A9C5B4]/80"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span className="text-white">{p.name}</span>
                          {!p.is_active && <span className="text-[10px] uppercase tracking-wider text-amber-400">(disabled)</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#A9C5B4] text-xs">HC: {formatHandicap(p.handicap) ?? '-'}</span>
                          <button 
                            onClick={() => setEditingPlayer({ id: p.id, name: p.name, handicap: p.handicap })}
                            className="text-[#A9C5B4] hover:text-[#D4AF37]"
                          >
                            <PencilSimple size={14} />
                          </button>
                          <button 
                            onClick={() => togglePlayerActive(p.id)}
                            className="text-[#A9C5B4] hover:text-amber-400"
                          >
                            {p.is_active ? 'Disable' : 'Enable'}
                          </button>
                          <button 
                            onClick={() => deletePlayer(p.id)}
                            disabled={saving}
                            className="text-[#A9C5B4] hover:text-red-400 disabled:opacity-30"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-[#D4AF37]/10 pt-4">
                <p className="text-xs text-[#A9C5B4] mb-2">Add New Player</p>
                <div className="flex gap-2">
                  <input type="text" value={newPlayer.name} onChange={e => setNewPlayer(p => ({ ...p, name: e.target.value }))} placeholder="Name" className="flex-1 px-3 py-2 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white text-sm focus:outline-none" />
                  <input type="number" value={newPlayer.handicap ?? ''} onChange={e => setNewPlayer(p => ({ ...p, handicap: e.target.value === '' ? null : parseFloat(e.target.value) }))} placeholder="HC" className="w-20 px-3 py-2 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white text-sm text-center focus:outline-none" step="any" />
                  <button onClick={addPlayer} disabled={saving || !newPlayer.name.trim()} className="px-4 py-2 bg-[#D4AF37] text-[#051A10] font-bold text-sm rounded-lg hover:bg-[#F1D67E] disabled:opacity-40"><Plus size={16} /></button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Courses + Course Holes */}
          {step === 2 && (
            <div>
              <h3 className="text-sm text-[#A9C5B4] uppercase tracking-wider mb-4 flex items-center gap-2"><MapPin size={16} className="text-[#D4AF37]" /> Courses ({courses.length})</h3>
              <div className="space-y-2 mb-4">
                {courses.map(c => (
                  <div key={c.id} className={`rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10 overflow-hidden ${!c.is_active ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between py-2 px-3 gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-white font-semibold text-sm">{c.name}</span>
                        {!c.is_active && <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-400">(disabled)</span>}
                        <p className="text-[#A9C5B4] text-xs">Par {c.par} &middot; Rating {c.rating} &middot; Slope {c.slope}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => openCourseHoles(editingCourseHoles === c.id ? null : c.id)} className="text-xs text-[#D4AF37] border border-[#D4AF37]/30 px-2 py-1 rounded hover:bg-[#D4AF37]/10">{editingCourseHoles === c.id ? 'Close' : 'Holes'}</button>
                        <button onClick={() => toggleCourseActive(c)} className="text-xs text-[#A9C5B4] hover:text-amber-400 border border-transparent hover:border-amber-500/30 px-2 py-1 rounded">{c.is_active ? 'Disable' : 'Enable'}</button>
                      </div>
                    </div>
                    {editingCourseHoles === c.id && (
                      <div className="px-3 pb-3 border-t border-[#D4AF37]/10">
                        <p className="text-[11px] text-[#A9C5B4]/70 italic py-2">Par &amp; SI per hole — used by every round played on this course.</p>
                        
                        {/* Mobile-friendly layout */}
                        <div className="space-y-3">
                          {/* Header */}
                          <div className="grid grid-cols-3 gap-2 text-[10px] text-[#A9C5B4]/70 uppercase tracking-wider px-2 pb-2 border-b border-[#D4AF37]/10">
                            <span className="text-center">Hole</span>
                            <span className="text-center">Par</span>
                            <span className="text-center">SI</span>
                          </div>
                          
                          {/* Holes - single column on mobile, two columns on desktop */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {courseHolesDraft.map((h) => {
                              const i = courseHolesDraft.findIndex(x => x.hole_number === h.hole_number);
                              return (
                                <div key={h.hole_number} className="grid grid-cols-3 gap-2 items-center bg-[#051A10]/40 rounded-lg p-2 border border-[#D4AF37]/10">
                                  <span className="text-[#D4AF37] text-sm font-bold text-center">{h.hole_number}</span>
                                  <input 
                                    type="number" 
                                    value={h.par} 
                                    onChange={e => updateCourseHole(i, 'par', e.target.value)} 
                                    className="w-full px-2 py-1.5 rounded bg-[#051A10] border border-[#D4AF37]/20 text-white text-xs text-center focus:outline-none focus:border-[#D4AF37]/50" 
                                    min="1" 
                                    max="6"
                                  />
                                  <input 
                                    type="number" 
                                    value={h.stroke_index} 
                                    onChange={e => updateCourseHole(i, 'stroke_index', e.target.value)} 
                                    className="w-full px-2 py-1.5 rounded bg-[#051A10] border border-[#D4AF37]/20 text-white text-xs text-center focus:outline-none focus:border-[#D4AF37]/50" 
                                    min="1" 
                                    max="18"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        
                        <button onClick={saveCourseHoles} disabled={saving} className="mt-4 w-full py-2.5 rounded-lg bg-[#D4AF37] text-[#051A10] font-bold text-sm hover:bg-[#F1D67E] disabled:opacity-40"><Check size={14} className="inline mr-1" /> Save Holes</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-[#D4AF37]/10 pt-4 space-y-3">
                <p className="text-xs text-[#A9C5B4]">Add New Course</p>
                <Field label="Name" value={newCourse.name} onChange={v => setNewCourse(c => ({ ...c, name: v }))} placeholder="e.g. Zebula" />
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Par" type="number" value={newCourse.par} onChange={v => setNewCourse(c => ({ ...c, par: v }))} placeholder="72" />
                  <Field label="Rating" type="number" value={newCourse.rating} onChange={v => setNewCourse(c => ({ ...c, rating: v }))} placeholder="73.2" />
                  <Field label="Slope" type="number" value={newCourse.slope} onChange={v => setNewCourse(c => ({ ...c, slope: v }))} placeholder="129" />
                </div>
                <button onClick={addCourse} disabled={saving || !newCourse.name.trim()} className="w-full py-2.5 rounded-lg bg-[#D4AF37] text-[#051A10] font-bold text-sm hover:bg-[#F1D67E] disabled:opacity-40"><Plus size={16} className="inline mr-1" /> Add Course</button>
              </div>
            </div>
          )}

          {/* STEP 3: Rounds (holes are on the course) */}
          {step === 3 && (
            <div>
              <h3 className="text-sm text-[#A9C5B4] uppercase tracking-wider mb-2 flex items-center gap-2"><Golf size={16} className="text-[#D4AF37]" /> Rounds ({setupRounds.length})</h3>
              <p className="text-xs text-[#A9C5B4]/70 italic mb-4">Each round uses the holes you configured on its course — you don't need to set them again here.</p>
              <div className="space-y-2 mb-4">
                {setupRounds.map(r => (
                  <div key={r.id} className="py-2.5 px-3 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10 text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-white font-semibold">Round {r.round_number}</span>
                        <span className="text-[#A9C5B4] text-xs ml-2">{r.courses?.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-emerald-400 hidden sm:inline">Holes from course</span>
                        <button 
                          onClick={() => deleteRound(r.id)} 
                          disabled={saving}
                          className="text-[#A9C5B4] hover:text-red-400 disabled:opacity-30"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-rose-300 uppercase tracking-wider block mb-1">🍺 Beer Hole</label>
                        <select value={r.beer_hole || ''} onChange={e => updateRoundSpecial(r.id, 'beer_hole', e.target.value)} className="w-full px-2 py-1.5 rounded bg-[#051A10] border border-[#D4AF37]/20 text-white text-xs focus:outline-none">
                          <option value="">None</option>
                          {Array.from({length:18},(_,i)=>i+1).map(h => <option key={h} value={h}>Hole {h}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-purple-300 uppercase tracking-wider block mb-1">🎭 Joker Hole</label>
                        <select value={r.joker_hole || ''} onChange={e => updateRoundSpecial(r.id, 'joker_hole', e.target.value)} className="w-full px-2 py-1.5 rounded bg-[#051A10] border border-[#D4AF37]/20 text-white text-xs focus:outline-none">
                          <option value="">None</option>
                          {Array.from({length:18},(_,i)=>i+1).map(h => <option key={h} value={h}>Hole {h}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#D4AF37]/10 pt-4">
                <p className="text-xs text-[#A9C5B4] mb-2">Add New Round</p>
                <div className="flex gap-2">
                  <select id="newRoundCourse" className="flex-1 px-3 py-2 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white text-sm focus:outline-none">
                    <option value="">Select course...</option>
                    {activeCourses.map(c => <option key={c.id} value={c.id}>{c.name} (Par {c.par})</option>)}
                  </select>
                  <button onClick={() => { const sel = document.getElementById('newRoundCourse'); addRound(sel.value); sel.value = ''; }} disabled={saving} className="px-4 py-2 bg-[#D4AF37] text-[#051A10] font-bold text-sm rounded-lg hover:bg-[#F1D67E] disabled:opacity-40"><Plus size={16} /></button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Season-wide Teams */}
          {step === 4 && (
            <div>
              <h3 className="text-sm text-[#A9C5B4] uppercase tracking-wider mb-2 flex items-center gap-2"><UsersThree size={16} className="text-[#D4AF37]" /> Season Team Pairings ({seasonTeams.length})</h3>
              <p className="text-xs text-[#A9C5B4]/70 italic mb-4">Set once — these pairings play together across every round.</p>
              <div className="space-y-1 mb-4">
                {seasonTeams.length === 0 && <p className="text-xs text-[#A9C5B4]/60 py-3 text-center">No teams yet.</p>}
                {seasonTeams.map(t => (
                  <div key={t.id} className="flex items-center justify-between py-1.5 px-3 rounded bg-[#051A10]/60 border border-[#D4AF37]/10 text-sm">
                    <span className="text-white">{t.player1?.name} and {t.player2?.name}</span>
                    <button onClick={async () => { await db.deleteTeam(t.id); setTeams(await db.getAllTeams()); }} className="text-[#A9C5B4] hover:text-red-400"><Trash size={14} /></button>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#D4AF37]/10 pt-4">
                <div className="flex gap-2">
                  <select value={newTeam.player1} onChange={e => setNewTeam(t => ({ ...t, player1: e.target.value }))} className="flex-1 px-2 py-2 rounded bg-[#051A10] border border-[#D4AF37]/20 text-white text-sm focus:outline-none">
                    <option value="">Player 1...</option>
                    {players.filter(p => p.is_active && !isPlayerInTeam(p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select value={newTeam.player2} onChange={e => setNewTeam(t => ({ ...t, player2: e.target.value }))} className="flex-1 px-2 py-2 rounded bg-[#051A10] border border-[#D4AF37]/20 text-white text-sm focus:outline-none">
                    <option value="">Player 2...</option>
                    {players.filter(p => p.is_active && !isPlayerInTeam(p.id) && String(p.id) !== newTeam.player1).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button onClick={addTeam} disabled={saving || !newTeam.player1 || !newTeam.player2} className="px-3 py-2 bg-[#D4AF37] text-[#051A10] font-bold text-sm rounded hover:bg-[#F1D67E] disabled:opacity-40"><Plus size={16} /></button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Complete */}
          {step === 5 && (
            <div className="text-center py-8">
              <Check size={48} weight="duotone" className="text-emerald-400 mx-auto mb-4" />
              <h2 className="text-2xl font-sans text-[#D4AF37] mb-3">Season Ready!</h2>
              <p className="text-[#A9C5B4] text-sm mb-6">Your league is configured with:</p>
              <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto mb-6">
                <div className="text-center py-3 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10"><p className="text-xl font-bold text-white">{players.length}</p><p className="text-xs text-[#A9C5B4]">Players</p></div>
                <div className="text-center py-3 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10"><p className="text-xl font-bold text-white">{activeCourses.length}</p><p className="text-xs text-[#A9C5B4]">Active Courses</p></div>
                <div className="text-center py-3 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10"><p className="text-xl font-bold text-white">{setupRounds.length}</p><p className="text-xs text-[#A9C5B4]">Rounds</p></div>
                <div className="text-center py-3 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10"><p className="text-xl font-bold text-white">{seasonTeams.length}</p><p className="text-xs text-[#A9C5B4]">Teams</p></div>
              </div>
              
              {/* Detailed Setup Information */}
              <div className="text-left max-w-md mx-auto space-y-3 mb-6">
                <div className="bg-[#051A10]/40 rounded-lg p-3 border border-[#D4AF37]/10">
                  <h4 className="text-sm font-semibold text-[#D4AF37] mb-2">📊 Setup Summary</h4>
                  <div className="space-y-1 text-xs">
                    <p className="text-[#A9C5B4]">
                      <span className="text-white">{players.filter(p => p.is_active).length}</span> active players
                      {players.filter(p => !p.is_active).length > 0 && (
                        <span className="text-amber-400 ml-2">({players.filter(p => !p.is_active).length} disabled)</span>
                      )}
                    </p>
                    <p className="text-[#A9C5B4]">
                      <span className="text-white">{setupRounds.filter(r => r.joker_hole).length}</span> rounds with joker holes
                    </p>
                    <p className="text-[#A9C5B4]">
                      <span className="text-white">{setupRounds.filter(r => r.beer_hole).length}</span> rounds with beer holes
                    </p>
                  </div>
                </div>
                
                {setupRounds.length > 0 && (
                  <div className="bg-[#051A10]/40 rounded-lg p-3 border border-[#D4AF37]/10">
                    <h4 className="text-sm font-semibold text-[#D4AF37] mb-2">🏌️ Rounds Configuration</h4>
                    <div className="space-y-1 text-xs">
                      {setupRounds.map(r => (
                        <p key={r.id} className="text-[#A9C5B4]">
                          Round {r.round_number}: {r.courses?.name}
                          {r.joker_hole && <span className="text-purple-400 ml-2">🎭 Joker Hole {r.joker_hole}</span>}
                          {r.beer_hole && <span className="text-amber-400 ml-2">🍺 Beer Hole {r.beer_hole}</span>}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <button onClick={onComplete} className="px-8 py-3 bg-[#D4AF37] text-[#051A10] font-bold rounded-lg hover:bg-[#F1D67E] transition-colors">Go to Dashboard</button>
            </div>
          )}
        </div>

        {/* Navigation */}
        {step < 5 && (
          <div className="flex justify-between mt-6">
            <button onClick={prev} disabled={step === 0} className="flex items-center gap-1 px-4 py-2 text-sm text-[#A9C5B4] hover:text-white disabled:opacity-30"><ArrowLeft size={16} /> Back</button>
            <button onClick={next} className="flex items-center gap-1 px-4 py-2 text-sm bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 rounded-lg hover:bg-[#D4AF37]/30">{step === 4 ? 'Finish' : 'Next'} <ArrowRight size={16} /></button>
          </div>
        )}
      </motion.div>
      
      {/* Confirm Modal */}
      <ConfirmModal
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel || 'Confirm'}
        danger={confirmDialog.danger !== false}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog({ open: false, title: '', message: '', onConfirm: null })}
      />
    </>
  );
}
