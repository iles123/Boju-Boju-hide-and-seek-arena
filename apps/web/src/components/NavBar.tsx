import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function NavBar() {
  const { user, logout } = useAuth();
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand">BOJU BOJU Arena</Link>
        <nav className="nav-links">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/play">Play</NavLink>
          {user ? (
            <>
              <NavLink to="/lobby">Lobby</NavLink>
              <NavLink to="/profile">Profile</NavLink>
              <button className="link-btn" onClick={() => void logout()}>Logout</button>
            </>
          ) : (
            <>
              <NavLink to="/signin">Sign In</NavLink>
              <NavLink to="/signup">Sign Up</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
