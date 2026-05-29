import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, X } from '@phosphor-icons/react';
import * as db from '../services/supabaseService';

const AuthModal = ({ onSuccess, onClose }) => {
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
          setSuccess('Account created! Please check your email to confirm your address, then sign in. An admin will approve your editing access.');
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-[#051A10]/80 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-sm mx-4 rounded-xl border border-[#D4AF37]/30 bg-[#0F2C1D] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-sans text-[#D4AF37] flex items-center gap-2">
            <Lock size={20} /> {mode === 'login' ? 'Sign In' : 'Register'}
          </h2>
          <button onClick={onClose} className="text-[#A9C5B4] hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white placeholder-[#A9C5B4]/50 focus:border-[#D4AF37]/50 focus:outline-none text-sm"
              placeholder="Display Name"
              required
            />
          )}
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white placeholder-[#A9C5B4]/50 focus:border-[#D4AF37]/50 focus:outline-none text-sm"
            placeholder="Email"
            required
            data-testid="auth-email"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white placeholder-[#A9C5B4]/50 focus:border-[#D4AF37]/50 focus:outline-none text-sm"
            placeholder="Password"
            required
            data-testid="auth-password"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          {success && <p className="text-emerald-400 text-xs">{success}</p>}
          <button
            type="submit"
            disabled={loading}
            data-testid="auth-submit"
            className="w-full py-2.5 rounded-lg bg-[#D4AF37] text-[#051A10] font-bold text-sm hover:bg-[#F1D67E] transition-colors disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        <p className="text-xs text-[#A9C5B4] text-center mt-4">
          {mode === 'login' ? (
            <>No account? <button onClick={() => { setMode('register'); setError(''); setSuccess(''); }} className="text-[#D4AF37] hover:underline">Register</button></>
          ) : (
            <>Have an account? <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }} className="text-[#D4AF37] hover:underline">Sign In</button></>
          )}
        </p>
      </motion.div>
    </motion.div>
  );
};

export default AuthModal;
