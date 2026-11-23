import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getArenaStats } from "../lib/api";
import type { ArenaStats } from "../lib/api";

const EMPTY_ARENA_STATS: ArenaStats = {
  live_hunts: 0,
  open_lobbies: 0,
  players_online: 0,
  chameleons_hidden: 0,
  hunters_active: 0,
  registered_players: 0,
};

const MARKET_QUESTS = [
  { label: "GLOBAL MARKET", value: "$213.9B", note: "+6.1% YoY", progress: 76 },
  { label: "ACTIVE PLAYERS", value: "3.70B", note: "+4.4% YoY", progress: 74 },
  { label: "MOBILE SHARE", value: "57%", note: "$121.1B", progress: 57 },
  { label: "AVG. SPEND", value: "$129.6", note: "per spender", progress: 65 },
];

export function AnimatedGameBg({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`landing-bg ${compact ? "auth-bg" : ""}`} aria-hidden="true">
      <div className="bg-gradient" />
      <div className="bg-grid" />
      <div className="bg-orb orb-a" />
      <div className="bg-orb orb-b" />
      <div className="bg-orb orb-c" />
      <div className="scan-beam" />

      <div className="bg-prop prop1" />
      <div className="bg-prop prop2" />
      <div className="bg-prop prop3" />
      <div className="bg-prop prop4" />
      <div className="bg-prop prop5" />
      <div className="bg-prop prop6" />

      <div className="bg-actor chameleon cham1">
        <svg viewBox="0 0 120 120" className="actor-svg">
          <ellipse cx="60" cy="70" rx="34" ry="22" className="cham-body" />
          <circle cx="82" cy="54" r="16" className="cham-head" />
          <circle cx="88" cy="50" r="5" className="cham-eye" />
          <circle cx="90" cy="50" r="2.2" className="cham-pupil" />
          <path d="M30 78 C10 78, 8 98, 22 100 C34 102, 40 90, 38 82" className="cham-tail" />
          <rect x="40" y="84" width="8" height="16" rx="3" className="cham-leg" />
          <rect x="58" y="84" width="8" height="16" rx="3" className="cham-leg" />
        </svg>
        <span className="actor-tag good">Blending...</span>
      </div>
      <div className="bg-actor chameleon cham2 blend">
        <svg viewBox="0 0 120 120" className="actor-svg">
          <rect x="36" y="38" width="48" height="48" rx="8" className="cham-body" />
          <rect x="52" y="24" width="18" height="18" rx="4" className="cham-head" />
          <circle cx="61" cy="33" r="3.5" className="cham-eye" />
        </svg>
        <span className="actor-tag good">Camouflaged</span>
      </div>
      <div className="bg-actor hunter hunt1">
        <svg viewBox="0 0 120 140" className="actor-svg">
          <rect x="42" y="48" width="36" height="42" rx="8" className="hunt-body" />
          <rect x="48" y="20" width="24" height="24" rx="6" className="hunt-head" />
          <rect x="50" y="28" width="20" height="6" rx="3" className="hunt-vis" />
          <rect x="30" y="56" width="10" height="28" rx="4" className="hunt-arm" />
          <rect x="80" y="56" width="10" height="28" rx="4" className="hunt-arm" />
          <rect x="46" y="90" width="10" height="28" rx="4" className="hunt-leg" />
          <rect x="64" y="90" width="10" height="28" rx="4" className="hunt-leg" />
        </svg>
        <span className="actor-tag bad">Hunter scanning</span>
      </div>

      <div className="spark s1" /><div className="spark s2" /><div className="spark s3" /><div className="spark s4" /><div className="spark s5" />
    </div>
  );
}

