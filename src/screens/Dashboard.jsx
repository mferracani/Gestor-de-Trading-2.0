import { useEffect, useState } from 'react';
import { Settings, Menu, Archive } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTradingStore } from '../store/useTradingStore';
import AccountRecommendationCard from '../components/dashboard/AccountRecommendationCard';
import LotSizeCalculator from '../components/dashboard/LotSizeCalculator';
import MiniMetricsStrip from '../components/dashboard/MiniMetricsStrip';
import AlertBanner from '../components/dashboard/AlertBanner';
import Skeleton from '../components/ui/Skeleton';

export default function Dashboard() {
  const { activeChallenge, accounts, isLoading, fetchDashboardData } = useTradingStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <div style={styles.container} className="page-enter">
      <header style={styles.header}>
        <div>
          <h1 style={styles.greeting}>Hola, Matias</h1>
          <p style={styles.subtitle}>Listo para operar el plan hoy.</p>
        </div>
        <div style={{ position: 'relative' }}>
          <button style={styles.iconButton} onClick={() => setMenuOpen(!menuOpen)}>
            <Menu size={22} color="var(--text-secondary)" />
          </button>
          
          {menuOpen && (
            <>
              <div style={styles.menuOverlay} onClick={() => setMenuOpen(false)} />
              <div style={styles.dropdownMenu}>
                <div style={{...styles.menuItem, ':hover': { backgroundColor: 'var(--bg-tertiary)' }}} onClick={() => { setMenuOpen(false); navigate('/archivadas'); }}>
                  <Archive size={18} color="var(--text-secondary)" />
                  <span>Archivadas</span>
                </div>
                <div style={{...styles.menuItem, ':hover': { backgroundColor: 'var(--bg-tertiary)' }}} onClick={() => { setMenuOpen(false); /* open settings */ }}>
                  <Settings size={18} color="var(--text-secondary)" />
                  <span>Ajustes</span>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {isLoading ? (
        <div style={styles.content}>
          {/* Skeleton del AlertBanner */}
          <Skeleton height="72px" borderRadius="16px" />
          {/* Skeleton de MiniMetricsStrip */}
          <Skeleton height="110px" borderRadius="20px" />
          {/* Skeleton de AccountRecommendationCard */}
          <Skeleton height="140px" borderRadius="20px" />
          {/* Skeleton del LotSizeCalculator */}
          <Skeleton height="200px" borderRadius="20px" />
        </div>
      ) : (
        <div style={styles.content}>
          <AlertBanner challenge={activeChallenge} />
          <MiniMetricsStrip challenge={activeChallenge} accounts={accounts} />
          <AccountRecommendationCard accounts={accounts} />
          <LotSizeCalculator balance={activeChallenge?.balance_actual_usd || 10000} />
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '24px 24px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px'
  },
  greeting: {
    fontSize: '28px',
    fontWeight: '700',
    letterSpacing: '-0.5px'
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '15px',
    marginTop: '4px'
  },
  iconButton: {
    backgroundColor: 'var(--bg-tertiary)',
    height: '40px',
    width: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  placeholderCard: {
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: '20px',
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '150px',
    color: 'var(--text-muted)'
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    color: 'var(--text-secondary)',
    padding: '80px 0'
  },
  menuOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 90,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '50px',
    right: 0,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '8px',
    minWidth: '200px',
    zIndex: 100,
    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '500',
    color: 'var(--text-primary)',
  }
};
