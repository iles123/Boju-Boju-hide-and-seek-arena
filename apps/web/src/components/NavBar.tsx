import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { MusicToggle } from "./MusicToggle";

export function NavBar() {
  const { user, logout } = useAuth();
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand">BOJU BOJU: Hunt &amp; Seek</Link>
        <nav className="nav-links">
          <MusicToggle />
          <NavLink to="/">Home</NavLink>
          <NavLink to="/play">Practice</NavLink>
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
