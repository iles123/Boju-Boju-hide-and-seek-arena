import { FormEvent, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const tokenFromUrl = useMemo(() => params.get("token") ?? "", [params]);
  const [token, setToken] = useState(tokenFromUrl);
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
    <div className="page">
      <form className="card form" onSubmit={onSubmit}>
        <h2>Reset Password</h2>
        {error && <p className="error">{error}</p>}
        {msg && <p className="info">{msg}</p>}
        <label>Reset token<input value={token} onChange={(e) => setToken(e.target.value)} required /></label>
        <label>New password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></label>
        <button className="btn" disabled={busy} type="submit">{busy ? "Resetting..." : "Reset password"}</button>
        <p className="muted small"><Link to="/signin">Back to sign in</Link></p>
      </form>
    </div>
  );
}
