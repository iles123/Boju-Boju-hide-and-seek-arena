import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PasswordInput from "../components/PasswordInput";
import { useAuth } from "../context/AuthContext";
import { AnimatedGameBg } from "./LandingPage";

export default function SignInPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(identifier, password);
      nav("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <AnimatedGameBg compact />
      <form className="card form auth-card" onSubmit={onSubmit}>
        <div className="auth-badge">BOJU BOJU ARENA</div>
        <h2>Welcome back, hunter</h2>
        <p className="muted small">Sign in with your email or username to keep your gamer profile, paint, and stats.</p>
        {error && <p className="error">{error}</p>}
        <label>Email or username<input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@example.com or Hunter" autoComplete="username" required /></label>
        <PasswordInput label="Password" value={password} onChange={setPassword} placeholder="Your password" autoComplete="current-password" required />
        <button className="btn" disabled={busy} type="submit">{busy ? "Signing in..." : "Sign in"}</button>
        <div className="muted small row auth-links">
          <Link to="/forgot-password">Forgot password?</Link>
          <Link to="/signup">Create account</Link>
        </div>
        <Link className="btn secondary" to="/play">Continue as guest</Link>
      </form>
    </div>
  );
}
