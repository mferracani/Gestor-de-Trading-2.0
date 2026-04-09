import { useEffect, useState } from 'react';
import { Plus, Loader2, Wallet, TrendingUp, TrendingDown, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function FundedAccountList() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'funded_accounts'),
          where('user_id', '==', 'user_test_123'),
          where('estado', '!=', 'archivada')
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        setAccounts(data);
      } catch (err) {
        console.error('Error cargando cuentas fondeadas:', err);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Cuentas Fondeadas</h1>
          <p style={styles.subtitle}>Sin límite de cuentas • Objetivo de retiro 2%</p>
        </div>
        <button style={styles.addBtn} onClick={() => navigate('/fondeadas/nueva')}>
          <Plus size={18} />
          <span>Nueva</span>
        </button>
      </header>

      {loading ? (
        <div style={styles.loadingState}>
          <Loader2 className="spinner" size={32} color="var(--accent-blue)" />
          <p>Cargando cuentas...</p>
        </div>
      ) : accounts.length === 0 ? (
        <div style={styles.emptyState}>
          <Wallet size={48} color="var(--text-secondary)" style={{ marginBottom: 16 }} />
          <p style={styles.emptyTitle}>Sin cuentas fondeadas</p>
          <p style={styles.emptySubtitle}>Agregá tu primera cuenta fondeada para empezar a trackearla.</p>
          <button style={styles.addBtn} onClick={() => navigate('/fondeadas/nueva')}>
            <Plus size={18} />
            <span>Agregar cuenta</span>
          </button>
        </div>
      ) : (
        <div style={styles.grid}>
          {accounts.map(acc => (
            <FundedAccountCard key={acc.id} account={acc} onPress={() => navigate(`/fondeadas/${acc.id}`)} />
          ))}
          {/* Slot vacío para agregar */}
          <div style={styles.emptyCard} onClick={() => navigate('/fondeadas/nueva')}>
            <Plus size={24} color="var(--text-secondary)" />
            <span style={styles.emptyCardText}>Agregar cuenta</span>
          </div>
        </div>
      )}
    </div>
  );
}

function FundedAccountCard({ account, onPress }) {
  const balance = account.balance_actual_usd || account.balance_inicial_usd || 0;
  const inicial = account.balance_inicial_usd || 0;
  const pnl = account.pnl_acumulado_usd || 0;
  const targetRetiroPct = account.objetivo_retiro_pct || 2;
  const targetRetiroUsd = (inicial * targetRetiroPct) / 100;
  const faltaUsd = Math.max(0, targetRetiroUsd - pnl);
  const progresoPct = Math.min(100, (pnl / targetRetiroUsd) * 100);
  const isLogrado = faltaUsd <= 0 && pnl > 0;

  const pnlColor = pnl > 0 ? 'var(--accent-green)' : pnl < 0 ? 'var(--accent-red)' : 'var(--text-secondary)';
  const accentColor = isLogrado ? '#30d158' : 'var(--accent-blue)';

  return (
    <div style={{ ...styles.card, border: isLogrado ? '1px solid rgba(48, 209, 88, 0.3)' : '1px solid var(--border)' }} onClick={onPress}>
      {/* Header de la card */}
      <div style={styles.cardHeader}>
        <div style={styles.cardIcon}>
          <Wallet size={18} color={accentColor} />
        </div>
        <div style={styles.cardBroker}>{account.broker || 'Fondeada'}</div>
        {isLogrado && (
          <div style={styles.logradoBadge}>
            <CheckCircle size={13} /> Retiro listo
          </div>
        )}
      </div>

      {/* Nombre y balance */}
      <div style={styles.cardName}>{account.nombre}</div>
      <div style={styles.balanceRow}>
        <div>
          <div style={styles.metaLabel}>Balance Actual</div>
          <div style={styles.balanceValue}>${balance.toLocaleString()}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={styles.metaLabel}>PnL Total</div>
          <div style={{ ...styles.balanceValue, color: pnlColor }}>
            {pnl >= 0 ? '+' : ''}${pnl.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Barra de progreso hacia retiro */}
      <div style={styles.progressSection}>
        <div style={styles.progressLabelRow}>
          <span style={styles.metaLabel}>Progreso retiro ({targetRetiroPct}%)</span>
          <span style={{ fontSize: 12, color: isLogrado ? '#30d158' : '#ff9f0a', fontWeight: 600 }}>
            {isLogrado ? '🏆 Listo' : `Faltan $${faltaUsd.toLocaleString()}`}
          </span>
        </div>
        <div style={styles.progressTrack}>
          <div style={{
            ...styles.progressFill,
            width: `${progresoPct}%`,
            background: isLogrado
              ? 'linear-gradient(90deg, #30d158, #34c759)'
              : 'linear-gradient(90deg, var(--accent-blue), #5e9eff)',
          }} />
        </div>
      </div>

      {/* Footer: regla consistencia */}
      {account.regla_consistencia && (
        <div style={styles.consistencyBadge}>
          <TrendingUp size={12} /> Regla de consistencia activa
        </div>
      )}

      <div style={styles.verDetalle}>Ver Detalle →</div>
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
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'var(--accent-blue)',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    flexShrink: 0,
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
    backgroundColor: 'var(--bg-secondary)',
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
  },
  cardIcon: {
    width: '32px',
    height: '32px',
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
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
  logradoBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#30d158',
    backgroundColor: 'rgba(48, 209, 88, 0.1)',
    padding: '4px 8px',
    borderRadius: '8px',
  },
  cardName: {
    fontSize: '17px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  balanceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: '12px',
    padding: '12px 14px',
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
  progressSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  progressLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTrack: {
    height: '6px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.5s ease',
  },
  consistencyBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '11px',
    color: 'var(--accent-blue)',
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
    padding: '5px 10px',
    borderRadius: '8px',
    fontWeight: '500',
    width: 'fit-content',
  },
  verDetalle: {
    fontSize: '13px',
    color: 'var(--accent-blue)',
    fontWeight: '600',
    marginTop: '4px',
  },
  emptyCard: {
    border: '2px dashed var(--border)',
    borderRadius: '20px',
    padding: '40px 24px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    minHeight: '180px',
    transition: 'border-color 0.2s',
  },
  emptyCardText: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
};
