import { useEffect, useState } from 'react';
import {
  collection, query, where, getDocs, addDoc, updateDoc,
  deleteDoc, doc, writeBatch,
} from 'firebase/firestore';
import {
  Plus, Edit3, Trash2, X, DollarSign, ArrowRight,
  Flame, CheckCircle, AlertCircle,
} from 'lucide-react';
import { nanoid } from 'nanoid';
import { useNavigate } from 'react-router';
import { db } from '../lib/firebase';
import { useToast } from '../components/ui/Toast';

const USER_ID = 'user_test_123';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ESTADO_META = {
  // challenges
  activo:    { label: 'En curso',  color: '#ff9f0a', bg: 'rgba(255,159,10,0.12)', icon: '🎯' },
  danger:    { label: 'En riesgo', color: '#ff6b35', bg: 'rgba(255,107,53,0.12)', icon: '⚠️' },
  aprobada:  { label: 'Aprobada',  color: '#30d158', bg: 'rgba(48,209,88,0.12)',  icon: '✅' },
  quemada:   { label: 'Quemada',   color: '#ff453a', bg: 'rgba(255,69,58,0.12)',  icon: '🔥' },
  archivada: { label: 'Archivada', color: '#8e8e93', bg: 'rgba(142,142,147,0.12)', icon: '📦' },
  // funded
  fondeada:  { label: 'Fondeada',  color: '#30d158', bg: 'rgba(48,209,88,0.12)',  icon: '💰' },
};

const getEstadoMeta = (tipo, estadoOperativo, enRetiro) => {
  if (tipo === 'fondeada') {
    if (estadoOperativo === 'quemada') return ESTADO_META.quemada;
    if (enRetiro) return { label: 'En retiro', color: '#5e9eff', bg: 'rgba(94,158,255,0.12)', icon: '⏳' };
    return ESTADO_META.fondeada;
  }
  return ESTADO_META[estadoOperativo] || ESTADO_META.activo;
};

