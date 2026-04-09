import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TrendingUp, TrendingDown, Minus, Filter } from 'lucide-react';

const FILTERS = ['Todos', 'WIN', 'LOSS', 'B.E.'];

export default function Historial() {
  const [trades, setTrades] = useState([]);
  const [accounts, setAccounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('Todos');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const userId = 'user_test_123';

        // Cargar cuentas para poder mostrar el nombre
        const qAccounts = query(collection(db, 'accounts'), where('user_id', '==', userId));
        const accountsSnap = await getDocs(qAccounts);
        const accountsMap = {};
        accountsSnap.docs.forEach(d => { accountsMap[d.id] = d.data(); });
        setAccounts(accountsMap);

        // Cargar todos los trades del usuario
        const qTrades = query(collection(db, 'trades'), where('user_id', '==', userId));
        const tradesSnap = await getDocs(qTrades);
        const allTrades = tradesSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
        setTrades(allTrades);
      } catch (err) {
        console.error('Error cargando historial:', err);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filteredTrades = trades.filter(t => {
    if (activeFilter === 'Todos') return true;
    if (activeFilter === 'B.E.') return t.resultado === 'BE' || t.resultado === 'B.E.';
    return t.resultado === activeFilter;
  });

  // Estadísticas del top
  const totalPnl = trades.reduce((acc, t) => acc + (t.pnl_usd || 0), 0);
  const wins = trades.filter(t => t.resultado === 'WIN').length;
  const losses = trades.filter(t => t.resultado === 'LOSS').length;
  const winRate = trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0;

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', marginTop: 40 }}>
        Cargando historial...
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>Historial</h1>
      </header>

      {/* Resumen global */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>PnL Total</div>
          <div style={{ ...styles.statValue, color: totalPnl >= 0 ? '#30d158' : '#ff453a' }}>
            {totalPnl > 0 ? '+' : ''}${totalPnl.toLocaleString()}
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Operaciones</div>
          <div style={styles.statValue}>{trades.length}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Win Rate</div>
          <div style={{ ...styles.statValue, color: winRate >= 50 ? '#30d158' : '#ff9f0a' }}>
            {winRate}%
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>W / L</div>
          <div style={styles.statValue}>
            <span style={{ color: '#30d158' }}>{wins}</span>
            <span style={{ color: 'var(--text-muted)' }}> / </span>
            <span style={{ color: '#ff453a' }}>{losses}</span>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div style={styles.filterRow}>
        <Filter size={14} color="var(--text-muted)" />
        {FILTERS.map(f => (
          <button
            key={f}
            style={{
              ...styles.filterBtn,
              ...(activeFilter === f ? styles.filterBtnActive : {})
            }}
            onClick={() => setActiveFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filteredTrades.length === 0 ? (
        <div style={styles.empty}>
          {trades.length === 0
            ? 'Aún no registraste ningún trade.'
            : 'No hay trades con ese filtro.'}
        </div>
      ) : (
        <div style={styles.list}>
          {filteredTrades.map(trade => {
            const isWin = trade.resultado === 'WIN';
            const isLoss = trade.resultado === 'LOSS';
            const pnl = trade.pnl_usd || 0;
            const accountName = accounts[trade.account_id]?.nombre || `Cuenta ${trade.account_id?.slice(-4)}`;
            const fecha = trade.fecha
              ? new Date(trade.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
              : '—';

            return (
              <div key={trade.id} style={styles.tradeCard}>
                {/* Icono resultado */}
                <div style={{
                  ...styles.tradeIcon,
                  backgroundColor: isWin ? 'rgba(48,209,88,0.12)' : isLoss ? 'rgba(255,69,58,0.12)' : 'rgba(255,255,255,0.05)'
                }}>
                  {isWin && <TrendingUp size={18} color="#30d158" />}
                  {isLoss && <TrendingDown size={18} color="#ff453a" />}
                  {!isWin && !isLoss && <Minus size={18} color="var(--text-muted)" />}
                </div>

                {/* Info */}
                <div style={styles.tradeInfo}>
                  <div style={styles.tradeAsset}>{trade.activo}</div>
                  <div style={styles.tradeMeta}>
                    <span style={styles.accountTag}>{accountName}</span>
                    <span style={{ color: 'var(--text-muted)' }}>·</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{fecha}</span>
                  </div>
                </div>

                {/* PnL */}
                <div style={{
                  ...styles.tradePnl,
                  color: isWin ? '#30d158' : isLoss ? '#ff453a' : 'var(--text-muted)'
                }}>
                  {pnl === 0 ? 'B.E.' : `${pnl > 0 ? '+' : ''}$${pnl.toLocaleString()}`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '24px 24px 40px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '20px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    letterSpacing: '-0.5px',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    marginBottom: '20px',
  },
  statCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  statLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
  },
  statValue: {
    fontSize: '20px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  filterBtn: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    fontWeight: '500',
    padding: '6px 14px',
    borderRadius: '100px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  filterBtnActive: {
    backgroundColor: 'var(--accent-blue)',
    borderColor: 'var(--accent-blue)',
    color: '#fff',
  },
  empty: {
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '14px',
    marginTop: '48px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  tradeCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '14px 16px',
  },
  tradeIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tradeInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  tradeAsset: {
    fontSize: '15px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  tradeMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  accountTag: {
    fontSize: '12px',
    color: 'var(--accent-blue)',
    fontWeight: '500',
    backgroundColor: 'rgba(10,132,255,0.1)',
    padding: '2px 8px',
    borderRadius: '6px',
  },
  tradePnl: {
    fontSize: '16px',
    fontWeight: '700',
    flexShrink: 0,
  },
};
