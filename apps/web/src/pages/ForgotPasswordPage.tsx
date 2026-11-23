import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { AnimatedGameBg } from "./LandingPage";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await api.forgotPassword({ email });
      setMsg(res.message + " (In dev, check API console output for the reset link/token.)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <AnimatedGameBg compact />
      <form className="card form auth-card" onSubmit={onSubmit}>
        <div className="auth-badge">BOJU BOJU ARENA</div>
        <h2>Forgot Password</h2>
        <p className="muted small">Enter the email on your gamer account and we will print a reset token in the dev console.</p>
        {error && <p className="error">{error}</p>}
        {msg && <p className="info">{msg}</p>}
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
        <button className="btn" disabled={busy} type="submit">{busy ? "Sending..." : "Send reset link"}</button>
        <p className="muted small"><Link to="/signin">Back to sign in</Link></p>
      </form>
    </div>
  );
}