// ── Componente principal ──────────────────────────────────────────────────────
export default function CuentasRegistro() {
  const addToast = useToast();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);           // unión de accounts + funded_accounts
  const [huerfanos, setHuerfanos] = useState([]); // docs viejos en cuentas_registro sin linkear
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null);   // cuenta en el modal de cobros

  // Form nueva cuenta
  const [tipoNuevo, setTipoNuevo] = useState('challenge'); // 'challenge' | 'fondeada'
  const [formChallenge, setFormChallenge] = useState({
    nombre: '', costo_usd: '', slot: 'A',
    balance: '10000', objetivo: '1000', max_loss: '1000', max_daily_loss: '500',
  });
  const [formFondeada, setFormFondeada] = useState({
    nombre: '', broker: '', costo_usd: '',
    balance: '', objetivo_retiro_pct: 2,
    regla_consistencia: true, consistencia_pct: 40,
  });
  const [savingNew, setSavingNew] = useState(false);

  // Modal cobros
  const [newCobroMonto, setNewCobroMonto] = useState('');
  const [newCobroFecha, setNewCobroFecha] = useState(new Date().toISOString().slice(0, 10));
  const [newCobroNota, setNewCobroNota] = useState('');

  // ── Carga ───────────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      const [challengeSnap, fundedSnap, huerfanosSnap] = await Promise.all([
        getDocs(query(collection(db, 'accounts'), where('user_id', '==', USER_ID))),
        getDocs(query(collection(db, 'funded_accounts'), where('user_id', '==', USER_ID))),
        getDocs(query(collection(db, 'cuentas_registro'), where('user_id', '==', USER_ID))),
      ]);

      const challenges = challengeSnap.docs.map(d => ({
        id: d.id, tipo: 'challenge', col: 'accounts', ...d.data(),
      }));
      const funded = fundedSnap.docs.map(d => ({
        id: d.id, tipo: 'fondeada', col: 'funded_accounts', ...d.data(),
      }));

      // Ordenar: activos primero, luego por nombre
      const all = [...challenges, ...funded].sort((a, b) => {
        const order = { activo: 0, danger: 1, aprobada: 2, fondeada: 0, quemada: 3, archivada: 4 };
        const pa = order[a.estado] ?? 0;
        const pb = order[b.estado] ?? 0;
        if (pa !== pb) return pa - pb;
        return (a.nombre || '').localeCompare(b.nombre || '');
      });

      setRows(all);
      setHuerfanos(huerfanosSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error cargando cuentas:', err);
      addToast('Error al cargar cuentas.', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Crear cuenta nueva ──────────────────────────────────────────────────────
  const handleCreate = async () => {
    setSavingNew(true);
    try {
      if (tipoNuevo === 'challenge') {
        const { nombre, costo_usd, slot, balance, objetivo, max_loss, max_daily_loss } = formChallenge;
        if (!nombre.trim()) { addToast('Ingresá un nombre.', 'warning'); setSavingNew(false); return; }
        await addDoc(collection(db, 'accounts'), {
          user_id: USER_ID,
          slot,
          label: `Cuenta ${slot}`,
          nombre: nombre.trim(),
          fase_actual: 'Fase 1',
          estado: 'activo',
          balance_inicial_usd: Number(balance) || 10000,
          balance_actual_usd: Number(balance) || 10000,
          objetivo_usd: Number(objetivo) || 1000,
          max_loss_usd: Number(max_loss) || 1000,
          max_daily_loss_usd: Number(max_daily_loss) || 500,
          pnl_acumulado_usd: 0,
          orden_rotacion: slot === 'A' ? 1 : slot === 'B' ? 2 : 3,
          es_cuenta_activa: slot === 'A',
          costo_usd: Number(costo_usd) || 0,
          cobros: [],
          created_at: new Date().toISOString(),
        });
      } else {
        const { nombre, broker, costo_usd, balance, objetivo_retiro_pct, regla_consistencia, consistencia_pct } = formFondeada;
        if (!nombre.trim() || !balance) { addToast('Completá nombre y balance.', 'warning'); setSavingNew(false); return; }
        await addDoc(collection(db, 'funded_accounts'), {
          user_id: USER_ID,
          nombre: nombre.trim(),
          broker: broker.trim() || 'Cuenta Fondeada',
          balance_inicial_usd: Number(balance),
          balance_actual_usd: Number(balance),
          pnl_acumulado_usd: 0,
          objetivo_retiro_pct: Number(objetivo_retiro_pct) || 2,
          regla_consistencia,
          consistencia_pct: regla_consistencia ? (Number(consistencia_pct) || 40) : null,
          commission_profile: 'alpha_raw',
          commission_per_side_usd: 2.5,
          notas: '',
          estado: 'activo',
          en_retiro: false,
          fecha_cobro: null,
          ciclo_actual: 1,
          historial_ciclos: [],
          costo_usd: Number(costo_usd) || 0,
          cobros: [],
          createdAt: new Date().toISOString(),
        });
      }
      // Reset forms
      setFormChallenge({ nombre: '', costo_usd: '', slot: 'A', balance: '10000', objetivo: '1000', max_loss: '1000', max_daily_loss: '500' });
      setFormFondeada({ nombre: '', broker: '', costo_usd: '', balance: '', objetivo_retiro_pct: 2, regla_consistencia: true, consistencia_pct: 40 });
      setShowNew(false);
      await load();
      addToast('Cuenta creada.', 'success');
    } catch (err) {
      console.error(err);
      addToast('Error al crear la cuenta.', 'error');
    }
    setSavingNew(false);
  };

  // ── Actualizar campo en doc operativo ───────────────────────────────────────
  const handleUpdateField = async (row, patch) => {
    try {
      await updateDoc(doc(db, row.col, row.id), patch);
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, ...patch } : r));
      if (editing?.id === row.id) setEditing(prev => ({ ...prev, ...patch }));
    } catch {
      addToast('Error al actualizar.', 'error');
    }
  };

  // ── Cobros ──────────────────────────────────────────────────────────────────
  const handleAddCobro = async () => {
    if (!editing) return;
    const monto = Number(newCobroMonto);
    if (!monto || monto <= 0) { addToast('Ingresá un monto válido.', 'warning'); return; }
    const cobro = {
      id: nanoid(8),
      monto_usd: monto,
      fecha: newCobroFecha || new Date().toISOString().slice(0, 10),
      nota: newCobroNota.trim() || null,
    };
    const nextCobros = [...(editing.cobros || []), cobro];
    await handleUpdateField(editing, { cobros: nextCobros });
    setNewCobroMonto(''); setNewCobroNota('');
    addToast('Cobro agregado.', 'success');
  };

  const handleDeleteCobro = async (cobroId) => {
    if (!editing) return;
    const nextCobros = (editing.cobros || []).filter(c => c.id !== cobroId);
    await handleUpdateField(editing, { cobros: nextCobros });
  };

  // ── Migración de huérfanos ──────────────────────────────────────────────────
  const handleLinkHuerfano = async (huerfanoId, targetRowId) => {
    const huerfano = huerfanos.find(h => h.id === huerfanoId);
    const target = rows.find(r => r.id === targetRowId);
    if (!huerfano || !target) return;
    try {
      await updateDoc(doc(db, target.col, target.id), {
        costo_usd: huerfano.costo_usd || 0,
        cobros: huerfano.cobros || [],
      });
      await deleteDoc(doc(db, 'cuentas_registro', huerfanoId));
      addToast('Cuenta vinculada correctamente.', 'success');
      await load();
    } catch {
      addToast('Error al vincular.', 'error');
    }
  };

  // ── Totales ──────────────────────────────────────────────────────────────────
  const totalInvertido = rows.reduce((s, r) => s + (Number(r.costo_usd) || 0), 0);
  const totalCobrado = rows.reduce(
    (s, r) => s + (r.cobros || []).reduce((a, c) => a + (Number(c.monto_usd) || 0), 0), 0
  );
  const saldoNeto = totalCobrado - totalInvertido;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Cuentas</h1>
          <p style={styles.subtitle}>Registro financiero unificado</p>
        </div>
        <button style={styles.newBtn} onClick={() => setShowNew(v => !v)}>
          <Plus size={16} /><span>Nueva</span>
        </button>
      </div>

      {/* Totalizador */}
      <div style={styles.totalsRow}>
        <TotalCard label="Invertido" value={totalInvertido} color="#ff9f0a" />
        <TotalCard label="Cobrado" value={totalCobrado} color="#30d158" />
        <TotalCard label="Saldo neto" value={saldoNeto} color={saldoNeto >= 0 ? '#30d158' : '#ff453a'} sign />
      </div>

      {/* Banner de migración */}
      {huerfanos.length > 0 && (
        <div style={styles.migrationBanner}>
          <AlertCircle size={16} color="#ff9f0a" />
          <span style={{ flex: 1, fontSize: 13 }}>
            <strong>{huerfanos.length} registro{huerfanos.length > 1 ? 's' : ''}</strong> del sistema anterior sin vincular.
            Hacé clic en "Vincular" para asignarlos a una cuenta.
          </span>
          {huerfanos.map(h => (
            <HuerfanoRow key={h.id} huerfano={h} rows={rows} onLink={handleLinkHuerfano} />
          ))}
        </div>
      )}

      {/* Form nueva cuenta */}
      {showNew && (
        <div style={styles.formCard}>
          {/* Toggle tipo */}
          <div style={styles.toggleRow}>
            {['challenge', 'fondeada'].map(t => (
              <button key={t} style={{
                ...styles.toggleBtn,
                backgroundColor: tipoNuevo === t ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                color: tipoNuevo === t ? '#fff' : 'var(--text-secondary)',
              }} onClick={() => setTipoNuevo(t)}>
                {t === 'challenge' ? '🎯 Challenge' : '💰 Fondeada'}
              </button>
            ))}
          </div>

          {tipoNuevo === 'challenge' ? (
            <ChallengeForm form={formChallenge} onChange={setFormChallenge} />
          ) : (
            <FondedaForm form={formFondeada} onChange={setFormFondeada} />
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button style={styles.btnGhost} onClick={() => setShowNew(false)}>Cancelar</button>
            <button style={styles.btnPrimary} onClick={handleCreate} disabled={savingNew}>
              {savingNew ? 'Guardando...' : 'Crear cuenta'}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div style={styles.emptyState}>Cargando...</div>
      ) : rows.length === 0 ? (
        <div style={styles.emptyState}>
          <DollarSign size={32} color="var(--text-secondary)" />
          <div style={{ marginTop: 12 }}>No hay cuentas todavía.</div>
        </div>
      ) : (
        <div style={styles.list}>
          {/* Header tabla desktop */}
          <div className="desktop-only" style={styles.listHeader}>
            <span style={{ flex: 2 }}>Nombre</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Costo</span>
            <span style={{ flex: 1, textAlign: 'center' }}>Estado</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Cobrado</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Neto</span>
            <span style={{ width: 80 }}></span>
          </div>

          {rows.map(r => {
            const cobrado = (r.cobros || []).reduce((s, c) => s + (Number(c.monto_usd) || 0), 0);
            const neto = cobrado - (Number(r.costo_usd) || 0);
            const meta = getEstadoMeta(r.tipo, r.estado, r.en_retiro);
            const isArchivada = r.estado === 'archivada';
            const detailPath = r.tipo === 'challenge' ? `/challenges/${r.id}` : `/fondeadas/${r.id}`;

            return (
              <div key={r.id} style={{ ...styles.row, opacity: isArchivada ? 0.55 : 1 }}>
                <div style={styles.rowName}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {r.tipo === 'challenge' ? '🎯' : '💰'}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{r.nombre}</span>
                  </div>
                  <div style={styles.rowNameSub}>
                    {(r.cobros || []).length} cobro{(r.cobros || []).length !== 1 ? 's' : ''}
                    {r.tipo === 'challenge' && r.slot ? ` · Slot ${r.slot}` : ''}
                  </div>
                </div>

                {/* Costo editable inline */}
                <div style={styles.rowCosto}>
                  <input
                    type="number"
                    step="0.01"
                    value={r.costo_usd ?? ''}
                    placeholder="—"
                    onChange={e => setRows(prev => prev.map(x => x.id === r.id ? { ...x, costo_usd: e.target.value } : x))}
                    onBlur={e => handleUpdateField(r, { costo_usd: Number(e.target.value) || 0 })}
                    style={styles.costoInput}
                  />
                </div>

                {/* Estado badge */}
                <div style={styles.rowEstado}>
                  <span style={{
                    ...styles.estadoBadge,
                    backgroundColor: meta.bg,
                    color: meta.color,
                  }}>
                    {meta.icon} {meta.label}
                  </span>
                </div>

                <div style={{ ...styles.rowNum, color: cobrado > 0 ? '#30d158' : 'var(--text-secondary)' }}>
                  {fmt(cobrado)}
                </div>
                <div style={{ ...styles.rowNum, fontWeight: 700, color: neto >= 0 ? '#30d158' : '#ff453a' }}>
                  {neto >= 0 ? '+' : ''}{fmt(neto)}
                </div>

                <div style={styles.rowActions}>
                  <button style={styles.iconBtn} title="Ver detalle" onClick={() => navigate(detailPath)}>
                    <ArrowRight size={15} color="var(--accent-blue)" />
                  </button>
                  <button style={styles.iconBtn} title="Cobros" onClick={() => setEditing(r)}>
                    <Edit3 size={15} color="var(--text-secondary)" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal cobros */}
      {editing && (
        <div style={styles.modalOverlay} onClick={() => setEditing(null)}>
          <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>
                  {editing.tipo === 'challenge' ? '🎯' : '💰'} {editing.nombre}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Costo: {fmt(editing.costo_usd)} · {(editing.cobros || []).length} cobros
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  style={{ ...styles.iconBtn, backgroundColor: 'rgba(10,132,255,0.1)', borderRadius: 8, padding: '6px 10px' }}
                  onClick={() => navigate(editing.tipo === 'challenge' ? `/challenges/${editing.id}` : `/fondeadas/${editing.id}`)}
                >
                  <ArrowRight size={14} color="var(--accent-blue)" />
                </button>
                <button style={styles.iconBtn} onClick={() => setEditing(null)}>
                  <X size={18} color="var(--text-secondary)" />
                </button>
              </div>
            </div>

            {/* Nombre editable */}
            <div style={styles.sectionLabel}>Nombre</div>
            <input
              style={styles.modalInput}
              value={editing.nombre}
              onChange={e => setEditing(prev => ({ ...prev, nombre: e.target.value }))}
              onBlur={e => handleUpdateField(editing, { nombre: e.target.value.trim() })}
            />

            {/* Costo editable */}
            <div style={styles.sectionLabel}>Costo USD</div>
            <input
              type="number" step="0.01"
              style={styles.modalInput}
              value={editing.costo_usd ?? ''}
              onChange={e => setEditing(prev => ({ ...prev, costo_usd: e.target.value }))}
              onBlur={e => handleUpdateField(editing, { costo_usd: Number(e.target.value) || 0 })}
            />

            {/* Cobros */}
            <div style={styles.sectionLabel}>Cobros registrados</div>
            {(editing.cobros || []).length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', paddingBottom: 8 }}>Sin cobros todavía.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {(editing.cobros || []).map(k => (
                  <div key={k.id} style={styles.cobroRow}>
                    <div>
                      <span style={{ fontWeight: 600, color: '#30d158' }}>+{fmt(k.monto_usd)}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>
                        {new Date(k.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {k.nota ? ` · ${k.nota}` : ''}
                      </span>
                    </div>
                    <button style={styles.iconBtn} onClick={() => handleDeleteCobro(k.id)}>
                      <Trash2 size={13} color="#ff453a" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Agregar cobro */}
            <div style={styles.sectionLabel}>Agregar cobro</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" step="0.01" style={styles.modalInput}
                  placeholder="Monto USD" value={newCobroMonto}
                  onChange={e => setNewCobroMonto(e.target.value)} />
                <input type="date" style={{ ...styles.modalInput, maxWidth: 160 }}
                  value={newCobroFecha}
                  onChange={e => setNewCobroFecha(e.target.value)} />
              </div>
              <input style={styles.modalInput} placeholder="Nota (opcional)"
                value={newCobroNota} onChange={e => setNewCobroNota(e.target.value)} />
              <button style={styles.btnPrimary} onClick={handleAddCobro}>Agregar cobro</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

function TotalCard({ label, value, color, sign = false }) {
  const fmt2 = (n) =>
    `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div style={styles.totalCard}>
      <div style={styles.totalLabel}>{label}</div>
      <div style={{ ...styles.totalValue, color }}>
        {sign && value >= 0 ? '+' : ''}{fmt2(value)}
      </div>
    </div>
  );
}

function ChallengeForm({ form, onChange }) {
  const set = (k, v) => onChange(f => ({ ...f, [k]: v }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={styles.formRow}>
        <input style={styles.input} placeholder="Nombre (ej: FTMO 10k Fase 1)"
          value={form.nombre} onChange={e => set('nombre', e.target.value)} />
        <input type="number" step="0.01" style={{ ...styles.input, maxWidth: 140 }}
          placeholder="Costo USD" value={form.costo_usd} onChange={e => set('costo_usd', e.target.value)} />
      </div>
      <div style={styles.formRow}>
        <select style={styles.input} value={form.slot} onChange={e => set('slot', e.target.value)}>
          {['A','B','C'].map(s => <option key={s} value={s}>Slot {s}</option>)}
        </select>
        <input type="number" style={styles.input} placeholder="Balance inicial"
          value={form.balance} onChange={e => set('balance', e.target.value)} />
      </div>
      <div style={styles.formRow}>
        <input type="number" style={styles.input} placeholder="Objetivo USD"
          value={form.objetivo} onChange={e => set('objetivo', e.target.value)} />
        <input type="number" style={styles.input} placeholder="Max loss total"
          value={form.max_loss} onChange={e => set('max_loss', e.target.value)} />
        <input type="number" style={styles.input} placeholder="Max loss diario"
          value={form.max_daily_loss} onChange={e => set('max_daily_loss', e.target.value)} />
      </div>
    </div>
  );
}

function FondedaForm({ form, onChange }) {
  const set = (k, v) => onChange(f => ({ ...f, [k]: v }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={styles.formRow}>
        <input style={styles.input} placeholder="Nombre (ej: Alpha Capital 10K)"
          value={form.nombre} onChange={e => set('nombre', e.target.value)} />
        <input style={{ ...styles.input, maxWidth: 180 }} placeholder="Broker (opcional)"
          value={form.broker} onChange={e => set('broker', e.target.value)} />
      </div>
      <div style={styles.formRow}>
        <input type="number" style={styles.input} placeholder="Balance inicial USD"
          value={form.balance} onChange={e => set('balance', e.target.value)} />
        <input type="number" step="0.01" style={{ ...styles.input, maxWidth: 140 }}
          placeholder="Costo USD" value={form.costo_usd} onChange={e => set('costo_usd', e.target.value)} />
      </div>
      <div style={styles.formRow}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Objetivo retiro %</span>
          <input type="number" style={styles.input} value={form.objetivo_retiro_pct}
            onChange={e => set('objetivo_retiro_pct', e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Consistencia</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{
              ...styles.toggleBtn, flex: 1,
              backgroundColor: form.regla_consistencia ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
              color: form.regla_consistencia ? '#fff' : 'var(--text-secondary)',
            }} onClick={() => set('regla_consistencia', true)}>Sí</button>
            <button style={{
              ...styles.toggleBtn, flex: 1,
              backgroundColor: !form.regla_consistencia ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
              color: !form.regla_consistencia ? '#fff' : 'var(--text-secondary)',
            }} onClick={() => set('regla_consistencia', false)}>No</button>
          </div>
        </div>
        {form.regla_consistencia && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Límite %</span>
            <input type="number" style={styles.input} value={form.consistencia_pct}
              onChange={e => set('consistencia_pct', e.target.value)} />
          </div>
        )}
      </div>
    </div>
  );
}

function HuerfanoRow({ huerfano, rows, onLink }) {
  const [targetId, setTargetId] = useState('');
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', width: '100%', marginTop: 8 }}>
      <span style={{ fontSize: 13, flex: 1, minWidth: 120 }}>
        📋 <strong>{huerfano.nombre}</strong> — Costo: ${huerfano.costo_usd || 0}
      </span>
      <select
        style={{ ...styles.input, flex: 1, minWidth: 150 }}
        value={targetId}
        onChange={e => setTargetId(e.target.value)}
      >
        <option value="">Vincular a...</option>
        {rows.map(r => (
          <option key={r.id} value={r.id}>
            {r.tipo === 'challenge' ? '🎯' : '💰'} {r.nombre}
          </option>
        ))}
      </select>
      <button
        style={{ ...styles.btnPrimary, padding: '8px 12px', fontSize: 12 }}
        disabled={!targetId}
        onClick={() => onLink(huerfano.id, targetId)}
      >
        Vincular
      </button>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const styles = {
  container: { padding: '16px 20px 80px', maxWidth: 1100, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 700, margin: 0 },
  subtitle: { fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' },
  newBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    backgroundColor: 'var(--accent-blue)', color: '#fff',
    border: 'none', borderRadius: 10, padding: '9px 14px',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },

  totalsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 },
  totalCard: { backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' },
  totalLabel: { fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  totalValue: { fontSize: 22, fontWeight: 800 },

  migrationBanner: {
    display: 'flex', flexDirection: 'column', gap: 4,
    backgroundColor: 'rgba(255,159,10,0.08)',
    border: '1px solid rgba(255,159,10,0.25)',
    borderRadius: 12, padding: '12px 14px', marginBottom: 14,
  },

  formCard: {
    backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: 14, padding: 14, marginBottom: 16,
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  toggleRow: { display: 'flex', gap: 8, marginBottom: 4 },
  toggleBtn: { flex: 1, padding: '8px 12px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  formRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  input: {
    flex: 1, minWidth: 100,
    backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '9px 12px', fontSize: 14, color: 'var(--text-primary)', outline: 'none',
  },
  btnGhost: {
    backgroundColor: 'transparent', border: '1px solid var(--border)',
    borderRadius: 10, padding: '8px 14px', fontSize: 13,
    color: 'var(--text-secondary)', cursor: 'pointer',
  },
  btnPrimary: {
    backgroundColor: 'var(--accent-blue)', color: '#fff',
    border: 'none', borderRadius: 10, padding: '10px 14px',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },

  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  listHeader: {
    display: 'flex', gap: 8, padding: '0 14px',
    fontSize: 11, color: 'var(--text-secondary)',
    textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600,
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 8,
    backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '10px 14px', flexWrap: 'wrap',
  },
  rowName: { flex: 2, minWidth: 140 },
  rowNameSub: { fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 },
  rowCosto: { flex: 1, minWidth: 80 },
  costoInput: {
    width: '100%', backgroundColor: 'transparent',
    border: '1px solid var(--border)', borderRadius: 8,
    padding: '5px 8px', fontSize: 13, fontWeight: 600,
    color: 'var(--text-primary)', outline: 'none', textAlign: 'right',
  },
  rowEstado: { flex: 1, display: 'flex', justifyContent: 'center', minWidth: 100 },
  estadoBadge: {
    fontSize: 11, fontWeight: 600, padding: '4px 10px',
    borderRadius: 8, whiteSpace: 'nowrap',
  },
  rowNum: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: 600, minWidth: 80 },
  rowActions: { display: 'flex', gap: 4, width: 68, justifyContent: 'flex-end' },
  iconBtn: {
    backgroundColor: 'transparent', border: 'none',
    borderRadius: 8, padding: 6, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  emptyState: {
    padding: '60px 20px', textAlign: 'center',
    backgroundColor: 'var(--bg-secondary)', border: '1px dashed var(--border)',
    borderRadius: 14, color: 'var(--text-primary)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },

  modalOverlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 50, padding: 16,
  },
  modalBox: {
    backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)',
    borderRadius: 16, padding: 20, width: '100%', maxWidth: 520,
    maxHeight: '90vh', overflowY: 'auto',
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 16,
  },
  modalInput: {
    flex: 1, width: '100%', boxSizing: 'border-box',
    backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '9px 12px', fontSize: 14,
    color: 'var(--text-primary)', outline: 'none', marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 4,
  },
  cobroRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '8px 12px',
  },
};
