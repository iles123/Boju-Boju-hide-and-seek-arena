import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getArenaStats } from "../lib/api";
import type { ArenaStats, User } from "../lib/api";

const EMPTY_ARENA_STATS: ArenaStats = {
  live_hunts: 0,
  open_lobbies: 0,
  players_online: 0,
  chameleons_hidden: 0,
  hunters_active: 0,
  registered_players: 0,
};

const MAP_ROTATION = ["MARKET", "WAREHOUSE", "ROOFTOPS", "GARDEN", "ARCADE"];

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

function LiveCard({ user }: { user?: User | null }) {
  const [stats, setStats] = useState<ArenaStats>(EMPTY_ARENA_STATS);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

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

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const fmt = (value: number) => value.toLocaleString("en-US");
  const squadLevel = Math.max(1, Math.floor(Math.sqrt(stats.registered_players + 1)));
  const hiderWins = user?.stats.wins_as_hider ?? 0;
  const seekerWins = user?.stats.wins_as_seeker ?? 0;
  const games = user?.stats.games_played ?? 0;
  const eliminations = user?.stats.eliminations ?? 0;
  const survivalMinutes = Math.floor((user?.stats.survival_time_seconds ?? 0) / 60);
  const camoLevel = Math.max(1, Math.floor(Math.sqrt(hiderWins + 1) * 2));
  const camoProgress = Math.min(100, (hiderWins % 5) * 20);
  const winRate = games ? Math.round(((hiderWins + seekerWins) / games) * 100) : 0;
  const hiderShare = stats.players_online > 0 ? Math.round((stats.chameleons_hidden / stats.players_online) * 100) : 50;
  const hunterShare = 100 - hiderShare;
  const activeIndex = stats.live_hunts % MAP_ROTATION.length;
  const dropDate = new Date(now);
  dropDate.setUTCHours(24, 0, 0, 0);
  const dropSeconds = Math.max(0, Math.floor((dropDate.getTime() - now) / 1000));
  const dropLabel = `${String(Math.floor(dropSeconds / 3600)).padStart(2, "0")}:${String(Math.floor((dropSeconds % 3600) / 60)).padStart(2, "0")}:${String(dropSeconds % 60).padStart(2, "0")}`;
  const missions = [
    { label: "BLEND MASTER", detail: `${hiderWins} hider wins`, progress: camoProgress, tone: "green" },
    { label: "SHARP EYES", detail: `${eliminations} tags`, progress: Math.min(100, eliminations * 4), tone: "rose" },
    { label: "SURVIVOR", detail: `${survivalMinutes}m alive`, progress: Math.min(100, survivalMinutes * 2), tone: "cyan" },
  ];

  return (
    <section className="live-card" aria-label="Live arena mission control">
      <div className="live-card-top">
        <span className="live-title"><span className="live-pulse" />ARENA COMMAND</span>
        <span className="live-sync"><span className={syncedAt ? "sync-dot live" : "sync-dot"} />{syncedAt ? `LIVE · ${new Date(syncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "CONNECTING"}</span>
      </div>
      <div className="live-grid">
        <div className="live-metric">
          <div className="metric-top"><small>LIVE HUNTS</small><span>ROUND</span></div>
          <strong>{fmt(stats.live_hunts)}</strong>
          <div className="meter"><i style={{ width: `${Math.min(100, stats.live_hunts * 18 + stats.hunters_active * 7)}%` }} /></div>
        </div>
        <div className="live-metric">
          <div className="metric-top"><small>ONLINE</small><span>NOW</span></div>
          <strong>{fmt(stats.players_online)}</strong>
          <div className="meter cyan"><i style={{ width: `${Math.min(100, stats.players_online * 8)}%` }} /></div>
        </div>
        <div className="live-metric">
          <div className="metric-top"><small>HIDDEN</small><span>CAMO</span></div>
          <strong>{fmt(stats.chameleons_hidden)}</strong>
          <div className="meter green"><i style={{ width: `${Math.min(100, stats.chameleons_hidden * 11)}%` }} /></div>
        </div>
        <div className="live-metric">
          <div className="metric-top"><small>LOBBIES</small><span>OPEN</span></div>
          <strong>{fmt(stats.open_lobbies)}</strong>
          <div className="meter amber"><i style={{ width: `${Math.min(100, stats.open_lobbies * 12)}%` }} /></div>
        </div>
      </div>
      <div className="live-lower">
        <div className="live-panel">
          <div className="panel-head"><span>RANK PATH</span><strong>{user ? `CAMO LV ${camoLevel}` : "RECRUIT"}</strong></div>
          <div className="rank-row">
            <div className="rank-badge">{user ? camoLevel : 1}</div>
            <div className="rank-copy">
              <strong>{user?.profile.display_name || "Guest Scout"}</strong>
              <small>{games} matches · {winRate}% win rate</small>
            </div>
            <div className="drop-clock"><small>NEXT DROP</small><strong>{dropLabel}</strong></div>
          </div>
          <div className="level-track"><i style={{ width: `${user ? camoProgress : 0}%` }} /></div>
          <small className="panel-foot">{user ? `${5 - (hiderWins % 5)} hider wins to next camo level` : "Sign up to start earning camo rank"}</small>
        </div>
        <div className="live-panel">
          <div className="panel-head"><span>ROLE BALANCE</span><strong>SQUAD LV {squadLevel}</strong></div>
          <div className="role-bars">
            <div>
              <div className="role-label"><small>HIDERS</small><strong>{hiderShare}%</strong></div>
              <div className="meter green"><i style={{ width: `${hiderShare}%` }} /></div>
            </div>
            <div>
              <div className="role-label"><small>HUNTERS</small><strong>{hunterShare}%</strong></div>
              <div className="meter rose"><i style={{ width: `${hunterShare}%` }} /></div>
            </div>
          </div>
          <div className="map-strip">
            {MAP_ROTATION.map((map, i) => <span key={map} className={i === activeIndex ? "map-chip active" : "map-chip"}>{map}</span>)}
          </div>
        </div>
      </div>
      <div className="mission-board">
        <div className="board-head"><strong>MISSION BOARD</strong><span>PLAYER OBJECTIVES</span></div>
        <div className="mission-grid">
          {missions.map((mission) => (
            <div className="mission" key={mission.label}>
              <div className="mission-head"><strong>{mission.label}</strong><small>{mission.detail}</small></div>
              <div className={`meter ${mission.tone}`}><i style={{ width: `${mission.progress}%` }} /></div>
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

          <LiveCard user={user} />

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