function LiveCard() {
  const [stats, setStats] = useState<ArenaStats>(EMPTY_ARENA_STATS);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const next = await getArenaStats();
        if (active) {
          setStats(next);
          setSyncedAt(Date.now());
        }
      } catch {
        if (active) setSyncedAt(null);
      }
    };
    void load();
    const timer = window.setInterval(load, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const fmt = (value: number) => value.toLocaleString("en-US");
  const squadLevel = Math.max(1, Math.floor(Math.sqrt(stats.registered_players + 1)));
  const squadRemainder = (stats.registered_players + 1) % 100;
  const squadProgress = squadRemainder;
  const huntHeat = Math.min(100, stats.live_hunts * 18 + stats.hunters_active * 7);
  const hideHeat = Math.min(100, stats.chameleons_hidden * 11);

  return (
    <section className="live-card" aria-label="Live arena stats">
      <div className="live-card-top">
        <span className="live-title"><span className="live-pulse" />LIVE ARENA FEED</span>
        <span className="live-sync">{syncedAt ? `SYNCED ${new Date(syncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "CONNECTING"}</span>
      </div>
      <div className="live-grid">
        <div className="live-metric">
          <small>LIVE HUNTS</small>
          <strong>{fmt(stats.live_hunts)}</strong>
          <div className="meter"><i style={{ width: `${huntHeat}%` }} /></div>
        </div>
        <div className="live-metric">
          <small>PLAYERS ONLINE</small>
          <strong>{fmt(stats.players_online)}</strong>
          <div className="meter cyan"><i style={{ width: `${Math.min(100, stats.players_online * 8)}%` }} /></div>
        </div>
        <div className="live-metric">
          <small>CHAMELEONS HIDDEN</small>
          <strong>{fmt(stats.chameleons_hidden)}</strong>
          <div className="meter green"><i style={{ width: `${hideHeat}%` }} /></div>
        </div>
        <div className="live-metric">
          <small>OPEN LOBBIES</small>
          <strong>{fmt(stats.open_lobbies)}</strong>
          <div className="meter amber"><i style={{ width: `${Math.min(100, stats.open_lobbies * 12)}%` }} /></div>
        </div>
      </div>
      <div className="live-level">
        <div className="live-level-head">
          <span className="level-chip">SQUAD LV {squadLevel}</span>
          <strong>{fmt(stats.registered_players)} REGISTERED</strong>
          <span>{100 - squadRemainder} TO NEXT LV</span>
        </div>
        <div className="level-track"><i style={{ width: `${squadProgress}%` }} /></div>
      </div>
      <div className="market-quests">
        <div className="quest-head">
          <strong>WORLD QUEST</strong>
          <span>2026 MARKET INTEL</span>
        </div>
        <div className="quest-grid">
          {MARKET_QUESTS.map((quest) => (
            <div className="quest" key={quest.label}>
              <small>{quest.label}</small>
              <strong>{quest.value}</strong>
              <span>{quest.note}</span>
              <div className="meter quest-meter"><i style={{ width: `${quest.progress}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  return (
    <div className="landing-wrap">
      <AnimatedGameBg />
      <div className="landing-content">
        <section className="hero card huntseek-hero landing-hero">
          <div className="hero-badge">Boju-Boju Hunt & Seek</div>
          <h1>BOJU BOJU: Hunt & Seek</h1>
          <p className="hero-lead">Paint. Pose. Blend in. Don’t get caught.</p>
          <p className="muted">inspired 3D multiplayer hide-and-seek. Play as a <strong>Chameleon</strong> to paint your colors, pick a disguise pose, and blend into the arena — or as a <strong>Hunter</strong> to seek and tag anything suspicious.</p>

          <div className="feature-pills">
            <span className="pill">🎨 Paint & Camouflage</span>
            <span className="pill">🧱 Pose & Blend</span>
            <span className="pill">🔍 Hunt & Tag</span>
            <span className="pill">👥 Friends vs Others</span>
            <span className="pill">📱 Mobile + Desktop</span>
          </div>

          <LiveCard />

          {user ? (
            <div className="stack hero-actions">
              <p>Signed in as <strong>{user.username}</strong>. Ready to blend in?</p>
              <div className="row">
                <Link className="btn" to="/lobby">Play Hunt & Seek</Link>
                <Link className="btn secondary" to="/profile">Profile</Link>
                <Link className="btn secondary" to="/play">Practice Sandbox</Link>
              </div>
            </div>
          ) : (
            <div className="stack hero-actions">
              <div className="row">
                <Link className="btn" to="/signup">Create account</Link>
                <Link className="btn secondary" to="/signin">Sign in</Link>
                <Link className="btn secondary" to="/play">Practice Sandbox</Link>
              </div>
              <p className="muted small">Create an account to join rooms, team up with friends, and play online matches.</p>
            </div>
          )}

          <div className="hero-notes">
            <div className="note"><strong>Chameleons:</strong> match props with paint, choose a form, lock to stay hidden.</div>
            <div className="note"><strong>Hunters:</strong> watch for movement and odd colors, then tag before time runs out.</div>
            <div className="note"><strong>Friends vs others:</strong> share a room code, coordinate roles, and play together against other players.</div>
          </div>
        </section>
      </div>
    </div>
  );
}
