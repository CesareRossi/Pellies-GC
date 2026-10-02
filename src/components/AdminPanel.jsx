import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PencilSimple, Trash, Plus, Check, X, UserCircle, ShieldCheck, Clock, ShieldSlash,
  Warning, Flag, Trophy, CaretDown, Target, Lock, LockOpen, Users, MapPin,
  CalendarBlank, Golf, Confetti, Broom,
} from '@phosphor-icons/react';
import * as db from '../services/supabaseService';
import { parseHoleField, validateCourseHoles, normalizeHolesForSave } from '../lib/courseHoles';
import { formatHandicap } from '../lib/utils';
import ConfirmModal from './ConfirmModal';
import SeasonRecapModal from './SeasonRecap';
import {
  Button, IconButton, Chip, LiveChip, Field, SelectField, Segmented,
  SectionLabel, Banner, EmptyState, SearchInput, Spinner,
} from './common';
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from '../hooks/useOverlay';

/* ==========================================================================
   Modal — portalled, scroll-locked, escape-to-close, focus-trapped.
   Header and footer are pinned; only the body scrolls, so a tall form (the
   Round editor, the 18-hole editor) never pushes its Save button off-screen.
   ========================================================================== */
const Modal = ({ title, subtitle, icon, onClose, children, footer, wide = false, testId }) => {
  const panelRef = useRef(null);
  useBodyScrollLock(true);
  useEscapeKey(true, onClose);
  useFocusTrap(panelRef, true);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      className="fixed inset-0 z-[150] flex items-center justify-center bg-[#03110A]/82 p-3 backdrop-blur-md sm:p-6"
      onClick={onClose}
      data-testid={testId}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ scale: 0.97, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.985, y: 6, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className={`pg-card flex max-h-[min(92vh,52rem)] w-full flex-col overflow-hidden ${
          wide ? 'max-w-2xl' : 'max-w-lg'
        }`}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-[#D4AF37]/14 px-5 py-4">
          {icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#D4AF37]">
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="pg-display truncate text-[17px] text-[#D4AF37]">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-xs text-[#A9C5B4]">{subtitle}</p>}
          </div>
          <IconButton label="Close" onClick={onClose} data-overlay-close="true">
            <X size={18} />
          </IconButton>
        </div>

        <div className="pg-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-[#D4AF37]/14 bg-[#0C2416]/70 px-5 py-4">{footer}</div>
        )}
      </motion.div>
    </motion.div>,
    document.body
  );
};

/* -------------------------------------------------------------------------- */

const PanelHeader = ({ icon, title, count, children }) => (
  <div className="mb-5 flex flex-wrap items-center gap-3">
    <SectionLabel icon={icon} className="flex-1 min-w-[140px]">
      {title}
      {count != null && <span className="ml-1.5 text-[#D4AF37]">({count})</span>}
    </SectionLabel>
    <div className="flex items-center gap-2">{children}</div>
  </div>
);

/** Round-number / rank style gold numeral tile. */
const NumberTile = ({ children, tone = 'default' }) => (
  <span
    className={`pg-num flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-bold ${
      tone === 'live'
        ? 'border-[#D4AF37]/60 bg-gradient-to-b from-[#F1D67E] to-[#D4AF37] text-[#051A10]'
        : 'border-[#D4AF37]/22 bg-[#D4AF37]/8 text-[#D4AF37]'
    }`}
  >
    {children}
  </span>
);

const Avatar = ({ name, muted = false }) => {
  const initials = (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold tracking-wide ${
        muted
          ? 'border-white/10 bg-white/5 text-[#A9C5B4]'
          : 'border-[#D4AF37]/25 bg-gradient-to-br from-[#D4AF37]/20 to-transparent text-[#D4AF37]'
      }`}
    >
      {initials}
    </span>
  );
};

/** One row in an admin list. */
const Row = ({ leading, title, meta, actions, highlight = false, dimmed = false, testId }) => (
  <div
    data-testid={testId}
    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
      highlight
        ? 'border-[#D4AF37]/45 bg-[#D4AF37]/10'
        : 'border-[#D4AF37]/10 bg-[#051A10]/55 hover:border-[#D4AF37]/22 hover:bg-[#0B2817]/70'
    } ${dimmed ? 'opacity-55' : ''}`}
  >
    {leading}
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">{title}</div>
      {meta && <div className="mt-1 flex flex-wrap items-center gap-1.5">{meta}</div>}
    </div>
    <div className="flex shrink-0 items-center gap-0.5">{actions}</div>
  </div>
);

/* ==========================================================================
   PLAYERS
   ========================================================================== */
