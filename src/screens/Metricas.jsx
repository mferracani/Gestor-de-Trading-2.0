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

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const userId = 'user_test_123';
        const q = query(collection(db, 'trades'), where('user_id', '==', userId));
        const snap = await getDocs(q);
        const all = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
        setTrades(all);
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
};
