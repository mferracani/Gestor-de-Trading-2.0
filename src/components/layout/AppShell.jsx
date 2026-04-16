import { Outlet, NavLink } from 'react-router';
import { Home, List, History, BarChart2, Wallet, Archive, DollarSign } from 'lucide-react';
import '../../styles/index.css';

export default function AppShell() {
  return (
    <div style={styles.container}>
      {/* Navegación Superior (Escritorio) */}
      <nav className="desktop-only" style={styles.desktopNav}>
        <div style={styles.navGroup}>
          <NavItemDesktop to="/" icon={<Home size={20} />} label="Inicio" />
          <NavItemDesktop to="/challenges" icon={<List size={20} />} label="Challenges" />
          <NavItemDesktop to="/fondeadas" icon={<Wallet size={20} />} label="Fondeadas" />
          <NavItemDesktop to="/cuentas" icon={<DollarSign size={20} />} label="Cuentas" />
          <NavItemDesktop to="/archivadas" icon={<Archive size={20} />} label="Archivadas" />
          <NavItemDesktop to="/historial" icon={<History size={20} />} label="Historial" />
          <NavItemDesktop to="/metricas" icon={<BarChart2 size={20} />} label="Métricas" />
        </div>
      </nav>

      {/* Contenido principal (las pantallas inyectadas por el router) */}
      <main style={styles.main}>
        <Outlet />
      </main>

      {/* Navegación Inferior (Móvil) */}
      <nav className="mobile-only" style={styles.bottomNav}>
        <NavItem to="/" icon={<Home size={22} />} label="Inicio" />
        <NavItem to="/challenges" icon={<List size={22} />} label="Challenges" />
        <NavItem to="/fondeadas" icon={<Wallet size={22} />} label="Fondeadas" />
        <NavItem to="/cuentas" icon={<DollarSign size={22} />} label="Cuentas" />
        <NavItem to="/metricas" icon={<BarChart2 size={22} />} label="Métricas" />
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        ...styles.navItem,
        color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)'
      })}
    >
      {icon}
      <span style={styles.navLabel}>{label}</span>
    </NavLink>
  );
}

function NavItemDesktop({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        ...styles.desktopNavItem,
        color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
        borderBottom: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent'
      })}
    >
      {icon}
      <span style={styles.desktopNavLabel}>{label}</span>
    </NavLink>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  main: {
    flex: 1,
    overflowY: 'auto',
    width: '100%',
    maxWidth: '1200px', // Aumentado para diseño de pantalla completa en escritorio
    margin: '0 auto',  // Centra el contenido en Desktop
  },
  desktopNav: {
    height: '64px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    marginBottom: '16px',
    padding: '0 32px', // padding exclusivo para Desktop
    flexShrink: 0
  },
  navGroup: {
    display: 'flex',
    gap: '32px',
    height: '100%',
  },
  desktopNavItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    height: '100%',
    padding: '0 4px',
    transition: 'all 0.2s',
  },
  desktopNavLabel: {
    fontSize: '14px',
    fontWeight: '500'
  },
  bottomNav: {
    height: '80px',
    backgroundColor: 'rgba(28, 28, 30, 0.8)', // --bg-secondary equivalent
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderTop: '0.5px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-around',
    paddingTop: '10px',
    paddingBottom: '20px', // Safe area for iOS
    flexShrink: 0
  },
  navItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: '4px',
    transition: 'color 0.2s',
  },
  navLabel: {
    fontSize: '11px',
    fontWeight: '500'
  }
};
