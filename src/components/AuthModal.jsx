import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Lock, X, SignIn, UserPlus } from '@phosphor-icons/react';
import * as db from '../services/supabaseService';
import { Field, Button, IconButton, Banner, Segmented } from './common';
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from '../hooks/useOverlay';

const AuthModal = ({ onSuccess, onClose }) => {
  const panelRef = useRef(null);
  useBodyScrollLock(true);
  useEscapeKey(true, onClose);
  useFocusTrap(panelRef, true);

  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setSuccess('');
    try {
      if (mode === 'login') {
        await db.signIn(email, password);
        // Small delay to let auth state propagate before closing modal
        await new Promise(r => setTimeout(r, 500));
        onSuccess();
      } else {
        const res = await db.signUp(email, password, displayName);
        // If session was returned (email confirmation disabled), user is logged in
        if (res?.session) {
          await new Promise(r => setTimeout(r, 500));
          onSuccess();
        } else {
          setSuccess('Account created. Check your email to confirm your address, then sign in. An admin will approve your editing access.');
          setMode('login');
          setPassword('');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setSuccess('');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[160] flex items-center justify-center bg-[#03110A]/85 p-4 backdrop-blur-lg"
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'login' ? 'Sign in' : 'Register'}
        initial={{ scale: 0.95, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.97, opacity: 0 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="pg-card pg-card-feature w-full max-w-sm p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#D4AF37]">
              <Lock size={20} weight="duotone" />
            </span>
            <p className="pg-eyebrow pg-eyebrow-gold mb-1">Pellies Golf Club</p>
            <h2 className="pg-display text-[22px] text-white">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
          </div>
          <IconButton label="Close" onClick={onClose} data-overlay-close="true"><X size={18} /></IconButton>
        </div>

        <Segmented
          ariaLabel="Sign in or register"
          className="mb-5 w-full"
          value={mode}
          onChange={switchMode}
          options={[
            { value: 'login', label: 'Sign in', icon: <SignIn size={14} weight="bold" /> },
            { value: 'register', label: 'Register', icon: <UserPlus size={14} weight="bold" /> },
          ]}
        />

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <Field
              label="Display name"
              value={displayName}
              onChange={setDisplayName}
              placeholder="How your name shows in the app"
              required
            />
          )}
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            required
            autoComplete="email"
            data-testid="auth-email"
          />
          <div>
            <label className="pg-label" htmlFor="pg-auth-password">Password</label>
            <input
              id="pg-auth-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="pg-input"
              placeholder="••••••••"
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              data-testid="auth-password"
            />
          </div>

          {error && <Banner tone="error">{error}</Banner>}
          {success && <Banner tone="success">{success}</Banner>}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            block
            disabled={loading}
            data-testid="auth-submit"
            className="mt-1"
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-[#A9C5B4]/70">
          {mode === 'login'
            ? 'New accounts need admin approval before you can edit scores.'
            : 'You can browse straight away — an admin approves editing access.'}
        </p>
      </motion.div>
    </motion.div>
  );
};

export default AuthModal;
