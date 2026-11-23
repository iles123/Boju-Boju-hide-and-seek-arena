import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AnimatedGameBg } from "./LandingPage";

const COLORS = ["#22d3ee", "#f472b6", "#a78bfa", "#facc15", "#34d399", "#fb7185"];
const MAPS = ["market", "warehouse", "rooftops", "garden", "arcade"];

export default function ProfilePage() {
  const { user, refreshMe, updateProfile } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState({ display_name: "", bio: "", avatar_color: "#22d3ee", favorite_map: "market" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const notice = (location.state as { notice?: string } | null)?.notice;
    if (notice) setMessage(notice);
  }, [location.state]);

  useEffect(() => {
    if (!user?.profile) return;
    setForm({
      display_name: user.profile.display_name,
      bio: user.profile.bio,
      avatar_color: user.profile.avatar_color,
      favorite_map: user.profile.favorite_map,
    });
  }, [user]);

  if (!user) return null;
  const s = user.stats;
  const displayName = user.profile.display_name || user.username;

  async function onSave() {
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile(form);
      setMessage("Gamer profile saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="auth-wrap profile-wrap">
      <AnimatedGameBg compact />
      <div className="card profile-card">
        <div className="profile-header">
          <div className="gamer-avatar" style={{ background: form.avatar_color }}>{displayName.slice(0, 2).toUpperCase()}</div>
          <div>
            <div className="auth-badge">GAMER PROFILE</div>
            <h2>{displayName}</h2>
            <p className="muted small">@{user.username} · {user.role} · {user.is_verified ? "Verified" : "Unverified"}</p>
          </div>
          <Link className="btn secondary" to="/lobby">Play now</Link>
        </div>

        <div className="profile-grid">
          <section className="profile-section">
            <h3>Edit identity</h3>
            <label>Display name<input value={form.display_name} maxLength={40} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></label>
            <label>Bio<textarea value={form.bio} maxLength={240} rows={3} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></label>
            <div className="small">Avatar color</div>
            <div className="row">
              {COLORS.map((c) => (
                <button key={c} type="button" className={`swatch ${form.avatar_color === c ? "active" : ""}`} style={{ background: c }} onClick={() => setForm({ ...form, avatar_color: c })} aria-label={`Use ${c}`} />
              ))}
            </div>
            <label>Favorite map
              <select value={form.favorite_map} onChange={(e) => setForm({ ...form, favorite_map: e.target.value })}>
                {MAPS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <button className="btn" disabled={saving} onClick={() => void onSave()}>{saving ? "Saving..." : "Save profile"}</button>
            {message && <p className="info small">{message}</p>}
          </section>

          <section className="profile-section">
            <h3>Career stats</h3>
            <div className="stat-grid">
              <div><strong>{s.games_played}</strong><span>Matches</span></div>
              <div><strong>{s.wins_as_seeker}</strong><span>Hunter wins</span></div>
              <div><strong>{s.wins_as_hider}</strong><span>Chameleon wins</span></div>
              <div><strong>{s.eliminations}</strong><span>Tags</span></div>
              <div><strong>{s.survival_time_seconds}</strong><span>Seconds survived</span></div>
              <div><strong>{new Date(user.created_at).toLocaleDateString()}</strong><span>Joined</span></div>
            </div>
            <p className="muted small">Email: {user.email}</p>
            <p className="muted small">Last login: {user.last_login ? new Date(user.last_login).toLocaleString() : "-"}</p>
            <button className="btn secondary" onClick={() => void refreshMe()}>Refresh profile</button>
          </section>
        </div>
      </div>
    </div>
  );
}
