import { useEffect, useState } from 'react';
import {
  collection, query, where, getDocs, addDoc, updateDoc,
  deleteDoc, doc,
} from 'firebase/firestore';
import { Plus, Edit3, Trash2, X, DollarSign, ArrowRight, Search } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useNavigate } from 'react-router';
import { db } from '../lib/firebase';
import { useToast } from '../components/ui/Toast';

const USER_ID = 'user_test_123';

const fmt = (n) =>
  `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ESTADO_META = {
  activo:    { label: 'En curso',   color: '#ff9f0a', bg: 'rgba(255,159,10,0.12)'  },
  danger:    { label: 'En riesgo',  color: '#ff6b35', bg: 'rgba(255,107,53,0.12)'  },
  aprobada:  { label: 'Aprobada',   color: '#30d158', bg: 'rgba(48,209,88,0.12)'   },
  quemada:   { label: 'Quemada',    color: '#ff453a', bg: 'rgba(255,69,58,0.12)'   },
  archivada: { label: 'Archivada',  color: '#8e8e93', bg: 'rgba(142,142,147,0.12)' },
};

const getEstadoMeta = (tipo, estado, enRetiro) => {
  if (tipo === 'fondeada') {
    if (estado === 'quemada') return ESTADO_META.quemada;
    if (enRetiro) return { label: 'En retiro', color: '#5e9eff', bg: 'rgba(94,158,255,0.12)' };
    return { label: 'Fondeada', color: '#30d158', bg: 'rgba(48,209,88,0.12)' };
  }
  return ESTADO_META[estado] || ESTADO_META.activo;
};

const TIPO_ICON = { challenge: '🎯', fondeada: '💰', historico: '📋' };

export default function CuentasRegistro() {
  const addToast = useToast();
  const navigate = useNavigate();

  const [operativas, setOperativas] = useState([]);   // accounts + funded_accounts
  const [historicas, setHistoricas] = useState([]);   // cuentas_registro (historial manual)
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  // Form nueva cuenta
  const [tipoNuevo, setTipoNuevo] = useState('historico'); // 'challenge' | 'fondeada' | 'historico'
  const [formChallenge, setFormChallenge] = useState({
    nombre: '', costo_usd: '', slot: 'A',
    balance: '10000', objetivo: '1000', max_loss: '1000', max_daily_loss: '500',
  });
  const [formFondeada, setFormFondeada] = useState({
    nombre: '', broker: '', costo_usd: '', balance: '',
    objetivo_retiro_pct: 2, regla_consistencia: true, consistencia_pct: 40,
  });
  const [formHistorico, setFormHistorico] = useState({ nombre: '', costo_usd: '', notas: '' });
  const [savingNew, setSavingNew] = useState(false);

  // Modal cobros
  const [newCobroMonto, setNewCobroMonto] = useState('');
  const [newCobroFecha, setNewCobroFecha] = useState(new Date().toISOString().slice(0, 10));
  const [newCobroNota, setNewCobroNota] = useState('');

  // ── Carga ───────────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      const [challengeSnap, fundedSnap, historicasSnap] = await Promise.all([
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

      const order = { activo: 0, danger: 1, aprobada: 2, quemada: 3, archivada: 4 };
      const all = [...challenges, ...funded].sort((a, b) => {
        const pa = a.tipo === 'fondeada' ? (a.estado === 'quemada' ? 3 : 0) : (order[a.estado] ?? 0);
        const pb = b.tipo === 'fondeada' ? (b.estado === 'quemada' ? 3 : 0) : (order[b.estado] ?? 0);
        if (pa !== pb) return pa - pb;
        return (a.nombre || '').localeCompare(b.nombre || '');
      });

      setOperativas(all);
      setHistoricas(
        historicasSnap.docs
          .map(d => ({ id: d.id, tipo: 'historico', col: 'cuentas_registro', ...d.data() }))
          .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
      );
    } catch (err) {
      console.error('Error cargando cuentas:', err);
      addToast('Error al cargar cuentas.', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Crear cuenta ────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    setSavingNew(true);
    try {
      if (tipoNuevo === 'historico') {
        if (!formHistorico.nombre.trim()) { addToast('Ingresá un nombre.', 'warning'); setSavingNew(false); return; }
        await addDoc(collection(db, 'cuentas_registro'), {
          user_id: USER_ID,
          nombre: formHistorico.nombre.trim(),
          costo_usd: Number(formHistorico.costo_usd) || 0,
          notas: formHistorico.notas.trim() || null,
          cobros: [],
          estado: 'quemada',
          createdAt: new Date().toISOString(),
        });
        setFormHistorico({ nombre: '', costo_usd: '', notas: '' });

      } else if (tipoNuevo === 'challenge') {
        const { nombre, costo_usd, slot, balance, objetivo, max_loss, max_daily_loss } = formChallenge;
        if (!nombre.trim()) { addToast('Ingresá un nombre.', 'warning'); setSavingNew(false); return; }
        await addDoc(collection(db, 'accounts'), {
          user_id: USER_ID, slot, label: `Cuenta ${slot}`, nombre: nombre.trim(),
          fase_actual: 'Fase 1', estado: 'activo',
          balance_inicial_usd: Number(balance) || 10000,
          balance_actual_usd: Number(balance) || 10000,
          objetivo_usd: Number(objetivo) || 1000,
          max_loss_usd: Number(max_loss) || 1000,
          max_daily_loss_usd: Number(max_daily_loss) || 500,
          pnl_acumulado_usd: 0,
          orden_rotacion: slot === 'A' ? 1 : slot === 'B' ? 2 : 3,
          es_cuenta_activa: slot === 'A',
          costo_usd: Number(costo_usd) || 0, cobros: [],
          created_at: new Date().toISOString(),
        });
        setFormChallenge({ nombre: '', costo_usd: '', slot: 'A', balance: '10000', objetivo: '1000', max_loss: '1000', max_daily_loss: '500' });

      } else {
        const { nombre, broker, costo_usd, balance, objetivo_retiro_pct, regla_consistencia, consistencia_pct } = formFondeada;
        if (!nombre.trim() || !balance) { addToast('Completá nombre y balance.', 'warning'); setSavingNew(false); return; }
        await addDoc(collection(db, 'funded_accounts'), {
          user_id: USER_ID, nombre: nombre.trim(),
          broker: broker.trim() || 'Cuenta Fondeada',
          balance_inicial_usd: Number(balance), balance_actual_usd: Number(balance),
          pnl_acumulado_usd: 0, objetivo_retiro_pct: Number(objetivo_retiro_pct) || 2,
          regla_consistencia, consistencia_pct: regla_consistencia ? (Number(consistencia_pct) || 40) : null,
          commission_profile: 'alpha_raw', commission_per_side_usd: 2.5, notas: '',
          estado: 'activo', en_retiro: false, fecha_cobro: null,
          ciclo_actual: 1, historial_ciclos: [],
          costo_usd: Number(costo_usd) || 0, cobros: [],
          createdAt: new Date().toISOString(),
        });
        setFormFondeada({ nombre: '', broker: '', costo_usd: '', balance: '', objetivo_retiro_pct: 2, regla_consistencia: true, consistencia_pct: 40 });
      }

      setShowNew(false);
      await load();
      addToast('Cuenta creada.', 'success');
    } catch (err) {
      console.error(err);
      addToast('Error al crear.', 'error');
    }
    setSavingNew(false);
  };

  // ── Actualizar campo ────────────────────────────────────────────────────────
  const handleUpdateField = async (row, patch) => {
    try {
      await updateDoc(doc(db, row.col, row.id), patch);
      const setter = row.tipo === 'historico' ? setHistoricas : setOperativas;
      setter(prev => prev.map(r => r.id === row.id ? { ...r, ...patch } : r));
      if (editing?.id === row.id) setEditing(prev => ({ ...prev, ...patch }));
    } catch {
      addToast('Error al actualizar.', 'error');
    }
  };

  const handleDelete = async (row) => {
    const label = row.tipo === 'historico' ? 'este registro histórico' : `"${row.nombre}"`;
    if (!window.confirm(`¿Eliminar ${label}?`)) return;
    try {
      await deleteDoc(doc(db, row.col, row.id));
      const setter = row.tipo === 'historico' ? setHistoricas : setOperativas;
      setter(prev => prev.filter(r => r.id !== row.id));
      addToast('Eliminado.', 'success');
    } catch {
      addToast('Error al eliminar.', 'error');
    }
  };

  // ── Cobros ──────────────────────────────────────────────────────────────────
  const handleAddCobro = async () => {
    if (!editing) return;
    const monto = Number(newCobroMonto);
    if (!monto || monto <= 0) { addToast('Monto inválido.', 'warning'); return; }
    const cobro = { id: nanoid(8), monto_usd: monto, fecha: newCobroFecha || new Date().toISOString().slice(0, 10), nota: newCobroNota.trim() || null };
    await handleUpdateField(editing, { cobros: [...(editing.cobros || []), cobro] });
    setNewCobroMonto(''); setNewCobroNota('');
    addToast('Cobro agregado.', 'success');
  };

  const handleDeleteCobro = async (cobroId) => {
    if (!editing) return;
    await handleUpdateField(editing, { cobros: (editing.cobros || []).filter(c => c.id !== cobroId) });
  };

  // ── Lista unificada y ordenada ───────────────────────────────────────────────
  const ORDER = { activo: 0, danger: 1, aprobada: 2, quemada: 3, archivada: 4, historico: 5 };
  const allSorted = [...operativas, ...historicas].sort((a, b) => {
    const pa = a.tipo === 'historico' ? ORDER.historico
      : a.tipo === 'fondeada' ? (a.estado === 'quemada' ? ORDER.quemada : 0)
      : (ORDER[a.estado] ?? 0);
    const pb = b.tipo === 'historico' ? ORDER.historico
      : b.tipo === 'fondeada' ? (b.estado === 'quemada' ? ORDER.quemada : 0)
      : (ORDER[b.estado] ?? 0);
    if (pa !== pb) return pa - pb;
    return (a.nombre || '').localeCompare(b.nombre || '');
  });

  // ── Filtro por búsqueda ──────────────────────────────────────────────────────
  const q = search.toLowerCase().trim();
  const filteredAll = q
    ? allSorted.filter(r =>
        (r.nombre || '').toLowerCase().includes(q) ||
        (r.broker || '').toLowerCase().includes(q) ||
        (r.slot || '').toLowerCase().includes(q) ||
        (r.notas || '').toLowerCase().includes(q)
      )
    : allSorted;

  // ── Totales ──────────────────────────────────────────────────────────────────
  const allRows = [...operativas, ...historicas];
  const totalInvertido = allRows.reduce((s, r) => s + (Number(r.costo_usd) || 0), 0);
  // Cobrado solo cuenta en fondeadas e históricas (los challenges no se cobran, se pasan)
  const totalCobrado = allRows
    .filter(r => r.tipo !== 'challenge')
    .reduce((s, r) => s + (r.cobros || []).reduce((a, c) => a + (Number(c.monto_usd) || 0), 0), 0);
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

      {/* Buscador */}
      <div style={styles.searchWrapper}>
        <Search size={15} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
        <input
          style={styles.searchInput}
          placeholder="Buscar por nombre, broker, slot..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button style={styles.searchClear} onClick={() => setSearch('')}>
            <X size={14} color="var(--text-secondary)" />
          </button>
        )}
      </div>

      {/* Totalizador */}
      <div style={styles.totalsRow}>
        <TotalCard label="Invertido" value={totalInvertido} color="#ff9f0a" />
        <TotalCard label="Cobrado" value={totalCobrado} color="#30d158" />
        <TotalCard label="Saldo neto" value={saldoNeto} color={saldoNeto >= 0 ? '#30d158' : '#ff453a'} sign />
      </div>

      {/* Form nueva cuenta */}
      {showNew && (
        <div style={styles.formCard}>
          <div style={styles.toggleRow}>
            {[
              { key: 'historico',  label: '📋 Histórica' },
              { key: 'challenge',  label: '🎯 Challenge' },
              { key: 'fondeada',   label: '💰 Fondeada'  },
            ].map(t => (
              <button key={t.key} style={{
                ...styles.toggleBtn,
                backgroundColor: tipoNuevo === t.key ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                color: tipoNuevo === t.key ? '#fff' : 'var(--text-secondary)',
              }} onClick={() => setTipoNuevo(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {tipoNuevo === 'historico' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={styles.formRow}>
                <input style={styles.input} placeholder="Nombre (ej: FTMO 10k quemada)"
                  value={formHistorico.nombre} onChange={e => setFormHistorico(f => ({ ...f, nombre: e.target.value }))} />
                <input type="number" step="0.01" style={{ ...styles.input, maxWidth: 140 }}
                  placeholder="Costo USD" value={formHistorico.costo_usd}
                  onChange={e => setFormHistorico(f => ({ ...f, costo_usd: e.target.value }))} />
              </div>
              <input style={styles.input} placeholder="Notas (opcional)"
                value={formHistorico.notas} onChange={e => setFormHistorico(f => ({ ...f, notas: e.target.value }))} />
            </div>
          )}
          {tipoNuevo === 'challenge' && <ChallengeForm form={formChallenge} onChange={setFormChallenge} />}
          {tipoNuevo === 'fondeada'  && <FondedaForm form={formFondeada} onChange={setFormFondeada} />}

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
      ) : (
        <div style={styles.list}>
          {/* Header tabla desktop */}
          <div className="desktop-only" style={styles.listHeader}>
            <span style={{ flex: 2 }}>Nombre</span>
            <span style={{ flex: 1, textAlign: 'center' }}>Estado</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Costo</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Cobrado</span>
            <span style={{ width: 80 }}></span>
          </div>

          {/* Lista unificada */}
          {filteredAll.map(r => <CuentaRow key={r.id} r={r} onEdit={() => setEditing(r)} onDelete={() => handleDelete(r)} onUpdate={handleUpdateField} navigate={navigate} />)}

          {filteredAll.length === 0 && (
            <div style={styles.emptyState}>
              <DollarSign size={32} color="var(--text-secondary)" />
              <div style={{ marginTop: 12 }}>No hay cuentas registradas.</div>
            </div>
          )}
        </div>
      )}

      {/* Modal cobros */}
      {editing && (
        <div style={styles.modalOverlay} onClick={() => setEditing(null)}>
          <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>
                  {TIPO_ICON[editing.tipo] || '📋'} {editing.nombre}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Costo: {fmt(editing.costo_usd)} · {(editing.cobros || []).length} cobros
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {editing.tipo !== 'historico' && (
                  <button
                    style={{ ...styles.iconBtn, backgroundColor: 'rgba(10,132,255,0.1)', borderRadius: 8, padding: '6px 10px' }}
                    onClick={() => navigate(editing.tipo === 'challenge' ? `/challenges/${editing.id}` : `/fondeadas/${editing.id}`)}
                  >
                    <ArrowRight size={14} color="var(--accent-blue)" />
                  </button>
                )}
                <button style={styles.iconBtn} onClick={() => setEditing(null)}>
                  <X size={18} color="var(--text-secondary)" />
                </button>
              </div>
            </div>

            <div style={styles.sectionLabel}>Nombre</div>
            <input style={styles.modalInput} value={editing.nombre}
              onChange={e => setEditing(p => ({ ...p, nombre: e.target.value }))}
              onBlur={e => handleUpdateField(editing, { nombre: e.target.value.trim() })} />

            <div style={styles.sectionLabel}>Costo USD</div>
            <input type="number" step="0.01" style={styles.modalInput}
              value={editing.costo_usd ?? ''}
              onChange={e => setEditing(p => ({ ...p, costo_usd: e.target.value }))}
              onBlur={e => handleUpdateField(editing, { costo_usd: Number(e.target.value) || 0 })} />

            {editing.tipo === 'historico' && (
              <>
                <div style={styles.sectionLabel}>Notas</div>
                <input style={styles.modalInput} placeholder="Notas opcionales"
                  value={editing.notas || ''}
                  onChange={e => setEditing(p => ({ ...p, notas: e.target.value }))}
                  onBlur={e => handleUpdateField(editing, { notas: e.target.value.trim() || null })} />
              </>
            )}

            <div style={styles.sectionLabel}>Cobros</div>
            {(editing.cobros || []).length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', paddingBottom: 8 }}>Sin cobros.</div>
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

            <div style={styles.sectionLabel}>Agregar cobro</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" step="0.01" style={styles.modalInput} placeholder="Monto USD"
                  value={newCobroMonto} onChange={e => setNewCobroMonto(e.target.value)} />
                <input type="date" style={{ ...styles.modalInput, maxWidth: 160 }}
                  value={newCobroFecha} onChange={e => setNewCobroFecha(e.target.value)} />
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

// ── Fila de cuenta ────────────────────────────────────────────────────────────
function CuentaRow({ r, onEdit, onDelete, onUpdate, navigate }) {
  const esChallenge = r.tipo === 'challenge';
  const cobrado = esChallenge ? null : (r.cobros || []).reduce((s, c) => s + (Number(c.monto_usd) || 0), 0);
  const meta = r.tipo === 'historico'
    ? { label: 'Historial', color: '#8e8e93', bg: 'rgba(142,142,147,0.12)' }
    : getEstadoMeta(r.tipo, r.estado, r.en_retiro);
  const isArchivada = r.estado === 'archivada';
  const detailPath = r.tipo === 'challenge' ? `/challenges/${r.id}` : `/fondeadas/${r.id}`;

  return (
    <div style={{ ...styles.row, opacity: isArchivada ? 0.55 : 1 }}>
      {/* Nombre */}
      <div style={styles.rowName}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13 }}>{TIPO_ICON[r.tipo] || '📋'}</span>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{r.nombre}</span>
        </div>
        <div style={styles.rowNameSub}>
          {r.tipo === 'challenge' ? 'Challenge' : r.tipo === 'fondeada' ? 'Fondeada' : 'Histórica'}
        </div>
      </div>

      {/* Estado */}
      <div style={styles.rowEstado}>
        <span style={{ ...styles.estadoBadge, backgroundColor: meta.bg, color: meta.color }}>
          {meta.label}
        </span>
      </div>

      {/* Costo — editable inline */}
      <div style={styles.rowCosto}>
        <input
          type="number" step="0.01"
          defaultValue={r.costo_usd ?? ''}
          placeholder="—"
          key={`${r.id}-costo`}
          onBlur={e => onUpdate(r, { costo_usd: Number(e.target.value) || 0 })}
          style={styles.costoInput}
        />
      </div>

      {/* Cobrado — solo fondeadas e históricas */}
      <div style={{ ...styles.rowNum, color: cobrado > 0 ? '#30d158' : 'var(--text-secondary)' }}>
        {cobrado === null
          ? <span style={{ color: 'var(--text-secondary)' }}>—</span>
          : cobrado > 0 ? fmt(cobrado) : <span style={{ color: 'var(--text-secondary)' }}>—</span>
        }
      </div>

      <div style={styles.rowActions}>
        {r.tipo !== 'historico' && (
          <button style={styles.iconBtn} title="Ver detalle" onClick={() => navigate(detailPath)}>
            <ArrowRight size={15} color="var(--accent-blue)" />
          </button>
        )}
        <button style={styles.iconBtn} title="Cobros / editar" onClick={onEdit}>
          <Edit3 size={15} color="var(--text-secondary)" />
        </button>
        <button style={styles.iconBtn} title="Eliminar" onClick={onDelete}>
          <Trash2 size={15} color="#ff453a" />
        </button>
      </div>
    </div>
  );
}

// ── Subforms ──────────────────────────────────────────────────────────────────
function ChallengeForm({ form, onChange }) {
  const set = (k, v) => onChange(f => ({ ...f, [k]: v }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={styles.formRow}>
        <input style={styles.input} placeholder="Nombre" value={form.nombre} onChange={e => set('nombre', e.target.value)} />
        <input type="number" step="0.01" style={{ ...styles.input, maxWidth: 140 }} placeholder="Costo USD" value={form.costo_usd} onChange={e => set('costo_usd', e.target.value)} />
      </div>
      <div style={styles.formRow}>
        <select style={styles.input} value={form.slot} onChange={e => set('slot', e.target.value)}>
          {['A','B','C'].map(s => <option key={s} value={s}>Slot {s}</option>)}
        </select>
        <input type="number" style={styles.input} placeholder="Balance inicial" value={form.balance} onChange={e => set('balance', e.target.value)} />
      </div>
      <div style={styles.formRow}>
        <input type="number" style={styles.input} placeholder="Objetivo USD" value={form.objetivo} onChange={e => set('objetivo', e.target.value)} />
        <input type="number" style={styles.input} placeholder="Max loss total" value={form.max_loss} onChange={e => set('max_loss', e.target.value)} />
        <input type="number" style={styles.input} placeholder="Max loss diario" value={form.max_daily_loss} onChange={e => set('max_daily_loss', e.target.value)} />
      </div>
    </div>
  );
}

function FondedaForm({ form, onChange }) {
  const set = (k, v) => onChange(f => ({ ...f, [k]: v }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={styles.formRow}>
        <input style={styles.input} placeholder="Nombre" value={form.nombre} onChange={e => set('nombre', e.target.value)} />
        <input style={{ ...styles.input, maxWidth: 180 }} placeholder="Broker (opcional)" value={form.broker} onChange={e => set('broker', e.target.value)} />
      </div>
      <div style={styles.formRow}>
        <input type="number" style={styles.input} placeholder="Balance inicial USD" value={form.balance} onChange={e => set('balance', e.target.value)} />
        <input type="number" step="0.01" style={{ ...styles.input, maxWidth: 140 }} placeholder="Costo USD" value={form.costo_usd} onChange={e => set('costo_usd', e.target.value)} />
        <input type="number" style={{ ...styles.input, maxWidth: 100 }} placeholder="Obj. retiro %" value={form.objetivo_retiro_pct} onChange={e => set('objetivo_retiro_pct', e.target.value)} />
      </div>
    </div>
  );
}

function TotalCard({ label, value, color, sign = false }) {
  const f = (n) => `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div style={styles.totalCard}>
      <div style={styles.totalLabel}>{label}</div>
      <div style={{ ...styles.totalValue, color }}>{sign && value >= 0 ? '+' : ''}{f(value)}</div>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const styles = {
  container: { padding: '16px 20px 80px', maxWidth: 1100, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 700, margin: 0 },
  subtitle: { fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' },
  newBtn: { display: 'flex', alignItems: 'center', gap: 6, backgroundColor: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  searchWrapper: { display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '9px 12px', marginBottom: 14 },
  searchInput: { flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text-primary)', minWidth: 0 },
  searchClear: { background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' },
  totalsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 },
  totalCard: { backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' },
  totalLabel: { fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  totalValue: { fontSize: 22, fontWeight: 800 },
  formCard: { backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 },
  toggleRow: { display: 'flex', gap: 8 },
  toggleBtn: { flex: 1, padding: '8px 12px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  formRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  input: { flex: 1, minWidth: 100, backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', fontSize: 14, color: 'var(--text-primary)', outline: 'none' },
  btnGhost: { backgroundColor: 'transparent', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' },
  btnPrimary: { backgroundColor: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  listHeader: { display: 'flex', gap: 8, padding: '0 14px', fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 },
  sectionDivider: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 4px 2px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', flexWrap: 'wrap' },
  rowName: { flex: 2, minWidth: 140 },
  rowNameSub: { fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 },
  rowCosto: { flex: 1, minWidth: 80 },
  costoInput: { width: '100%', backgroundColor: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', outline: 'none', textAlign: 'right' },
  rowEstado: { flex: 1, display: 'flex', justifyContent: 'center', minWidth: 100 },
  estadoBadge: { fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8, whiteSpace: 'nowrap' },
  rowNum: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: 600, minWidth: 80 },
  rowActions: { display: 'flex', gap: 2, width: 80, justifyContent: 'flex-end' },
  iconBtn: { backgroundColor: 'transparent', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emptyState: { padding: '60px 20px', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', border: '1px dashed var(--border)', borderRadius: 14, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 },
  modalBox: { backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalInput: { flex: 1, width: '100%', boxSizing: 'border-box', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', fontSize: 14, color: 'var(--text-primary)', outline: 'none', marginBottom: 8 },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  cobroRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' },
};
