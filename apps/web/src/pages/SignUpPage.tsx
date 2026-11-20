import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function SignUpPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null); setBusy(true);
    try {
      const msg = await register(email, username, password);
      if (msg) setInfo(msg);
      nav("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <form className="card form" onSubmit={onSubmit}>
        <h2>Sign Up</h2>
        {error && <p className="error">{error}</p>}
        {info && <p className="info">{info}</p>}
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" required /></label>
        <p className="muted small">3-20 chars: letters, numbers, underscore.</p>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></label>
        <button className="btn" disabled={busy} type="submit">{busy ? "Creating..." : "Create account"}</button>
        <p className="muted small">Already have an account? <Link to="/signin">Sign in</Link></p>
      </form>
    </div>
  );
}
