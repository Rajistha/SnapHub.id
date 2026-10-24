import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { FiArrowLeft } from 'react-icons/fi';
import { supabase } from '../../lib/supabase';
import { getAdminUrl } from '../../lib/appUrls';

// Form login yang sama untuk semua halaman internal (sebelumnya disalin di tiap halaman).
const AdminLogin = ({ title, subtitle }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      toast.error(err.message || 'Login gagal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-theme="dark" className="min-h-screen flex items-center justify-center bg-[var(--admin-bg)] p-5">
      <div className="w-full max-w-sm bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-7">
        <img src="/icons.svg" alt="" className="h-9 mb-5" />
        <h1 className="text-xl font-semibold text-[var(--admin-text-main)]">{title}</h1>
        <p className="text-sm text-[var(--admin-text-muted)] mt-1 mb-6">{subtitle}</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="ui-label">Email</label>
            <input id="login-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="ui-input" required />
          </div>
          <div>
            <label htmlFor="login-password" className="ui-label">Password</label>
            <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="ui-input" required />
          </div>
          <button type="submit" disabled={busy} className="ui-btn ui-btn-primary w-full">
            {busy ? 'Masuk…' : 'Masuk'}
          </button>
        </form>

        <a href={getAdminUrl()} className="mt-6 inline-flex items-center gap-2 text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]">
          <FiArrowLeft size={14} /> Kembali ke Admin
        </a>
      </div>
    </div>
  );
};

export default AdminLogin;
