import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check, Plus, Trash, Flag, MapPin, UsersThree, Golf } from '@phosphor-icons/react';
import * as db from '../services/supabaseService';

const steps = ['Welcome', 'Players', 'Courses', 'Rounds & Holes', 'Teams', 'Complete'];

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

  // Data
  const [players, setPlayers] = useState([]);
  const [newPlayer, setNewPlayer] = useState({ name: '', handicap: null });
  const [courses, setCourses] = useState([]);
  const [newCourse, setNewCourse] = useState({ name: '', par: 72, rating: null, slope: null });
  const [rounds, setRounds] = useState([]);
  const [editingHoles, setEditingHoles] = useState(null); // round index
  const [teams, setTeams] = useState([]);
  const [newTeam, setNewTeam] = useState({ player1: '', player2: '' });

  // Load existing data
  useEffect(() => {
    db.getPlayers().then(setPlayers).catch(() => {});
    db.getCourses().then(setCourses).catch(() => {});
    db.getRounds().then(r => {
      // Load holes for each round
      Promise.all(r.filter(rd => rd.is_setup).map(async rd => {
        const holes = await db.getRoundHoles(rd.id);
        return { ...rd, holes };
      })).then(withHoles => setRounds(r.map(rd => {
        const wh = withHoles.find(w => w.id === rd.id);
        return wh || rd;
      })));
    }).catch(() => {});
  }, []);

  const next = () => setStep(s => Math.min(s + 1, steps.length - 1));
  const prev = () => setStep(s => Math.max(s - 1, 0));

  // === ADD PLAYER ===
  const addPlayer = async () => {
    if (!newPlayer.name.trim()) return;
    setSaving(true); setMsg('');
    try {
      const p = await db.createPlayer(newPlayer);
      setPlayers(prev => [...prev, p].sort((a, b) => a.name.localeCompare(b.name)));
      setNewPlayer({ name: '', handicap: null });
    } catch (e) { setMsg(e.message); }
    finally { setSaving(false); }
  };

  // === ADD COURSE ===
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

  // === ADD ROUND ===
  const addRound = async (courseId) => {
    if (!courseId) return;
    setSaving(true); setMsg('');
    try {
      const existingRounds = await db.getRounds();
      const nextNum = existingRounds.length > 0 ? Math.max(...existingRounds.map(r => r.round_number)) + 1 : 1;
      const r = await db.createRound({ round_number: nextNum, course_id: parseInt(courseId), is_setup: true });
      // Create default 18 holes
      const defaultHoles = Array.from({ length: 18 }, (_, i) => ({
        round_id: r.id, hole_number: i + 1, par: 4, stroke_index: i + 1
      }));
      await db.upsertRoundHoles(defaultHoles);
      const fullRound = { ...r, courses: courses.find(c => c.id === parseInt(courseId)), holes: defaultHoles };
      setRounds(prev => [...prev, fullRound]);
    } catch (e) { setMsg(e.message); }
    finally { setSaving(false); }
  };

  const updateHole = (roundIdx, holeIdx, field, value) => {
    setRounds(prev => prev.map((r, ri) => {
      if (ri !== roundIdx || !r.holes) return r;
      return { ...r, holes: r.holes.map((h, hi) => hi === holeIdx ? { ...h, [field]: parseInt(value) || 0 } : h) };
    }));
  };

  const saveHoles = async (roundIdx) => {
    const r = rounds[roundIdx];
    if (!r.holes) return;
    setSaving(true); setMsg('');
    try {
      await db.upsertRoundHoles(r.holes.map(h => ({ round_id: r.id, hole_number: h.hole_number, par: h.par, stroke_index: h.stroke_index })));
      setMsg('Holes saved!'); setTimeout(() => setMsg(''), 3000);
    } catch (e) { setMsg(e.message); }
    finally { setSaving(false); }
  };

  // === ADD TEAM ===
  const addTeam = async (roundId) => {
    if (!newTeam.player1 || !newTeam.player2 || !roundId) return;
    setSaving(true); setMsg('');
    try {
      await db.createTeam({ round_id: parseInt(roundId), player1_id: parseInt(newTeam.player1), player2_id: parseInt(newTeam.player2) });
      const allTeams = await db.getAllTeams();
      setTeams(allTeams);
      setNewTeam({ player1: '', player2: '' });
    } catch (e) { setMsg(e.message); }
    finally { setSaving(false); }
  };

  useEffect(() => {
    if (step === 4) db.getAllTeams().then(setTeams).catch(() => {});
  }, [step]);

  const setupRounds = rounds.filter(r => r.is_setup);

  return (
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
        {msg && <div className={`mb-4 text-xs ${msg.includes('Error') || msg.includes('error') ? 'text-red-400' : 'text-emerald-400'}`}>{msg}</div>}

        {/* STEP 0: Welcome */}
        {step === 0 && (
          <div className="text-center py-8">
            <Golf size={48} weight="duotone" className="text-[#D4AF37] mx-auto mb-4" />
            <h2 className="text-2xl font-serif text-[#D4AF37] mb-3">Season Setup Wizard</h2>
            <p className="text-[#A9C5B4] text-sm max-w-md mx-auto mb-6">
              Set up your golf league season step by step. Add players, courses, rounds with hole configurations, and team pairings.
            </p>
            <p className="text-[#A9C5B4]/70 text-xs">You already have {players.length} players, {courses.length} courses, and {setupRounds.length} rounds configured.</p>
          </div>
        )}

        {/* STEP 1: Players */}
        {step === 1 && (
          <div>
            <h3 className="text-sm text-[#A9C5B4] uppercase tracking-wider mb-4 flex items-center gap-2"><Flag size={16} className="text-[#D4AF37]" /> Players ({players.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {players.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10 text-sm">
                  <span className="text-white">{p.name}</span>
                  <span className="text-[#A9C5B4] text-xs">HC: {p.handicap ?? '-'}</span>
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

        {/* STEP 2: Courses */}
        {step === 2 && (
          <div>
            <h3 className="text-sm text-[#A9C5B4] uppercase tracking-wider mb-4 flex items-center gap-2"><MapPin size={16} className="text-[#D4AF37]" /> Courses ({courses.length})</h3>
            <div className="space-y-2 mb-4">
              {courses.map(c => (
                <div key={c.id} className="py-2 px-3 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10 text-sm">
                  <span className="text-white font-semibold">{c.name}</span>
                  <span className="text-[#A9C5B4] text-xs ml-2">Par {c.par} &middot; Rating {c.rating} &middot; Slope {c.slope}</span>
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

        {/* STEP 3: Rounds & Holes */}
        {step === 3 && (
          <div>
            <h3 className="text-sm text-[#A9C5B4] uppercase tracking-wider mb-4 flex items-center gap-2"><Golf size={16} className="text-[#D4AF37]" /> Rounds ({setupRounds.length})</h3>
            <div className="space-y-3 mb-4">
              {rounds.filter(r => r.is_setup).map((r, ri) => {
                const realIdx = rounds.indexOf(r);
                return (
                <div key={r.id} className="rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10 overflow-hidden">
                  <div className="flex items-center justify-between py-2.5 px-4">
                    <div><span className="text-white text-sm font-semibold">Round {r.round_number}</span><span className="text-[#A9C5B4] text-xs ml-2">{r.courses?.name}</span></div>
                    <button onClick={() => setEditingHoles(editingHoles === realIdx ? null : realIdx)} className="text-xs text-[#D4AF37] border border-[#D4AF37]/30 px-2 py-1 rounded hover:bg-[#D4AF37]/10">{editingHoles === realIdx ? 'Close' : 'Edit Holes'}</button>
                  </div>
                  {editingHoles === realIdx && r.holes && (
                    <div className="px-4 pb-4 border-t border-[#D4AF37]/10">
                      <div className="grid grid-cols-[50px_1fr_1fr] gap-1 text-[10px] text-[#A9C5B4] uppercase tracking-wider py-2"><span>Hole</span><span>Par</span><span>SI</span></div>
                      <div className="max-h-[300px] overflow-y-auto space-y-1">
                        {r.holes.map((h, hi) => (
                          <div key={h.hole_number} className="grid grid-cols-[50px_1fr_1fr] gap-1 items-center">
                            <span className="text-white text-xs font-bold text-center">{h.hole_number}</span>
                            <input type="number" value={h.par} onChange={e => updateHole(realIdx, hi, 'par', e.target.value)} className="px-2 py-1.5 rounded bg-[#051A10] border border-[#D4AF37]/20 text-white text-xs text-center focus:outline-none" />
                            <input type="number" value={h.stroke_index} onChange={e => updateHole(realIdx, hi, 'stroke_index', e.target.value)} className="px-2 py-1.5 rounded bg-[#051A10] border border-[#D4AF37]/20 text-white text-xs text-center focus:outline-none" />
                          </div>
                        ))}
                      </div>
                      <button onClick={() => saveHoles(realIdx)} disabled={saving} className="mt-3 w-full py-2 rounded-lg bg-[#D4AF37] text-[#051A10] font-bold text-xs hover:bg-[#F1D67E] disabled:opacity-40"><Check size={14} className="inline mr-1" /> Save Holes</button>
                    </div>
                  )}
                </div>
              );})}
            </div>
            <div className="border-t border-[#D4AF37]/10 pt-4">
              <p className="text-xs text-[#A9C5B4] mb-2">Add New Round</p>
              <div className="flex gap-2">
                <select id="newRoundCourse" className="flex-1 px-3 py-2 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white text-sm focus:outline-none">
                  <option value="">Select course...</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={() => { const sel = document.getElementById('newRoundCourse'); addRound(sel.value); }} disabled={saving} className="px-4 py-2 bg-[#D4AF37] text-[#051A10] font-bold text-sm rounded-lg hover:bg-[#F1D67E] disabled:opacity-40"><Plus size={16} /></button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Teams */}
        {step === 4 && (
          <div>
            <h3 className="text-sm text-[#A9C5B4] uppercase tracking-wider mb-4 flex items-center gap-2"><UsersThree size={16} className="text-[#D4AF37]" /> Team Pairings</h3>
            {setupRounds.map(r => {
              const roundTeams = teams.filter(t => t.round_id === r.id);
              return (
                <div key={r.id} className="mb-4">
                  <p className="text-xs text-[#D4AF37]/70 uppercase tracking-wider mb-2">Round {r.round_number} - {r.courses?.name}</p>
                  <div className="space-y-1 mb-2">
                    {roundTeams.map(t => (
                      <div key={t.id} className="flex items-center justify-between py-1.5 px-3 rounded bg-[#051A10]/60 border border-[#D4AF37]/10 text-sm">
                        <span className="text-white">{t.player1?.name} & {t.player2?.name}</span>
                        <button onClick={async () => { await db.deleteTeam(t.id); setTeams(await db.getAllTeams()); }} className="text-[#A9C5B4] hover:text-red-400"><Trash size={14} /></button>
                      </div>
                    ))}
                    {roundTeams.length === 0 && <p className="text-[#A9C5B4] text-xs">No teams yet</p>}
                  </div>
                  <div className="flex gap-2">
                    <select value={newTeam.player1} onChange={e => setNewTeam(t => ({ ...t, player1: e.target.value }))} className="flex-1 px-2 py-1.5 rounded bg-[#051A10] border border-[#D4AF37]/20 text-white text-xs focus:outline-none">
                      <option value="">Player 1...</option>
                      {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select value={newTeam.player2} onChange={e => setNewTeam(t => ({ ...t, player2: e.target.value }))} className="flex-1 px-2 py-1.5 rounded bg-[#051A10] border border-[#D4AF37]/20 text-white text-xs focus:outline-none">
                      <option value="">Player 2...</option>
                      {players.filter(p => String(p.id) !== newTeam.player1).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button onClick={() => addTeam(r.id)} disabled={saving || !newTeam.player1 || !newTeam.player2} className="px-3 py-1.5 bg-[#D4AF37] text-[#051A10] font-bold text-xs rounded hover:bg-[#F1D67E] disabled:opacity-40"><Plus size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* STEP 5: Complete */}
        {step === 5 && (
          <div className="text-center py-8">
            <Check size={48} weight="duotone" className="text-emerald-400 mx-auto mb-4" />
            <h2 className="text-2xl font-serif text-[#D4AF37] mb-3">Season Ready!</h2>
            <p className="text-[#A9C5B4] text-sm mb-6">Your league is configured with:</p>
            <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto mb-6">
              <div className="text-center py-3 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10"><p className="text-xl font-bold text-white">{players.length}</p><p className="text-xs text-[#A9C5B4]">Players</p></div>
              <div className="text-center py-3 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10"><p className="text-xl font-bold text-white">{courses.length}</p><p className="text-xs text-[#A9C5B4]">Courses</p></div>
              <div className="text-center py-3 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10"><p className="text-xl font-bold text-white">{setupRounds.length}</p><p className="text-xs text-[#A9C5B4]">Rounds</p></div>
              <div className="text-center py-3 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10"><p className="text-xl font-bold text-white">{teams.length}</p><p className="text-xs text-[#A9C5B4]">Teams</p></div>
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
  );
}