const PlayersPanel = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | player_id
  const [form, setForm] = useState({ name: '', handicap: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);
  const [actionError, setActionError] = useState('');
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  useEffect(() => { load(); }, []);
  const load = async () => {
    setLoading(true);
    try { setPlayers(await db.getAllPlayers()); } finally { setLoading(false); }
  };

  const nameTaken = useMemo(() => {
    const n = form.name.trim().toLowerCase();
    if (!n) return false;
    return players.some((p) => p.name.trim().toLowerCase() === n && p.id !== editing);
  }, [form.name, players, editing]);

  const save = async () => {
    if (!form.name.trim() || nameTaken) return;
    setSaving(true); setError('');
    try {
      if (editing === 'new') await db.createPlayer({ name: form.name.trim(), handicap: form.handicap });
      else await db.updatePlayer(editing, { name: form.name.trim(), handicap: form.handicap });
      setEditing(null); await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    setActionError('');
    try {
      await db.deletePlayer(confirmDel.id);
      await load();
    } catch (e) {
      setActionError('Error: ' + e.message);
      setTimeout(() => setActionError(''), 5000);
    }
  };

  const togglePlayerActive = async (playerId) => {
    const player = players.find((p) => p.id === playerId);
    if (!player) return;
    setActionError('');
    try {
      if (player.is_active) await db.disablePlayer(playerId);
      else await db.enablePlayer(playerId);
      await load();
    } catch (e) {
      setActionError('Error: ' + e.message);
      setTimeout(() => setActionError(''), 5000);
    }
  };

  const sortedPlayers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...players]
      .filter((p) => (showInactive ? true : p.is_active))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [players, query, showInactive]);

  const activeCount = players.filter((p) => p.is_active).length;

  return (
    <div>
      <PanelHeader icon={<Users size={14} weight="duotone" />} title="Players" count={players.length}>
        <Button
          size="sm"
          variant="primary"
          icon={<Plus size={14} weight="bold" />}
          onClick={() => { setEditing('new'); setForm({ name: '', handicap: null }); setError(''); setActionError(''); }}
          data-testid="player-add"
        >
          Add player
        </Button>
      </PanelHeader>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={query} onChange={setQuery} placeholder="Search players…" className="flex-1" />
        <Segmented
          ariaLabel="Filter players"
          size="sm"
          value={showInactive ? 'all' : 'active'}
          onChange={(v) => setShowInactive(v === 'all')}
          options={[
            { value: 'all', label: 'All', count: players.length },
            { value: 'active', label: 'Active', count: activeCount },
          ]}
        />
      </div>

      {actionError && <Banner tone="error" className="mb-4">{actionError}</Banner>}

      {loading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="pg-skeleton h-14" />)}</div>
      ) : sortedPlayers.length === 0 ? (
        <EmptyState icon={<Users size={26} weight="duotone" />} title="No players found" message={query ? 'Try a different search.' : 'Add your first player to get started.'} />
      ) : (
        <div className="space-y-2">
          {sortedPlayers.map((p) => (
            <Row
              key={p.id}
              dimmed={!p.is_active}
              leading={<Avatar name={p.name} muted={!p.is_active} />}
              title={
                <>
                  <span className="truncate text-sm font-semibold text-white">{p.name}</span>
                  {!p.is_active && <Chip tone="amber">Disabled</Chip>}
                </>
              }
              meta={
                <Chip>
                  HCP&nbsp;<span className="pg-num text-white">{formatHandicap(p.handicap) ?? '—'}</span>
                </Chip>
              }
              actions={
                <>
                  <IconButton
                    label="Edit player" tone="gold"
                    onClick={() => { setEditing(p.id); setForm({ name: p.name, handicap: p.handicap }); setError(''); }}
                    data-testid={`player-edit-${p.id}`}
                  >
                    <PencilSimple size={16} />
                  </IconButton>
                  <IconButton
                    label={p.is_active ? 'Disable player' : 'Enable player'}
                    onClick={() => togglePlayerActive(p.id)}
                    data-testid={`player-toggle-${p.id}`}
                  >
                    {p.is_active ? <ShieldSlash size={16} /> : <ShieldCheck size={16} />}
                  </IconButton>
                  <IconButton label="Remove player" tone="danger" onClick={() => setConfirmDel(p)} data-testid={`player-delete-${p.id}`}>
                    <Trash size={16} />
                  </IconButton>
                </>
              }
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <Modal
            title={editing === 'new' ? 'Add player' : 'Edit player'}
            icon={<Users size={17} weight="duotone" />}
            onClose={() => setEditing(null)}
            testId="player-modal"
            footer={
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                <Button
                  variant="primary" block onClick={save}
                  disabled={saving || !form.name.trim() || nameTaken}
                  icon={<Check size={15} weight="bold" />} data-testid="player-save"
                >
                  {saving ? 'Saving…' : 'Save player'}
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              <Field
                label="Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Player name" required autoFocus
                error={nameTaken ? 'A player with this name already exists.' : ''}
              />
              <Field
                label="Handicap index" type="number" value={form.handicap}
                onChange={(v) => setForm((f) => ({ ...f, handicap: v }))}
                placeholder="e.g. 14.7"
                hint="Enter a negative value for a plus handicap (−3 shows as +3.0)."
              />
              {error && <Banner tone="error">{error}</Banner>}
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <ConfirmModal
        open={!!confirmDel}
        title="Remove player?"
        message={`This will deactivate ${confirmDel?.name} and remove all of their scores. This can't be undone.`}
        confirmLabel="Remove player"
        onConfirm={doDelete}
        onClose={() => setConfirmDel(null)}
      />
    </div>
  );
};

/* ==========================================================================
   COURSES
   ========================================================================== */
const CoursesPanel = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', rating: null, slope: null, par: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [actionError, setActionError] = useState('');
  // Holes setup (per-course)
  const [holesCourse, setHolesCourse] = useState(null);
  const [holes, setHoles] = useState([]);
  const [savingHoles, setSavingHoles] = useState(false);
  const [holesMsg, setHolesMsg] = useState('');
  const [holesError, setHolesError] = useState('');

  useEffect(() => { load(); }, []);
  const load = async () => {
    setLoading(true);
    try { setCourses(await db.getCourses(true)); } finally { setLoading(false); }
  };

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
    setActionError('');
    try { await db.setCourseActive(c.id, !c.is_active); await load(); }
    catch (e) { setActionError('Error: ' + e.message); setTimeout(() => setActionError(''), 5000); }
  };

  const openHoles = async (course) => {
    setHolesCourse(course);
    try {
      const existing = await db.getCourseHoles(course.id);
      if (existing.length > 0) {
        setHoles(existing.map((h) => ({ hole_number: h.hole_number, par: h.par, stroke_index: h.stroke_index })));
      } else {
        setHoles(Array.from({ length: 18 }, (_, i) => ({ hole_number: i + 1, par: null, stroke_index: null })));
      }
    } catch (e) {
      setHoles(Array.from({ length: 18 }, (_, i) => ({ hole_number: i + 1, par: null, stroke_index: null })));
    }
    setHolesMsg('');
    setHolesError('');
  };

  const updateHole = (idx, field, value) => {
    setHolesError('');
    setHoles((prev) => prev.map((h, i) => (i === idx ? { ...h, [field]: parseHoleField(value) } : h)));
  };

  const saveHoles = async () => {
    const validationErrors = validateCourseHoles(holes, holesCourse?.par);
    if (validationErrors.length) {
      setHolesError(validationErrors.join(' '));
      return;
    }
    setSavingHoles(true); setHolesMsg(''); setHolesError('');
    try {
      const normalized = normalizeHolesForSave(holes);
      const data = normalized.map((h) => ({ course_id: holesCourse.id, ...h }));
      await db.upsertCourseHoles(data);
      setHolesMsg('Holes saved. Every round on this course now uses these.');
      setTimeout(() => setHolesMsg(''), 3500);
    } catch (e) { setHolesMsg('Error: ' + e.message); }
    finally { setSavingHoles(false); }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((c) => (q ? c.name.toLowerCase().includes(q) : true));
  }, [courses, query]);

  const holesTotal = holes.reduce((s, h) => s + (Number(h.par) || 0), 0);
  const parMatches = holesCourse?.par != null && holesTotal === Number(holesCourse.par);
  const holesFilled = holes.filter((h) => h.par != null && h.par !== '' && h.stroke_index != null && h.stroke_index !== '').length;

  return (
    <div>
      <PanelHeader icon={<MapPin size={14} weight="duotone" />} title="Courses" count={courses.length}>
        <Button
          size="sm" variant="primary" icon={<Plus size={14} weight="bold" />}
          onClick={() => { setEditing('new'); setForm({ name: '', rating: null, slope: null, par: null }); setError(''); }}
          data-testid="course-add"
        >
          Add course
        </Button>
      </PanelHeader>

      <SearchInput value={query} onChange={setQuery} placeholder="Search courses…" className="mb-4" />
      {actionError && <Banner tone="error" className="mb-4">{actionError}</Banner>}

      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="pg-skeleton h-14" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<MapPin size={26} weight="duotone" />} title="No courses found" message={query ? 'Try a different search.' : 'Add a course so rounds have somewhere to be played.'} />
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Row
              key={c.id}
              dimmed={!c.is_active}
              leading={
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/22 bg-[#D4AF37]/8 text-[#D4AF37]">
                  <Flag size={16} weight="duotone" />
                </span>
              }
              title={
                <>
                  <span className="truncate text-sm font-semibold text-white">{c.name}</span>
                  {!c.is_active && <Chip tone="amber">Disabled</Chip>}
                </>
              }
              meta={
                <>
                  <Chip>Par <span className="pg-num text-white">{c.par ?? '—'}</span></Chip>
                  <Chip>Rating <span className="pg-num text-white">{c.rating ?? '—'}</span></Chip>
                  <Chip>Slope <span className="pg-num text-white">{c.slope ?? '—'}</span></Chip>
                </>
              }
              actions={
                <>
                  <Button size="sm" variant="outline" onClick={() => openHoles(c)} data-testid={`course-holes-${c.id}`}>
                    Holes
                  </Button>
                  <IconButton label={c.is_active ? 'Disable course' : 'Enable course'} onClick={() => toggleActive(c)} data-testid={`course-toggle-${c.id}`}>
                    {c.is_active ? <ShieldSlash size={16} /> : <ShieldCheck size={16} />}
                  </IconButton>
                  <IconButton
                    label="Edit course" tone="gold"
                    onClick={() => { setEditing(c.id); setForm({ name: c.name, rating: c.rating, slope: c.slope, par: c.par }); setError(''); }}
                    data-testid={`course-edit-${c.id}`}
                  >
                    <PencilSimple size={16} />
                  </IconButton>
                </>
              }
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <Modal
            title={editing === 'new' ? 'Add course' : 'Edit course'}
            icon={<MapPin size={17} weight="duotone" />}
            onClose={() => setEditing(null)}
            testId="course-modal"
            footer={
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                <Button variant="primary" block onClick={save} disabled={saving || !form.name.trim()} icon={<Check size={15} weight="bold" />} data-testid="course-save">
                  {saving ? 'Saving…' : 'Save course'}
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              <Field label="Course name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Zebula" required autoFocus />
              <div className="grid grid-cols-3 gap-3">
                <Field label="Par" type="number" value={form.par} onChange={(v) => setForm((f) => ({ ...f, par: v }))} placeholder="72" />
                <Field label="Rating" type="number" value={form.rating} onChange={(v) => setForm((f) => ({ ...f, rating: v }))} placeholder="73.2" />
                <Field label="Slope" type="number" value={form.slope} onChange={(v) => setForm((f) => ({ ...f, slope: v }))} placeholder="129" />
              </div>
              <p className="pg-field-hint">Set par &amp; stroke index per hole with the <strong className="text-[#D4AF37]">Holes</strong> button on the course row.</p>
              {error && <Banner tone="error">{error}</Banner>}
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Course holes setup */}
      <AnimatePresence>
        {holesCourse && (
          <Modal
            title={`Holes — ${holesCourse.name}`}
            subtitle="Par & stroke index are set once per course"
            icon={<Golf size={17} weight="duotone" />}
            onClose={() => setHolesCourse(null)}
            wide
            testId="course-holes-modal"
            footer={
              <div className="space-y-2.5">
                {holesMsg && <Banner tone={holesMsg.includes('Error') ? 'error' : 'success'}>{holesMsg}</Banner>}
                <Button variant="primary" block onClick={saveHoles} disabled={savingHoles} icon={<Check size={15} weight="bold" />} data-testid="course-holes-save">
                  {savingHoles ? 'Saving…' : 'Save holes'}
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <div className="pg-card-flat px-3 py-2.5">
                  <p className="pg-eyebrow mb-1">Course par</p>
                  <p className="pg-num text-lg font-bold text-white">{holesCourse?.par ?? '—'}</p>
                </div>
                <div className="pg-card-flat px-3 py-2.5">
                  <p className="pg-eyebrow mb-1">Holes total</p>
                  <p className={`pg-num text-lg font-bold ${holesCourse?.par == null ? 'text-white' : parMatches ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {holesTotal}
                  </p>
                </div>
                <div className="pg-card-flat col-span-2 px-3 py-2.5 sm:col-span-1">
                  <p className="pg-eyebrow mb-1">Completed</p>
                  <p className="pg-num text-lg font-bold text-white">{holesFilled}<span className="text-sm text-[#A9C5B4]">/18</span></p>
                </div>
              </div>

              {holesError && <Banner tone="error">{holesError}</Banner>}

              <div>
                <div className="sticky top-0 z-10 -mx-1 grid grid-cols-[48px_1fr_1fr] gap-2 border-b border-[#D4AF37]/12 bg-[#0F2C1D] px-1 pb-2 pt-1">
                  <span className="pg-eyebrow text-center">Hole</span>
                  <span className="pg-eyebrow text-center">Par</span>
                  <span className="pg-eyebrow text-center">SI</span>
                </div>
                <div className="space-y-1.5 pt-2">
                  {holes.map((h, i) => {
                    const isBack9 = h.hole_number === 10;
                    return (
                      <React.Fragment key={h.hole_number}>
                        {isBack9 && (
                          <div className="flex items-center gap-2 py-1.5">
                            <span className="pg-eyebrow pg-eyebrow-gold">Back 9</span>
                            <span className="h-px flex-1 bg-[#D4AF37]/12" />
                          </div>
                        )}
                        <div className="grid grid-cols-[48px_1fr_1fr] items-center gap-2 rounded-lg border border-[#D4AF37]/10 bg-[#051A10]/55 p-1.5">
                          <span className="pg-num text-center text-sm font-bold text-[#D4AF37]">{h.hole_number}</span>
                          <input
                            type="number" inputMode="numeric"
                            value={h.par === '' || h.par == null ? '' : h.par}
                            onChange={(e) => updateHole(i, 'par', e.target.value)}
                            className="pg-input pg-num min-h-[40px] py-2 text-center"
                            min={1} max={6} placeholder="Par"
                            aria-label={`Hole ${h.hole_number} par`}
                          />
                          <input
                            type="number" inputMode="numeric"
                            value={h.stroke_index === '' || h.stroke_index == null ? '' : h.stroke_index}
                            onChange={(e) => updateHole(i, 'stroke_index', e.target.value)}
                            className="pg-input pg-num min-h-[40px] py-2 text-center"
                            min={1} max={18} placeholder="SI"
                            aria-label={`Hole ${h.hole_number} stroke index`}
                          />
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ==========================================================================
   ROUNDS
   ========================================================================== */
const RoundsPanel = ({ onSeasonChanged }) => {
  const [rounds, setRounds] = useState([]);
  const [courses, setCourses] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ round_number: null, course_id: null, beer_hole: null, joker_hole: null });
  const [included, setIncluded] = useState(new Set());
  const [includedInitial, setIncludedInitial] = useState(new Set());
  const [playerQuery, setPlayerQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);
  const [confirmClear, setConfirmClear] = useState(null);
  const [confirmCloseRound, setConfirmCloseRound] = useState(null);
  // Completeness check for the round being closed: null = not checked yet
  const [closeCheck, setCloseCheck] = useState(null);
  const [actionMsg, setActionMsg] = useState('');
  const [allInclusions, setAllInclusions] = useState([]);
  const [currentRoundId, setCurrentRoundId] = useState(null);
  const [settingCurrent, setSettingCurrent] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { load(); }, []);
  const load = async () => {
    setLoading(true);
    try {
      setRounds(await db.getRounds());
      setCourses(await db.getCourses());
      setPlayers(await db.getPlayers());
      try { setAllInclusions(await db.getAllRoundInclusions()); } catch { /* ignore */ }
      try {
        const currentRound = await db.getCurrentRound();
        setCurrentRoundId(currentRound?.id || null);
      } catch { /* ignore */ }
    } finally { setLoading(false); }
  };

  const openEdit = async (round) => {
    setEditing(round.id);
    setPlayerQuery('');
    setForm({
      round_number: round.round_number,
      course_id: round.course_id,
      beer_hole: round.beer_hole,
      joker_hole: round.joker_hole,
    });
    setError('');
    try {
      const ids = await db.getRoundParticipants(round.id);
      const s = new Set(ids);
      setIncluded(s);
      setIncludedInitial(new Set(s));
    } catch {
      setIncluded(new Set());
      setIncludedInitial(new Set());
    }
  };

  const openNew = () => {
    setEditing('new');
    setPlayerQuery('');
    // Next number = highest existing + 1. Using rounds.length would collide
    // whenever the season has a gap or a duplicate in its numbering.
    const highest = rounds.reduce((m, r) => Math.max(m, Number(r.round_number) || 0), 0);
    setForm({ round_number: highest + 1, course_id: null, beer_hole: null, joker_hole: null });
    setIncluded(new Set());
    setIncludedInitial(new Set());
    setError('');
  };

  const togglePlayerIncluded = (playerId) => {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId); else next.add(playerId);
      return next;
    });
  };

  const activePlayers = useMemo(() => players.filter((p) => p.is_active), [players]);
  const visiblePlayers = useMemo(() => {
    const q = playerQuery.trim().toLowerCase();
    return activePlayers.filter((p) => (q ? p.name.toLowerCase().includes(q) : true));
  }, [activePlayers, playerQuery]);

  /* ---- validation ---------------------------------------------------- */
  const roundNumberValue = form.round_number === '' || form.round_number == null ? null : parseInt(form.round_number, 10);

  const duplicateRound = useMemo(() => {
    if (roundNumberValue == null || Number.isNaN(roundNumberValue)) return null;
    return rounds.find((r) => Number(r.round_number) === roundNumberValue && r.id !== editing) || null;
  }, [roundNumberValue, rounds, editing]);

  const roundNumberError =
    roundNumberValue == null || Number.isNaN(roundNumberValue)
      ? 'Round number is required.'
      : roundNumberValue < 1
      ? 'Round number must be 1 or higher.'
      : duplicateRound
      ? `Round ${roundNumberValue} already exists (${duplicateRound.courses?.name || 'no course'}). Pick another number.`
      : '';

  const sameHoleWarning =
    form.beer_hole && form.joker_hole && Number(form.beer_hole) === Number(form.joker_hole)
      ? `Hole ${form.beer_hole} is set as both the beer hole and the joker hole.`
      : '';

  const canSave = !roundNumberError && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true); setError('');
    try {
      // A round is fully set up once it has a course (holes live on the course)
      const data = {
        round_number: roundNumberValue,
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
      if (roundId) {
        // For new rounds, exclude all active players who are NOT in the included set
        // For existing rounds, use incremental approach to avoid RLS issues
        if (editing === 'new') {
          const activeIds = players.filter((p) => p.is_active).map((p) => p.id);
          const toExclude = activeIds.filter((id) => !included.has(id));
          await Promise.all([
            ...toExclude.map((id) => db.setPlayerIncluded(roundId, id, false)),
            ...[...included].map((id) => db.setPlayerIncluded(roundId, id, true)),
          ]);
        } else {
          const toAdd = [...included].filter((id) => !includedInitial.has(id));
          const toRemove = [...includedInitial].filter((id) => !included.has(id));
          await Promise.all([
            ...toAdd.map((id) => db.setPlayerIncluded(roundId, id, true)),
            ...toRemove.map((id) => db.setPlayerIncluded(roundId, id, false)),
          ]);
        }
      }
      const wasNew = editing === 'new';
      setEditing(null);
      await load();
      setActionMsg(`Round ${roundNumberValue} ${wasNew ? 'created' : 'updated'}.`);
      setTimeout(() => setActionMsg(''), 4000);
      onSeasonChanged?.();
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
      onSeasonChanged?.();
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

  // A round must be fully scored before it can be closed — closing with gaps
  // locks in totals that are quietly wrong.
  const requestCloseRound = async (round) => {
    setConfirmCloseRound(round);
    if (round.is_closed) { setCloseCheck(null); return; }   // reopening is always allowed
    setCloseCheck({ loading: true });
    try {
      setCloseCheck(await db.getRoundCompletion(round.id));
    } catch (e) {
      setCloseCheck({ error: e.message });
    }
  };

  const doCloseRound = async () => {
    if (!confirmCloseRound) return;
    // Belt and braces: the confirm button is disabled in this case anyway.
    if (!confirmCloseRound.is_closed && closeCheck && !closeCheck.loading && !closeCheck.complete) return;
    setActionMsg('');
    try {
      const wasClosing = !confirmCloseRound.is_closed;
      await db.updateRound(confirmCloseRound.id, { is_closed: wasClosing });

      // If closing the current live round, set next open round as current
      if (wasClosing && currentRoundId === confirmCloseRound.id) {
        const nextOpenRound = rounds.find((r) => r.id !== confirmCloseRound.id && !r.is_closed);
        if (nextOpenRound) {
          await db.setCurrentRound(nextOpenRound.id);
          setCurrentRoundId(nextOpenRound.id);
        }
      }

      await load();
      setActionMsg(`Round ${confirmCloseRound.round_number} ${wasClosing ? 'closed' : 'reopened'}.`);
      setTimeout(() => setActionMsg(''), 4000);
      onSeasonChanged?.();
    } catch (e) { setActionMsg('Error: ' + e.message); }
    finally { setConfirmCloseRound(null); setCloseCheck(null); }
  };

  const setLive = async (roundId, roundNumber) => {
    setSettingCurrent(true);
    try {
      await db.setCurrentRound(roundId);
      setCurrentRoundId(roundId);
      setActionMsg(`Round ${roundNumber} is now the live round.`);
      setTimeout(() => setActionMsg(''), 4000);
      onSeasonChanged?.();
    } catch (e) {
      setActionMsg('Error: ' + e.message);
    } finally { setSettingCurrent(false); }
  };

  const clearLive = async () => {
    setSettingCurrent(true);
    try {
      await db.setCurrentRound(null);
      setCurrentRoundId(null);
      setActionMsg('Live round cleared.');
      setTimeout(() => setActionMsg(''), 4000);
      onSeasonChanged?.();
    } catch (e) {
      setActionMsg('Error: ' + e.message);
    } finally { setSettingCurrent(false); }
  };

  const openCount = rounds.filter((r) => !r.is_closed).length;
  const closedCount = rounds.length - openCount;

  const visibleRounds = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rounds.filter((r) => {
      if (statusFilter === 'open' && r.is_closed) return false;
      if (statusFilter === 'closed' && !r.is_closed) return false;
      if (!q) return true;
      const course = (r.courses?.name || '').toLowerCase();
      return course.includes(q) || String(r.round_number).includes(q);
    });
  }, [rounds, query, statusFilter]);

  const holeOptions = useMemo(
    () => Array.from({ length: 18 }, (_, i) => ({ value: String(i + 1), label: `Hole ${i + 1}` })),
    []
  );

  const editingRound = editing && editing !== 'new' ? rounds.find((r) => r.id === editing) : null;

  const closeBlocked = !!confirmCloseRound && !confirmCloseRound.is_closed
    && !!closeCheck && !closeCheck.loading && !closeCheck.complete;

  const closeMessage = (() => {
    if (!confirmCloseRound) return '';
    if (confirmCloseRound.is_closed) {
      return `Round ${confirmCloseRound.round_number} will be reopened for scoring.`;
    }
    if (!closeCheck || closeCheck.loading) return 'Checking that every scorecard is complete…';
    if (closeCheck.error) return `Could not verify the scorecards: ${closeCheck.error}`;
    if (closeCheck.holeCount === 0) {
      return 'This round has no holes set up yet, so there is nothing to close. Add par & stroke index on the course first.';
    }
    if (closeCheck.participantCount === 0) {
      return 'Nobody is marked as playing this round yet. Add players in Edit round before closing it.';
    }
    if (!closeCheck.complete) {
      const list = closeCheck.incomplete
        .slice(0, 6)
        .map((p) => `${p.name} (${p.scored}/${p.total})`)
        .join(', ');
      const more = closeCheck.incomplete.length > 6 ? ` and ${closeCheck.incomplete.length - 6} more` : '';
      return `${closeCheck.incomplete.length} of ${closeCheck.participantCount} scorecards are incomplete: ${list}${more}. Enter the missing holes first — closing now would lock in totals that are short.`;
    }
    return `All ${closeCheck.participantCount} scorecards are complete. Round ${confirmCloseRound.round_number} will be closed and no new scores can be added or changed.`;
  })();

  return (
    <div>
      <PanelHeader icon={<CalendarBlank size={14} weight="duotone" />} title="Rounds" count={rounds.length}>
        {currentRoundId && (
          <Button size="sm" variant="outline" onClick={clearLive} disabled={settingCurrent} icon={<Target size={14} />}>
            Clear live
          </Button>
        )}
        <Button size="sm" variant="primary" icon={<Plus size={14} weight="bold" />} onClick={openNew} data-testid="round-add">
          Add round
        </Button>
      </PanelHeader>

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchInput value={query} onChange={setQuery} placeholder="Search by course or round number…" className="flex-1" />
        <Segmented
          ariaLabel="Filter rounds"
          size="sm"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All', count: rounds.length },
            { value: 'open', label: 'Open', count: openCount },
            { value: 'closed', label: 'Closed', count: closedCount },
          ]}
        />
      </div>

      {actionMsg && (
        <Banner tone={actionMsg.includes('Error') ? 'error' : 'success'} className="mb-4" data-testid="rounds-action-msg">
          {actionMsg}
        </Banner>
      )}

      {loading ? (
        <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="pg-skeleton h-16" />)}</div>
      ) : visibleRounds.length === 0 ? (
        <EmptyState
          icon={<CalendarBlank size={26} weight="duotone" />}
          title={rounds.length === 0 ? 'No rounds yet' : 'No rounds match'}
          message={rounds.length === 0 ? 'Add your first round to start the season.' : 'Try a different search or filter.'}
          action={rounds.length === 0 ? <Button variant="primary" icon={<Plus size={14} weight="bold" />} onClick={openNew}>Add round</Button> : null}
        />
      ) : (
        <div className="pg-scroll max-h-[62vh] space-y-2 overflow-y-auto pr-1">
          {visibleRounds.map((r) => {
            const inCount = allInclusions.filter((e) => e.round_id === r.id).length;
            const isLive = currentRoundId === r.id;
            return (
              <Row
                key={r.id}
                highlight={isLive}
                testId={`round-row-${r.id}`}
                leading={<NumberTile tone={isLive ? 'live' : 'default'}>{r.round_number}</NumberTile>}
                title={
                  <>
                    <span className="truncate text-sm font-semibold text-white">
                      {r.courses ? r.courses.name : 'No course'}
                    </span>
                    {isLive && <LiveChip />}
                  </>
                }
                meta={
                  <>
                    {!r.is_setup && <Chip tone="amber">Not set up</Chip>}
                    {r.is_closed ? <Chip tone="red"><Lock size={10} weight="fill" /> Closed</Chip> : <Chip tone="emerald"><LockOpen size={10} /> Open</Chip>}
                    {r.beer_hole && <Chip tone="rose">🍺 H{r.beer_hole}</Chip>}
                    {r.joker_hole && <Chip tone="purple">🎭 H{r.joker_hole}</Chip>}
                    <Chip>{inCount} playing</Chip>
                  </>
                }
                actions={
                  <>
                    <IconButton
                      label={isLive ? 'This is the live round' : 'Set as live round'}
                      active={isLive}
                      onClick={() => setLive(r.id, r.round_number)}
                      disabled={settingCurrent || isLive}
                      data-testid={`round-set-current-${r.id}`}
                    >
                      <Target size={16} weight={isLive ? 'fill' : 'regular'} />
                    </IconButton>
                    <IconButton
                      label={r.is_closed ? 'Reopen round' : 'Close round'}
                      onClick={() => requestCloseRound(r)}
                      className={r.is_closed ? 'text-red-400' : 'text-emerald-400'}
                      data-testid={`round-close-${r.id}`}
                    >
                      {r.is_closed ? <Lock size={16} weight="fill" /> : <LockOpen size={16} />}
                    </IconButton>
                    <IconButton label="Edit round" tone="gold" onClick={() => openEdit(r)} data-testid={`round-edit-${r.id}`}>
                      <PencilSimple size={16} />
                    </IconButton>
                    <IconButton label="Clear scores for this round" onClick={() => setConfirmClear(r)} data-testid={`round-clear-${r.id}`}>
                      <Broom size={16} />
                    </IconButton>
                    <IconButton label="Delete round" tone="danger" onClick={() => setConfirmDel(r)} data-testid={`round-delete-${r.id}`}>
                      <Trash size={16} />
                    </IconButton>
                  </>
                }
              />
            );
          })}
        </div>
      )}

      {/* Round add/edit */}
      <AnimatePresence>
        {editing && (
          <Modal
            title={editing === 'new' ? 'Add round' : `Edit round ${editingRound?.round_number ?? ''}`}
            subtitle={editingRound?.courses?.name}
            icon={<CalendarBlank size={17} weight="duotone" />}
            onClose={() => setEditing(null)}
            wide
            testId="round-modal"
            footer={
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                <Button
                  variant="primary" block onClick={save} disabled={!canSave}
                  icon={<Check size={15} weight="bold" />} data-testid="round-save"
                >
                  {saving ? 'Saving…' : editing === 'new' ? 'Create round' : 'Save changes'}
                </Button>
              </div>
            }
          >
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[150px_1fr]">
                <Field
                  label="Round number" type="number" inputMode="numeric" min={1}
                  value={form.round_number}
                  onChange={(v) => setForm((f) => ({ ...f, round_number: v }))}
                  placeholder="e.g. 6" required
                  error={roundNumberError}
                  data-testid="round-number-input"
                />
                <SelectField
                  label="Course"
                  value={form.course_id}
                  onChange={(v) => setForm((f) => ({ ...f, course_id: v || null }))}
                  placeholder="Select course…"
                  options={courses.map((c) => ({ value: c.id, label: `${c.name} (Par ${c.par})` }))}
                  hint={form.course_id ? 'Par & SI come from this course’s hole setup.' : 'A round counts as set up once it has a course.'}
                  data-testid="round-course-select"
                />
              </div>

              <div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SelectField
                    label="🍺 Beer hole"
                    value={form.beer_hole ?? ''}
                    onChange={(v) => setForm((f) => ({ ...f, beer_hole: v ? parseInt(v) : null }))}
                    placeholder="— Disabled (no beer hole) —"
                    options={holeOptions}
                    data-testid="round-beer-hole-select"
                  />
                  <SelectField
                    label="🎭 Joker hole"
                    value={form.joker_hole ?? ''}
                    onChange={(v) => setForm((f) => ({ ...f, joker_hole: v ? parseInt(v) : null }))}
                    placeholder="— Disabled (no joker hole) —"
                    options={holeOptions}
                    data-testid="round-joker-hole-select"
                  />
                </div>
                {sameHoleWarning && <Banner tone="warning" className="mt-3">{sameHoleWarning}</Banner>}
                <p className="pg-field-hint mt-3">
                  <strong className="text-rose-300">Beer hole</strong> — worst score on this hole buys drinks (ties = all liable).{' '}
                  <strong className="text-purple-300">Joker hole</strong> — stableford points on this hole count double.
                  Leave either on <span className="text-[#D4AF37]">Disabled</span> to skip it for this round.
                </p>
              </div>

              {/* Participants */}
              <div className="pg-card-flat p-3.5">
                <div className="mb-2.5 flex flex-wrap items-center gap-2">
                  <SectionLabel icon={<Users size={13} weight="duotone" />} className="flex-1 min-w-[120px]">
                    Played this round
                  </SectionLabel>
                  <Chip tone={included.size > 0 ? 'emerald' : 'default'} data-testid="round-included-count">
                    {included.size} of {activePlayers.length}
                  </Chip>
                </div>

                <p className="pg-field-hint mb-3 mt-0">
                  Only selected players count for scoring, awards and score entry. New players are not included until you add them here.
                </p>

                <div className="mb-2.5 flex flex-col gap-2 sm:flex-row">
                  <SearchInput value={playerQuery} onChange={setPlayerQuery} placeholder="Find a player…" className="flex-1" />
                  <div className="flex gap-2">
                    <Button
                      size="sm" variant="outline"
                      onClick={() => setIncluded(new Set(activePlayers.map((p) => p.id)))}
                      data-testid="round-select-all"
                    >
                      Select all
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIncluded(new Set())} data-testid="round-clear-all">
                      Clear
                    </Button>
                  </div>
                </div>

                {visiblePlayers.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[#A9C5B4]/60">No players match “{playerQuery}”.</p>
                ) : (
                  <div className="pg-scroll max-h-56 overflow-y-auto pr-1">
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {visiblePlayers.map((p) => {
                        const isIn = included.has(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            role="checkbox"
                            aria-checked={isIn}
                            onClick={() => togglePlayerIncluded(p.id)}
                            className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-[13px] transition-colors ${
                              isIn
                                ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-100'
                                : 'border-[#D4AF37]/14 bg-[#051A10]/60 text-[#A9C5B4] hover:border-[#D4AF37]/30 hover:text-white'
                            }`}
                            data-testid={`round-include-${p.id}`}
                          >
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                isIn ? 'border-emerald-400 bg-emerald-400 text-[#051A10]' : 'border-[#A9C5B4]/35'
                              }`}
                            >
                              {isIn && <Check size={11} weight="bold" />}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{p.name}</span>
                            <span className="pg-num shrink-0 text-[10px] text-[#A9C5B4]/70">
                              {formatHandicap(p.handicap) ?? '—'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {error && <Banner tone="error">{error}</Banner>}
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <ConfirmModal
        open={!!confirmDel}
        title="Delete round?"
        message={`This will permanently delete Round ${confirmDel?.round_number}${
          confirmDel?.courses?.name ? ` at ${confirmDel.courses.name}` : ''
        } along with all its holes and scores. This cannot be undone.`}
        confirmLabel="Delete round"
        onConfirm={doDelete}
        onClose={() => setConfirmDel(null)}
      />
      <ConfirmModal
        open={!!confirmClear}
        title="Clear scores for this round?"
        message={`All score entries for Round ${confirmClear?.round_number} will be removed. Holes are kept.`}
        confirmLabel="Clear scores"
        onConfirm={doClear}
        onClose={() => setConfirmClear(null)}
      />
      <ConfirmModal
        open={!!confirmCloseRound}
        danger={!confirmCloseRound?.is_closed}
        title={confirmCloseRound?.is_closed ? 'Reopen round?' : closeBlocked ? 'Round isn’t finished' : 'Close round?'}
        message={closeMessage}
        confirmLabel={confirmCloseRound?.is_closed ? 'Reopen round' : 'Close round'}
        confirmDisabled={closeBlocked || closeCheck?.loading}
        onConfirm={doCloseRound}
        onClose={() => { setConfirmCloseRound(null); setCloseCheck(null); }}
      />
    </div>
  );
};


// ===== TEAMS =====
// Teams are season-wide: one pairing applies to every round.
// TEAM COMMENTED OUT: const TeamsPanel = () => {
const TeamsPanel_UNUSED = () => {
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
        <Modal title="Add Team" onClose={() => setEditing(null)} footer={<Button variant="primary" block onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>}>
          <div className="space-y-4">
            <SelectField label="Player 1" value={form.player1_id} onChange={v => setForm(f => ({ ...f, player1_id: v }))} placeholder="Select..." options={players.map(p => ({ value: p.id, label: p.name }))} />
            <SelectField label="Player 2" value={form.player2_id} onChange={v => setForm(f => ({ ...f, player2_id: v }))} placeholder="Select..." options={players.filter(p => String(p.id) !== String(form.player1_id)).map(p => ({ value: p.id, label: p.name }))} />
            {error && <Banner tone="error">{error}</Banner>}
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


/* ==========================================================================
   USERS
   ========================================================================== */
const UsersPanel = ({ currentUserId, allPlayers }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try { setUsers(await db.getAllUsers()); } finally { setLoading(false); }
  };

  const updateRole = async (userId, role) => {
    setError('');
    try { await db.updateUserRole(userId, role); await load(); }
    catch (e) { setError('Error: ' + e.message); setTimeout(() => setError(''), 5000); }
  };

  const updatePlayerLink = async (userId, playerId) => {
    setError('');
    try { await db.updateUserPlayerLink(userId, playerId ? parseInt(playerId) : null); await load(); }
    catch (e) { setError('Error: ' + e.message); setTimeout(() => setError(''), 5000); }
  };

  const doRemove = async () => {
    if (!confirmRemove) return;
    setError('');
    try { await db.removeUser(confirmRemove.id); await load(); }
    catch (e) { setError('Error: ' + e.message); setTimeout(() => setError(''), 5000); }
  };

  const roleIcon = (role) =>
    role === 'admin' ? <ShieldCheck size={11} weight="fill" />
      : role === 'approved' ? <Check size={11} weight="bold" />
      : role === 'pending' ? <Clock size={11} weight="fill" />
      : <ShieldSlash size={11} weight="fill" />;

  const roleTone = (role) =>
    role === 'admin' ? 'gold' : role === 'approved' ? 'emerald' : role === 'pending' ? 'amber' : 'red';

  const pendingCount = users.filter((u) => u.role === 'pending').length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => (roleFilter === 'all' ? true : roleFilter === 'pending' ? u.role === 'pending' : u.role === 'admin'))
      .filter((u) =>
        q ? `${u.display_name || ''} ${u.email || ''}`.toLowerCase().includes(q) : true
      );
  }, [users, query, roleFilter]);

  return (
    <div>
      <PanelHeader icon={<UserCircle size={14} weight="duotone" />} title="Users" count={users.length}>
        {pendingCount > 0 && <Chip tone="amber">{pendingCount} pending</Chip>}
      </PanelHeader>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={query} onChange={setQuery} placeholder="Search by name or email…" className="flex-1" />
        <Segmented ariaLabel="Filter users" size="sm"
          value={roleFilter} onChange={setRoleFilter}
          options={[
            { value: 'all', label: 'All', count: users.length },
            { value: 'pending', label: 'Pending', count: pendingCount },
            { value: 'admin', label: 'Admins', count: users.filter((u) => u.role === 'admin').length },
          ]}
        />
      </div>

      <p className="pg-field-hint mb-4 mt-0">
        Newly registered users appear here after their first login. If someone is missing, ask them to log in once.
      </p>

      {error && <Banner tone="error" className="mb-4">{error}</Banner>}

      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="pg-skeleton h-24" />)}</div>
      ) : visible.length === 0 ? (
        <EmptyState icon={<UserCircle size={26} weight="duotone" />} title="No users found" message="Try a different search or filter." />
      ) : (
        <div className="space-y-2.5">
          {visible.map((u) => (
            <div
              key={u.id}
              className="rounded-xl border border-[#D4AF37]/10 bg-[#051A10]/55 p-3 transition-colors hover:border-[#D4AF37]/22"
              data-testid={`user-row-${u.id}`}
            >
              <div className="flex items-center gap-3">
                <Avatar name={u.display_name || u.email?.split('@')[0]} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-semibold text-white">
                      {u.display_name || u.email?.split('@')[0]}
                    </p>
                    <Chip tone={roleTone(u.role)}>
                      {roleIcon(u.role)}
                      <span className="hidden capitalize sm:inline">{u.role}</span>
                    </Chip>
                    {u.id === currentUserId && <Chip>You</Chip>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[#A9C5B4]">{u.email}</p>
                </div>
                {u.id !== currentUserId && (
                  <IconButton label="Remove user" tone="danger" onClick={() => setConfirmRemove(u)} data-testid={`user-remove-${u.id}`}>
                    <Trash size={16} />
                  </IconButton>
                )}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <SelectField
                  label="Role"
                  value={u.role}
                  onChange={(v) => updateRole(u.id, v)}
                  options={[
                    { value: 'pending', label: 'Pending' },
                    { value: 'approved', label: 'Approved' },
                    { value: 'admin', label: 'Admin' },
                    { value: 'rejected', label: 'Disabled' },
                  ]}
                  data-testid={`user-role-${u.id}`}
                />
                <SelectField
                  label="Linked player"
                  value={u.player_id || ''}
                  onChange={(v) => updatePlayerLink(u.id, v)}
                  placeholder="Not linked"
                  options={(allPlayers || []).map((p) => ({ value: p.id, label: p.name }))}
                  data-testid={`user-player-${u.id}`}
                />
              </div>
            </div>
          ))}
        </div>
      )}

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

/* ==========================================================================
   SEASON
   ========================================================================== */
const SeasonPanel = ({ onSeasonChanged }) => {
  const [current, setCurrent] = useState(null);
  const [archived, setArchived] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableExists, setTableExists] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveSuccess, setArchiveSuccess] = useState(false);
  const [archivedSeasonName, setArchivedSeasonName] = useState('');
  const [openArchived, setOpenArchived] = useState(null);
  const [recapSeason, setRecapSeason] = useState(null);

  useEffect(() => { load(); }, []);
  const load = async () => {
    setLoading(true);
    try {
      const exists = await db.seasonsTableExists();
      setTableExists(exists);
      if (!exists) { setCurrent(null); setArchived([]); return; }
      const [c, a] = await Promise.all([db.getCurrentSeason(), db.getArchivedSeasons()]);
      setCurrent(c);
      setArchived(a);
    } catch (e) { setMsg('Error: ' + e.message); }
    finally { setLoading(false); }
  };

  const startRename = () => { setNameDraft(current?.name || ''); setRenaming(true); setMsg(''); };

  const saveRename = async () => {
    if (!nameDraft.trim()) return;
    setSaveBusy(true); setMsg('');
    try {
      await db.updateCurrentSeasonName(nameDraft.trim());
      setRenaming(false);
      await load();
      setMsg('Season name updated.');
      setTimeout(() => setMsg(''), 3500);
      onSeasonChanged?.();
    } catch (e) { setMsg('Error: ' + e.message); }
    finally { setSaveBusy(false); }
  };

  const openArchiveFlow = () => {
    const yr = new Date().getFullYear() + 1;
    setNewSeasonName(`Pellies Golf League ${yr}`);
    setArchiveOpen(true);
    setMsg('');
  };

  const doArchive = async () => {
    if (!newSeasonName.trim()) return;
    setArchiving(true); setMsg('');
    try {
      const archivedName = current?.name || 'The previous season';
      await db.archiveAndStartNewSeason(newSeasonName.trim());
      setArchiveOpen(false);
      setConfirmArchive(false);
      await load();
      setArchivedSeasonName(archivedName);
      setArchiveSuccess(true);
      onSeasonChanged?.();
    } catch (e) { setMsg('Error: ' + e.message); }
    finally { setArchiving(false); }
  };

  if (loading) {
    return (
      <div className="py-10 text-center">
        <Spinner className="mx-auto mb-3" size={34} />
        <p className="text-sm text-[#A9C5B4]">Loading season…</p>
      </div>
    );
  }

  if (!tableExists) {
    return (
      <div>
        <SectionLabel icon={<Flag size={14} weight="duotone" />} className="mb-3">Seasons — setup required</SectionLabel>
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5" data-testid="seasons-migration-notice">
          <p className="mb-2 text-sm font-semibold text-amber-200">One-time migration needed</p>
          <p className="mb-3 text-xs leading-relaxed text-amber-100/80">
            To unlock named seasons, archive and history, run the updated{' '}
            <span className="font-mono text-[#D4AF37]">SUPABASE_SETUP.sql</span> from the app repo in your Supabase SQL Editor.
            It only adds the new <span className="font-mono text-[#D4AF37]">seasons</span> table and seeds your first season — existing data is untouched.
          </p>
          <ol className="ml-4 list-decimal space-y-1 text-[11px] text-amber-100/80">
            <li>Supabase dashboard → SQL Editor → paste the script → Run</li>
            <li>Come back and press <span className="text-[#D4AF37]">Refresh</span> (top right)</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionLabel icon={<Flag size={14} weight="duotone" />} className="mb-4">Current season</SectionLabel>

      {msg && <Banner tone={msg.includes('Error') ? 'error' : 'success'} className="mb-4" data-testid="season-msg">{msg}</Banner>}

      <div className="pg-card pg-card-feature mb-6 p-5">
        {!renaming ? (
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="pg-eyebrow pg-eyebrow-gold mb-1.5">Active</p>
              <p className="pg-display truncate text-2xl text-white" data-testid="current-season-name">
                {current?.name || '— no season —'}
              </p>
              {current?.started_at && (
                <p className="mt-1.5 text-xs text-[#A9C5B4]">
                  Started {new Date(current.started_at).toLocaleDateString()}
                </p>
              )}
            </div>
            <IconButton label="Rename season" tone="gold" onClick={startRename} data-testid="season-rename-btn">
              <PencilSimple size={16} />
            </IconButton>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Season name" value={nameDraft} onChange={setNameDraft} placeholder="e.g. Pellies Golf League 2026" autoFocus />
            <div className="flex gap-2">
              <Button variant="primary" block onClick={saveRename} disabled={saveBusy || !nameDraft.trim()} data-testid="season-save-name">
                {saveBusy ? 'Saving…' : 'Save'}
              </Button>
              <Button variant="ghost" onClick={() => setRenaming(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      <div className="mb-7">
        <SectionLabel className="mb-2">End of season</SectionLabel>
        <p className="pg-field-hint mb-3 mt-0">
          Archives the current standings &amp; awards as a permanent snapshot, then wipes rounds/scores/teams/exclusions to start a
          fresh season. Players, courses, and course-hole setup are kept.
        </p>
        <Button variant="secondary" block size="lg" onClick={openArchiveFlow} icon={<Confetti size={16} weight="duotone" />} data-testid="season-archive-btn">
          Archive &amp; start new season
        </Button>
      </div>

      <AnimatePresence>
        {archiveOpen && (
          <Modal
            title="Start a new season"
            icon={<Confetti size={17} weight="duotone" />}
            onClose={() => setArchiveOpen(false)}
            footer={
              <Button
                variant="primary" block
                onClick={() => { if (newSeasonName.trim()) setConfirmArchive(true); }}
                disabled={!newSeasonName.trim() || archiving}
                data-testid="season-archive-next"
              >
                Continue →
              </Button>
            }
          >
            <div className="space-y-4">
              <div className="pg-card-flat p-3.5">
                <p className="mb-1 text-sm font-semibold text-[#D4AF37]">Current season: {current?.name || '—'}</p>
                <p className="text-xs leading-relaxed text-[#A9C5B4]">
                  It will be archived with a full snapshot of the leaderboards, awards and player stats — viewable any time below.
                </p>
              </div>
              <Field
                label="New season name" value={newSeasonName} onChange={setNewSeasonName}
                placeholder={`Pellies Golf League ${new Date().getFullYear() + 1}`} autoFocus
              />
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <ConfirmModal
        open={confirmArchive}
        title="Archive current season?"
        message={`This will permanently archive "${current?.name || 'the current season'}" with its final standings, then wipe every round, score, team and exclusion so "${newSeasonName.trim()}" starts clean. Players, courses and hole setup are preserved. This cannot be undone.`}
        confirmLabel={archiving ? 'Working…' : 'Archive & start new'}
        onConfirm={doArchive}
        onClose={() => setConfirmArchive(false)}
        busy={archiving}
        closeOnConfirm={false}
      />

      <ConfirmModal
        open={archiveSuccess}
        danger={false}
        title="Season archived"
        message={`"${archivedSeasonName}" has been archived with all awards and standings. The new season "${newSeasonName.trim()}" is now active.`}
        confirmLabel="Great"
        onConfirm={() => { setArchiveSuccess(false); setNewSeasonName(''); setArchivedSeasonName(''); }}
        onClose={() => { setArchiveSuccess(false); setNewSeasonName(''); setArchivedSeasonName(''); }}
      />

      <SectionLabel icon={<Trophy size={13} weight="duotone" />} className="mb-3">
        Season history ({archived.length})
      </SectionLabel>

      {archived.length === 0 ? (
        <div className="py-8 text-center">
          <Flag size={26} className="mx-auto mb-2 text-[#D4AF37]/30" weight="duotone" />
          <p className="text-[11px] italic text-[#A9C5B4]/60">No archived seasons yet</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {archived.map((s) => {
            const champ = s.summary_json?.champion;
            const isOpen = openArchived === s.id;
            const endDate = s.ended_at ? new Date(s.ended_at) : null;
            return (
              <div key={s.id} className="overflow-hidden rounded-xl border border-[#D4AF37]/16 bg-[#0F2C1D]/45">
                <button
                  onClick={() => setOpenArchived(isOpen ? null : s.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#D4AF37]/8"
                  aria-expanded={isOpen}
                  data-testid={`archived-season-${s.id}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/10">
                    <Flag size={15} className="text-[#D4AF37]" weight="duotone" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-tight text-white">{s.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[10px] text-[#A9C5B4]/80">
                        {endDate ? endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                      </span>
                      {champ && (
                        <>
                          <span className="text-[#A9C5B4]/40">•</span>
                          <span className="text-[10px] font-medium text-[#D4AF37]">🏆 {champ.player || champ.Player}</span>
                          <span className="pg-num text-[10px] text-[#A9C5B4]/80">{champ.total ?? champ.Total} pts</span>
                        </>
                      )}
                    </div>
                  </div>
                  <motion.span animate={{ rotate: isOpen ? 180 : 0 }} className="shrink-0 text-[#A9C5B4]/60">
                    <CaretDown size={14} />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      {s.summary_json && (
                        <div className="bg-[#051A10]/35 px-4 pb-4">
                          {s.summary_json?.champion?.player && (
                            <div className="mb-4 border-b border-[#D4AF37]/10 pb-3">
                              <h5 className="pg-eyebrow mb-2">Champion</h5>
                              <div className="flex items-center gap-2">
                                <span className="text-lg">🏆</span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-white">{s.summary_json.champion.player}</p>
                                  <p className="pg-num text-[10px] text-[#A9C5B4]/70">{s.summary_json.champion.total} points</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {(s.summary_json?.awards?.season?.wooden_spoon_leader?.length > 0 ||
                            s.summary_json?.awards?.season?.joker_king?.length > 0 ||
                            s.summary_json?.awards?.season?.beer_king?.length > 0 ||
                            s.summary_json?.awards?.season?.golden_round?.length > 0) && (
                            <div className="mb-4 border-b border-[#D4AF37]/10 pb-3">
                              <h5 className="pg-eyebrow mb-2">Season awards</h5>
                              <div className="grid grid-cols-1 gap-2">
                                {s.summary_json?.awards?.season?.golden_round?.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">👑</span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm text-white">{s.summary_json.awards.season.golden_round[0].player}</p>
                                      <p className="text-[10px] text-[#A9C5B4]/70">Golden Round • {s.summary_json.awards.season.golden_round[0].total} pts</p>
                                    </div>
                                  </div>
                                )}
                                {s.summary_json?.awards?.season?.joker_king?.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">🎭</span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm text-white">{s.summary_json.awards.season.joker_king[0].player}</p>
                                      <p className="text-[10px] text-[#A9C5B4]/70">Joker King • +{s.summary_json.awards.season.joker_king[0].totalBonus} pts</p>
                                    </div>
                                  </div>
                                )}
                                {s.summary_json?.awards?.season?.beer_king?.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">🍺</span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm text-white">{s.summary_json.awards.season.beer_king.map((p) => p.player).join(' & ')}</p>
                                      <p className="text-[10px] text-[#A9C5B4]/70">Beer King • {s.summary_json.awards.season.beer_king[0].count} wins</p>
                                    </div>
                                  </div>
                                )}
                                {s.summary_json?.awards?.season?.wooden_spoon_leader?.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">🥄</span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm text-white">{s.summary_json.awards.season.wooden_spoon_leader[0].player}</p>
                                      <p className="text-[10px] text-[#A9C5B4]/70">Wooden Spoon • {s.summary_json.awards.season.wooden_spoon_leader[0].average.toFixed(1)} avg</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {s.summary_json?.awards?.per_round?.length > 0 && (
                            <div>
                              <h5 className="pg-eyebrow mb-2">Round highlights</h5>
                              <div className="space-y-2">
                                {s.summary_json.awards.per_round.slice(0, 3).map((round, idx) => (
                                  <div key={idx} className="rounded-lg bg-[#051A10]/45 p-2.5">
                                    <p className="mb-1 text-xs font-medium text-white">Round {round.round_number}</p>
                                    <div className="flex flex-wrap gap-x-2.5 gap-y-1">
                                      {round.wooden_spoon && <span className="text-[10px] text-[#A9C5B4]">🥄 {round.wooden_spoon.player}</span>}
                                      {round.freeze && <span className="text-[10px] text-[#A9C5B4]">🧊 {round.freeze.player}</span>}
                                      {round.heater && <span className="text-[10px] text-[#A9C5B4]">🔥 {round.heater.player}</span>}
                                      {round.clutch_king && <span className="text-[10px] text-[#A9C5B4]">🎯 {round.clutch_king.player}</span>}
                                      {round.slow_starter && <span className="text-[10px] text-[#A9C5B4]">🐌 {round.slow_starter.player}</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="mt-4 flex gap-2 border-t border-[#D4AF37]/10 pt-3">
                            <Button variant="secondary" size="sm" block onClick={() => setRecapSeason(s)} data-testid={`archive-share-${s.id}`}>
                              📸 Recap
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setOpenArchived(null)}>Close</Button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {recapSeason && <SeasonRecapModal season={recapSeason} onClose={() => setRecapSeason(null)} />}
      </AnimatePresence>
    </div>
  );
};

/* ==========================================================================
   DANGER ZONE
   ========================================================================== */
const DangerPanel = () => {
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const doClear = async () => {
    setMsg(''); setBusy(true);
    try {
      const counts = await db.clearAllScores();
      const total = counts.fines + counts.scores;
      if (total === 0) {
        setMsg('Warning: 0 rows were deleted. This usually means RLS in Supabase is blocking the delete. Run the SUPABASE_SETUP.sql from your repo in the Supabase SQL Editor to fix policies.');
      } else {
        setMsg(`Deleted ${counts.fines} fines and ${counts.scores} scores. Click Refresh in the top bar to see the dashboard update.`);
      }
    } catch (e) { setMsg('Error: ' + e.message); }
    finally {
      setBusy(false);
      window.dispatchEvent(new CustomEvent('clearScorecardLoading'));
    }
  };

  const doReset = async () => {
    setMsg(''); setBusy(true);
    try {
      const counts = await db.resetSeasonData();
      const total = counts.fines + counts.scores + counts.teams + counts.holes + counts.rounds;
      if (total === 0) {
        setMsg('Warning: 0 rows were deleted. This usually means RLS in Supabase is blocking deletes. Run the SUPABASE_SETUP.sql from your repo in the Supabase SQL Editor.');
      } else {
        setMsg(`Season reset. Deleted ${counts.fines} fines, ${counts.scores} scores, ${counts.teams} teams, ${counts.holes} legacy per-round hole rows, ${counts.rounds} rounds. Course-level hole setup preserved. Click Refresh in the top bar to reload the dashboard.`);
      }
    } catch (e) { setMsg('Error: ' + e.message); }
    finally {
      setBusy(false);
      window.dispatchEvent(new CustomEvent('clearScorecardLoading'));
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-red-400">
        <Warning size={16} weight="fill" />
        <span className="pg-eyebrow" style={{ color: 'inherit' }}>Danger zone</span>
      </div>
      <p className="mb-5 text-xs leading-relaxed text-[#A9C5B4]">
        These actions are permanent.{' '}
        <span className="text-[#D4AF37]">Players, courses, and course-level hole setup are always preserved.</span>
      </p>

      {msg && (
        <Banner tone={msg.includes('Error') || msg.includes('Warning') ? 'error' : 'success'} className="mb-4" data-testid="danger-msg">
          {msg}
        </Banner>
      )}

      <div className="space-y-3">
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/6 p-4">
          <p className="mb-1 text-sm font-semibold text-amber-200">Clear all scores</p>
          <p className="mb-3 text-xs leading-relaxed text-[#A9C5B4]">
            Removes every score entry and fine across all rounds. Rounds, holes and players stay.
          </p>
          <Button variant="outline" block onClick={() => setConfirmClear(true)} disabled={busy} data-testid="clear-all-scores">
            {busy ? 'Working…' : 'Clear all scores'}
          </Button>
        </div>

        <div className="rounded-xl border border-red-500/25 bg-red-500/6 p-4">
          <p className="mb-1 text-sm font-semibold text-red-300">Reset entire season</p>
          <p className="mb-3 text-xs leading-relaxed text-[#A9C5B4]">
            Deletes every round, score, team pairing and legacy hole override. Your players, courses and hole setup survive.
          </p>
          <Button variant="danger" block onClick={() => setConfirmReset(true)} disabled={busy} data-testid="reset-season">
            {busy ? 'Working…' : 'Reset entire season'}
          </Button>
        </div>
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

/* ==========================================================================
   MAIN
   ========================================================================== */
const TABS = [
  // TEAM COMMENTED OUT: { id: 'teams', label: 'Teams', icon: <UsersThree size={14} weight="duotone" /> },
  { id: 'players', label: 'Players', icon: <Users size={14} weight="duotone" /> },
  { id: 'courses', label: 'Courses', icon: <MapPin size={14} weight="duotone" /> },
  { id: 'rounds', label: 'Rounds', icon: <CalendarBlank size={14} weight="duotone" /> },
  { id: 'users', label: 'Users', icon: <UserCircle size={14} weight="duotone" /> },
  { id: 'season', label: 'Season', icon: <Flag size={14} weight="duotone" /> },
  { id: 'danger', label: 'Danger', icon: <Warning size={14} weight="duotone" /> },
];

export default function AdminPanel({ onSeasonChanged, currentUserId, allPlayers }) {
  const [tab, setTab] = useState('players');
  const tabRefs = useRef({});

  // Arrow-key navigation across the tab strip (WAI-ARIA tabs pattern)
  const onTabKeyDown = (e) => {
    const idx = TABS.findIndex((t) => t.id === tab);
    let next = null;
    if (e.key === 'ArrowRight') next = TABS[(idx + 1) % TABS.length];
    else if (e.key === 'ArrowLeft') next = TABS[(idx - 1 + TABS.length) % TABS.length];
    else if (e.key === 'Home') next = TABS[0];
    else if (e.key === 'End') next = TABS[TABS.length - 1];
    if (next) {
      e.preventDefault();
      setTab(next.id);
      tabRefs.current[next.id]?.focus();
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} data-testid="admin-panel">
      <div className="mb-7 text-center">
        <p className="pg-eyebrow pg-eyebrow-gold mb-2">League control</p>
        <h2 className="pg-display pg-gold-text text-[30px] sm:text-[36px]">Admin Panel</h2>
        <p className="mt-1.5 text-sm text-[#A9C5B4]">Players, courses, rounds and season management</p>
      </div>

      {/* Tab strip — scrolls horizontally on narrow screens instead of wrapping */}
      <div className="mb-7 flex justify-start sm:justify-center">
        <div className="pg-scroll -mx-4 w-full overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:px-0">
          <div
            className="pg-segment w-max"
            role="tablist"
            aria-label="Admin sections"
            onKeyDown={onTabKeyDown}
          >
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  ref={(el) => { tabRefs.current[t.id] = el; }}
                  type="button"
                  role="tab"
                  id={`admin-tab-${t.id}`}
                  aria-selected={active}
                  aria-controls={`admin-panel-${t.id}`}
                  tabIndex={active ? 0 : -1}
                  data-active={active}
                  onClick={() => setTab(t.id)}
                  className={`pg-segment-item ${t.id === 'danger' ? 'pg-segment-item-danger' : ''} ${
                    t.id === 'danger' && !active ? 'text-red-300/80 hover:text-red-200' : ''
                  }`}
                  data-testid={`admin-tab-${t.id}`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className="pg-card mx-auto max-w-2xl p-5 sm:p-6"
        role="tabpanel"
        id={`admin-panel-${tab}`}
        aria-labelledby={`admin-tab-${tab}`}
      >
        {/* Keyed swap rather than an exit-animated AnimatePresence: a stalled
            exit would leave the panel blank (see App.js for the same note). */}
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 'players' && <PlayersPanel />}
          {tab === 'courses' && <CoursesPanel />}
          {tab === 'rounds' && <RoundsPanel onSeasonChanged={onSeasonChanged} />}
          {/* TEAM COMMENTED OUT: {tab === 'teams' && <TeamsPanel />} */}
          {tab === 'users' && <UsersPanel currentUserId={currentUserId} allPlayers={allPlayers} />}
          {tab === 'season' && <SeasonPanel onSeasonChanged={onSeasonChanged} />}
          {tab === 'danger' && <DangerPanel />}
        </motion.div>
      </div>
    </motion.div>
  );
}
