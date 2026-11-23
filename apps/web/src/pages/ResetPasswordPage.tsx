import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PasswordInput from "../components/PasswordInput";
import { api } from "../lib/api";
import { AnimatedGameBg } from "./LandingPage";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const tokenFromUrl = useMemo(() => params.get("token") ?? "", [params]);
  const [token, setToken] = useState(tokenFromUrl);
  useEffect(() => setToken(tokenFromUrl), [tokenFromUrl]);
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await api.resetPassword({ token, new_password: password });
      setMsg(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <AnimatedGameBg compact />
      <form className="card form auth-card" onSubmit={onSubmit}>
        <div className="auth-badge">BOJU BOJU ARENA</div>
        <h2>Reset Password</h2>
        <p className="muted small">Paste the token from the dev console, then choose a new password.</p>
        {error && <p className="error">{error}</p>}
        {msg && <p className="info">{msg}</p>}
        <label>Reset token<input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste reset token" required /></label>
        <PasswordInput label="New password" value={password} onChange={setPassword} placeholder="At least 8 characters" minLength={8} maxLength={128} autoComplete="new-password" required />
        <button className="btn" disabled={busy} type="submit">{busy ? "Resetting..." : "Reset password"}</button>
        <p className="muted small"><Link to="/signin">Back to sign in</Link></p>
      </form>
    </div>
  );
}
