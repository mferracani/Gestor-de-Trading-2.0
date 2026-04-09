import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Archive, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useToast } from '../components/ui/Toast';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

  // ── Consistencia: agrupamos por día ──────────────────────────────────
  const limitePct = account.consistencia_pct || 40;
  const tradesByDay = trades.reduce((acc, t) => {
    const day = (t.fecha || '').slice(0, 10);
    acc[day] = (acc[day] || 0) + (t.pnl_usd || 0);
    return acc;
  }, {});
  const dailyPnls = Object.values(tradesByDay);
  const totalWins = dailyPnls.filter(d => d > 0).reduce((s, d) => s + d, 0);
  const bestDayProfit = dailyPnls.length > 0 ? Math.max(0, ...dailyPnls) : 0;
  const consistenciaPct = totalWins > 0 ? (bestDayProfit / totalWins) * 100 : 0;
  const consistenciaOk = account.regla_consistencia ? consistenciaPct <= limitePct : true;

  // ── Recomendaciones expertas ──────────────────────────────────────────
  // Para que la consistencia sea válida: totalWins necesita ser >= bestDay / (limitePct/100)
  const totalWinsNecesario = bestDayProfit > 0 ? bestDayProfit / (limitePct / 100) : 0;
  const ganarAdicionalNecesario = Math.max(0, totalWinsNecesario - totalWins);

  // Zona segura para el próximo día ganador:
  // Si la consistencia está OK: máximo = totalWins * limitePct/100 * 0.85 (con margen de seguridad)
  // Si está en alerta: cualquier día ganador nuevo no debe superar bestDayProfit y debe aportar al total
  const maxDiaSeguridadFactor = 0.85; // 85% del límite teórico para margen
  const maxProximoDia = consistenciaOk
    ? Math.floor(totalWins * (limitePct / 100) * maxDiaSeguridadFactor)
    : Math.floor(Math.min(bestDayProfit * 0.7, ganarAdicionalNecesario * 0.5)); // no superar el bestDay
  const minProximoDia = Math.max(10, Math.floor(maxProximoDia * 0.3));

  // Días estimados para el objetivo de retiro (con días promedio entre min y max)
  const avgDia = (minProximoDia + maxProximoDia) / 2;
  const diasEstimadosRetiro = avgDia > 0 ? Math.ceil(faltaUsd / avgDia) : null;

  // Escenario de pérdida: peor día entre los negatives o estimado del 0.5% de la cuenta
  const worstDay = dailyPnls.filter(d => d < 0).length > 0
    ? Math.abs(Math.min(...dailyPnls.filter(d => d < 0)))
    : Math.round(inicial * 0.005);
  const pnlTrasPerdida = pnl - worstDay;
  const progresoTrasPerdida = Math.min(100, Math.max(0, (pnlTrasPerdida / targetRetiroUsd) * 100));
  const perdidaRecomendadaMax = Math.round(inicial * 0.005); // max 0.5% del inicial por día

  const winCount = trades.filter(t => t.resultado === 'WIN').length;
  const winRate = trades.length > 0 ? Math.round((winCount / trades.length) * 100) : 0;

  const pnlColor = pnl > 0 ? 'var(--accent-green)' : pnl < 0 ? 'var(--accent-red)' : 'var(--text-secondary)';
  const progressColor = isLogrado ? '#30d158' : 'var(--accent-blue)';
  const fmt = (n) => `$${Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
        <div style={styles.gridCell}>
          <div style={styles.gridLabel}>Balance Inicial</div>
          <div style={styles.gridValue}>${inicial.toLocaleString()}</div>
        </div>
        <div style={styles.gridCell}>
          <div style={styles.gridLabel}>Balance Actual</div>
          <div style={styles.gridValue}>${balance.toLocaleString()}</div>
        </div>
        <div style={styles.gridCell}>
          <div style={styles.gridLabel}>PnL Total</div>
          <div style={{ ...styles.gridValue, color: pnlColor }}>
            {pnl >= 0 ? '+' : ''}${pnl.toLocaleString()}
          </div>
        </div>
        <div style={styles.gridCell}>
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

      {/* ── Panel de Análisis Experto ── */}
      {account.regla_consistencia && trades.length > 0 && (
        <div style={{
          ...styles.guiaCard,
          borderColor: consistenciaOk ? 'rgba(48,209,88,0.25)' : 'rgba(255,159,10,0.3)',
          backgroundColor: consistenciaOk ? 'rgba(48,209,88,0.05)' : 'rgba(255,159,10,0.06)',
        }}>

          {/* Encabezado */}
          <div style={styles.guiaHeader}>
            <div style={styles.guiaHeaderLeft}>
              <span style={{ fontSize: 20 }}>{consistenciaOk ? '🧠' : '⚠️'}</span>
              <div>
                <div style={styles.guiaTitulo}>Análisis de Gestión</div>
                <div style={styles.guiaSubtitulo}>
                  Consistencia {limitePct}% · Mejor día: {fmt(bestDayProfit)} ({Math.round(consistenciaPct)}% del total)
                </div>
              </div>
            </div>
            <div style={{
              ...styles.guiaBadge,
              backgroundColor: consistenciaOk ? 'rgba(48,209,88,0.15)' : 'rgba(255,159,10,0.15)',
              color: consistenciaOk ? '#30d158' : '#ff9f0a',
            }}>
              {consistenciaOk ? 'En regla' : 'Fuera de límite'}
            </div>
          </div>

          <div style={styles.guiaDivider} />

          {/* Bloque 1: Próximo día ganador */}
          <div style={styles.guiaBloque}>
            <div style={styles.guiaIcono}>🎯</div>
            <div>
              <div style={styles.guiaBloqueTitle}>Próximo día ganador recomendado</div>
              {consistenciaOk ? (
                <div style={styles.guiaBloqueText}>
                  Apuntá a ganar entre <strong style={{ color: '#30d158' }}>{fmt(minProximoDia)}</strong> y{' '}
                  <strong style={{ color: '#30d158' }}>{fmt(maxProximoDia)}</strong> en tu próxima sesión.
                  Eso mantiene tu mejor día dentro del límite del {limitePct}%.
                </div>
              ) : (
                <div style={styles.guiaBloqueText}>
                  Tu mejor día ({fmt(bestDayProfit)}) representa el {Math.round(consistenciaPct)}% del total.
                  Necesitás acumular <strong style={{ color: '#ff9f0a' }}>{fmt(ganarAdicionalNecesario)}</strong> más
                  en días distintos. Objetivos seguros: <strong>{fmt(minProximoDia)}–{fmt(maxProximoDia)}</strong> por sesión.
                </div>
              )}
            </div>
          </div>

          {/* Bloque 2: Camino al retiro */}
          <div style={styles.guiaBloque}>
            <div style={styles.guiaIcono}>🏁</div>
            <div>
              <div style={styles.guiaBloqueTitle}>Camino al objetivo de retiro</div>
              <div style={styles.guiaBloqueText}>
                Te faltan <strong style={{ color: '#fff' }}>{fmt(faltaUsd)}</strong> para retirar
                ({fmt(targetRetiroUsd)} · {targetRetiroPct}%) ·{' '}
                {diasEstimadosRetiro
                  ? <>Estimado: <strong style={{ color: '#0af' }}>~{diasEstimadosRetiro} sesiones ganadoras</strong> con días de {fmt(minProximoDia)}–{fmt(maxProximoDia)}.</>
                  : 'No se puede estimar sin un objetivo de ganancia diaria.'}
              </div>
            </div>
          </div>

          {/* Bloque 3: Escenario de pérdida */}
          <div style={styles.guiaBloque}>
            <div style={styles.guiaIcono}>🛡️</div>
            <div>
              <div style={styles.guiaBloqueTitle}>Si el próximo trade es una pérdida</div>
              <div style={styles.guiaBloqueText}>
                Pérdida diaria máxima recomendada: <strong style={{ color: '#ff453a' }}>{fmt(perdidaRecomendadaMax)}</strong> (0.5% del cuenta).
                Una pérdida similar a tus peores días ({fmt(worstDay)}) dejaría tu PnL en{' '}
                <strong style={{ color: pnlTrasPerdida >= 0 ? '#30d158' : '#ff453a' }}>
                  {pnlTrasPerdida >= 0 ? '+' : '-'}{fmt(pnlTrasPerdida)}
                </strong>{' '}y tu progreso en {Math.round(progresoTrasPerdida)}%.
              </div>
            </div>
          </div>

          {/* Bloque 4: Estado de consistencia detallado */}
          {!consistenciaOk && (
            <div style={{ ...styles.guiaBloque, alignItems: 'flex-start' }}>
              <div style={styles.guiaIcono}>📊</div>
              <div>
                <div style={styles.guiaBloqueTitle}>Para regularizar la consistencia</div>
                <div style={styles.guiaBloqueText}>
                  Con tu mejor día en {fmt(bestDayProfit)}, el total de ganancias debe llegar a al menos{' '}
                  <strong style={{ color: '#ff9f0a' }}>{fmt(totalWinsNecesario)}</strong>.
                  Actualmente estás en <strong>{fmt(totalWins)}</strong>. Necesitás{' '}
                  <strong style={{ color: '#ff9f0a' }}>{fmt(ganarAdicionalNecesario)}</strong> más,
                  distribuidos en múltiples sesiones sin superar {fmt(bestDayProfit)} en ningún día.
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Placeholder si aún no hay trades */}
      {account.regla_consistencia && trades.length === 0 && (
        <div style={{ ...styles.guiaCard, borderColor: 'var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🧠</span>
            <div>
              <div style={styles.guiaTitulo}>Análisis de Gestión</div>
              <div style={styles.guiaBloqueText}>Registrá tu primer trade para ver las recomendaciones personalizadas.</div>
            </div>
          </div>
        </div>
      )}

      {/* Curva de Equity */}
      {trades.length >= 2 && (() => {
        const sorted = [...trades].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
        const equityData = sorted.reduce((acc, t) => {
          const prev = acc.length > 0 ? acc[acc.length - 1].pnl : 0;
          const cumPnl = prev + (t.pnl_usd || 0);
          const d = new Date(t.fecha);
          const label = `${d.getDate()}/${d.getMonth() + 1}`;
          return [...acc, { label, pnl: Number(cumPnl.toFixed(2)) }];
        }, []);
        const finalPnl = equityData[equityData.length - 1]?.pnl || 0;
        const lineColor = finalPnl >= 0 ? '#30d158' : '#ff453a';
        return (
          <div style={styles.equityCard}>
            <h3 style={styles.sectionTitle}>CURVA DE EQUITY</h3>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={equityData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="eqGradFunded" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={lineColor} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: '#636366', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#636366', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: '#ebebf5' }}
                  formatter={(v) => [`$${v}`, 'PnL acum.']}
                />
                <Area type="monotone" dataKey="pnl" stroke={lineColor} strokeWidth={2} fill="url(#eqGradFunded)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );
      })()}

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
              const pnl = trade.pnl_usd || 0;
              const fecha = trade.fecha
                ? new Date(trade.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                : '—';
              return (
                <div key={trade.id} style={styles.tradeCard}>
                  <div style={{
                    ...styles.tradeIcon,
                    backgroundColor: isWin ? 'rgba(48,209,88,0.12)' : isLoss ? 'rgba(255,69,58,0.12)' : 'rgba(255,255,255,0.05)'
                  }}>
                    {isWin && <TrendingUp size={18} color="#30d158" />}
                    {isLoss && <TrendingDown size={18} color="#ff453a" />}
                    {!isWin && !isLoss && <Minus size={18} color="var(--text-muted)" />}
                  </div>
                  <div style={styles.tradeInfo}>
                    <div style={styles.tradeAsset}>{trade.activo}</div>
                    <div style={styles.tradeMeta}>
                      <span style={styles.accountTag}>{account.nombre}</span>
                      <span style={{ color: 'var(--text-muted)' }}>·</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{fecha}</span>
                    </div>
                  </div>
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
  gridCell: { padding: '16px 18px', backgroundColor: 'var(--bg-secondary)' },
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
  tradeCard: { display: 'flex', alignItems: 'center', gap: '14px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '14px 16px' },
  tradeIcon: { width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tradeInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' },
  tradeAsset: { fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' },
  tradeMeta: { display: 'flex', alignItems: 'center', gap: '6px' },
  accountTag: { fontSize: '12px', color: 'var(--accent-blue)', fontWeight: '500', backgroundColor: 'rgba(10,132,255,0.1)', padding: '2px 8px', borderRadius: '6px' },
  tradePnl: { fontSize: '16px', fontWeight: '700', flexShrink: 0 },

  // ── Expert guide panel ──────────────────────────────────
  guiaCard: {
    border: '1px solid', borderRadius: '18px', padding: '18px 20px',
    marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '14px',
  },
  guiaHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' },
  guiaHeaderLeft: { display: 'flex', alignItems: 'flex-start', gap: '10px' },
  guiaTitulo: { fontSize: '15px', fontWeight: '700', marginBottom: '2px' },
  guiaSubtitulo: { fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' },
  guiaBadge: {
    fontSize: '11px', fontWeight: '700', padding: '4px 10px',
    borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0,
    textTransform: 'uppercase', letterSpacing: '0.4px',
  },
  guiaDivider: { height: '1px', backgroundColor: 'rgba(255,255,255,0.06)', margin: '0 -4px' },
  guiaBloque: { display: 'flex', alignItems: 'flex-start', gap: '10px' },
  guiaIcono: { fontSize: '18px', flexShrink: 0, marginTop: '1px' },
  guiaBloqueTitle: { fontSize: '13px', fontWeight: '600', marginBottom: '4px' },
  guiaBloqueText: { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.55' },
};

