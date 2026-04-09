import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Archive, TrendingUp, TrendingDown, Minus, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useToast } from '../components/ui/Toast';

export default function FundedAccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [account, setAccount] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const docRef = doc(db, 'funded_accounts', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setAccount({ id: docSnap.id, ...docSnap.data() });

        const qTrades = query(collection(db, 'trades'), where('account_id', '==', id));
        const tradesSnap = await getDocs(qTrades);
        const _trades = tradesSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
        setTrades(_trades);
      } catch (err) {
        console.error('Error cargando cuenta fondeada:', err);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const handleArchive = async () => {
    if (!window.confirm('¿Archivar esta cuenta?')) return;
    try {
      await updateDoc(doc(db, 'funded_accounts', id), { estado: 'archivada' });
      addToast('Cuenta archivada correctamente.', 'success');
      navigate('/fondeadas');
    } catch {
      addToast('Error al archivar.', 'error');
    }
  };

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando cuenta...</div>;
  if (!account) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--accent-red)' }}>Cuenta no encontrada.</div>;

  // ── Cálculos ──────────────────────────────────────────
  const inicial = account.balance_inicial_usd || 0;
  const balance = account.balance_actual_usd || inicial;
  const pnl = account.pnl_acumulado_usd || 0;
  const targetRetiroPct = account.objetivo_retiro_pct || 2;
  const targetRetiroUsd = (inicial * targetRetiroPct) / 100;
  const faltaUsd = Math.max(0, targetRetiroUsd - pnl);
  const progresoPct = Math.min(100, Math.max(0, (pnl / targetRetiroUsd) * 100));
  const isLogrado = faltaUsd <= 0 && pnl > 0;

  // Regla de consistencia: agrupamos trades por día y comparamos el mejor día vs total de ganancias
  // Igual a la lógica del broker: "Best Trading Day Profit" no puede superar X% del total
  const limitePct = account.consistencia_pct || 40; // Usa el % guardado en la cuenta (default 40)
  const tradesByDay = trades.reduce((acc, t) => {
    const day = (t.fecha || '').slice(0, 10); // 'YYYY-MM-DD'
    acc[day] = (acc[day] || 0) + (t.pnl_usd || 0);
    return acc;
  }, {});
  const dailyPnls = Object.values(tradesByDay);
  const totalWins = dailyPnls.filter(d => d > 0).reduce((s, d) => s + d, 0);
  const bestDayProfit = dailyPnls.length > 0 ? Math.max(0, ...dailyPnls) : 0;
  const consistenciaPct = totalWins > 0 ? (bestDayProfit / totalWins) * 100 : 0;
  const consistenciaOk = account.regla_consistencia ? consistenciaPct <= limitePct : true;

  const winCount = trades.filter(t => t.resultado === 'WIN').length;
  const lossCount = trades.filter(t => t.resultado === 'LOSS').length;
  const winRate = trades.length > 0 ? Math.round((winCount / trades.length) * 100) : 0;

  const pnlColor = pnl > 0 ? 'var(--accent-green)' : pnl < 0 ? 'var(--accent-red)' : 'var(--text-secondary)';
  const progressColor = isLogrado ? '#30d158' : 'var(--accent-blue)';

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.iconButton}>
          <ArrowLeft size={24} color="var(--text-primary)" />
        </button>
        <button style={styles.iconButton} onClick={handleArchive} title="Archivar cuenta">
          <Archive size={20} color="var(--text-secondary)" />
        </button>
      </header>

      {/* Badge + Nombre */}
      <div style={styles.topSection}>
        <div style={styles.brokerBadge}>{account.broker || 'Cuenta Fondeada'}</div>
        <h1 style={styles.title}>{account.nombre}</h1>
      </div>

      {/* Balance grid */}
      <div style={styles.balanceGrid}>
        <div>
          <div style={styles.gridLabel}>Balance Inicial</div>
          <div style={styles.gridValue}>${inicial.toLocaleString()}</div>
        </div>
        <div>
          <div style={styles.gridLabel}>Balance Actual</div>
          <div style={styles.gridValue}>${balance.toLocaleString()}</div>
        </div>
        <div>
          <div style={styles.gridLabel}>PnL Total</div>
          <div style={{ ...styles.gridValue, color: pnlColor }}>
            {pnl >= 0 ? '+' : ''}${pnl.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={styles.gridLabel}>Win Rate</div>
          <div style={styles.gridValue}>{winRate}%</div>
        </div>
      </div>

      {/* Progreso de retiro */}
      <div style={styles.retiroCard}>
        <div style={styles.retiroHeader}>
          <div>
            <div style={styles.retiroLabel}>
              {isLogrado ? '🏆 ¡Objetivo de retiro alcanzado!' : `Objetivo de retiro (${targetRetiroPct}%)`}
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: isLogrado ? '#30d158' : '#ff9f0a', marginTop: 4 }}>
              {isLogrado ? `+$${pnl.toLocaleString()}` : `Faltan $${faltaUsd.toLocaleString()}`}
            </div>
          </div>
          {/* Círculo de progreso */}
          <div style={{ position: 'relative', width: 64, height: 64 }}>
            <svg width="64" height="64" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
              <circle
                cx="32" cy="32" r="26" fill="none"
                stroke={progressColor}
                strokeWidth="4"
                strokeDasharray={`${(progresoPct / 100) * 163} 163`}
                strokeLinecap="round"
              />
            </svg>
            <span style={styles.circleLabel}>{Math.round(progresoPct)}%</span>
          </div>
        </div>
        {/* Barra de progreso */}
        <div style={styles.progressTrack}>
          <div style={{
            ...styles.progressFill,
            width: `${progresoPct}%`,
            backgroundColor: progressColor,
          }} />
        </div>
        <div style={styles.progressFooter}>
          <span style={styles.progressFooterText}>$0</span>
          <span style={styles.progressFooterText}>Meta: ${targetRetiroUsd.toLocaleString()}</span>
        </div>
      </div>

      {/* Regla de Consistencia */}
      {account.regla_consistencia && (
        <div style={{
          ...styles.consistenciaCard,
          borderColor: consistenciaOk ? 'rgba(10,132,255,0.2)' : 'rgba(255,69,58,0.3)',
          backgroundColor: consistenciaOk ? 'rgba(10,132,255,0.06)' : 'rgba(255,69,58,0.08)',
        }}>
          <div style={styles.consistenciaHeader}>
            {consistenciaOk
              ? <CheckCircle size={18} color="var(--accent-blue)" />
              : <AlertTriangle size={18} color="var(--accent-red)" />
            }
            <span style={{ fontWeight: '600', fontSize: '14px', color: consistenciaOk ? 'var(--accent-blue)' : 'var(--accent-red)' }}>
              Regla de Consistencia {consistenciaOk ? '✓' : '⚠️'}
            </span>
          </div>
          <p style={styles.consistenciaText}>
            {trades.length === 0
              ? 'Sin trades registrados. La regla se evaluará al registrar ganancias.'
              : consistenciaOk
                ? `Tu mejor día representa el ${Math.round(consistenciaPct)}% del total de ganancias ($${bestDayProfit.toFixed(2)}). Dentro del límite del ${limitePct}%.`
                : `⚠️ Tu mejor día representa el ${Math.round(consistenciaPct)}% de tus ganancias totales ($${bestDayProfit.toFixed(2)}). Supera el límite del ${limitePct}%.`
            }
          </p>
          <div style={styles.consistenciaInfo}>
            <Info size={12} color="var(--text-secondary)" />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Mejor día de ganancia ≤ {limitePct}% del total acumulado
            </span>
          </div>
        </div>
      )}

      {/* Historial de trades */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>HISTORIAL DE TRADES</h3>
          <button
            style={styles.registerBtn}
            onClick={() => navigate(`/trades/nuevo?accountId=${account.id}&tipo=fondeada`)}
          >
            + Registrar Trade
          </button>
        </div>

        {trades.length === 0 ? (
          <div style={styles.emptyTrades}>
            <p>Aún no hay trades registrados en esta cuenta.</p>
          </div>
        ) : (
          <div style={styles.tradesList}>
            {trades.map(trade => {
              const isWin = trade.resultado === 'WIN';
              const isLoss = trade.resultado === 'LOSS';
              return (
                <div key={trade.id} style={styles.tradeCard}>
                  <div style={styles.tradeIcon}>
                    {isWin && <TrendingUp size={20} color="var(--accent-green)" />}
                    {isLoss && <TrendingDown size={20} color="var(--accent-red)" />}
                    {!isWin && !isLoss && <Minus size={20} color="#8e8e93" />}
                  </div>
                  <div style={styles.tradeDetails}>
                    <div style={styles.tradeAsset}>{trade.activo}</div>
                    <div style={styles.tradeDate}>
                      {new Date(trade.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{
                    ...styles.tradePnl,
                    color: isWin ? 'var(--accent-green)' : isLoss ? 'var(--accent-red)' : 'var(--text-secondary)'
                  }}>
                    {isWin ? '+' : ''}{trade.pnl_usd === 0 ? 'B.E.' : `$${trade.pnl_usd}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '16px 24px 60px', maxWidth: '800px', margin: '0 auto', overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  iconButton: { backgroundColor: 'transparent', border: 'none', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 },
  topSection: { marginBottom: '20px' },
  brokerBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    color: 'var(--accent-blue)', backgroundColor: 'rgba(10,132,255,0.1)',
    padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
    marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  title: { fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' },
  balanceGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: '1px', backgroundColor: 'var(--border)',
    border: '1px solid var(--border)', borderRadius: '16px',
    overflow: 'hidden', marginBottom: '16px',
  },
  gridLabel: { fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  gridValue: { fontSize: '20px', fontWeight: '700' },
  retiroCard: {
    backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: '16px', padding: '20px', marginBottom: '16px',
    display: 'flex', flexDirection: 'column', gap: '12px',
  },
  retiroHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  retiroLabel: { fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' },
  circleLabel: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' },
  progressTrack: { height: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: '4px', transition: 'width 0.6s ease' },
  progressFooter: { display: 'flex', justifyContent: 'space-between' },
  progressFooterText: { fontSize: '11px', color: 'var(--text-secondary)' },
  consistenciaCard: {
    border: '1px solid', borderRadius: '16px', padding: '16px',
    marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px',
  },
  consistenciaHeader: { display: 'flex', alignItems: 'center', gap: '8px' },
  consistenciaText: { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 },
  consistenciaInfo: { display: 'flex', alignItems: 'center', gap: '5px' },
  section: { marginBottom: '32px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  sectionTitle: { fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', letterSpacing: '0.5px' },
  registerBtn: {
    backgroundColor: 'var(--accent-blue)', border: 'none', color: '#fff',
    fontSize: '14px', fontWeight: '600', cursor: 'pointer', padding: '8px 16px', borderRadius: '12px',
  },
  emptyTrades: {
    backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: '16px', padding: '40px 24px', textAlign: 'center',
    color: 'var(--text-secondary)', fontSize: '14px',
  },
  tradesList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  tradeCard: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: '14px', padding: '14px 16px',
  },
  tradeIcon: {
    width: '38px', height: '38px', borderRadius: '10px',
    backgroundColor: 'var(--bg-tertiary)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', marginRight: '12px',
  },
  tradeDetails: { flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' },
  tradeAsset: { fontSize: '15px', fontWeight: '600' },
  tradeDate: { fontSize: '12px', color: 'var(--text-secondary)' },
  tradePnl: { fontSize: '16px', fontWeight: '700' },
};

// Patch styles que requieren las celdas del grid
const gridCellStyle = { padding: '16px', backgroundColor: 'var(--bg-secondary)' };
