import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';

export default function Metricas() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  const [accountsMap, setAccountsMap] = useState({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const userId = 'user_test_123';

        // Cargar trades
        const q = query(collection(db, 'trades'), where('user_id', '==', userId));
        const snap = await getDocs(q);
        const all = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
        setTrades(all);

        // Cargar cuentas (challenges + fondeadas) para mapear balance_inicial_usd
        const accMap = {};
        const qAcc = query(collection(db, 'accounts'), where('user_id', '==', userId));
        const accSnap = await getDocs(qAcc);
        accSnap.docs.forEach(d => {
          const data = d.data();
          accMap[d.id] = data.balance_inicial_usd || 10000;
        });
        const qFunded = query(collection(db, 'funded_accounts'), where('user_id', '==', userId));
        const fundedSnap = await getDocs(qFunded);
        fundedSnap.docs.forEach(d => {
          const data = d.data();
          accMap[d.id] = data.balance_inicial_usd || 10000;
        });
        setAccountsMap(accMap);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', marginTop: 40 }}>Calculando métricas...</div>;
  }

  if (trades.length === 0) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Métricas</h1>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 60, fontSize: 14 }}>
          Aún no hay trades registrados para analizar.
        </div>
      </div>
    );
  }

  // ── Cálculos ──────────────────────────────────────────────────────────────

  // 1. Curva de equity acumulada
  const equityCurve = trades.reduce((acc, t) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].pnl : 0;
    const cumPnl = prev + (t.pnl_usd || 0);
    const d = new Date(t.fecha);
    const label = `${d.getDate()}/${d.getMonth() + 1}`;
    return [...acc, { label, pnl: cumPnl, trade_pnl: t.pnl_usd || 0 }];
  }, []);

  // 2. Estadísticas generales
  const totalTrades = trades.length;
  const wins = trades.filter(t => t.resultado === 'WIN');
  const losses = trades.filter(t => t.resultado === 'LOSS');
  const be = trades.filter(t => t.resultado === 'BE' || t.resultado === 'B.E.');
  const winRate = Math.round((wins.length / totalTrades) * 100);
  const totalPnl = trades.reduce((acc, t) => acc + (t.pnl_usd || 0), 0);
  const avgWin = wins.length > 0 ? wins.reduce((a, t) => a + t.pnl_usd, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, t) => a + t.pnl_usd, 0) / losses.length : 0;
  const expectancy = (winRate / 100) * avgWin + ((100 - winRate) / 100) * avgLoss;

  // Max drawdown
  let peak = 0; let maxDD = 0; let running = 0;
  for (const t of trades) {
    running += t.pnl_usd || 0;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
  }

  // 5. Win vs Loss Analysis — Promedios en % del balance de cada cuenta
  const getTradeBalancePct = (t) => {
    const bal = accountsMap[t.account_id] || 10000;
    return ((t.pnl_usd || 0) / bal) * 100;
  };

  const avgWinPct = wins.length > 0 ? wins.reduce((a, t) => a + getTradeBalancePct(t), 0) / wins.length : 0;
  const avgLossPct = losses.length > 0 ? losses.reduce((a, t) => a + getTradeBalancePct(t), 0) / losses.length : 0;
  const absAvgWinPct = Math.abs(avgWinPct);
  const absAvgLossPct = Math.abs(avgLossPct);
  const rrRatio = absAvgLossPct > 0 ? absAvgWinPct / absAvgLossPct : 0;
  const maxBarValue = Math.max(absAvgWinPct, absAvgLossPct, 0.01);
  const winBarPct = (absAvgWinPct / maxBarValue) * 100;
  const lossBarPct = (absAvgLossPct / maxBarValue) * 100;

  // Últimos N trades para tendencia reciente (también en %)
  const recentN = 10;
  const recentTrades = trades.slice(-recentN);
  const recentWins = recentTrades.filter(t => t.resultado === 'WIN');
  const recentLosses = recentTrades.filter(t => t.resultado === 'LOSS');
  const recentAvgWinPct = recentWins.length > 0 ? recentWins.reduce((a, t) => a + getTradeBalancePct(t), 0) / recentWins.length : 0;
  const recentAvgLossPct = recentLosses.length > 0 ? recentLosses.reduce((a, t) => a + getTradeBalancePct(t), 0) / recentLosses.length : 0;
  const recentRR = Math.abs(recentAvgLossPct) > 0 ? Math.abs(recentAvgWinPct) / Math.abs(recentAvgLossPct) : 0;

  // Recomendaciones inteligentes
  const getWinLossRecommendations = () => {
    const recs = [];
    if (wins.length === 0 || losses.length === 0) {
      return [{ icon: '📊', text: 'Necesitás al menos un trade ganador y uno perdedor para generar un análisis completo.' }];
    }
    // Patrón principal: ¿ganancias promedio más chicas que pérdidas promedio? (en %)
    if (rrRatio < 0.8) {
      recs.push({
        icon: '🚨',
        title: 'Estás cortando los trades ganadores demasiado rápido',
        text: `En promedio ganás ${absAvgWinPct.toFixed(2)}% pero perdés ${absAvgLossPct.toFixed(2)}% del balance por trade. Estás arriesgando más de lo que dejás correr. Para ser rentable con un Win Rate de ${winRate}%, necesitás un R:R de al menos 1:1.`,
        severity: 'danger'
      });
    } else if (rrRatio < 1.0) {
      recs.push({
        icon: '⚠️',
        title: 'Tu ganancia promedio es menor que tu pérdida promedio',
        text: `Ganás ${absAvgWinPct.toFixed(2)}% vs perdés ${absAvgLossPct.toFixed(2)}% del balance. Estás cerca del 1:1 pero todavía a favor de las pérdidas. Intentá mover tu TP un poco más lejos o tu SL un poco más cerca.`,
        severity: 'warning'
      });
    } else if (rrRatio >= 1.5) {
      recs.push({
        icon: '🏆',
        title: 'Excelente gestión de riesgo',
        text: `Tu ganancia promedio (${absAvgWinPct.toFixed(2)}%) es ${rrRatio.toFixed(1)}x tu pérdida promedio (${absAvgLossPct.toFixed(2)}%). Seguí manteniendo este ratio.`,
        severity: 'success'
      });
    } else {
      recs.push({
        icon: '✅',
        title: 'Ratio Win/Loss aceptable',
        text: `Ganás ${absAvgWinPct.toFixed(2)}% vs perdés ${absAvgLossPct.toFixed(2)}% — ratio ${rrRatio.toFixed(2)}:1. Buen punto de partida, pero si podés llevar el R:R a 1.5:1 o más, tu cuenta va a crecer más rápido.`,
        severity: 'ok'
      });
    }
    // Tendencia reciente
    if (recentWins.length > 0 && recentLosses.length > 0) {
      const trendBetter = recentRR > rrRatio;
      const trendWorse = recentRR < rrRatio * 0.7;
      if (trendWorse) {
        recs.push({
          icon: '📉',
          title: 'Tu R:R está empeorando',
          text: `En tus últimos ${recentN} trades el ratio bajó a ${recentRR.toFixed(2)}:1 (general: ${rrRatio.toFixed(2)}:1). Revisá si estás moviendo el SL o cerrando antes del TP.`,
          severity: 'warning'
        });
      } else if (trendBetter) {
        recs.push({
          icon: '📈',
          title: 'Tu R:R está mejorando',
          text: `Últimos ${recentN} trades: ${recentRR.toFixed(2)}:1 vs general ${rrRatio.toFixed(2)}:1. Buen progreso, seguí así.`,
          severity: 'success'
        });
      }
    }
    // Dato clave: si la pérdida promedio % es mucho mayor que la ganancia promedio %
    if (absAvgLossPct > absAvgWinPct * 2 && absAvgWinPct > 0) {
      recs.push({
        icon: '💡',
        title: 'Tus pérdidas promedio duplican a tus ganancias',
        text: `Perdés en promedio ${absAvgLossPct.toFixed(2)}% del balance vs ganás ${absAvgWinPct.toFixed(2)}%. Aunque tengas buen Win Rate, pocas pérdidas grandes pueden borrar muchas ganancias chicas. Considerá un stop loss máximo fijo.`,
        severity: 'danger'
      });
    }
    return recs;
  };
  const winLossRecs = getWinLossRecommendations();

  // 3. Distribución por resultado para BarChart
  const distribution = [
    { label: 'WIN', count: wins.length, color: '#30d158' },
    { label: 'LOSS', count: losses.length, color: '#ff453a' },
    { label: 'B.E.', count: be.length, color: '#636366' },
  ];

  // 4. PnL por activo
  const byAsset = {};
  for (const t of trades) {
    const key = t.activo || 'OTHER';
    if (!byAsset[key]) byAsset[key] = 0;
    byAsset[key] += t.pnl_usd || 0;
  }
  const assetData = Object.entries(byAsset)
    .map(([asset, pnl]) => ({ asset, pnl }))
    .sort((a, b) => b.pnl - a.pnl);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Métricas</h1>
        <span style={styles.subtitle}>{totalTrades} operaciones registradas</span>
      </header>

      {/* KPIs */}
      <div style={styles.kpiGrid}>
        <KPI label="PnL Total" value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString()}`} color={totalPnl >= 0 ? '#30d158' : '#ff453a'} />
        <KPI label="Win Rate" value={`${winRate}%`} color={winRate >= 50 ? '#30d158' : '#ff9f0a'} />
        <KPI label="Expectancy" value={`${expectancy >= 0 ? '+' : ''}$${expectancy.toFixed(0)}`} color={expectancy >= 0 ? '#30d158' : '#ff453a'} />
        <KPI label="Max Drawdown" value={`-$${maxDD.toFixed(0)}`} color="#ff453a" />
        <KPI label="Avg. Win" value={`+$${avgWin.toFixed(0)}`} color="#30d158" />
        <KPI label="Avg. Loss" value={`$${avgLoss.toFixed(0)}`} color="#ff453a" />
      </div>

      {/* ── Panel Win vs Loss ── */}
      {(wins.length > 0 || losses.length > 0) && (
        <div style={{
          ...styles.chartCard,
          border: rrRatio < 0.8 ? '1px solid rgba(255,69,58,0.3)' : rrRatio < 1 ? '1px solid rgba(255,159,10,0.25)' : '1px solid rgba(48,209,88,0.2)',
          backgroundColor: rrRatio < 0.8 ? 'rgba(255,69,58,0.04)' : rrRatio < 1 ? 'rgba(255,159,10,0.04)' : 'var(--bg-secondary)',
        }}>
          <div style={styles.wlHeader}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '3px' }}>Ganancia vs Pérdida Promedio</h3>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Ratio R:R actual: <strong style={{ color: rrRatio >= 1 ? '#30d158' : '#ff453a' }}>{rrRatio.toFixed(2)}:1</strong>
                {' · '}{totalTrades} trades analizados
              </span>
            </div>
            <div style={{
              ...styles.wlBadge,
              backgroundColor: rrRatio >= 1.5 ? 'rgba(48,209,88,0.15)' : rrRatio >= 1 ? 'rgba(48,209,88,0.1)' : rrRatio >= 0.8 ? 'rgba(255,159,10,0.15)' : 'rgba(255,69,58,0.15)',
              color: rrRatio >= 1 ? '#30d158' : rrRatio >= 0.8 ? '#ff9f0a' : '#ff453a',
            }}>
              {rrRatio >= 1.5 ? 'Excelente' : rrRatio >= 1 ? 'Aceptable' : rrRatio >= 0.8 ? 'Mejorable' : 'Crítico'}
            </div>
          </div>

          {/* Barras comparativas — promedios en % */}
          <div style={styles.wlBarsWrap}>
            <div style={styles.wlBarRow}>
              <span style={styles.wlBarLabel}>Avg. Win</span>
              <div style={styles.wlBarTrack}>
                <div style={{ ...styles.wlBarFill, width: `${winBarPct}%`, backgroundColor: '#30d158' }} />
              </div>
              <span style={{ ...styles.wlBarValue, color: '#30d158' }}>+{absAvgWinPct.toFixed(2)}%</span>
            </div>
            <div style={styles.wlBarRow}>
              <span style={styles.wlBarLabel}>Avg. Loss</span>
              <div style={styles.wlBarTrack}>
                <div style={{ ...styles.wlBarFill, width: `${lossBarPct}%`, backgroundColor: '#ff453a' }} />
              </div>
              <span style={{ ...styles.wlBarValue, color: '#ff453a' }}>-{absAvgLossPct.toFixed(2)}%</span>
            </div>
          </div>

          {/* KPIs inline — promedios % y R:R reciente */}
          <div style={styles.wlKpiRow}>
            <div style={styles.wlKpiItem}>
              <span style={styles.wlKpiLabel}>Prom. ganancia</span>
              <span style={{ ...styles.wlKpiValue, color: '#30d158' }}>+{absAvgWinPct.toFixed(2)}%</span>
            </div>
            <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.08)', alignSelf: 'stretch' }} />
            <div style={styles.wlKpiItem}>
              <span style={styles.wlKpiLabel}>Prom. pérdida</span>
              <span style={{ ...styles.wlKpiValue, color: '#ff453a' }}>-{absAvgLossPct.toFixed(2)}%</span>
            </div>
            <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.08)', alignSelf: 'stretch' }} />
            <div style={styles.wlKpiItem}>
              <span style={styles.wlKpiLabel}>R:R reciente ({recentN})</span>
              <span style={{ ...styles.wlKpiValue, color: recentRR >= 1 ? '#30d158' : '#ff9f0a' }}>
                {recentWins.length > 0 && recentLosses.length > 0 ? `${recentRR.toFixed(2)}:1` : '—'}
              </span>
            </div>
          </div>

          {/* Recomendaciones */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {winLossRecs.map((rec, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '12px 14px', borderRadius: '12px',
                backgroundColor: rec.severity === 'danger' ? 'rgba(255,69,58,0.08)' : rec.severity === 'warning' ? 'rgba(255,159,10,0.08)' : rec.severity === 'success' ? 'rgba(48,209,88,0.06)' : 'rgba(255,255,255,0.03)',
              }}>
                <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>{rec.icon}</span>
                <div>
                  {rec.title && <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '3px' }}>{rec.title}</div>}
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{rec.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Equity Curve */}
      <div style={styles.chartCard}>
        <h3 style={styles.chartTitle}>Curva de Equity</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={equityCurve} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={totalPnl >= 0 ? '#30d158' : '#ff453a'} stopOpacity={0.3} />
                <stop offset="95%" stopColor={totalPnl >= 0 ? '#30d158' : '#ff453a'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={{ fill: '#636366', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#636366', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 12, fontSize: 13 }}
              labelStyle={{ color: '#ebebf5' }}
              formatter={(v) => [`$${v}`, 'PnL acum.']}
            />
            <Area
              type="monotone"
              dataKey="pnl"
              stroke={totalPnl >= 0 ? '#30d158' : '#ff453a'}
              strokeWidth={2}
              fill="url(#equityGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Distribución + PnL por activo */}
      <div style={styles.twoCol}>
        {/* Distribución WIN / LOSS / BE */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Distribución</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={distribution} margin={{ top: 8, right: 8, left: -30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#636366', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#636366', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 12, fontSize: 13 }}
                formatter={(v) => [v, 'Trades']}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {distribution.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* PnL por activo */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>PnL por Activo</h3>
          <div style={styles.assetList}>
            {assetData.map(a => (
              <div key={a.asset} style={styles.assetRow}>
                <span style={styles.assetName}>{a.asset}</span>
                <div style={styles.assetBarWrap}>
                  <div style={{
                    height: '4px',
                    borderRadius: '4px',
                    backgroundColor: a.pnl >= 0 ? '#30d158' : '#ff453a',
                    width: `${Math.min(100, (Math.abs(a.pnl) / Math.max(...assetData.map(x => Math.abs(x.pnl)))) * 100)}%`,
                    minWidth: '4px',
                  }} />
                </div>
                <span style={{ ...styles.assetPnl, color: a.pnl >= 0 ? '#30d158' : '#ff453a' }}>
                  {a.pnl >= 0 ? '+' : ''}${a.pnl.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, color }) {
  return (
    <div style={styles.kpiCard}>
      <div style={styles.kpiLabel}>{label}</div>
      <div style={{ ...styles.kpiValue, color }}>{value}</div>
    </div>
  );
}

const styles = {
  container: { padding: '24px 24px 40px', maxWidth: '800px', margin: '0 auto' },
  header: { marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px' },
  subtitle: { fontSize: '13px', color: 'var(--text-muted)' },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
    marginBottom: '16px',
  },
  kpiCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '14px 16px',
  },
  kpiLabel: { fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500', marginBottom: '4px' },
  kpiValue: { fontSize: '22px', fontWeight: '700' },
  chartCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    padding: '20px',
    marginBottom: '12px',
  },
  chartTitle: { fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  assetList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  assetRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  assetName: { fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', width: '70px', flexShrink: 0 },
  assetBarWrap: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', height: '4px' },
  assetPnl: { fontSize: '13px', fontWeight: '600', flexShrink: 0, width: '60px', textAlign: 'right' },
  // Win vs Loss panel
  wlHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '18px' },
  wlBadge: { fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.4px' },
  wlBarsWrap: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' },
  wlBarRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  wlBarLabel: { fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500', width: '64px', flexShrink: 0 },
  wlBarTrack: { flex: 1, height: '10px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' },
  wlBarFill: { height: '100%', borderRadius: '6px', transition: 'width 0.5s ease' },
  wlBarValue: { fontSize: '15px', fontWeight: '700', width: '76px', textAlign: 'right', flexShrink: 0 },
  wlKpiRow: { display: 'flex', gap: '0', marginBottom: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '12px 0' },
  wlKpiItem: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
  wlKpiLabel: { fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' },
  wlKpiValue: { fontSize: '16px', fontWeight: '700' },
};
