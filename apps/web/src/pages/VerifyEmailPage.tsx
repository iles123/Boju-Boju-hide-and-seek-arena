import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const tokenFromUrl = useMemo(() => params.get("token") ?? "", [params]);
  const [token, setToken] = useState(tokenFromUrl);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { refreshMe } = useAuth();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await api.verifyEmail({ token });
      setMsg(res.message);
      await refreshMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <form className="card form" onSubmit={onSubmit}>
        <h2>Verify Email</h2>
        {error && <p className="error">{error}</p>}
        {msg && <p className="info">{msg}</p>}
        <label>Verification token<input value={token} onChange={(e) => setToken(e.target.value)} required /></label>
        <button className="btn" disabled={busy} type="submit">{busy ? "Verifying..." : "Verify email"}</button>
      </form>
    </div>
  );
}
