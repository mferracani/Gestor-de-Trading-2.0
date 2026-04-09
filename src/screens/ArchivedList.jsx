import { useEffect, useState } from 'react';
import { Archive, Loader2, CheckCircle, XCircle, Wallet, List as ListIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function ArchivedList() {
  const navigate = useNavigate();
  const [archivedAccounts, setArchivedAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const userId = 'user_test_123';
        const states = ['quemada', 'aprobada', 'archivada'];

        // Cargar challenges archivados
        const qAuth = query(
          collection(db, 'accounts'),
          where('user_id', '==', userId),
          where('estado', 'in', states)
        );
        const authSnap = await getDocs(qAuth);
        const challenges = authSnap.docs.map(d => ({ id: d.id, ...d.data(), tipo: 'challenge' }));

        // Cargar fondeadas archivadas
        const qFunded = query(
          collection(db, 'funded_accounts'),
          where('user_id', '==', userId),
          where('estado', 'in', states)
        );
        const fundedSnap = await getDocs(qFunded);
        const funded = fundedSnap.docs.map(d => ({ id: d.id, ...d.data(), tipo: 'fondeada' }));

        const all = [...challenges, ...funded];
        all.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        
        setArchivedAccounts(all);
      } catch (err) {
        console.error('Error cargando cuentas archivadas:', err);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Cuentas Archivadas</h1>
          <p style={styles.subtitle}>Historial de cuentas pasadas, quemadas o archivadas.</p>
        </div>
      </header>

      {loading ? (
        <div style={styles.loadingState}>
          <Loader2 className="spinner" size={32} color="var(--accent-blue)" />
          <p>Cargando archivo...</p>
        </div>
      ) : archivedAccounts.length === 0 ? (
        <div style={styles.emptyState}>
          <Archive size={48} color="var(--text-secondary)" style={{ marginBottom: 16 }} />
          <p style={styles.emptyTitle}>Sin cuentas en el archivo</p>
          <p style={styles.emptySubtitle}>Cuando una cuenta sea aprobada, quemada o la archives manualmente, aparecerá acá.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {archivedAccounts.map(acc => (
            <ArchivedCard key={acc.id} account={acc} onPress={() => navigate(`/${acc.tipo === 'fondeada' ? 'fondeadas' : 'challenges'}/${acc.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ArchivedCard({ account, onPress }) {
  const isAprobada = account.estado === 'aprobada';
  const isQuemada = account.estado === 'quemada';
  const isFondeada = account.tipo === 'fondeada';

  let borderStyle = '1px solid var(--border)';
  let bgOverlay = 'transparent';
  let StatusIcon = Archive;
  let statusColor = 'var(--text-secondary)';
  let statusBadgeLabel = 'Archivada';

  if (isAprobada) {
    borderStyle = '1px solid rgba(48, 209, 88, 0.3)';
    bgOverlay = 'rgba(48, 209, 88, 0.05)';
    StatusIcon = CheckCircle;
    statusColor = '#30d158';
    statusBadgeLabel = 'Aprobada';
  } else if (isQuemada) {
    borderStyle = '1px solid rgba(255, 69, 58, 0.3)';
    bgOverlay = 'rgba(255, 69, 58, 0.05)';
    StatusIcon = XCircle;
    statusColor = '#ff453a';
    statusBadgeLabel = 'Quemada';
  }

  return (
    <div style={{ ...styles.card, border: borderStyle, backgroundColor: 'var(--bg-secondary)', position: 'relative', overflow: 'hidden' }} onClick={onPress}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: bgOverlay, pointerEvents: 'none' }} />
      
      <div style={styles.cardHeader}>
        <div style={styles.cardIcon}>
          {isFondeada ? <Wallet size={18} color="var(--accent-blue)" /> : <ListIcon size={18} color="var(--accent-orange)" />}
        </div>
        <div style={styles.cardBroker}>{isFondeada ? 'Fondeada' : 'Challenge'} • {account.broker || 'Demo'}</div>
        <div style={{ ...styles.statusBadge, color: statusColor, backgroundColor: bgOverlay }}>
          <StatusIcon size={13} /> {statusBadgeLabel}
        </div>
      </div>

      <div style={styles.cardContent}>
        <div style={styles.cardName}>{account.nombre || `Cuenta ${account.slot || ''}`}</div>
        <div style={styles.metaLabel}>Balance Final / PnL</div>
        <div style={styles.balanceValue}>
          ${(account.balance_actual_usd || account.balance_inicial_usd || 0).toLocaleString()} 
          <span style={{ color: (account.pnl_acumulado_usd || 0) >= 0 ? '#30d158' : '#ff453a', marginLeft: 8, fontSize: '15px' }}>
            ({(account.pnl_acumulado_usd || 0) >= 0 ? '+' : ''}${(account.pnl_acumulado_usd || 0).toLocaleString()})
          </span>
        </div>
      </div>
      
      <div style={styles.verDetalle}>Ver Historial Completo →</div>
    </div>
  );
}

const styles = {
  container: {
    padding: '24px',
    maxWidth: '800px',
    margin: '0 auto',
    minHeight: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    letterSpacing: '-0.5px',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 0',
    gap: '12px',
    color: 'var(--text-secondary)',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 24px',
    textAlign: 'center',
    gap: '8px',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  emptySubtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginBottom: '16px',
    maxWidth: '280px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
  },
  card: {
    borderRadius: '20px',
    padding: '20px',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    position: 'relative',
    zIndex: 1
  },
  cardIcon: {
    width: '32px',
    height: '32px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBroker: {
    flex: 1,
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    fontWeight: '600',
    padding: '4px 8px',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-tertiary)'
  },
  cardContent: {
    position: 'relative',
    zIndex: 1
  },
  cardName: {
    fontSize: '17px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '8px'
  },
  metaLabel: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    marginBottom: '2px',
  },
  balanceValue: {
    fontSize: '17px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  verDetalle: {
    fontSize: '13px',
    color: 'var(--accent-blue)',
    fontWeight: '600',
    marginTop: '4px',
    position: 'relative',
    zIndex: 1
  }
};
