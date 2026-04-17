import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PencilSimple, Trash, Plus, Check, X, UserCircle, ShieldCheck, Clock, ShieldSlash } from '@phosphor-icons/react';
import * as db from '../services/supabaseService';

const Modal = ({ title, onClose, children }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-[#051A10]/80 backdrop-blur-sm">
    <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-lg mx-4 rounded-xl border border-[#D4AF37]/30 bg-[#0F2C1D] p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-serif text-[#D4AF37]">{title}</h2><button onClick={onClose} className="text-[#A9C5B4] hover:text-white"><X size={20} /></button></div>
      {children}
    </motion.div>
  </motion.div>
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
            <button onClick={() => { setEditing(p.id); setForm({ name: p.name, handicap: p.handicap }); setError(''); }} className="text-[#A9C5B4] hover:text-[#D4AF37]"><PencilSimple size={16} /></button>
            <button onClick={async () => { if(window.confirm('Deactivate?')) { await db.deletePlayer(p.id); await load(); } }} className="text-[#A9C5B4] hover:text-red-400"><Trash size={16} /></button>
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

  useEffect(() => { load(); }, []);
  const load = async () => { setCourses(await db.getCourses()); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true); setError('');
    try {
      if (editing === 'new') await db.createCourse(form);
      else await db.updateCourse(editing, form);
      setEditing(null); await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <h3 className="text-sm text-[#A9C5B4] uppercase tracking-wider flex-1">Courses ({courses.length})</h3>
        <button onClick={() => { setEditing('new'); setForm({ name: '', rating: null, slope: null, par: null }); setError(''); }} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 rounded-lg hover:bg-[#D4AF37]/30"><Plus size={14} /> Add</button>
      </div>
      <div className="space-y-2">{courses.map(c => (
        <div key={c.id} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10">
          <div><p className="text-white text-sm font-semibold">{c.name}</p><p className="text-[#A9C5B4] text-xs">Par {c.par} &middot; Rating {c.rating} &middot; Slope {c.slope}</p></div>
          <button onClick={() => { setEditing(c.id); setForm({ name: c.name, rating: c.rating, slope: c.slope, par: c.par }); setError(''); }} className="text-[#A9C5B4] hover:text-[#D4AF37]"><PencilSimple size={16} /></button>
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
    </div>
  );
};

// ===== ROUNDS + HOLES SETUP =====
const RoundsPanel = () => {
  const [rounds, setRounds] = useState([]);
  const [courses, setCourses] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ round_number: null, course_id: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Holes setup
  const [holesRound, setHolesRound] = useState(null);
  const [holes, setHoles] = useState([]);
  const [savingHoles, setSavingHoles] = useState(false);
  const [holesMsg, setHolesMsg] = useState('');

  useEffect(() => { load(); }, []);
  const load = async () => { setRounds(await db.getRounds()); setCourses(await db.getCourses()); };

  const save = async () => {
    if (!form.round_number) return;
    setSaving(true); setError('');
    try {
      const data = { round_number: parseInt(form.round_number), course_id: form.course_id ? parseInt(form.course_id) : null, is_setup: !!form.course_id };
      if (editing === 'new') await db.createRound(data);
      else await db.updateRound(editing, data);
      setEditing(null); await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const openHoles = async (round) => {
    setHolesRound(round);
    const existing = await db.getRoundHoles(round.id);
    if (existing.length > 0) {
      setHoles(existing.map(h => ({ hole_number: h.hole_number, par: h.par, stroke_index: h.stroke_index })));
    } else {
      // Default 18 holes
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
      const data = holes.map(h => ({ round_id: holesRound.id, hole_number: h.hole_number, par: h.par, stroke_index: h.stroke_index }));
      await db.upsertRoundHoles(data);
      setHolesMsg('Holes saved!');
      setTimeout(() => setHolesMsg(''), 3000);
    } catch (e) { setHolesMsg('Error: ' + e.message); } finally { setSavingHoles(false); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <h3 className="text-sm text-[#A9C5B4] uppercase tracking-wider flex-1">Rounds ({rounds.length})</h3>
        <button onClick={() => { setEditing('new'); setForm({ round_number: rounds.length + 1, course_id: null }); setError(''); }} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 rounded-lg hover:bg-[#D4AF37]/30"><Plus size={14} /> Add</button>
      </div>
      <div className="space-y-2">{rounds.map(r => (
        <div key={r.id} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10">
          <div><p className="text-white text-sm font-semibold">Round {r.round_number}</p><p className="text-[#A9C5B4] text-xs">{r.courses ? r.courses.name : 'No course'} {r.is_setup ? '' : '(not set up)'}</p></div>
          <div className="flex gap-2">
            {r.is_setup && <button onClick={() => openHoles(r)} className="text-xs text-[#D4AF37] border border-[#D4AF37]/30 px-2 py-1 rounded hover:bg-[#D4AF37]/10">Holes</button>}
            <button onClick={() => { setEditing(r.id); setForm({ round_number: r.round_number, course_id: r.course_id }); setError(''); }} className="text-[#A9C5B4] hover:text-[#D4AF37]"><PencilSimple size={16} /></button>
          </div>
        </div>
      ))}</div>

      {/* Round Edit Modal */}
      <AnimatePresence>{editing && (
        <Modal title={editing === 'new' ? 'Add Round' : 'Edit Round'} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <Field label="Round Number" type="number" value={form.round_number} onChange={v => setForm(f => ({ ...f, round_number: v }))} placeholder="e.g. 6" required />
            <SelectField label="Course" value={form.course_id} onChange={v => setForm(f => ({ ...f, course_id: v || null }))} placeholder="Select course..." options={courses.map(c => ({ value: c.id, label: `${c.name} (Par ${c.par})` }))} />
            <ErrorMsg msg={error} />
            <SaveBtn onClick={save} loading={saving} />
          </div>
        </Modal>
      )}</AnimatePresence>

      {/* Holes Setup Modal */}
      <AnimatePresence>{holesRound && (
        <Modal title={`Holes Setup — Round ${holesRound.round_number} (${holesRound.courses?.name})`} onClose={() => setHolesRound(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-[60px_1fr_1fr] gap-2 text-xs text-[#A9C5B4] uppercase tracking-wider px-1">
              <span>Hole</span><span>Par</span><span>SI</span>
            </div>
            {holes.map((h, i) => (
              <div key={h.hole_number} className="grid grid-cols-[60px_1fr_1fr] gap-2 items-center">
                <span className="text-white text-sm font-bold text-center">{h.hole_number}</span>
                <input type="number" value={h.par} onChange={e => updateHole(i, 'par', e.target.value)} className="px-3 py-2 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white text-sm text-center focus:outline-none focus:border-[#D4AF37]/50" />
                <input type="number" value={h.stroke_index} onChange={e => updateHole(i, 'stroke_index', e.target.value)} className="px-3 py-2 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white text-sm text-center focus:outline-none focus:border-[#D4AF37]/50" />
              </div>
            ))}
            {holesMsg && <p className={`text-xs ${holesMsg.includes('Error') ? 'text-red-400' : 'text-emerald-400'}`}>{holesMsg}</p>}
            <SaveBtn onClick={saveHoles} loading={savingHoles} label="Save Holes" />
          </div>
        </Modal>
      )}</AnimatePresence>
    </div>
  );
};

// ===== TEAMS =====
const TeamsPanel = () => {
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ round_id: null, player1_id: null, player2_id: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);
  const load = async () => { setTeams(await db.getAllTeams()); setPlayers(await db.getPlayers()); setRounds(await db.getSetUpRounds()); };

  const save = async () => {
    if (!form.round_id || !form.player1_id || !form.player2_id) return;
    setSaving(true); setError('');
    try {
      await db.createTeam({ round_id: parseInt(form.round_id), player1_id: parseInt(form.player1_id), player2_id: parseInt(form.player2_id) });
      setEditing(null); await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this team?')) return;
    try { await db.deleteTeam(id); await load(); } catch (e) { alert('Error: ' + e.message); }
  };

  const byRound = {};
  teams.forEach(t => {
    const key = `Round ${t.rounds?.round_number || '?'} - ${t.rounds?.courses?.name || 'Unknown'}`;
    if (!byRound[key]) byRound[key] = [];
    byRound[key].push(t);
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <h3 className="text-sm text-[#A9C5B4] uppercase tracking-wider flex-1">Teams ({teams.length})</h3>
        <button onClick={() => { setEditing('new'); setForm({ round_id: rounds[0]?.id || null, player1_id: null, player2_id: null }); setError(''); }} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 rounded-lg hover:bg-[#D4AF37]/30"><Plus size={14} /> Add</button>
      </div>
      {Object.entries(byRound).map(([label, rTeams]) => (
        <div key={label} className="mb-4"><p className="text-xs text-[#D4AF37]/70 uppercase tracking-wider mb-2">{label}</p><div className="space-y-2">{rTeams.map(t => (
          <div key={t.id} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10">
            <p className="text-white text-sm">{t.player1?.name} & {t.player2?.name}</p>
            <button onClick={() => remove(t.id)} className="text-[#A9C5B4] hover:text-red-400"><Trash size={16} /></button>
          </div>
        ))}</div></div>
      ))}
      <AnimatePresence>{editing && (
        <Modal title="Add Team" onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <SelectField label="Round" value={form.round_id} onChange={v => setForm(f => ({ ...f, round_id: v }))} options={rounds.map(r => ({ value: r.id, label: `Round ${r.round_number} - ${r.courses?.name}` }))} />
            <SelectField label="Player 1" value={form.player1_id} onChange={v => setForm(f => ({ ...f, player1_id: v }))} placeholder="Select..." options={players.map(p => ({ value: p.id, label: p.name }))} />
            <SelectField label="Player 2" value={form.player2_id} onChange={v => setForm(f => ({ ...f, player2_id: v }))} placeholder="Select..." options={players.filter(p => String(p.id) !== String(form.player1_id)).map(p => ({ value: p.id, label: p.name }))} />
            <ErrorMsg msg={error} />
            <SaveBtn onClick={save} loading={saving} />
          </div>
        </Modal>
      )}</AnimatePresence>
    </div>
  );
};

// ===== USERS =====
const UsersPanel = () => {
  const [users, setUsers] = useState([]);
  useEffect(() => { load(); }, []);
  const load = async () => { setUsers(await db.getAllUsers()); };
  const updateRole = async (userId, role) => { await db.updateUserRole(userId, role); await load(); };
  const ri = (role) => role === 'admin' ? <ShieldCheck size={16} className="text-[#D4AF37]" /> : role === 'approved' ? <Check size={16} className="text-emerald-400" /> : role === 'pending' ? <Clock size={16} className="text-amber-400" /> : <ShieldSlash size={16} className="text-red-400" />;
  const rb = (role) => role === 'admin' ? 'bg-[#D4AF37]/10 text-[#D4AF37]' : role === 'approved' ? 'bg-emerald-900/30 text-emerald-400' : role === 'pending' ? 'bg-amber-900/30 text-amber-400' : 'bg-red-900/30 text-red-400';
  return (
    <div>
      <h3 className="text-sm text-[#A9C5B4] uppercase tracking-wider mb-5">Users ({users.length})</h3>
      <div className="space-y-2">{users.map(u => (
        <div key={u.id} className="flex items-center justify-between py-3 px-4 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10">
          <div className="flex items-center gap-3"><UserCircle size={28} className="text-[#A9C5B4]" /><div><p className="text-white text-sm font-semibold">{u.display_name || u.email?.split('@')[0]}</p><p className="text-[#A9C5B4] text-xs">{u.email}</p></div></div>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${rb(u.role)}`}>{ri(u.role)} {u.role}</span>
            {u.role !== 'admin' && <select value={u.role} onChange={e => updateRole(u.id, e.target.value)} className="bg-[#051A10] border border-[#D4AF37]/20 text-white text-xs rounded px-2 py-1 focus:outline-none">
              <option value="pending">Pending</option><option value="approved">Approved</option><option value="admin">Admin</option><option value="rejected">Rejected</option>
            </select>}
          </div>
        </div>
      ))}</div>
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
        {['players','courses','rounds','teams','users'].map(t => <TabBtn key={t} active={tab===t} label={t.charAt(0).toUpperCase()+t.slice(1)} onClick={()=>setTab(t)}/>)}
      </div>
      <div className="max-w-2xl mx-auto rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 backdrop-blur-md p-6 shadow-2xl">
        {tab === 'players' && <PlayersPanel />}
        {tab === 'courses' && <CoursesPanel />}
        {tab === 'rounds' && <RoundsPanel />}
        {tab === 'teams' && <TeamsPanel />}
        {tab === 'users' && <UsersPanel />}
      </div>
    </motion.div>
  );
}
