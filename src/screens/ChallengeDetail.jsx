import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Edit3, Archive, TrendingUp, TrendingDown, Minus, Trash2, X, Check } from 'lucide-react';
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useTradingStore } from '../store/useTradingStore';
import { useToast } from '../components/ui/Toast';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { buildTradeFinancials, getTradeNetPnl } from '../lib/tradeMath';

export default function ChallengeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchAccounts } = useTradingStore();
  const addToast = useToast();

  const [account, setAccount] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
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
      const docRef = doc(db, 'accounts', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setAccount(data);
        setEditForm({
          nombre: data.nombre || '',
          broker: data.broker || '',
          balance_inicial_usd: data.balance_inicial_usd || '',
          objetivo_usd: data.objetivo_usd || '',
          max_loss_usd: data.max_loss_usd || '',
          max_daily_loss_usd: data.max_daily_loss_usd || '',
        });
      }
      const qTrades = query(collection(db, 'trades'), where('account_id', '==', id));
      const tradesSnap = await getDocs(qTrades);
      setTrades(
        tradesSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
      );
    } catch (err) {
      console.error('Error cargando detalle de cuenta:', err);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleArchive = async () => {
    if (!window.confirm('¿Archivar esta cuenta? Desaparecerá de los slots activos.')) return;
    try {
      await updateDoc(doc(db, 'accounts', id), { estado: 'archivada', activo: false });
      await fetchAccounts();
      addToast('Cuenta archivada.', 'success');
      navigate('/challenges');
    } catch (err) {
      console.error('Error archivando:', err);
      addToast('Error al archivar: ' + err.message, 'error');
    }
  };

  const handleDelete = async () => {
    const name = account?.nombre || 'esta cuenta';
    if (!window.confirm(`¿Eliminar "${name}" y todos sus trades permanentemente? Esta acción no se puede deshacer.`)) return;
    try {
      // 1. Buscar todos los trades de esta cuenta
      const qTrades = query(collection(db, 'trades'), where('account_id', '==', id));
      const snap = await getDocs(qTrades);
      console.log(`Eliminando ${snap.docs.length} trades...`);

      // 2. Borrar trades uno a uno (batch podría fallar)
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }

      // 3. Borrar la cuenta
      await deleteDoc(doc(db, 'accounts', id));
      console.log('Cuenta eliminada correctamente.');

      fetchAccounts().catch(() => {}); // no bloquear
      addToast(`"${name}" eliminada correctamente.`, 'success');
      navigate('/challenges');
    } catch (err) {
      console.error('Error al eliminar cuenta:', err);
      addToast('Error al eliminar: ' + (err?.message || 'Revisar consola'), 'error');
    }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const updates = {
        nombre: editForm.nombre.trim() || account.nombre,
        broker: editForm.broker.trim(),
        balance_inicial_usd: parseFloat(editForm.balance_inicial_usd) || account.balance_inicial_usd,
        objetivo_usd: parseFloat(editForm.objetivo_usd) || account.objetivo_usd,
        max_loss_usd: parseFloat(editForm.max_loss_usd) || account.max_loss_usd,
        max_daily_loss_usd: parseFloat(editForm.max_daily_loss_usd) || account.max_daily_loss_usd,
      };
      await updateDoc(doc(db, 'accounts', id), updates);
      setEditOpen(false);
      addToast('Cuenta actualizada.', 'success');
      // fetchAccounts por separado, que no bloquee
      fetchAccounts().catch(() => {});
      load();
    } catch (err) {
      console.error('Error guardando cambios:', err);
      addToast('Error al guardar: ' + (err?.message || 'Revisar consola'), 'error');
    }
    setSaving(false);
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
      fetchAccounts().catch(() => {});
      await load();
    } catch (err) {
      console.error('Error actualizando trade:', err);
      addToast('Error al actualizar trade: ' + (err?.message || 'Revisar consola'), 'error');
    }
    setSavingTrade(false);
  };

  const handleDeleteTrade = async (trade) => {
    if (!window.confirm(`¿Eliminar trade de ${trade.activo || 'activo'}?`)) return;
    try {
      await useTradingStore.getState().deleteTrade(trade.id);
      addToast('Trade eliminado.', 'success');
      fetchAccounts().catch(() => {});
      await load();
    } catch (err) {
      console.error('Error eliminando trade:', err);
      addToast('Error al eliminar trade: ' + (err?.message || 'Revisar consola'), 'error');
    }
  };

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando cuenta...</div>;
  if (!account) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--accent-red)' }}>Cuenta no encontrada.</div>;

  const pnlColor = (account.pnl_acumulado_usd || 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
  const pnlSign = (account.pnl_acumulado_usd || 0) > 0 ? '+' : '';
  const pnl = account.pnl_acumulado_usd || 0;
  const objetivo = account.objetivo_usd || 1000;
  const falta = Math.max(0, objetivo - pnl);
  const progresoPct = Math.min(100, (pnl / objetivo) * 100);
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
        <div style={styles.actions}>
          <button style={styles.iconButton} onClick={handleArchive} title="Archivar">
            <Archive size={20} color="var(--text-secondary)" />
          </button>
          <button style={{ ...styles.iconButton, color: 'var(--accent-red)' }} onClick={handleDelete} title="Eliminar">
            <Trash2 size={20} color="var(--accent-red)" />
          </button>
          <button style={styles.iconButton} onClick={() => setEditOpen(true)} title="Editar">
            <Edit3 size={20} color="var(--text-secondary)" />
          </button>
        </div>
      </header>

      {/* Info */}
      <div style={styles.challengeInfo}>
        <div style={styles.statusBadge}>⚡ {account.estado} (Slot {account.slot})</div>
        <h1 style={styles.title}>{account.nombre}</h1>

        <div style={styles.balanceGrid}>
          <div>
            <div style={styles.label}>Balance Actual</div>
            <div style={styles.value}>${(account.balance_actual_usd || account.balance_inicial_usd).toLocaleString()}</div>
          </div>
          <div>
            <div style={styles.label}>PnL Acumulado</div>
            <div style={{ ...styles.value, color: pnlColor }}>{pnlSign}${(account.pnl_acumulado_usd || 0).toLocaleString()}</div>
          </div>
        </div>

        {/* Progreso */}
        <div style={styles.progresoCard}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              {falta <= 0 ? '🏆 ¡Objetivo alcanzado!' : 'Faltan para el objetivo'}
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: falta <= 0 ? '#30d158' : '#ff9f0a' }}>
              {falta <= 0 ? `+$${pnl.toLocaleString()}` : `$${falta.toLocaleString()}`}
            </div>
          </div>
          <div style={{ position: 'relative', width: '52px', height: '52px' }}>
            <svg width="52" height="52" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
              <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
              <circle cx="26" cy="26" r="22" fill="none"
                stroke={falta <= 0 ? '#30d158' : '#ff9f0a'} strokeWidth="3"
                strokeDasharray={`${(Math.max(0, progresoPct) / 100) * 138} 138`}
                strokeLinecap="round"
              />
            </svg>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700' }}>
              {Math.round(Math.max(0, progresoPct))}%
            </span>
          </div>
        </div>

        <div style={styles.limitsRow}>
          <span>Meta: <strong style={{ color: 'var(--accent-green)' }}>${account.objetivo_usd}</strong></span>
          <span style={styles.dot}>•</span>
          <span>Límite Global: <strong style={{ color: 'var(--accent-red)' }}>${account.max_loss_usd}</strong></span>
          <span style={styles.dot}>•</span>
          <span>Lím. Día: <strong style={{ color: 'var(--accent-orange)' }}>${account.max_daily_loss_usd}</strong></span>
        </div>
      </div>

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
                  <linearGradient id="eqGradChallenge" x1="0" y1="0" x2="0" y2="1">
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
                    dataMin => Math.min(0, dataMin, -(account.max_loss_usd || 0)), 
                    dataMax => Math.max(0, dataMax, (account.objetivo_usd || 0))
                  ]}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: '#ebebf5' }}
                  formatter={(v) => [`$${v}`, 'PnL acum.']}
                />
                <ReferenceLine y={account.objetivo_usd} stroke="var(--accent-green)" strokeDasharray="3 3" opacity={0.3} />
                <ReferenceLine y={-(account.max_loss_usd || 0)} stroke="var(--accent-red)" strokeDasharray="3 3" opacity={0.3} />
                <Area type="monotone" dataKey="pnl" stroke={lineColor} strokeWidth={2} fill="url(#eqGradChallenge)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );
      })()}

      {/* Trades */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>HISTORIAL DE TRADES</h3>
          <button style={styles.linkBtn} onClick={() => navigate(`/trades/nuevo?accountId=${account.id}`)}>
            + Registrar Trade
          </button>
        </div>
        {trades.length === 0 ? (
          <div style={styles.emptyTrades}>Aún no hay trades registrados en esta cuenta.</div>
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

      {/* ── Modal de edición ── */}
      {editOpen && (
        <div style={styles.modalOverlay} onClick={() => setEditOpen(false)}>
          <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span style={styles.modalTitle}>Editar Challenge</span>
              <button style={styles.modalClose} onClick={() => setEditOpen(false)}>
                <X size={20} color="var(--text-secondary)" />
              </button>
            </div>

            <div style={styles.modalBody}>
              {[
                { label: 'Nombre', field: 'nombre', type: 'text', placeholder: 'Ej: FTMO 10K' },
                { label: 'Broker / Firma', field: 'broker', type: 'text', placeholder: 'Ej: FTMO' },
                { label: 'Balance Inicial (USD)', field: 'balance_inicial_usd', type: 'number', placeholder: '10000' },
                { label: 'Objetivo de ganancia (USD)', field: 'objetivo_usd', type: 'number', placeholder: '1000' },
                { label: 'Pérdida máxima global (USD)', field: 'max_loss_usd', type: 'number', placeholder: '1000' },
                { label: 'Pérdida máxima diaria (USD)', field: 'max_daily_loss_usd', type: 'number', placeholder: '500' },
              ].map(({ label, field, type, placeholder }) => (
                <div key={field} style={styles.modalField}>
                  <label style={styles.modalLabel}>{label}</label>
                  <input
                    style={styles.modalInput}
                    type={type}
                    placeholder={placeholder}
                    value={editForm[field]}
                    onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            <div style={styles.modalFooter}>
              <button style={styles.modalDeleteBtn} onClick={() => { setEditOpen(false); handleDelete(); }}>
                <Trash2 size={16} /> Eliminar cuenta
              </button>
              <button style={styles.modalSaveBtn} onClick={handleSaveEdit} disabled={saving}>
                <Check size={16} /> {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
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
  container: { padding: '16px 24px 40px', maxWidth: '800px', margin: '0 auto', height: '100%', overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  iconButton: { backgroundColor: 'transparent', border: 'none', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 },
  actions: { display: 'flex', gap: '4px' },
  challengeInfo: { marginBottom: '32px' },
  statusBadge: { display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-orange)', backgroundColor: 'rgba(255,159,10,0.1)', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', marginBottom: '12px' },
  title: { fontSize: '26px', fontWeight: '700', marginBottom: '16px' },
  balanceGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: 'var(--bg-secondary)', padding: '20px', borderRadius: '16px', marginBottom: '16px', border: '1px solid var(--border)' },
  label: { fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' },
  value: { fontSize: '22px', fontWeight: '700' },
  progresoCard: { backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  limitsRow: { display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: 'var(--text-secondary)', flexWrap: 'wrap' },
  dot: { color: 'var(--border)' },
  section: { marginBottom: '32px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  sectionTitle: { fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', letterSpacing: '0.5px' },
  linkBtn: { backgroundColor: 'var(--accent-blue)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer', padding: '8px 16px', borderRadius: '12px' },
  emptyTrades: { backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' },
  tradesList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  equityCard: { backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px 16px 10px', marginBottom: '24px' },
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

  // Modal
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
};
