import { Link } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import { useWebSocket } from '../hooks/useWebSocket';
import { useState, useCallback } from 'react';

const Navbar = () => {
  const [lastEvent, setLastEvent] = useState(null);
  useWebSocket(useCallback((msg) => setLastEvent(msg), []));

  return (
    <nav style={styles.nav}>
      <div style={styles.brand}>
        <span style={styles.logo}>⬡</span>
        <span style={styles.brandName}>NetraX</span>
        <span style={styles.tagline}>Intelligent Network Management</span>
      </div>
      <div style={styles.links}>
        <Link to="/"           style={styles.link}>Dashboard</Link>
        <Link to="/discovery"  style={styles.link}>Discovery</Link>
        <Link to="/monitor"    style={styles.link}>Monitor</Link>
        <Link to="/analytics"  style={styles.link}>Analytics</Link>
        <Link to="/automation" style={styles.link}>Automation</Link>
        <Link to="/alerts"     style={styles.link}>Alerts</Link>
        <NotificationBell wsLastEvent={lastEvent} />
        <span style={styles.badge}>Phase 8</span>
      </div>
    </nav>
  );
};

const styles = {
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', height: '60px', background: '#0f172a', borderBottom: '1px solid #1e293b', position: 'sticky', top: 0, zIndex: 100 },
  brand: { display: 'flex', alignItems: 'center', gap: '10px' },
  logo: { fontSize: '24px', color: '#38bdf8' },
  brandName: { color: '#f1f5f9', fontWeight: 700, fontSize: '20px', letterSpacing: '1px' },
  tagline: { color: '#475569', fontSize: '12px', marginLeft: '4px' },
  links: { display: 'flex', alignItems: 'center', gap: '16px' },
  link: { color: '#94a3b8', textDecoration: 'none', fontSize: '13px' },
  badge: { background: '#1e40af', color: '#93c5fd', padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 },
};

export default Navbar;