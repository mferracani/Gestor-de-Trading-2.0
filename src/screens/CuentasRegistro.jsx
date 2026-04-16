import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Plus, Edit3, Trash2, X, DollarSign } from 'lucide-react';
import { nanoid } from 'nanoid';
import { db } from '../lib/firebase';
import { useToast } from '../components/ui/Toast';

const USER_ID = 'user_test_123';

const ESTADOS = [
  { value: 'en_curso', label: 'En curso', color: '#ff9f0a', bg: 'rgba(255,159,10,0.12)' },
  { value: 'fundada', label: 'Fundada', color: '#30d158', bg: 'rgba(48,209,88,0.12)' },
  { value: 'quemada', label: 'Quemada', color: '#ff453a', bg: 'rgba(255,69,58,0.12)' },
];

const getEstadoMeta = (val) => ESTADOS.find(e => e.value === val) || ESTADOS[0];

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CuentasRegistro() {
  const addToast = useToast();
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form nueva cuenta
  const [showNew, setShowNew] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newCosto, setNewCosto] = useState('');
  const [newEstado, setNewEstado] = useState('en_curso');
  const [savingNew, setSavingNew] = useState(false);

  // Modal edición de cobros
  const [editing, setEditing] = useState(null);
  const [newCobroMonto, setNewCobroMonto] = useState('');
  const [newCobroFecha, setNewCobroFecha] = useState(new Date().toISOString().slice(0, 10));
  const [newCobroNota, setNewCobroNota] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'cuentas_registro'), where('user_id', '==', USER_ID));
      const snap = await getDocs(q);
      const rows = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setCuentas(rows);
    } catch (err) {
      console.error('Error cargando cuentas:', err);
      addToast('Error al cargar cuentas.', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newNombre.trim()) {
      addToast('Ingresá un nombre.', 'warning');
      return;
    }
    setSavingNew(true);
    try {
      await addDoc(collection(db, 'cuentas_registro'), {
        user_id: USER_ID,
        nombre: newNombre.trim(),
        costo_usd: Number(newCosto) || 0,
        estado: newEstado,
        cobros: [],
        createdAt: new Date().toISOString(),
      });
      setNewNombre(''); setNewCosto(''); setNewEstado('en_curso');
      setShowNew(false);
      await load();
      addToast('Cuenta registrada.', 'success');
    } catch (err) {
      console.error(err);
      addToast('Error al crear.', 'error');
    }
    setSavingNew(false);
  };

  const handleUpdate = async (id, patch) => {
    try {
      await updateDoc(doc(db, 'cuentas_registro', id), patch);
      setCuentas(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
      if (editing?.id === id) setEditing(prev => ({ ...prev, ...patch }));
    } catch {
      addToast('Error al actualizar.', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta cuenta del registro?')) return;
    try {
      await deleteDoc(doc(db, 'cuentas_registro', id));
      setCuentas(prev => prev.filter(c => c.id !== id));
      addToast('Cuenta eliminada.', 'success');
    } catch {
      addToast('Error al eliminar.', 'error');
    }
  };

  const handleAddCobro = async () => {
    if (!editing) return;
    const monto = Number(newCobroMonto);
    if (!monto || monto <= 0) {
      addToast('Ingresá un monto válido.', 'warning');
      return;
    }
    const cobro = {
      id: nanoid(8),
      monto_usd: monto,
      fecha: newCobroFecha || new Date().toISOString().slice(0, 10),
      nota: newCobroNota.trim() || null,
    };
    const nextCobros = [...(editing.cobros || []), cobro];
    await handleUpdate(editing.id, { cobros: nextCobros });
    setNewCobroMonto(''); setNewCobroNota('');
    addToast('Cobro agregado.', 'success');
  };

  const handleDeleteCobro = async (cobroId) => {
    if (!editing) return;
    const nextCobros = (editing.cobros || []).filter(c => c.id !== cobroId);
    await handleUpdate(editing.id, { cobros: nextCobros });
  };

  // Totales
  const totalInvertido = cuentas.reduce((s, c) => s + (Number(c.costo_usd) || 0), 0);
  const totalCobrado = cuentas.reduce(
    (s, c) => s + (c.cobros || []).reduce((acc, k) => acc + (Number(k.monto_usd) || 0), 0),
    0
  );
  const saldoNeto = totalCobrado - totalInvertido;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Cuentas</h1>
          <p style={styles.subtitle}>Registro financiero de costos y cobros</p>
        </div>
        <button style={styles.newBtn} onClick={() => setShowNew(v => !v)}>
          <Plus size={16} />
          <span>Nueva</span>
        </button>
      </div>

      {/* Totalizador */}
      <div style={styles.totalsRow}>
        <TotalCard label="Invertido" value={totalInvertido} color="#ff9f0a" />
        <TotalCard label="Cobrado" value={totalCobrado} color="#30d158" />
        <TotalCard
          label="Saldo neto"
          value={saldoNeto}
          color={saldoNeto >= 0 ? '#30d158' : '#ff453a'}
          sign
        />
      </div>

      {/* Form nueva cuenta */}
      {showNew && (
        <div style={styles.formCard}>
          <div style={styles.formRow}>
            <input
              style={styles.input}
              placeholder="Nombre de la cuenta (ej: FTMO 10k Fase 1)"
              value={newNombre}
              onChange={e => setNewNombre(e.target.value)}
            />
            <input
              type="number"
              step="0.01"
              style={{ ...styles.input, maxWidth: 140 }}
              placeholder="Costo USD"
              value={newCosto}
              onChange={e => setNewCosto(e.target.value)}
            />
            <select
              style={{ ...styles.input, maxWidth: 140 }}
              value={newEstado}
              onChange={e => setNewEstado(e.target.value)}
            >
              {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={styles.btnGhost} onClick={() => setShowNew(false)}>Cancelar</button>
            <button style={styles.btnPrimary} onClick={handleCreate} disabled={savingNew}>
              {savingNew ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de cuentas */}
      {loading ? (
        <div style={styles.emptyState}>Cargando...</div>
      ) : cuentas.length === 0 ? (
        <div style={styles.emptyState}>
          <DollarSign size={32} color="var(--text-secondary)" />
          <div style={{ marginTop: 12 }}>Aún no registraste cuentas.</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Agregá una para empezar a llevar el balance.
          </div>
        </div>
      ) : (
        <div style={styles.list}>
          {/* Header de tabla (solo desktop) */}
          <div className="desktop-only" style={styles.listHeader}>
            <span style={{ flex: 2 }}>Nombre</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Costo</span>
            <span style={{ flex: 1, textAlign: 'center' }}>Estado</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Cobrado</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Neto</span>
            <span style={{ width: 80 }}></span>
          </div>

          {cuentas.map(c => {
            const cobrado = (c.cobros || []).reduce((s, k) => s + (Number(k.monto_usd) || 0), 0);
            const neto = cobrado - (Number(c.costo_usd) || 0);
            const estadoMeta = getEstadoMeta(c.estado);
            return (
              <div key={c.id} style={styles.row}>
                <div style={styles.rowName}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{c.nombre}</div>
                  <div style={styles.rowNameSub}>
                    {(c.cobros || []).length} {(c.cobros || []).length === 1 ? 'cobro' : 'cobros'}
                  </div>
                </div>
                <div style={styles.rowCosto}>{fmt(c.costo_usd)}</div>
                <div style={styles.rowEstado}>
                  <select
                    value={c.estado}
                    onChange={e => handleUpdate(c.id, { estado: e.target.value })}
                    style={{
                      ...styles.estadoSelect,
                      backgroundColor: estadoMeta.bg,
                      color: estadoMeta.color,
                      borderColor: estadoMeta.color + '40',
                    }}
                  >
                    {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>
                <div style={{ ...styles.rowCosto, color: cobrado > 0 ? '#30d158' : 'var(--text-secondary)' }}>
                  {fmt(cobrado)}
                </div>
                <div style={{ ...styles.rowCosto, fontWeight: 700, color: neto >= 0 ? '#30d158' : '#ff453a' }}>
                  {neto >= 0 ? '+' : ''}{fmt(neto)}
                </div>
                <div style={styles.rowActions}>
                  <button style={styles.iconBtn} title="Editar cobros" onClick={() => setEditing(c)}>
                    <Edit3 size={15} color="var(--text-secondary)" />
                  </button>
                  <button style={styles.iconBtn} title="Eliminar" onClick={() => handleDelete(c.id)}>
                    <Trash2 size={15} color="#ff453a" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de edición de cobros */}
      {editing && (
        <div style={styles.modalOverlay} onClick={() => setEditing(null)}>
          <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{editing.nombre}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Costo: {fmt(editing.costo_usd)} · {(editing.cobros || []).length} cobros
                </div>
              </div>
              <button style={styles.iconBtn} onClick={() => setEditing(null)}>
                <X size={18} color="var(--text-secondary)" />
              </button>
            </div>

            {/* Nombre y costo editables */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                style={styles.input}
                value={editing.nombre}
                onChange={e => setEditing(prev => ({ ...prev, nombre: e.target.value }))}
                onBlur={e => handleUpdate(editing.id, { nombre: e.target.value.trim() })}
              />
              <input
                type="number"
                step="0.01"
                style={{ ...styles.input, maxWidth: 140 }}
                value={editing.costo_usd ?? ''}
                onChange={e => setEditing(prev => ({ ...prev, costo_usd: e.target.value }))}
                onBlur={e => handleUpdate(editing.id, { costo_usd: Number(e.target.value) || 0 })}
              />
            </div>

            {/* Lista de cobros */}
            <div style={styles.sectionTitle}>Cobros registrados</div>
            {(editing.cobros || []).length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '8px 0' }}>
                Sin cobros todavía.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {(editing.cobros || []).map(k => (
                  <div key={k.id} style={styles.cobroRow}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, color: '#30d158' }}>+{fmt(k.monto_usd)}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
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

            {/* Agregar nuevo cobro */}
            <div style={styles.sectionTitle}>Agregar cobro</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  step="0.01"
                  style={styles.input}
                  placeholder="Monto USD"
                  value={newCobroMonto}
                  onChange={e => setNewCobroMonto(e.target.value)}
                />
                <input
                  type="date"
                  style={{ ...styles.input, maxWidth: 160 }}
                  value={newCobroFecha}
                  onChange={e => setNewCobroFecha(e.target.value)}
                />
              </div>
              <input
                style={styles.input}
                placeholder="Nota (opcional)"
                value={newCobroNota}
                onChange={e => setNewCobroNota(e.target.value)}
              />
              <button style={styles.btnPrimary} onClick={handleAddCobro}>
                Agregar cobro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TotalCard({ label, value, color, sign = false }) {
  return (
    <div style={styles.totalCard}>
      <div style={styles.totalLabel}>{label}</div>
      <div style={{ ...styles.totalValue, color }}>
        {sign && value >= 0 ? '+' : ''}{fmt(value)}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '16px 20px 80px', maxWidth: 1100, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' },
  subtitle: { fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' },
  newBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    backgroundColor: 'var(--accent-blue)', color: '#fff',
    border: 'none', borderRadius: 10, padding: '9px 14px',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },

  totalsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 },
  totalCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 14, padding: '14px 16px',
  },
  totalLabel: { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  totalValue: { fontSize: 22, fontWeight: 800 },

  formCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 14, padding: 14, marginBottom: 16,
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  formRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  input: {
    flex: 1, minWidth: 120,
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 10, padding: '10px 12px',
    fontSize: 14, color: 'var(--text-primary)',
    outline: 'none',
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
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 12, padding: '12px 14px',
    flexWrap: 'wrap',
  },
  rowName: { flex: 2, minWidth: 140, display: 'flex', flexDirection: 'column' },
  rowNameSub: { fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 },
  rowCosto: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', minWidth: 80 },
  rowEstado: { flex: 1, display: 'flex', justifyContent: 'center', minWidth: 110 },
  estadoSelect: {
    border: '1px solid', borderRadius: 8,
    padding: '5px 10px', fontSize: 12, fontWeight: 600,
    outline: 'none', cursor: 'pointer',
  },
  rowActions: { display: 'flex', gap: 4, width: 80, justifyContent: 'flex-end' },
  iconBtn: {
    backgroundColor: 'transparent', border: 'none',
    borderRadius: 8, padding: 6, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  emptyState: {
    padding: '60px 20px', textAlign: 'center',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px dashed var(--border)',
    borderRadius: 14, color: 'var(--text-primary)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },

  // Modal
  modalOverlay: {
    position: 'fixed', inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 50, padding: 16,
  },
  modalBox: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 16, padding: 20,
    width: '100%', maxWidth: 520,
    maxHeight: '90vh', overflowY: 'auto',
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: 700,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 8, marginTop: 4,
  },
  cobroRow: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 10, padding: '8px 12px',
  },
};
