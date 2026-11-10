import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { setSession } from '../auth';
import { ErrorBox, Field } from '../components';
import { useAction } from '../hooks';

type Mode = 'login' | 'register';

export default function Login() {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const { busy, error, setError, run } = useAction();

  const isRegister = mode === 'register';
  const name = username.trim();
  const mismatch = isRegister && confirm !== '' && confirm !== password;

  const switchMode = (next: Mode) => {
    setMode(next);
    setPassword('');
    setConfirm('');
    setError(undefined);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mismatch) return;
    const res = await run(async () => {
      // Register doesn't log in, so obtain the token right after.
      if (isRegister) await api.auth.register(name, password);
      return api.auth.obtainToken(name, password);
    });
    if (res?.token) setSession({ token: res.token, username: name });
  };

  return (
    <div className="login-screen">
      <form className="card login-card form" onSubmit={submit}>
        <div className="login-brand">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <h1>Director</h1>
        </div>
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!isRegister}
            className={`auth-tab${!isRegister ? ' active' : ''}`}
            onClick={() => switchMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isRegister}
            className={`auth-tab${isRegister ? ' active' : ''}`}
            onClick={() => switchMode('register')}
          >
            Sign up
          </button>
        </div>
        <p className="muted small">
          {isRegister
            ? 'New accounts are read-only; an admin can grant more access.'
            : 'Sign in with your Director account.'}
        </p>
        <Field label="Username" hint={isRegister ? 'Letters, digits and @.+-_ (max 150).' : undefined}>
          <input
            className="input"
            autoComplete="username"
            autoFocus
            required
            maxLength={150}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
        <Field label="Password" hint={isRegister ? 'At least 8 characters, not too common or all digits.' : undefined}>
          <input
            className="input"
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {isRegister && (
          <Field label="Confirm password" hint={mismatch ? 'Passwords do not match.' : undefined}>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
        )}
        <ErrorBox error={error} />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={busy || !name || !password || (isRegister && (!confirm || mismatch))}
        >
          {busy ? (isRegister ? 'Creating account…' : 'Signing in…') : isRegister ? 'Create account' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
