import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PasswordInput from "../components/PasswordInput";
import { useAuth } from "../context/AuthContext";
import { AnimatedGameBg } from "./LandingPage";

const AVATAR_COLORS = ["#22d3ee", "#f472b6", "#a78bfa", "#facc15", "#34d399", "#fb7185"];
const MAPS = ["market", "warehouse", "rooftops", "garden", "arcade"];

export default function SignUpPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [favoriteMap, setFavoriteMap] = useState("market");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!password || password !== confirmPassword) {
      setError(!password ? "Enter a password." : "Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const msg = await register(email, username, password, {
        display_name: displayName || username,
        avatar_color: avatarColor,
        favorite_map: favoriteMap,
      });
      nav("/profile", { state: msg ? { notice: msg } : null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <AnimatedGameBg compact />
      <form className="card form auth-card" onSubmit={onSubmit}>
        <div className="auth-badge">CREATE YOUR GAMER ID</div>
        <h2>Join the arena</h2>
        <p className="muted small">Your profile follows you into every room and match.</p>
        {error && <p className="error">{error}</p>}
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
        <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ShadowPainter" minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" autoComplete="username" required /></label>
        <p className="muted small">3-20 chars: letters, numbers, underscore.</p>
        <div className="profile-setup">
          <div className="small"><strong>Gamer profile</strong></div>
          <label>Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} placeholder={username || "How hunters see you"} /></label>
          <div className="avatar-picker small">
            <span>Avatar color</span>
            <div className="row">
              {AVATAR_COLORS.map((c) => (
                <button key={c} type="button" className={`swatch ${avatarColor === c ? "active" : ""}`} style={{ background: c }} onClick={() => setAvatarColor(c)} aria-label={`Use ${c} avatar`} />
              ))}
            </div>
          </div>
          <label>Favorite map
            <select value={favoriteMap} onChange={(e) => setFavoriteMap(e.target.value)}>
              {MAPS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        </div>
        <PasswordInput label="Password" value={password} onChange={setPassword} placeholder="At least 8 characters" minLength={8} maxLength={128} autoComplete="new-password" required />
        <PasswordInput label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Repeat your password" minLength={8} maxLength={128} autoComplete="new-password" required />
        <div className={`small ${password && password === confirmPassword ? "muted" : "error"}`}>{password && password === confirmPassword ? "Passwords match." : "Passwords do not match yet."}</div>
        <button className="btn" disabled={busy} type="submit">{busy ? "Creating..." : "Create account & profile"}</button>
        <p className="muted small">Already have an account? <Link to="/signin">Sign in</Link></p>
      </form>
    </div>
  );
}
