import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LandingPage() {
  const { user } = useAuth();
  return (
    <div className="page">
      <section className="hero card">
        <h1>BOJU BOJU Arena</h1>
        <p className="muted">3D multiplayer hide-and-seek prototype (Phases 0-4 complete: auth, lobby/rooms, greybox movement, round flow, networked arena prototype)</p>
        {user ? (
          <div className="stack">
            <p>Signed in as <strong>{user.username}</strong>.</p>
            <div className="row">
              <Link className="btn" to="/lobby">Open Lobby</Link>
              <Link className="btn secondary" to="/profile">Profile</Link>
              <Link className="btn secondary" to="/play">Greybox Sandbox</Link>
            </div>
          </div>
        ) : (
          <div className="row">
            <Link className="btn" to="/signup">Create account</Link>
            <Link className="btn secondary" to="/signin">Sign in</Link>
            <Link className="btn secondary" to="/play">Greybox Sandbox</Link>
          </div>
        )}
      </section>
    </div>
  );
}
