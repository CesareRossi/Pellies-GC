import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PencilSimple, Trash, Plus, Check, X, UserCircle, ShieldCheck, Clock, ShieldSlash, Warning } from '@phosphor-icons/react';
import * as db from '../services/supabaseService';
import ConfirmModal from './ConfirmModal';

const Modal = ({ title, onClose, children, footer, wide = false }) => createPortal(
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-[100] flex items-start justify-center bg-[#051A10]/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
      onClick={(e) => e.stopPropagation()}
      className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} my-4 sm:my-10 rounded-xl border border-[#D4AF37]/30 bg-[#0F2C1D] shadow-2xl flex flex-col`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#D4AF37]/15 flex-shrink-0 rounded-t-xl">
        <h2 className="text-base font-serif text-[#D4AF37]">{title}</h2>
        <button onClick={onClose} className="text-[#A9C5B4] hover:text-white"><X size={20} /></button>
      </div>
      {/* Body — grows to content, outer backdrop handles scrolling */}
      <div className="px-5 py-4">
        {children}
      </div>
      {/* Footer — stays at bottom of modal (not pinned to viewport, since modal auto-sizes) */}
      {footer && (
        <div className="px-5 py-3 border-t border-[#D4AF37]/15 flex-shrink-0 rounded-b-xl">
          {footer}
        </div>
      )}
    </motion.div>
  </motion.div>,
  document.body
);

const Field = ({ label, type = 'text', value, onChange, placeholder, required }) => (
  <div><label className="text-xs text-[#A9C5B4] uppercase tracking-wider block mb-1">{label}</label>
    <input type={type} value={value ?? ''} onChange={e => onChange(type === 'number' ? (e.target.value === '' ? null : parseFloat(e.target.value)) : e.target.value)}
      className="w-full px-4 py-2.5 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white placeholder-[#A9C5B4]/50 focus:border-[#D4AF37]/50 focus:outline-none text-sm"
      placeholder={placeholder} required={required} step={type === 'number' ? 'any' : undefined} /></div>
);

const SelectField = ({ label, value, onChange, options, placeholder }) => (
  <div><label className="text-xs text-[#A9C5B4] uppercase tracking-wider block mb-1">{label}</label>
    <select value={value ?? ''} onChange={e => onChange(e.target.value)} className="w-full px-4 py-2.5 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white focus:border-[#D4AF37]/50 focus:outline-none text-sm">
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select></div>
);

const TabBtn = ({ active, label, onClick }) => (
  <button onClick={onClick} className={`px-4 py-2 text-sm font-sans rounded-lg transition-all ${active ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30' : 'text-[#A9C5B4] hover:text-white border border-transparent'}`}>{label}</button>
);

const SaveBtn = ({ onClick, loading, label = 'Save' }) => (
  <button onClick={onClick} disabled={loading} className="w-full py-2.5 rounded-lg bg-[#D4AF37] text-[#051A10] font-bold text-sm hover:bg-[#F1D67E] disabled:opacity-50"><Check size={16} className="inline mr-1" /> {loading ? 'Saving...' : label}</button>
);

const ErrorMsg = ({ msg }) => msg ? <p className="text-red-400 text-xs mt-2">{msg}</p> : null;

// ===== PLAYERS =====
const PlayersPanel = () => {
  const [players, setPlayers] = useState([]);
  const [editing, setEditing] = useState(null); // null | 'new' | player_id
  const [form, setForm] = useState({ name: '', handicap: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState(null); // player object

  useEffect(() => { load(); }, []);
  const load = async () => { setPlayers(await db.getPlayers()); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true); setError('');
    try {
      if (editing === 'new') await db.createPlayer({ name: form.name, handicap: form.handicap });
      else await db.updatePlayer(editing, { name: form.name, handicap: form.handicap });
      setEditing(null); await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    try {
      await db.deletePlayer(confirmDel.id);
      await load();
    } catch (e) { alert('Error: ' + e.message); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <h3 className="text-sm text-[#A9C5B4] uppercase tracking-wider flex-1">Players ({players.length})</h3>
        <button onClick={() => { setEditing('new'); setForm({ name: '', handicap: null }); setError(''); }} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 rounded-lg hover:bg-[#D4AF37]/30"><Plus size={14} /> Add</button>
      </div>
      <div className="space-y-2">{players.map(p => (
        <div key={p.id} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10">
          <div><p className="text-white text-sm font-semibold">{p.name}</p><p className="text-[#A9C5B4] text-xs">Handicap: {p.handicap ?? 'Not set'}</p></div>
          <div className="flex gap-2">
            <button onClick={() => { setEditing(p.id); setForm({ name: p.name, handicap: p.handicap }); setError(''); }} className="text-[#A9C5B4] hover:text-[#D4AF37]" data-testid={`player-edit-${p.id}`}><PencilSimple size={16} /></button>
            <button onClick={() => setConfirmDel(p)} className="text-[#A9C5B4] hover:text-red-400" data-testid={`player-delete-${p.id}`}><Trash size={16} /></button>
          </div>
        </div>
      ))}</div>
      <AnimatePresence>{editing && (
        <Modal title={editing === 'new' ? 'Add Player' : 'Edit Player'} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <Field label="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Player name" required />
            <Field label="Handicap Index" type="number" value={form.handicap} onChange={v => setForm(f => ({ ...f, handicap: v }))} placeholder="e.g. 14.7" />
            <ErrorMsg msg={error} />
            <SaveBtn onClick={save} loading={saving} />
          </div>
        </Modal>
      )}</AnimatePresence>
      <ConfirmModal
        open={!!confirmDel}
        title="Remove player?"
        message={`This will deactivate ${confirmDel?.name} and remove all of their scores and any teams they're part of. This can't be undone.`}
        confirmLabel="Remove player"
        onConfirm={doDelete}
        onClose={() => setConfirmDel(null)}
      />
    </div>
  );
};

// ===== COURSES =====
const CoursesPanel = () => {
  const [courses, setCourses] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', rating: null, slope: null, par: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Holes setup (now per-course)
  const [holesCourse, setHolesCourse] = useState(null);
  const [holes, setHoles] = useState([]);
  const [savingHoles, setSavingHoles] = useState(false);
  const [holesMsg, setHolesMsg] = useState('');

  useEffect(() => { load(); }, []);
  const load = async () => { setCourses(await db.getCourses(true)); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true); setError('');
    try {
      if (editing === 'new') await db.createCourse(form);
      else await db.updateCourse(editing, form);
      setEditing(null); await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const toggleActive = async (c) => {
    try { await db.setCourseActive(c.id, !c.is_active); await load(); }
    catch (e) { alert('Error: ' + e.message); }
  };

  const openHoles = async (course) => {
    setHolesCourse(course);
    try {
      const existing = await db.getCourseHoles(course.id);
      if (existing.length > 0) {
        setHoles(existing.map(h => ({ hole_number: h.hole_number, par: h.par, stroke_index: h.stroke_index })));
      } else {
        setHoles(Array.from({ length: 18 }, (_, i) => ({ hole_number: i + 1, par: 4, stroke_index: i + 1 })));
      }
    } catch (e) {
      setHoles(Array.from({ length: 18 }, (_, i) => ({ hole_number: i + 1, par: 4, stroke_index: i + 1 })));
    }
    setHolesMsg('');
  };

  const updateHole = (idx, field, value) => {
    setHoles(prev => prev.map((h, i) => i === idx ? { ...h, [field]: parseInt(value) || 0 } : h));
  };

  const saveHoles = async () => {
    setSavingHoles(true); setHolesMsg('');
    try {
      const data = holes.map(h => ({ course_id: holesCourse.id, hole_number: h.hole_number, par: h.par, stroke_index: h.stroke_index }));
      await db.upsertCourseHoles(data);
      setHolesMsg('✅ Holes saved! Every round on this course now uses these.');
      setTimeout(() => setHolesMsg(''), 3000);
    } catch (e) { setHolesMsg('Error: ' + e.message); }
    finally { setSavingHoles(false); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <h3 className="text-sm text-[#A9C5B4] uppercase tracking-wider flex-1">Courses ({courses.length})</h3>
        <button onClick={() => { setEditing('new'); setForm({ name: '', rating: null, slope: null, par: null }); setError(''); }} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 rounded-lg hover:bg-[#D4AF37]/30"><Plus size={14} /> Add</button>
      </div>
      <div className="space-y-2">{courses.map(c => (
        <div key={c.id} className={`flex items-center justify-between py-2.5 px-4 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10 ${!c.is_active ? 'opacity-50' : ''}`}>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold flex items-center gap-2">
              {c.name}
              {!c.is_active && <span className="text-[10px] uppercase tracking-wider text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded">Disabled</span>}
            </p>
            <p className="text-[#A9C5B4] text-xs">Par {c.par} &middot; Rating {c.rating} &middot; Slope {c.slope}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => openHoles(c)} className="text-xs text-[#D4AF37] border border-[#D4AF37]/30 px-2 py-1 rounded hover:bg-[#D4AF37]/10" data-testid={`course-holes-${c.id}`}>Holes</button>
            <button onClick={() => toggleActive(c)} title={c.is_active ? 'Disable course' : 'Enable course'} className="text-xs text-[#A9C5B4] hover:text-amber-400 border border-transparent hover:border-amber-500/30 px-2 py-1 rounded" data-testid={`course-toggle-${c.id}`}>{c.is_active ? 'Disable' : 'Enable'}</button>
            <button onClick={() => { setEditing(c.id); setForm({ name: c.name, rating: c.rating, slope: c.slope, par: c.par }); setError(''); }} className="text-[#A9C5B4] hover:text-[#D4AF37]" data-testid={`course-edit-${c.id}`}><PencilSimple size={16} /></button>
          </div>
        </div>
      ))}</div>
      <AnimatePresence>{editing && (
        <Modal title={editing === 'new' ? 'Add Course' : 'Edit Course'} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <Field label="Course Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Zebula" required />
            <div className="grid grid-cols-3 gap-3">
              <Field label="Par" type="number" value={form.par} onChange={v => setForm(f => ({ ...f, par: v }))} placeholder="72" />
              <Field label="Rating" type="number" value={form.rating} onChange={v => setForm(f => ({ ...f, rating: v }))} placeholder="73.2" />
              <Field label="Slope" type="number" value={form.slope} onChange={v => setForm(f => ({ ...f, slope: v }))} placeholder="129" />
            </div>
            <ErrorMsg msg={error} />
            <SaveBtn onClick={save} loading={saving} />
          </div>
        </Modal>
      )}</AnimatePresence>

      {/* Course Holes Setup Modal */}
      <AnimatePresence>{holesCourse && (
        <Modal
          title={`Holes — ${holesCourse.name}`}
          onClose={() => setHolesCourse(null)}
          wide
          footer={
            <div className="flex flex-col gap-2">
              {holesMsg && (
                <p className={`text-xs ${holesMsg.includes('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                  {holesMsg}
                </p>
              )}
              <SaveBtn onClick={saveHoles} loading={savingHoles} label="Save" />
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-[#A9C5B4]/80 leading-relaxed">Par &amp; SI set once per course — every round on this course uses these automatically.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
              {[0, 9].map(offset => (
                <div key={offset} className="space-y-1">
                  <div className="grid grid-cols-[32px_1fr_1fr] gap-1.5 text-[10px] text-[#A9C5B4]/70 uppercase tracking-wider font-semibold px-1 pb-1 border-b border-[#D4AF37]/10">
                    <span className="text-center">#</span><span className="text-center">Par</span><span className="text-center">SI</span>
                  </div>
                  {holes.slice(offset, offset + 9).map((h) => {
                    const i = holes.findIndex(x => x.hole_number === h.hole_number);
                    return (
                      <div key={h.hole_number} className="grid grid-cols-[32px_1fr_1fr] gap-1.5 items-center">
                        <span className="text-[#D4AF37] text-xs font-bold text-center">{h.hole_number}</span>
                        <input type="number" value={h.par} onChange={e => updateHole(i, 'par', e.target.value)} className="w-full px-1 py-1.5 rounded bg-[#051A10] border border-[#D4AF37]/20 text-white text-sm text-center focus:outline-none focus:border-[#D4AF37]/50" />
                        <input type="number" value={h.stroke_index} onChange={e => updateHole(i, 'stroke_index', e.target.value)} className="w-full px-1 py-1.5 rounded bg-[#051A10] border border-[#D4AF37]/20 text-white text-sm text-center focus:outline-none focus:border-[#D4AF37]/50" />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}</AnimatePresence>
    </div>
  );
};

// ===== ROUNDS =====
const RoundsPanel = () => {
  const [rounds, setRounds] = useState([]);
  const [courses, setCourses] = useState([]);
  const [players, setPlayers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ round_number: null, course_id: null, beer_hole: null, joker_hole: null });
  // Set of player IDs who did NOT compete in the round being edited
  const [excluded, setExcluded] = useState(new Set());
  // Snapshot of exclusions when the edit modal opened — used to diff on save
  const [excludedInitial, setExcludedInitial] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Confirmations
  const [confirmDel, setConfirmDel] = useState(null); // round to delete
  const [confirmClear, setConfirmClear] = useState(null); // round to clear scores
  const [actionMsg, setActionMsg] = useState('');
  const [allExclusions, setAllExclusions] = useState([]);

  useEffect(() => { load(); }, []);
  const load = async () => {
    setRounds(await db.getRounds());
    setCourses(await db.getCourses());
    setPlayers(await db.getPlayers());
    try { setAllExclusions(await db.getAllRoundExclusions()); } catch { /* ignore */ }
  };

  const openEdit = async (round) => {
    setEditing(round.id);
    setForm({
      round_number: round.round_number,
      course_id: round.course_id,
      beer_hole: round.beer_hole,
      joker_hole: round.joker_hole,
    });
    setError('');
    try {
      const ids = await db.getRoundExclusions(round.id);
      const s = new Set(ids);
      setExcluded(s);
      setExcludedInitial(new Set(s));
    } catch {
      setExcluded(new Set());
      setExcludedInitial(new Set());
    }
  };

  const openNew = () => {
    setEditing('new');
    setForm({ round_number: rounds.length + 1, course_id: null, beer_hole: null, joker_hole: null });
    setExcluded(new Set());
    setExcludedInitial(new Set());
    setError('');
  };

  const togglePlayerExcluded = (playerId) => {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId); else next.add(playerId);
      return next;
    });
  };

  const save = async () => {
    if (!form.round_number) return;
    setSaving(true); setError('');
    try {
      // A round is fully set up once it has a course (holes live on the course)
      const data = {
        round_number: parseInt(form.round_number),
        course_id: form.course_id ? parseInt(form.course_id) : null,
        beer_hole: form.beer_hole ? parseInt(form.beer_hole) : null,
        joker_hole: form.joker_hole ? parseInt(form.joker_hole) : null,
        is_setup: !!form.course_id,
      };
      let roundId;
      if (editing === 'new') {
        const created = await db.createRound(data);
        roundId = created?.id;
      } else {
        await db.updateRound(editing, data);
        roundId = editing;
      }
      // Persist exclusion diff
      if (roundId) {
        const toAdd = [...excluded].filter(id => !excludedInitial.has(id));
        const toRemove = [...excludedInitial].filter(id => !excluded.has(id));
        await Promise.all([
          ...toAdd.map(id => db.setPlayerExcluded(roundId, id, true)),
          ...toRemove.map(id => db.setPlayerExcluded(roundId, id, false)),
        ]);
      }
      setEditing(null); await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    setActionMsg('');
    try {
      await db.deleteRound(confirmDel.id);
      await load();
      setActionMsg(`Round ${confirmDel.round_number} deleted.`);
      setTimeout(() => setActionMsg(''), 4000);
    } catch (e) { setActionMsg('Error: ' + e.message); }
  };
  const doClear = async () => {
    if (!confirmClear) return;
    setActionMsg('');
    try {
      await db.clearRoundScores(confirmClear.id);
      setActionMsg(`Scores cleared for Round ${confirmClear.round_number}.`);
      setTimeout(() => setActionMsg(''), 4000);
    } catch (e) { setActionMsg('Error: ' + e.message); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <h3 className="text-sm text-[#A9C5B4] uppercase tracking-wider flex-1">Rounds ({rounds.length})</h3>
        <button onClick={openNew} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 rounded-lg hover:bg-[#D4AF37]/30"><Plus size={14} /> Add</button>
      </div>
      {actionMsg && <div className={`mb-4 py-2 px-3 rounded-lg text-xs ${actionMsg.includes('Error') ? 'bg-red-900/30 text-red-400 border border-red-500/30' : 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30'}`} data-testid="rounds-action-msg">{actionMsg}</div>}
      <div className="space-y-2">{rounds.map(r => {
        const exCount = allExclusions.filter(e => e.round_id === r.id).length;
        return (
        <div key={r.id} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10">
          <div className="min-w-0 flex-1"><p className="text-white text-sm font-semibold">Round {r.round_number}</p><p className="text-[#A9C5B4] text-xs truncate">{r.courses ? r.courses.name : 'No course'} {r.is_setup ? '' : '(not set up)'}
            {r.beer_hole && <span className="ml-2 text-rose-300">🍺 H{r.beer_hole}</span>}
            {r.joker_hole && <span className="ml-2 text-purple-300">🎭 H{r.joker_hole}</span>}
            {exCount > 0 && <span className="ml-2 text-amber-300">✕ {exCount} out</span>}
          </p></div>
          <div className="flex gap-2 items-center">
            <button onClick={() => openEdit(r)} className="text-[#A9C5B4] hover:text-[#D4AF37]" data-testid={`round-edit-${r.id}`}><PencilSimple size={16} /></button>
            <button onClick={() => setConfirmClear(r)} title="Clear scores for this round" className="text-[#A9C5B4] hover:text-amber-400" data-testid={`round-clear-${r.id}`}><Warning size={16} /></button>
            <button onClick={() => setConfirmDel(r)} title="Delete this round" className="text-[#A9C5B4] hover:text-red-400" data-testid={`round-delete-${r.id}`}><Trash size={16} /></button>
          </div>
        </div>
        );
      })}</div>

      {/* Round Edit Modal */}
      <AnimatePresence>{editing && (
        <Modal title={editing === 'new' ? 'Add Round' : 'Edit Round'} onClose={() => setEditing(null)} wide
          footer={<SaveBtn onClick={save} loading={saving} />}>
          <div className="space-y-4">
            <Field label="Round Number" type="number" value={form.round_number} onChange={v => setForm(f => ({ ...f, round_number: v }))} placeholder="e.g. 6" required />
            <SelectField label="Course" value={form.course_id} onChange={v => setForm(f => ({ ...f, course_id: v || null }))} placeholder="Select course..." options={courses.map(c => ({ value: c.id, label: `${c.name} (Par ${c.par})` }))} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#A9C5B4] uppercase tracking-wider block mb-1">🍺 Beer Hole</label>
                <select
                  value={form.beer_hole ?? ''}
                  onChange={e => setForm(f => ({ ...f, beer_hole: e.target.value ? parseInt(e.target.value) : null }))}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white focus:border-[#D4AF37]/50 focus:outline-none text-sm"
                  data-testid="round-beer-hole-select"
                >
                  <option value="">— Disabled (no beer hole) —</option>
                  {Array.from({length:18},(_,i)=>i+1).map(h => <option key={h} value={h}>Hole {h}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#A9C5B4] uppercase tracking-wider block mb-1">🎭 Joker Hole</label>
                <select
                  value={form.joker_hole ?? ''}
                  onChange={e => setForm(f => ({ ...f, joker_hole: e.target.value ? parseInt(e.target.value) : null }))}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white focus:border-[#D4AF37]/50 focus:outline-none text-sm"
                  data-testid="round-joker-hole-select"
                >
                  <option value="">— Disabled (no joker hole) —</option>
                  {Array.from({length:18},(_,i)=>i+1).map(h => <option key={h} value={h}>Hole {h}</option>)}
                </select>
              </div>
            </div>
            <p className="text-[11px] text-[#A9C5B4]/70 italic leading-relaxed">🍺 Beer Hole: worst score on this hole buys drinks (ties = all liable). 🎭 Joker Hole: stableford points on this hole count double. Leave either on <span className="text-[#D4AF37]">Disabled</span> to skip it for this round.</p>

            {/* Excluded players */}
            {editing !== 'new' && (
              <div>
                <label className="text-xs text-[#A9C5B4] uppercase tracking-wider block mb-2">Didn't play this round</label>
                <p className="text-[11px] text-[#A9C5B4]/70 italic leading-relaxed mb-2">
                  Tap anyone who sat this round out. They're excluded from individual awards &amp; the season-complete gate, but their partner's score still counts for the team.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {players.map(p => {
                    const isOut = excluded.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlayerExcluded(p.id)}
                        className={`text-left px-2.5 py-1.5 rounded-md border text-xs transition-colors ${isOut ? 'bg-amber-500/15 border-amber-500/40 text-amber-200' : 'bg-[#051A10]/60 border-[#D4AF37]/15 text-[#A9C5B4] hover:border-[#D4AF37]/30'}`}
                        data-testid={`round-exclude-${p.id}`}
                      >
                        <span className="inline-block w-3 mr-1">{isOut ? '✕' : ''}</span>{p.name}
                      </button>
                    );
                  })}
                </div>
                {excluded.size > 0 && (
                  <p className="text-[11px] text-amber-300 mt-2">{excluded.size} player{excluded.size === 1 ? '' : 's'} marked as not playing this round.</p>
                )}
              </div>
            )}
            {editing === 'new' && (
              <p className="text-[11px] text-[#A9C5B4]/60 italic">Save the round first, then reopen it to mark anyone who didn't play.</p>
            )}

            <ErrorMsg msg={error} />
          </div>
        </Modal>
      )}</AnimatePresence>

      <ConfirmModal
        open={!!confirmDel}
        title="Delete round?"
        message={`This will permanently delete Round ${confirmDel?.round_number} along with all its holes, scores, and team pairings. This cannot be undone.`}
        confirmLabel="Delete round"
        onConfirm={doDelete}
        onClose={() => setConfirmDel(null)}
      />
      <ConfirmModal
        open={!!confirmClear}
        title="Clear scores for this round?"
        message={`All score entries for Round ${confirmClear?.round_number} will be removed. Holes and team pairings are kept.`}
        confirmLabel="Clear scores"
        onConfirm={doClear}
        onClose={() => setConfirmClear(null)}
      />
    </div>
  );
};

// ===== TEAMS =====
// Teams are season-wide: one pairing applies to every round.
const TeamsPanel = () => {
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ player1_id: null, player2_id: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => { load(); }, []);
  const load = async () => { setTeams(await db.getAllTeams()); setPlayers(await db.getPlayers()); };

  const save = async () => {
    if (!form.player1_id || !form.player2_id) return;
    setSaving(true); setError('');
    try {
      // Create a season-wide team (round_id will be null)
      await db.createTeam({ player1_id: parseInt(form.player1_id), player2_id: parseInt(form.player2_id) });
      setEditing(null); await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    try { await db.deleteTeam(confirmDel.id); await load(); }
    catch (e) { alert('Error: ' + e.message); }
  };

  // Group teams: season-wide first, then any legacy per-round teams
  const seasonTeams = teams.filter(t => !t.round_id);
  const roundTeams = teams.filter(t => t.round_id);
  const byRound = {};
  roundTeams.forEach(t => {
    const key = `Round ${t.rounds?.round_number || '?'} - ${t.rounds?.courses?.name || 'Unknown'}`;
    if (!byRound[key]) byRound[key] = [];
    byRound[key].push(t);
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <h3 className="text-sm text-[#A9C5B4] uppercase tracking-wider flex-1">Teams ({seasonTeams.length})</h3>
        <button onClick={() => { setEditing('new'); setForm({ player1_id: null, player2_id: null }); setError(''); }} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 rounded-lg hover:bg-[#D4AF37]/30"><Plus size={14} /> Add</button>
      </div>
      <p className="text-xs text-[#A9C5B4]/70 italic mb-5">Teams are season-wide — one pairing plays together across every round.</p>
      {seasonTeams.length === 0 && <p className="text-xs text-[#A9C5B4]/60 py-4 text-center">No teams yet. Click Add to create your first pairing.</p>}
      <div className="space-y-2 mb-4">{seasonTeams.map(t => (
        <div key={t.id} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10">
          <p className="text-white text-sm">{t.player1?.name} &amp; {t.player2?.name}</p>
          <button onClick={() => setConfirmDel(t)} className="text-[#A9C5B4] hover:text-red-400" data-testid={`team-delete-${t.id}`}><Trash size={16} /></button>
        </div>
      ))}</div>
      {roundTeams.length > 0 && (
        <>
          <h4 className="text-xs text-[#A9C5B4]/60 uppercase tracking-wider mt-6 mb-3">Legacy per-round pairings</h4>
          {Object.entries(byRound).map(([label, rTeams]) => (
            <div key={label} className="mb-4">
              <p className="text-xs text-[#D4AF37]/60 uppercase tracking-wider mb-2">{label} (overrides season teams)</p>
              <div className="space-y-2">{rTeams.map(t => (
                <div key={t.id} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-[#051A10]/60 border border-amber-500/15">
                  <p className="text-white text-sm">{t.player1?.name} &amp; {t.player2?.name}</p>
                  <button onClick={() => setConfirmDel(t)} className="text-[#A9C5B4] hover:text-red-400"><Trash size={16} /></button>
                </div>
              ))}</div>
            </div>
          ))}
        </>
      )}
      <AnimatePresence>{editing && (
        <Modal title="Add Team" onClose={() => setEditing(null)} footer={<SaveBtn onClick={save} loading={saving} />}>
          <div className="space-y-4">
            <SelectField label="Player 1" value={form.player1_id} onChange={v => setForm(f => ({ ...f, player1_id: v }))} placeholder="Select..." options={players.map(p => ({ value: p.id, label: p.name }))} />
            <SelectField label="Player 2" value={form.player2_id} onChange={v => setForm(f => ({ ...f, player2_id: v }))} placeholder="Select..." options={players.filter(p => String(p.id) !== String(form.player1_id)).map(p => ({ value: p.id, label: p.name }))} />
            <ErrorMsg msg={error} />
          </div>
        </Modal>
      )}</AnimatePresence>
      <ConfirmModal
        open={!!confirmDel}
        title="Delete team?"
        message={`This will remove the pairing ${confirmDel?.player1?.name} & ${confirmDel?.player2?.name} from the league.`}
        confirmLabel="Delete team"
        onConfirm={doDelete}
        onClose={() => setConfirmDel(null)}
      />
    </div>
  );
};

// ===== USERS =====
const UsersPanel = () => {
  const [users, setUsers] = useState([]);
  const [confirmRemove, setConfirmRemove] = useState(null);
  useEffect(() => { load(); }, []);
  const load = async () => { setUsers(await db.getAllUsers()); };
  const updateRole = async (userId, role) => { await db.updateUserRole(userId, role); await load(); };
  const doRemove = async () => {
    if (!confirmRemove) return;
    try { await db.removeUser(confirmRemove.id); await load(); }
    catch (e) { alert('Error: ' + e.message); }
  };
  const ri = (role) => role === 'admin' ? <ShieldCheck size={16} className="text-[#D4AF37]" /> : role === 'approved' ? <Check size={16} className="text-emerald-400" /> : role === 'pending' ? <Clock size={16} className="text-amber-400" /> : <ShieldSlash size={16} className="text-red-400" />;
  const rb = (role) => role === 'admin' ? 'bg-[#D4AF37]/10 text-[#D4AF37]' : role === 'approved' ? 'bg-emerald-900/30 text-emerald-400' : role === 'pending' ? 'bg-amber-900/30 text-amber-400' : 'bg-red-900/30 text-red-400';
  return (
    <div>
      <h3 className="text-sm text-[#A9C5B4] uppercase tracking-wider mb-2">Users ({users.length})</h3>
      <p className="text-xs text-[#A9C5B4]/60 mb-5 italic">Note: newly registered users appear here after their first login. If a user doesn't show up, ask them to log in once.</p>
      <div className="space-y-2">{users.map(u => (
        <div key={u.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 px-4 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10 gap-3" data-testid={`user-row-${u.id}`}>
          <div className="flex items-center gap-3 min-w-0">
            <UserCircle size={28} className="text-[#A9C5B4] flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{u.display_name || u.email?.split('@')[0]}</p>
              <p className="text-[#A9C5B4] text-xs truncate">{u.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${rb(u.role)}`}>{ri(u.role)} {u.role}</span>
            {u.role !== 'admin' && (
              <>
                <select value={u.role} onChange={e => updateRole(u.id, e.target.value)} className="bg-[#051A10] border border-[#D4AF37]/20 text-white text-xs rounded px-2 py-1 focus:outline-none flex-1 sm:flex-none" data-testid={`user-role-${u.id}`}>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="admin">Admin</option>
                  <option value="rejected">Rejected (blocked)</option>
                </select>
                <button onClick={() => setConfirmRemove(u)} title="Remove user" className="text-[#A9C5B4] hover:text-red-400 flex-shrink-0" data-testid={`user-remove-${u.id}`}><Trash size={16} /></button>
              </>
            )}
          </div>
        </div>
      ))}</div>
      <ConfirmModal
        open={!!confirmRemove}
        title="Remove this user?"
        message={`This will mark ${confirmRemove?.display_name || confirmRemove?.email} as removed and revoke all access. You can reinstate them later by changing their role.`}
        confirmLabel="Remove user"
        onConfirm={doRemove}
        onClose={() => setConfirmRemove(null)}
      />
    </div>
  );
};

// ===== DANGER ZONE (reset season / clear scores) =====
const DangerPanel = () => {
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const doClear = async () => {
    setMsg(''); setBusy(true);
    try {
      const count = await db.clearAllScores();
      if (count === 0) {
        setMsg('Warning: 0 scores were deleted. This usually means RLS in Supabase is blocking the delete. Run the SUPABASE_SETUP.sql from your repo in the Supabase SQL Editor to fix policies.');
      } else {
        setMsg(`✅ ${count} score entries deleted. Click Refresh in the top bar to see the dashboard update.`);
      }
    } catch (e) { setMsg('Error: ' + e.message); }
    finally { setBusy(false); }
  };

  const doReset = async () => {
    setMsg(''); setBusy(true);
    try {
      const counts = await db.resetSeasonData();
      const total = counts.scores + counts.teams + counts.holes + counts.rounds;
      if (total === 0) {
        setMsg('Warning: 0 rows were deleted. This usually means RLS in Supabase is blocking deletes. Run the SUPABASE_SETUP.sql from your repo in the Supabase SQL Editor.');
      } else {
        setMsg(`✅ Season reset. Deleted ${counts.scores} scores, ${counts.teams} teams, ${counts.holes} legacy per-round hole rows, ${counts.rounds} rounds. Course-level hole setup preserved. Click Refresh in the top bar to reload the dashboard.`);
      }
    } catch (e) { setMsg('Error: ' + e.message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <h3 className="text-sm text-red-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Warning size={16} /> Danger Zone</h3>
      <p className="text-xs text-[#A9C5B4] mb-5">These actions are permanent. <span className="text-[#D4AF37]">Players, courses, and course-level hole setup are always preserved.</span></p>
      {msg && <div className={`mb-4 py-2 px-3 rounded-lg text-xs leading-relaxed ${msg.includes('Error') || msg.includes('Warning') ? 'bg-red-900/30 text-red-300 border border-red-500/30' : 'bg-emerald-900/30 text-emerald-300 border border-emerald-500/30'}`} data-testid="danger-msg">{msg}</div>}
      <div className="space-y-3">
        <button onClick={() => setConfirmClear(true)} disabled={busy} className="w-full py-3 rounded-lg border border-amber-500/40 text-amber-300 text-sm font-semibold hover:bg-amber-500/10 transition-colors disabled:opacity-40" data-testid="clear-all-scores">
          {busy ? 'Working...' : 'Clear all scores (keep rounds & teams)'}
        </button>
        <button onClick={() => setConfirmReset(true)} disabled={busy} className="w-full py-3 rounded-lg border border-red-500/40 text-red-400 text-sm font-semibold hover:bg-red-500/10 transition-colors disabled:opacity-40" data-testid="reset-season">
          {busy ? 'Working...' : 'Reset entire season (remove rounds, holes, scores & teams)'}
        </button>
      </div>
      <ConfirmModal
        open={confirmClear}
        title="Clear all scores?"
        message="Every score entry across all rounds will be deleted. Rounds, holes, teams and players remain. This can't be undone."
        confirmLabel="Clear all scores"
        onConfirm={doClear}
        onClose={() => setConfirmClear(false)}
      />
      <ConfirmModal
        open={confirmReset}
        title="Reset entire season?"
        message="Every round, legacy per-round hole override, score and team pairing will be deleted. Players, courses, and your course-level hole setup are kept so you can start a clean season with the same setup. This can't be undone."
        confirmLabel="Reset season"
        onConfirm={doReset}
        onClose={() => setConfirmReset(false)}
      />
    </div>
  );
};

// ===== MAIN ADMIN PANEL =====
export default function AdminPanel() {
  const [tab, setTab] = useState('players');
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} data-testid="admin-panel">
      <div className="text-center mb-8"><h2 className="text-3xl font-serif text-[#D4AF37] mb-2">Admin Panel</h2><p className="text-[#A9C5B4] text-sm">Manage your golf league</p></div>
      <div className="flex flex-wrap gap-2 justify-center mb-8">
        {['players','courses','rounds','teams','users','danger'].map(t => <TabBtn key={t} active={tab===t} label={t==='danger' ? 'Danger Zone' : t.charAt(0).toUpperCase()+t.slice(1)} onClick={()=>setTab(t)}/>)}
      </div>
      <div className="max-w-2xl mx-auto rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 backdrop-blur-md p-6 shadow-2xl">
        {tab === 'players' && <PlayersPanel />}
        {tab === 'courses' && <CoursesPanel />}
        {tab === 'rounds' && <RoundsPanel />}
        {tab === 'teams' && <TeamsPanel />}
        {tab === 'users' && <UsersPanel />}
        {tab === 'danger' && <DangerPanel />}
      </div>
    </motion.div>
  );
}
