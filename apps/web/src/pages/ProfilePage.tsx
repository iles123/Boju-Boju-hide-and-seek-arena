import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { user, refreshMe } = useAuth();
  if (!user) return null;
  const s = user.stats;
  return (
    <div className="page">
      <section className="card">
        <h2>Profile</h2>
        <div className="grid-2">
          <div><strong>Username:</strong> {user.username}</div>
          <div><strong>Email:</strong> {user.email}</div>
          <div><strong>Role:</strong> {user.role}</div>
          <div><strong>Verified:</strong> {user.is_verified ? "Yes" : "No"}</div>
          <div><strong>Created:</strong> {new Date(user.created_at).toLocaleString()}</div>
          <div><strong>Last login:</strong> {user.last_login ? new Date(user.last_login).toLocaleString() : "-"}</div>
        </div>
        <h3>Stats</h3>
        <div className="grid-2">
          <div>Games played: {s.games_played}</div>
          <div>Wins as seeker: {s.wins_as_seeker}</div>
          <div>Wins as hider: {s.wins_as_hider}</div>
          <div>Eliminations: {s.eliminations}</div>
          <div>Survival time (s): {s.survival_time_seconds}</div>
        </div>
        <button className="btn secondary" onClick={() => void refreshMe()}>Refresh profile</button>
      </section>
    </div>
  );
}
