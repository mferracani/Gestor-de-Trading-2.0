import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Archive, TrendingUp, TrendingDown, Minus, Edit3, Trash2, X, Check } from 'lucide-react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useToast } from '../components/ui/Toast';
import { useTradingStore } from '../store/useTradingStore';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { buildTradeFinancials, getCommissionPerSide, getTradeNetPnl, inferCommissionProfile } from '../lib/tradeMath';

export default function FundedAccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const addToast = useToast();

  const [account, setAccount] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStopPanel, setShowStopPanel] = useState(false);
  const [fechaCobro, setFechaCobro] = useState('');
  const [montoCobrado, setMontoCobrado] = useState('');
  const [savingStop, setSavingStop] = useState(false);
  const [savingCiclo, setSavingCiclo] = useState(false);
  const [showBalanceAdjust, setShowBalanceAdjust] = useState(false);
  const [adjustedBalance, setAdjustedBalance] = useState('');
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [savingAdjustment, setSavingAdjustment] = useState(false);
  const [showCommissionSettings, setShowCommissionSettings] = useState(false);
  const [commissionProfile, setCommissionProfile] = useState('alpha_raw');
  const [commissionPerSide, setCommissionPerSide] = useState('2.5');
  const [savingCommissionConfig, setSavingCommissionConfig] = useState(false);
  const [tradeEditOpen, setTradeEditOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [tradeEditForm, setTradeEditForm] = useState({
    activo: 'EURUSD',
    resultado: 'WIN',
    lotes: '',
    gross_pnl_usd: '',
    comision_usd: '',
    swap_usd: '',
    notas: '',
  });
  const [savingTrade, setSavingTrade] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const docRef = doc(db, 'funded_accounts', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const nextAccount = { id: docSnap.id, ...docSnap.data() };
        setAccount(nextAccount);
        setCommissionProfile(inferCommissionProfile(nextAccount));
        setCommissionPerSide(String(getCommissionPerSide(nextAccount) || 2.5));
      }

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
  }, [id]);

  useEffect(() => { load(); }, [load]);

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

  const handleStopParaRetiro = async () => {
    setSavingStop(true);
    try {
      const montoNum = montoCobrado === '' ? null : Number(montoCobrado);
      await useTradingStore.getState().stopParaRetiro(account.id, {
        fechaCobro: fechaCobro || null,
        montoCobrado: montoNum,
      });
      setAccount(prev => ({
        ...prev,
        en_retiro: true,
        fecha_cobro: fechaCobro || null,
        monto_cobrado_usd: montoNum,
      }));
      setShowStopPanel(false);
      setFechaCobro('');
      setMontoCobrado('');
      addToast('Retiro iniciado correctamente.', 'success');
    } catch (err) {
      addToast(err.message || 'Error al iniciar retiro.', 'error');
    }
    setSavingStop(false);
  };

  const handleIniciarNuevoCiclo = async () => {
    if (!window.confirm('¿Iniciar nuevo ciclo? El PnL y balance se resetearán.')) return;
    setSavingCiclo(true);
    try {
      await useTradingStore.getState().iniciarNuevoCiclo(account.id);
      await load();
      addToast('Nuevo ciclo iniciado. ¡A operar!', 'success');
    } catch (err) {
      addToast(err.message || 'Error al iniciar ciclo.', 'error');
    }
    setSavingCiclo(false);
  };

  const handleBalanceAdjust = async () => {
    const nextBalance = Number(adjustedBalance);
    if (!Number.isFinite(nextBalance) || nextBalance <= 0) {
      addToast('Ingresá un balance válido.', 'warning');
      return;
    }

    setSavingAdjustment(true);
    try {
      const newPnl = nextBalance - inicial;
      const adjustment = {
        fecha: new Date().toISOString(),
        balance_anterior_usd: balance,
        balance_nuevo_usd: nextBalance,
        diferencia_usd: nextBalance - balance,
        nota: adjustmentNote.trim() || null,
      };

      await updateDoc(doc(db, 'funded_accounts', account.id), {
        balance_actual_usd: nextBalance,
        pnl_acumulado_usd: newPnl,
        historial_ajustes_balance: arrayUnion(adjustment),
      });

      setAccount(prev => ({ ...prev, balance_actual_usd: nextBalance, pnl_acumulado_usd: newPnl }));
      setShowBalanceAdjust(false);
      setAdjustmentNote('');
      addToast('Balance ajustado correctamente.', 'success');
    } catch (err) {
      console.error('Error ajustando balance:', err);
      addToast('No pude ajustar el balance.', 'error');
    }
    setSavingAdjustment(false);
  };

  const handleSaveCommissionConfig = async () => {
    setSavingCommissionConfig(true);
    try {
      const payload = {
        commission_profile: commissionProfile,
        commission_per_side_usd: commissionProfile === 'custom_per_lot'
          ? (Number(commissionPerSide) || 0)
          : (commissionProfile === 'alpha_raw' ? 2.5 : 0),
      };

      await updateDoc(doc(db, 'funded_accounts', account.id), payload);
      setAccount(prev => ({ ...prev, ...payload }));
      setShowCommissionSettings(false);
      addToast('Configuración de comisiones actualizada.', 'success');
    } catch (err) {
      console.error('Error guardando configuración de comisiones:', err);
      addToast('No pude guardar la configuración.', 'error');
    }
    setSavingCommissionConfig(false);
  };

  const openTradeEdit = (trade) => {
    const financials = buildTradeFinancials(trade, account);
    setEditingTrade(trade);
    setTradeEditForm({
      activo: trade.activo || 'EURUSD',
      resultado: trade.resultado || 'WIN',
      lotes: trade.lotes == null ? '' : String(trade.lotes),
      gross_pnl_usd: String(Math.abs(financials.grossPnl)),
      comision_usd: trade.comision_usd == null ? '' : String(Math.abs(Number(trade.comision_usd))),
      swap_usd: trade.swap_usd == null ? '' : String(Number(trade.swap_usd)),
      notas: trade.notas || '',
    });
    setTradeEditOpen(true);
  };

  const handleSaveTradeEdit = async () => {
    if (!editingTrade) return;
    setSavingTrade(true);
    try {
      const grossRaw = Number(tradeEditForm.gross_pnl_usd || 0);
      const normalizedGross = tradeEditForm.resultado === 'LOSS'
        ? -Math.abs(grossRaw)
        : tradeEditForm.resultado === 'BE'
          ? 0
          : Math.abs(grossRaw);

      await useTradingStore.getState().updateTrade(editingTrade.id, {
        activo: tradeEditForm.activo,
        resultado: tradeEditForm.resultado,
        lotes: tradeEditForm.lotes === '' ? null : Number(tradeEditForm.lotes),
        gross_pnl_usd: normalizedGross,
        comision_usd: tradeEditForm.comision_usd === '' ? null : Number(tradeEditForm.comision_usd),
        swap_usd: tradeEditForm.swap_usd === '' ? null : Number(tradeEditForm.swap_usd),
        notas: tradeEditForm.notas,
      });

      addToast('Trade actualizado correctamente.', 'success');
      setTradeEditOpen(false);
      setEditingTrade(null);
      await load();
    } catch (err) {
      console.error('Error actualizando trade fondeado:', err);
      addToast('Error al actualizar trade.', 'error');
    }
    setSavingTrade(false);
  };

  const handleDeleteTrade = async (trade) => {
    if (!window.confirm(`¿Eliminar trade de ${trade.activo || 'activo'}?`)) return;
    try {
      await useTradingStore.getState().deleteTrade(trade.id);
      addToast('Trade eliminado.', 'success');
      await load();
    } catch (err) {
      console.error('Error eliminando trade:', err);
      addToast('Error al eliminar trade.', 'error');
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

  const enRetiro = account.en_retiro === true;
  const cicloActual = account.ciclo_actual ?? 1;
  const historialCiclos = account.historial_ciclos ?? [];
  const diasParaCobro = (() => {
    if (!account.fecha_cobro) return null;
    const cobro = new Date(account.fecha_cobro);
    const hoy = new Date();
    cobro.setHours(0, 0, 0, 0); hoy.setHours(0, 0, 0, 0);
    return Math.round((cobro - hoy) / (1000 * 60 * 60 * 24));
  })();
  // Si no hay fecha de cobro cargada, permitimos cobrar manualmente en cualquier momento.
  // Si hay fecha, se habilita cuando ya llegó (diasParaCobro <= 0).
  const puedeCobrar = !account.fecha_cobro || (diasParaCobro !== null && diasParaCobro <= 0);

  // ── Consistencia: agrupamos por día ──────────────────────────────────
  // Fórmula real de prop firms (Alpha Capital, FTMO, etc.):
  // Consistencia = Best Day Profit / PnL neto total
  // NO usar solo días positivos — los días negativos reducen el denominador y empeoran la consistencia
  const limitePct = account.consistencia_pct || 40;
  const tradesByDay = trades.reduce((acc, t) => {
    const day = (t.fecha || '').slice(0, 10);
    acc[day] = (acc[day] || 0) + getTradeNetPnl(t);
    return acc;
  }, {});
  const dailyPnls = Object.values(tradesByDay);
  const totalWins = dailyPnls.filter(d => d > 0).reduce((s, d) => s + d, 0); // solo para display
  const bestDayProfit = dailyPnls.length > 0 ? Math.max(0, ...dailyPnls) : 0;
  // Denominador = PnL neto (igual que lo calcula la prop firm)
  const consistenciaPct = pnl > 0 ? (bestDayProfit / pnl) * 100 : 0;
  const consistenciaOk = account.regla_consistencia ? consistenciaPct <= limitePct : true;

  // ── Recomendaciones expertas ──────────────────────────────────────────
  // Profit neto total necesario para que bestDay quede dentro del límite:
  const profitNecesarioConsistencia = bestDayProfit > 0 ? bestDayProfit / (limitePct / 100) : 0;
  const ganarAdicionalNecesario = Math.max(0, profitNecesarioConsistencia - pnl);

  // Zona segura para el próximo día ganador (sobre PnL neto, con 85% de margen)
  const maxDiaSeguridadFactor = 0.85;
  const maxProximoDia = consistenciaOk
    ? Math.floor(pnl * (limitePct / 100) * maxDiaSeguridadFactor)
    : Math.floor(Math.min(bestDayProfit * 0.7, ganarAdicionalNecesario * 0.5));
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

  // ── Risk Manager ───────────────────────────────────────────────────────
  const profitRequeridoConsistencia = profitNecesarioConsistencia; // = bestDay / (limitePct/100)
  const gapConsistencia = ganarAdicionalNecesario;
  const payoutHabilitado = isLogrado && consistenciaOk;

  // Escenarios dinámicos basados en la situación real
  const pnlBuffer = Math.max(0, pnl - targetRetiroUsd); // margen antes de perder el profit target

  const calcScenario = (amount) => {
    const newPnl = pnl + amount;
    const newBestDay = amount > 0 ? Math.max(bestDayProfit, amount) : bestDayProfit;
    const newConsistenciaPct = newPnl > 0 ? (newBestDay / newPnl) * 100 : 0;
    const newConsistenciaOk = newConsistenciaPct <= limitePct;
    const newIsLogrado = newPnl >= targetRetiroUsd && newPnl > 0;
    return { amount, newPnl, newConsistenciaPct, newConsistenciaOk, newIsLogrado, newPayoutOk: newIsLogrado && newConsistenciaOk };
  };

  // Ganancias: pasos progresivos hacia el payout
  const step1 = Math.max(10, Math.round(gapConsistencia * 0.25));
  const step2 = Math.round(gapConsistencia * 0.55);
  const step3 = Math.ceil(gapConsistencia); // monto exacto que desbloquea el payout
  const gainsScenarios = [
    { label: 'Pequeño avance', sublabel: 'Empieza a mover la aguja', ...calcScenario(step1) },
    { label: 'Avance sólido', sublabel: `${Math.round((step2 / gapConsistencia) * 100)}% del gap`, ...calcScenario(step2) },
    { label: 'Desbloquea payout', sublabel: 'Consistencia llega al límite', ...calcScenario(step3), highlight: true },
    ...(bestDayProfit > step3 * 1.25
      ? [{ label: 'Zona extra segura', sublabel: `Margen antes del best day`, ...calcScenario(Math.floor(bestDayProfit * 0.88)) }]
      : []),
  ];

  // Pérdidas: cuánto podés perder y sus consecuencias
  const lossScenarios = (() => {
    const rows = [];
    const smallLoss = Math.round(Math.min(pnlBuffer * 0.45, perdidaRecomendadaMax * 0.6));
    if (smallLoss > 0 && pnlBuffer > 0) {
      rows.push({ label: 'Pérdida tolerable', sublabel: 'Retroceso, target intacto', ...calcScenario(-smallLoss) });
    }
    if (pnlBuffer > 0) {
      rows.push({ label: 'Pierde profit target', sublabel: `Más de $${pnlBuffer.toFixed(0)} te saca del target`, ...calcScenario(-(Math.floor(pnlBuffer) + 1)), critical: true });
    }
    rows.push({ label: `Límite diario (0.5%)`, sublabel: 'Máximo recomendado por sesión', ...calcScenario(-perdidaRecomendadaMax) });
    // Deduplicar si montos muy cercanos
    return rows.filter((r, i, arr) => arr.findIndex(o => Math.abs(o.amount - r.amount) < 3) === i).sort((a, b) => b.amount - a.amount);
  })();

  const winCount = trades.filter(t => t.resultado === 'WIN').length;
  const winRate = trades.length > 0 ? Math.round((winCount / trades.length) * 100) : 0;

  const pnlColor = pnl > 0 ? 'var(--accent-green)' : pnl < 0 ? 'var(--accent-red)' : 'var(--text-secondary)';
  const progressColor = isLogrado ? '#30d158' : 'var(--accent-blue)';
  const fmt = (n) => `$${Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const editGrossRaw = Number(tradeEditForm.gross_pnl_usd || 0);
  const editNormalizedGross = tradeEditForm.resultado === 'LOSS'
    ? -Math.abs(editGrossRaw)
    : tradeEditForm.resultado === 'BE'
      ? 0
      : Math.abs(editGrossRaw);
  const tradeEditPreview = buildTradeFinancials({
    activo: tradeEditForm.activo,
    lotes: tradeEditForm.lotes === '' ? null : Number(tradeEditForm.lotes),
    gross_pnl_usd: editNormalizedGross,
    comision_usd: tradeEditForm.comision_usd,
    swap_usd: tradeEditForm.swap_usd,
  }, account);

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
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <div style={styles.brokerBadge}>{account.broker || 'Cuenta Fondeada'}</div>
          <div style={{
            ...styles.brokerBadge,
            color: account.regla_consistencia ? '#ff9f0a' : '#30d158',
            backgroundColor: account.regla_consistencia ? 'rgba(255,159,10,0.1)' : 'rgba(48,209,88,0.1)',
          }}>
            {account.regla_consistencia ? 'Con consistencia' : 'Sin consistencia'}
          </div>
        </div>
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

      <div style={styles.toolsCard}>
        <div style={styles.toolsHeader}>
          <div>
            <div style={styles.toolsTitle}>Ajustes de cuenta</div>
            <div style={styles.toolsSubtitle}>
              Sincronizá el balance real y definí cómo estimar la comisión automática.
            </div>
          </div>
          <div style={styles.toolsBadges}>
            <span style={styles.toolBadge}>
              Comisión: {commissionProfile === 'alpha_raw' ? 'Alpha RAW' : commissionProfile === 'custom_per_lot' ? 'Personalizada' : 'Sin comisión'}
            </span>
          </div>
        </div>

        <div style={styles.toolsActions}>
          <button
            style={styles.secondaryActionBtn}
            onClick={() => {
              setAdjustedBalance(String(balance));
              setShowBalanceAdjust(v => !v);
            }}
          >
            Ajustar balance
          </button>
          <button
            style={styles.secondaryActionBtn}
            onClick={() => setShowCommissionSettings(v => !v)}
          >
            Configurar comisión
          </button>
        </div>

        {showBalanceAdjust && (
          <div style={styles.actionPanel}>
            <div style={styles.panelTitle}>Ajuste manual de balance</div>
            <div style={styles.panelHint}>
              Esto actualiza el balance y recalcula el PnL acumulado sin crear un trade nuevo.
            </div>
            <input
              type="number"
              step="0.01"
              value={adjustedBalance}
              onChange={e => setAdjustedBalance(e.target.value)}
              style={styles.panelInput}
              placeholder="Ej: 10294.82"
            />
            <textarea
              rows="2"
              value={adjustmentNote}
              onChange={e => setAdjustmentNote(e.target.value)}
              style={{ ...styles.panelInput, resize: 'vertical', minHeight: '76px' }}
              placeholder="Nota opcional: ajuste por comisión, corrección manual, etc."
            />
            <div style={styles.panelActions}>
              <button style={styles.panelGhostBtn} onClick={() => setShowBalanceAdjust(false)}>
                Cancelar
              </button>
              <button style={styles.panelPrimaryBtn} onClick={handleBalanceAdjust} disabled={savingAdjustment}>
                {savingAdjustment ? 'Guardando...' : 'Guardar ajuste'}
              </button>
            </div>
          </div>
        )}

        {showCommissionSettings && (
          <div style={styles.actionPanel}>
            <div style={styles.panelTitle}>Configuración de comisión automática</div>
            <div style={styles.panelHint}>
              Se usa como valor por defecto al crear trades. Después siempre podés sobrescribirla manualmente.
            </div>

            <div style={styles.profileGrid}>
              {[
                { key: 'alpha_raw', title: 'Alpha RAW', subtitle: '$2.50 por lado y por lote. Índices sin comisión.' },
                { key: 'custom_per_lot', title: 'Personalizada', subtitle: 'Definís cuánto cobra por lado y por lote.' },
                { key: 'none', title: 'Sin comisión', subtitle: 'No estimar automáticamente.' },
              ].map(option => (
                <button
                  key={option.key}
                  style={{
                    ...styles.profileOption,
                    border: commissionProfile === option.key ? '2px solid var(--accent-blue)' : '1px solid var(--border)',
                    backgroundColor: commissionProfile === option.key ? 'rgba(10,132,255,0.1)' : 'var(--bg-secondary)',
                  }}
                  onClick={() => setCommissionProfile(option.key)}
                >
                  <div style={{ fontSize: '13px', fontWeight: '700', color: commissionProfile === option.key ? 'var(--accent-blue)' : 'var(--text-primary)', marginBottom: '4px' }}>
                    {option.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {option.subtitle}
                  </div>
                </button>
              ))}
            </div>

            {commissionProfile === 'custom_per_lot' && (
              <input
                type="number"
                step="0.01"
                value={commissionPerSide}
                onChange={e => setCommissionPerSide(e.target.value)}
                style={styles.panelInput}
                placeholder="Comisión por lado y por lote"
              />
            )}

            <div style={styles.panelActions}>
              <button style={styles.panelGhostBtn} onClick={() => setShowCommissionSettings(false)}>
                Cancelar
              </button>
              <button style={styles.panelPrimaryBtn} onClick={handleSaveCommissionConfig} disabled={savingCommissionConfig}>
                {savingCommissionConfig ? 'Guardando...' : 'Guardar configuración'}
              </button>
            </div>
          </div>
        )}
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

        {/* Botón Stop para Retiro — aparece cuando el objetivo está logrado y no hay retiro en curso */}
        {isLogrado && !enRetiro && (
          <div>
            {!showStopPanel ? (
              <button
                style={{
                  width: '100%', marginTop: '4px',
                  backgroundColor: 'rgba(48,209,88,0.12)',
                  border: '1px solid rgba(48,209,88,0.3)',
                  color: '#30d158', borderRadius: '14px',
                  padding: '12px 16px', fontSize: '15px',
                  fontWeight: '700', cursor: 'pointer',
                }}
                onClick={() => setShowStopPanel(true)}
              >
                Parar para Retiro
              </button>
            ) : (
              <div style={{
                marginTop: '4px', padding: '16px',
                backgroundColor: 'rgba(48,209,88,0.06)',
                border: '1px solid rgba(48,209,88,0.2)',
                borderRadius: '14px', display: 'flex',
                flexDirection: 'column', gap: '12px',
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#30d158' }}>
                  Monto a cobrar (USD, opcional)
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={montoCobrado}
                  onChange={e => setMontoCobrado(e.target.value)}
                  placeholder="Ej: 480.50"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px', padding: '10px 14px',
                    fontSize: '15px', color: 'var(--text-primary)',
                    outline: 'none', width: '100%', boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#30d158' }}>
                  Fecha de cobro (opcional)
                </div>
                <input
                  type="date"
                  value={fechaCobro}
                  onChange={e => setFechaCobro(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px', padding: '10px 14px',
                    fontSize: '15px', color: 'var(--text-primary)',
                    outline: 'none', width: '100%', boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  La cuenta queda bloqueada hasta la fecha de cobro. Sin fecha, podés desbloquearla cuando quieras.
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    style={{
                      flex: 1, padding: '12px',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: '12px', color: 'var(--text-secondary)',
                      fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                    }}
                    onClick={() => setShowStopPanel(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    style={{
                      flex: 2, padding: '12px',
                      backgroundColor: '#30d158', border: 'none',
                      borderRadius: '12px', color: '#000',
                      fontSize: '14px', fontWeight: '700', cursor: 'pointer',
                      opacity: savingStop ? 0.7 : 1,
                    }}
                    onClick={handleStopParaRetiro}
                    disabled={savingStop}
                  >
                    {savingStop ? 'Guardando...' : 'Confirmar Retiro'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Panel "Retiro en curso" — aparece cuando en_retiro es true */}
      {enRetiro && (
        <div style={{
          backgroundColor: 'rgba(48,209,88,0.07)',
          border: '1px solid rgba(48,209,88,0.3)',
          borderRadius: '16px', padding: '20px',
          marginBottom: '16px', display: 'flex',
          flexDirection: 'column', gap: '16px',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>💰</span>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#30d158' }}>
                Retiro en curso
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Ciclo {cicloActual} completado · Trading bloqueado
              </div>
            </div>
          </div>

          {/* Monto a cobrar — editable */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px', padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Monto a cobrar</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                PnL bruto: +${pnl.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <input
              type="number"
              step="0.01"
              value={account.monto_cobrado_usd ?? ''}
              placeholder="Sin monto cargado"
              onChange={async (e) => {
                const raw = e.target.value;
                const nextValue = raw === '' ? null : Number(raw);
                try {
                  await updateDoc(doc(db, 'funded_accounts', account.id), { monto_cobrado_usd: nextValue });
                  setAccount(prev => ({ ...prev, monto_cobrado_usd: nextValue }));
                } catch {
                  addToast('Error al actualizar el monto.', 'error');
                }
              }}
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border)', borderRadius: '10px',
                padding: '8px 12px', fontSize: '18px', fontWeight: '700',
                color: account.monto_cobrado_usd != null ? '#30d158' : 'var(--text-secondary)',
                outline: 'none', width: '100%', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Fecha de cobro editable */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px', padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Fecha de cobro</span>
              {account.fecha_cobro && diasParaCobro !== null && (
                <span style={{
                  fontSize: '12px', fontWeight: '600',
                  color: diasParaCobro < 0 ? '#ff453a' : diasParaCobro === 0 ? '#30d158' : '#ff9f0a',
                  backgroundColor: diasParaCobro < 0 ? 'rgba(255,69,58,0.12)' : diasParaCobro === 0 ? 'rgba(48,209,88,0.12)' : 'rgba(255,159,10,0.12)',
                  padding: '3px 10px', borderRadius: '8px',
                }}>
                  {diasParaCobro < 0
                    ? `Hace ${Math.abs(diasParaCobro)} días`
                    : diasParaCobro === 0
                    ? 'Hoy'
                    : `En ${diasParaCobro} días`}
                </span>
              )}
            </div>
            <input
              type="date"
              value={account.fecha_cobro || ''}
              onChange={async (e) => {
                const newDate = e.target.value;
                try {
                  await updateDoc(doc(db, 'funded_accounts', account.id), { fecha_cobro: newDate });
                  setAccount(prev => ({ ...prev, fecha_cobro: newDate }));
                  addToast('Fecha de cobro actualizada.', 'success');
                } catch {
                  addToast('Error al actualizar la fecha.', 'error');
                }
              }}
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border)', borderRadius: '10px',
                padding: '8px 12px', fontSize: '14px',
                color: account.fecha_cobro ? 'var(--text-primary)' : 'var(--text-secondary)',
                outline: 'none', width: '100%', boxSizing: 'border-box',
              }}
            />
            {!account.fecha_cobro && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Sin fecha asignada — editá cuando confirme la prop firm
              </div>
            )}
          </div>

          {/* Botón Iniciar Nuevo Ciclo — bloqueado hasta fecha de cobro */}
          <button
            style={{
              width: '100%', padding: '14px',
              backgroundColor: puedeCobrar ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
              border: puedeCobrar ? 'none' : '1px solid var(--border)',
              borderRadius: '14px',
              color: puedeCobrar ? '#fff' : 'var(--text-secondary)',
              fontSize: '15px', fontWeight: '700',
              cursor: puedeCobrar ? 'pointer' : 'not-allowed',
              opacity: savingCiclo ? 0.7 : 1,
            }}
            onClick={handleIniciarNuevoCiclo}
            disabled={savingCiclo || !puedeCobrar}
            title={!puedeCobrar ? 'Bloqueado hasta la fecha de cobro' : ''}
          >
            {savingCiclo
              ? 'Iniciando ciclo...'
              : puedeCobrar
                ? 'Confirmar cobro e iniciar nuevo ciclo'
                : `🔒 Bloqueado hasta ${new Date(account.fecha_cobro).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}`}
          </button>
        </div>
      )}

      {/* ── Risk Manager Panel (con regla de consistencia) ── */}
      {account.regla_consistencia && (
        <div style={{
          ...styles.guiaCard,
          borderColor: payoutHabilitado ? 'rgba(48,209,88,0.3)' : !consistenciaOk ? 'rgba(255,159,10,0.35)' : 'rgba(255,255,255,0.1)',
          backgroundColor: payoutHabilitado ? 'rgba(48,209,88,0.05)' : !consistenciaOk ? 'rgba(255,159,10,0.05)' : 'var(--bg-secondary)',
        }}>

          {/* Header */}
          <div style={styles.guiaHeader}>
            <div style={styles.guiaHeaderLeft}>
              <span style={{ fontSize: 20 }}>
                {payoutHabilitado ? '✅' : !consistenciaOk ? '⚠️' : '🔒'}
              </span>
              <div>
                <div style={styles.guiaTitulo}>Risk Manager</div>
                <div style={styles.guiaSubtitulo}>
                  Consistencia {limitePct}% · Mejor día: {fmt(bestDayProfit)} · PnL neto: {pnl >= 0 ? '+' : ''}{fmt(pnl)}
                </div>
              </div>
            </div>
            <div style={{
              ...styles.guiaBadge,
              backgroundColor: payoutHabilitado ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.12)',
              color: payoutHabilitado ? '#30d158' : '#ff453a',
            }}>
              {payoutHabilitado ? 'Payout OK' : 'Bloqueado'}
            </div>
          </div>

          {/* Badges de elegibilidad */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div style={styles.rmEligRow}>
              <span style={styles.rmEligLabel}>Profit Target ({targetRetiroPct}%)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {!isLogrado && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Faltan {fmt(faltaUsd)}</span>}
                <span style={{ ...styles.rmStatusBadge, backgroundColor: isLogrado ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.12)', color: isLogrado ? '#30d158' : '#ff453a' }}>
                  {isLogrado ? '✔ Alcanzado' : '❌ Pendiente'}
                </span>
              </div>
            </div>
            <div style={styles.rmEligRow}>
              <span style={styles.rmEligLabel}>Consistencia (máx {limitePct}%)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Actual: {Math.round(consistenciaPct)}%</span>
                <span style={{ ...styles.rmStatusBadge, backgroundColor: consistenciaOk ? 'rgba(48,209,88,0.15)' : 'rgba(255,159,10,0.15)', color: consistenciaOk ? '#30d158' : '#ff9f0a' }}>
                  {consistenciaOk ? '✔ En regla' : '❌ Fuera de límite'}
                </span>
              </div>
            </div>
            <div style={{ ...styles.rmEligRow, borderBottomWidth: 0 }}>
              <span style={{ ...styles.rmEligLabel, fontWeight: '700', color: 'var(--text-primary)' }}>Payout habilitado</span>
              <span style={{ ...styles.rmStatusBadge, backgroundColor: payoutHabilitado ? 'rgba(48,209,88,0.2)' : 'rgba(255,69,58,0.15)', color: payoutHabilitado ? '#30d158' : '#ff453a', fontWeight: '700' }}>
                {payoutHabilitado ? '✔ Sí' : '❌ No'}
              </span>
            </div>
          </div>

          {trades.length === 0 ? (
            <div style={{ ...styles.guiaBloqueText, textAlign: 'center', paddingTop: '4px' }}>
              Registrá tu primer trade para ver el análisis completo.
            </div>
          ) : (
            <>
              <div style={styles.guiaDivider} />

              {/* Bloqueo principal */}
              {!payoutHabilitado && (
                <div style={styles.guiaBloque}>
                  <div style={styles.guiaIcono}>🔒</div>
                  <div>
                    <div style={styles.guiaBloqueTitle}>Bloqueo principal</div>
                    <div style={styles.guiaBloqueText}>
                      {!consistenciaOk && isLogrado && <>
                        Profit target alcanzado ({fmt(pnl)}), pero la consistencia está fuera de regla.{' '}
                        Tu mejor día ({fmt(bestDayProfit)}) representa el{' '}
                        <strong style={{ color: '#ff9f0a' }}>{Math.round(consistenciaPct)}%</strong> del total de ganancias ({fmt(totalWins)}).
                        {' '}El límite es {limitePct}%.
                      </>}
                      {!isLogrado && consistenciaOk && <>
                        Faltan <strong style={{ color: '#ff453a' }}>{fmt(faltaUsd)}</strong> para alcanzar el profit target del {targetRetiroPct}% ({fmt(targetRetiroUsd)}).
                      </>}
                      {!isLogrado && !consistenciaOk && <>
                        Dos bloqueos activos: faltan <strong style={{ color: '#ff453a' }}>{fmt(faltaUsd)}</strong> para el profit target,
                        y la consistencia está en {Math.round(consistenciaPct)}% (límite: {limitePct}%).
                      </>}
                    </div>
                  </div>
                </div>
              )}

              {/* Objetivo para cumplir consistencia */}
              {!consistenciaOk && (
                <div style={styles.guiaBloque}>
                  <div style={styles.guiaIcono}>🎯</div>
                  <div style={{ flex: 1 }}>
                    <div style={styles.guiaBloqueTitle}>Objetivo para cumplir consistencia</div>
                    <div style={{ ...styles.guiaBloqueText, marginBottom: '10px' }}>
                      Con tu mejor día en {fmt(bestDayProfit)}, el total de ganancias debe alcanzar{' '}
                      <strong style={{ color: '#ff9f0a' }}>{fmt(profitRequeridoConsistencia)}</strong>.{' '}
                      Profit actual: <strong style={{ color: pnlColor }}>{fmt(pnl)}</strong>.{' '}
                      Gap: <strong style={{ color: '#ff9f0a' }}>{fmt(gapConsistencia)}</strong> distribuidos en múltiples días sin superar {fmt(bestDayProfit)} en ninguno.
                    </div>
                    {profitRequeridoConsistencia > 0 && (
                      <div>
                        <div style={styles.progressTrack}>
                          <div style={{ ...styles.progressFill, width: `${Math.min(100, (pnl / profitRequeridoConsistencia) * 100)}%`, backgroundColor: '#ff9f0a' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                          <span style={styles.progressFooterText}>{fmt(pnl)} actual</span>
                          <span style={styles.progressFooterText}>Meta: {fmt(profitRequeridoConsistencia)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={styles.guiaDivider} />

              {/* Tabla de escenarios — dos secciones */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                {/* Header sección ganancias */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#30d158' }}>Ganancias — ¿Cuándo asegurar el trade?</span>
                    {bestDayProfit > 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>No superar {fmt(bestDayProfit)} / día</span>
                    )}
                  </div>
                  <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(48,209,88,0.2)' }}>
                    {gainsScenarios.map(({ label, sublabel, amount, newPnl, newConsistenciaPct, newConsistenciaOk, newPayoutOk, highlight }) => (
                      <div key={amount} style={{
                        display: 'grid', gridTemplateColumns: '1fr auto',
                        padding: '12px 14px', alignItems: 'center', gap: '12px',
                        backgroundColor: highlight ? 'rgba(48,209,88,0.08)' : 'var(--bg-secondary)',
                        borderTop: '1px solid var(--border)',
                      }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px', fontWeight: '700', color: '#30d158' }}>
                              +{fmt(amount)}
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: highlight ? '#30d158' : 'var(--text-primary)' }}>
                              {label}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {sublabel} · PnL total: {fmt(newPnl)} · Consistencia: {Math.round(newConsistenciaPct)}%
                          </div>
                        </div>
                        <span style={{
                          fontSize: '12px', fontWeight: '700', padding: '4px 12px', borderRadius: '10px', whiteSpace: 'nowrap',
                          backgroundColor: newPayoutOk ? 'rgba(48,209,88,0.2)' : newConsistenciaOk ? 'rgba(48,209,88,0.1)' : 'rgba(255,159,10,0.12)',
                          color: newPayoutOk ? '#30d158' : newConsistenciaOk ? '#30d158' : '#ff9f0a',
                          border: highlight ? '1px solid rgba(48,209,88,0.4)' : 'none',
                        }}>
                          {newPayoutOk ? '✔ Payout OK' : `${Math.round(newConsistenciaPct)}% consist.`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Header sección pérdidas */}
                {lossScenarios.length > 0 && (
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#ff453a', marginBottom: '8px' }}>
                      Pérdidas — ¿Cuándo cortar?
                      {pnlBuffer > 0 && (
                        <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                          Buffer sobre profit target: {fmt(pnlBuffer)}
                        </span>
                      )}
                    </div>
                    <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,69,58,0.2)' }}>
                      {lossScenarios.map(({ label, sublabel, amount, newPnl, newConsistenciaPct, newIsLogrado, newPayoutOk, critical }) => (
                        <div key={amount} style={{
                          display: 'grid', gridTemplateColumns: '1fr auto',
                          padding: '12px 14px', alignItems: 'center', gap: '12px',
                          backgroundColor: critical ? 'rgba(255,69,58,0.06)' : 'var(--bg-secondary)',
                          borderTop: '1px solid var(--border)',
                        }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '700', color: '#ff453a' }}>
                                {fmt(amount)}
                              </span>
                              <span style={{ fontSize: '12px', fontWeight: '600', color: critical ? '#ff453a' : 'var(--text-primary)' }}>
                                {label}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {sublabel} · PnL total: {newIsLogrado ? '+' : ''}{fmt(newPnl)}
                              {newIsLogrado ? ` · Consist. ${Math.round(newConsistenciaPct)}%` : ' · Target perdido'}
                            </div>
                          </div>
                          <span style={{
                            fontSize: '12px', fontWeight: '700', padding: '4px 12px', borderRadius: '10px', whiteSpace: 'nowrap',
                            backgroundColor: critical ? 'rgba(255,69,58,0.15)' : 'rgba(255,159,10,0.12)',
                            color: critical ? '#ff453a' : '#ff9f0a',
                            border: critical ? '1px solid rgba(255,69,58,0.3)' : 'none',
                          }}>
                            {newIsLogrado ? '⚠️ Retroceso' : '❌ Target perdido'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={styles.guiaDivider} />

              {/* Plan de acción */}
              <div style={styles.guiaBloque}>
                <div style={styles.guiaIcono}>📋</div>
                <div>
                  <div style={styles.guiaBloqueTitle}>Plan de acción</div>
                  <div style={styles.guiaBloqueText}>
                    {payoutHabilitado && <>
                      Payout habilitado. Podés detener el trading y solicitar el retiro.
                    </>}
                    {!payoutHabilitado && !consistenciaOk && isLogrado && <>
                      Profit target cumplido. Único bloqueo: consistencia. Necesitás{' '}
                      <strong style={{ color: '#ff9f0a' }}>{fmt(gapConsistencia)}</strong> adicionales distribuidos en múltiples días.
                      Rango diario recomendado: <strong style={{ color: '#30d158' }}>{fmt(minProximoDia)}–{fmt(maxProximoDia)}</strong>.
                      No cerrés el trading — operá con tamaño reducido para acumular sin arriesgar el profit alcanzado.
                    </>}
                    {!payoutHabilitado && !isLogrado && <>
                      Faltan <strong style={{ color: '#ff453a' }}>{fmt(faltaUsd)}</strong> para el profit target.
                      {consistenciaOk
                        ? <> Consistencia OK. Sesiones de {fmt(minProximoDia)}–{fmt(maxProximoDia)} · ~{diasEstimadosRetiro ?? '?'} días estimados.</>
                        : <> Además, consistencia fuera de regla. Priorizá sesiones de {fmt(minProximoDia)}–{fmt(maxProximoDia)} para avanzar en ambas métricas.</>
                      }
                    </>}
                  </div>
                </div>
              </div>

              {/* Alertas */}
              {!payoutHabilitado && (
                <div style={{ backgroundColor: 'rgba(255,159,10,0.07)', border: '1px solid rgba(255,159,10,0.2)', borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#ff9f0a', marginBottom: '2px' }}>Alertas</div>
                  {bestDayProfit > 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      ⚠️ Ganar más de <strong style={{ color: '#ff9f0a' }}>{fmt(bestDayProfit)}</strong> en un solo día establece un nuevo best day y empeora la consistencia.
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    ⚠️ Una pérdida baja el PnL total sin mejorar la consistencia. Pérdida diaria prudente máxima: <strong style={{ color: '#ff453a' }}>{fmt(perdidaRecomendadaMax)}</strong> (0.5% del capital).
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Panel simple para cuentas sin regla de consistencia */}
      {!account.regla_consistencia && !enRetiro && trades.length > 0 && (
        <div style={{
          ...styles.guiaCard,
          borderColor: isLogrado ? 'rgba(48,209,88,0.25)' : 'rgba(255,255,255,0.1)',
          backgroundColor: isLogrado ? 'rgba(48,209,88,0.05)' : 'var(--bg-secondary)',
        }}>
          <div style={styles.guiaHeader}>
            <div style={styles.guiaHeaderLeft}>
              <span style={{ fontSize: 20 }}>{isLogrado ? '🏆' : '📈'}</span>
              <div>
                <div style={styles.guiaTitulo}>Progreso de retiro</div>
                <div style={styles.guiaSubtitulo}>Objetivo: {targetRetiroPct}% · {fmt(targetRetiroUsd)}</div>
              </div>
            </div>
            <div style={{ ...styles.guiaBadge, backgroundColor: isLogrado ? 'rgba(48,209,88,0.15)' : 'rgba(255,255,255,0.07)', color: isLogrado ? '#30d158' : 'var(--text-secondary)' }}>
              {isLogrado ? 'Listo para retirar' : `${Math.round(progresoPct)}%`}
            </div>
          </div>
          <div style={styles.guiaDivider} />
          <div style={styles.guiaBloque}>
            <div style={styles.guiaIcono}>💰</div>
            <div>
              <div style={styles.guiaBloqueTitle}>{isLogrado ? 'Objetivo alcanzado' : 'Acumulado hasta ahora'}</div>
              <div style={styles.guiaBloqueText}>
                PnL actual: <strong style={{ color: pnlColor }}>{pnl >= 0 ? '+' : ''}{fmt(pnl)}</strong>.
                {isLogrado
                  ? ' Podés parar el trading y solicitar el cobro usando el botón de arriba.'
                  : <> Faltan <strong style={{ color: 'var(--text-primary)' }}>{fmt(faltaUsd)}</strong> para alcanzar el objetivo de retiro del {targetRetiroPct}%.</>
                }
              </div>
            </div>
          </div>
          <div style={styles.guiaBloque}>
            <div style={styles.guiaIcono}>🔄</div>
            <div>
              <div style={styles.guiaBloqueTitle}>Ciclo actual: {cicloActual}</div>
              <div style={styles.guiaBloqueText}>
                {historialCiclos.length > 0
                  ? `Completaste ${historialCiclos.length} ciclo${historialCiclos.length > 1 ? 's' : ''} anteriores. Al iniciar un nuevo ciclo, el balance vuelve a $${inicial.toLocaleString()} y el PnL a $0.`
                  : 'Al completar el retiro e iniciar un nuevo ciclo, el balance se resetea al inicial y el PnL vuelve a $0.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Curva de Equity */}
      {trades.length >= 2 && (() => {
        const sorted = [...trades].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
        const equityData = sorted.reduce((acc, t) => {
          const prev = acc.length > 0 ? acc[acc.length - 1].pnl : 0;
          const cumPnl = prev + getTradeNetPnl(t);
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
                <YAxis 
                  tick={{ fill: '#636366', fontSize: 11 }} 
                  axisLine={false} 
                  tickLine={false} 
                  domain={[
                    dataMin => Math.min(0, dataMin, -(account.max_loss_usd || inicial * 0.1)), 
                    dataMax => Math.max(0, dataMax, targetRetiroUsd)
                  ]}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: '#ebebf5' }}
                  formatter={(v) => [`$${v}`, 'PnL acum.']}
                />
                <ReferenceLine y={targetRetiroUsd} stroke="var(--accent-green)" strokeDasharray="3 3" opacity={0.3} />
                <ReferenceLine y={-(account.max_loss_usd || inicial * 0.1)} stroke="var(--accent-red)" strokeDasharray="3 3" opacity={0.3} />
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
          {!enRetiro && (
            <button
              style={styles.registerBtn}
              onClick={() => navigate(`/trades/nuevo?accountId=${account.id}&tipo=fondeada`)}
            >
              + Registrar Trade
            </button>
          )}
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
              const { grossPnl, commission, swap, netPnl } = buildTradeFinancials(trade);
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
                  <div style={styles.tradePnlColumn}>
                    <div style={{
                      ...styles.tradePnl,
                      color: isWin ? '#30d158' : isLoss ? '#ff453a' : 'var(--text-muted)'
                    }}>
                      {grossPnl === 0 ? 'B.E.' : `${grossPnl > 0 ? '+' : ''}$${grossPnl.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </div>
                    {commission > 0 && (
                      <div style={styles.tradeCommission}>
                        Com. -${commission.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                    {swap !== 0 && (
                      <div style={{ ...styles.tradeCommission, color: swap > 0 ? 'rgba(48,209,88,0.7)' : 'rgba(255,100,90,0.8)' }}>
                        Swap {swap > 0 ? '+' : ''}${swap.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                  <div style={styles.tradeActions}>
                    <button style={styles.tradeActionBtn} onClick={() => openTradeEdit(trade)} title="Editar trade">
                      <Edit3 size={14} color="var(--text-secondary)" />
                    </button>
                    <button style={styles.tradeActionBtn} onClick={() => handleDeleteTrade(trade)} title="Eliminar trade">
                      <Trash2 size={14} color="#ff453a" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historial de Ciclos */}
      {historialCiclos.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={styles.sectionTitle}>HISTORIAL DE CICLOS</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
            {[...historialCiclos].reverse().map((ciclo, idx) => {
              const fechaStop = ciclo.fecha_stop
                ? new Date(ciclo.fecha_stop).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
                : '—';
              const fechaCobrado = ciclo.fecha_cobro
                ? new Date(ciclo.fecha_cobro).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
                : 'Sin fecha';
              return (
                <div key={idx} style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px', padding: '16px 18px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700' }}>
                      Ciclo {ciclo.ciclo}
                      <span style={{
                        marginLeft: '8px', fontSize: '11px',
                        color: 'var(--text-secondary)', fontWeight: '500',
                      }}>
                        {ciclo.num_trades} trades
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Stop: {fechaStop} · Cobro: {fechaCobrado}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                      {ciclo.monto_cobrado_usd != null ? 'Cobrado' : 'PnL del ciclo'}
                    </div>
                    <div style={{
                      fontSize: '18px', fontWeight: '800',
                      color: (ciclo.monto_cobrado_usd ?? ciclo.pnl_usd) >= 0 ? '#30d158' : '#ff453a',
                    }}>
                      {ciclo.monto_cobrado_usd != null
                        ? `+$${Number(ciclo.monto_cobrado_usd).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                        : `${ciclo.pnl_usd >= 0 ? '+' : ''}$${ciclo.pnl_usd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                    </div>
                    {ciclo.monto_cobrado_usd != null && (
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        PnL bruto: {ciclo.pnl_usd >= 0 ? '+' : ''}${ciclo.pnl_usd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tradeEditOpen && (
        <div style={styles.modalOverlay} onClick={() => setTradeEditOpen(false)}>
          <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span style={styles.modalTitle}>Editar Trade</span>
              <button style={styles.modalClose} onClick={() => setTradeEditOpen(false)}>
                <X size={20} color="var(--text-secondary)" />
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.modalField}>
                <label style={styles.modalLabel}>Activo</label>
                <input
                  style={styles.modalInput}
                  value={tradeEditForm.activo}
                  onChange={e => setTradeEditForm(f => ({ ...f, activo: e.target.value }))}
                />
              </div>

              <div style={styles.modalField}>
                <label style={styles.modalLabel}>Resultado</label>
                <div style={styles.resultadoRow}>
                  {['WIN', 'LOSS', 'BE'].map(result => (
                    <button
                      key={result}
                      style={{
                        ...styles.resultadoBtn,
                        backgroundColor: tradeEditForm.resultado === result ? 'rgba(10,132,255,0.12)' : 'var(--bg-tertiary)',
                        border: tradeEditForm.resultado === result ? '1px solid var(--accent-blue)' : '1px solid var(--border)',
                        color: tradeEditForm.resultado === result ? 'var(--accent-blue)' : 'var(--text-secondary)',
                      }}
                      onClick={() => setTradeEditForm(f => ({ ...f, resultado: result }))}
                    >
                      {result === 'BE' ? 'B.E.' : result}
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.modalField}>
                <label style={styles.modalLabel}>PnL Bruto (USD)</label>
                <input
                  style={styles.modalInput}
                  type="number"
                  step="0.01"
                  value={tradeEditForm.gross_pnl_usd}
                  onChange={e => setTradeEditForm(f => ({ ...f, gross_pnl_usd: e.target.value }))}
                />
              </div>

              <div style={styles.modalField}>
                <label style={styles.modalLabel}>Lotes (opcional)</label>
                <input
                  style={styles.modalInput}
                  type="number"
                  step="0.01"
                  value={tradeEditForm.lotes}
                  onChange={e => setTradeEditForm(f => ({ ...f, lotes: e.target.value }))}
                />
              </div>

              <div style={styles.modalField}>
                <label style={styles.modalLabel}>Comisión (USD, opcional)</label>
                <input
                  style={styles.modalInput}
                  type="number"
                  step="0.01"
                  value={tradeEditForm.comision_usd}
                  onChange={e => setTradeEditForm(f => ({ ...f, comision_usd: e.target.value }))}
                />
              </div>

              <div style={styles.modalField}>
                <label style={styles.modalLabel}>Swap (USD, opcional)</label>
                <input
                  style={styles.modalInput}
                  type="number"
                  step="0.01"
                  value={tradeEditForm.swap_usd}
                  onChange={e => setTradeEditForm(f => ({ ...f, swap_usd: e.target.value }))}
                />
              </div>

              <div style={styles.modalField}>
                <label style={styles.modalLabel}>Notas</label>
                <textarea
                  style={{ ...styles.modalInput, minHeight: '80px', resize: 'vertical' }}
                  value={tradeEditForm.notas}
                  onChange={e => setTradeEditForm(f => ({ ...f, notas: e.target.value }))}
                />
              </div>

              <div style={styles.tradePreviewCard}>
                <div style={styles.tradePreviewTitle}>Impacto neto</div>
                <div style={{
                  ...styles.tradePreviewValue,
                  color: tradeEditPreview.netPnl > 0 ? '#30d158' : tradeEditPreview.netPnl < 0 ? '#ff453a' : 'var(--text-primary)',
                }}>
                  {tradeEditPreview.netPnl > 0 ? '+' : ''}${tradeEditPreview.netPnl.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button style={styles.modalDeleteBtn} onClick={() => setTradeEditOpen(false)}>
                Cancelar
              </button>
              <button style={styles.modalSaveBtn} onClick={handleSaveTradeEdit} disabled={savingTrade}>
                <Check size={16} /> {savingTrade ? 'Guardando...' : 'Guardar trade'}
              </button>
            </div>
          </div>
        </div>
      )}
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
  toolsCard: {
    backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: '16px', padding: '18px', marginBottom: '16px',
    display: 'flex', flexDirection: 'column', gap: '14px',
  },
  toolsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' },
  toolsTitle: { fontSize: '14px', fontWeight: '700', marginBottom: '4px' },
  toolsSubtitle: { fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.45' },
  toolsBadges: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  toolBadge: {
    fontSize: '11px', fontWeight: '700', color: 'var(--accent-blue)',
    backgroundColor: 'rgba(10,132,255,0.1)', padding: '5px 10px',
    borderRadius: '999px', textTransform: 'uppercase', letterSpacing: '0.4px',
  },
  toolsActions: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  secondaryActionBtn: {
    backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', borderRadius: '12px', padding: '10px 14px',
    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
  },
  actionPanel: {
    backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)',
    borderRadius: '14px', padding: '14px', display: 'flex',
    flexDirection: 'column', gap: '12px',
  },
  panelTitle: { fontSize: '14px', fontWeight: '700' },
  panelHint: { fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.45' },
  panelInput: {
    backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', borderRadius: '12px', padding: '12px 14px',
    fontSize: '14px', outline: 'none',
  },
  panelActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' },
  panelGhostBtn: {
    backgroundColor: 'transparent', border: '1px solid var(--border)',
    color: 'var(--text-secondary)', borderRadius: '12px', padding: '10px 14px',
    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
  },
  panelPrimaryBtn: {
    backgroundColor: 'var(--accent-blue)', border: 'none',
    color: '#fff', borderRadius: '12px', padding: '10px 14px',
    fontSize: '13px', fontWeight: '700', cursor: 'pointer',
  },
  profileGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' },
  profileOption: {
    padding: '14px 12px', borderRadius: '14px', cursor: 'pointer', textAlign: 'left',
  },
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
  tradePnlColumn: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: '2px' },
  tradePnl: { fontSize: '16px', fontWeight: '700' },
  tradeCommission: { fontSize: '11px', color: 'rgba(255,100,90,0.75)', fontWeight: '500' },
  tradeActions: { display: 'flex', gap: '6px', marginLeft: '4px' },
  tradeActionBtn: {
    width: '30px', height: '30px', borderRadius: '8px', border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer',
  },

  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000, padding: '0' },
  modalBox: { backgroundColor: 'var(--bg-secondary)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border)', borderBottom: 'none' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 0' },
  modalTitle: { fontSize: '17px', fontWeight: '700' },
  modalClose: { backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: 4 },
  modalBody: { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' },
  modalField: { display: 'flex', flexDirection: 'column', gap: '6px' },
  modalLabel: { fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' },
  modalInput: { backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 14px', fontSize: '15px', color: 'var(--text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box' },
  modalFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px 28px', gap: '12px' },
  modalDeleteBtn: { display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(255,69,58,0.1)', color: 'var(--accent-red)', border: '1px solid rgba(255,69,58,0.2)', borderRadius: '12px', padding: '10px 16px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  modalSaveBtn: { display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '12px', padding: '10px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', flex: 1, justifyContent: 'center' },
  resultadoRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' },
  resultadoBtn: {
    borderRadius: '10px', padding: '10px 12px', fontSize: '13px', fontWeight: '700',
    cursor: 'pointer', background: 'transparent',
  },
  tradePreviewCard: {
    backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)',
    borderRadius: '12px', padding: '12px 14px',
  },
  tradePreviewTitle: { fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' },
  tradePreviewValue: { fontSize: '22px', fontWeight: '800', letterSpacing: '-0.4px' },

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

  // ── Risk Manager ─────────────────────────────────────────
  rmEligRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 14px', backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
  },
  rmEligLabel: { fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' },
  rmStatusBadge: {
    fontSize: '11px', fontWeight: '600', padding: '3px 10px',
    borderRadius: '10px', whiteSpace: 'nowrap',
  },
};
