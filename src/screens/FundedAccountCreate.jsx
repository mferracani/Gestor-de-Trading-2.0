import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useToast } from '../components/ui/Toast';

export default function FundedAccountCreate() {
  const navigate = useNavigate();
  const addToast = useToast();

  const [form, setForm] = useState({
    nombre: '',
    broker: '',
    balance_inicial_usd: '',
    objetivo_retiro_pct: 2,
    regla_consistencia: true,
    consistencia_pct: 40,
    commission_profile: 'alpha_raw',
    commission_per_side_usd: 2.5,
    notas: '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (!form.nombre.trim() || !form.balance_inicial_usd) {
      addToast('Completá el nombre y balance inicial.', 'warning');
      return;
    }
    setSaving(true);
    try {
      const balanceNum = parseFloat(form.balance_inicial_usd);
      await addDoc(collection(db, 'funded_accounts'), {
        nombre: form.nombre.trim(),
        broker: form.broker.trim() || 'Cuenta Fondeada',
        balance_inicial_usd: balanceNum,
        balance_actual_usd: balanceNum,
        pnl_acumulado_usd: 0,
        objetivo_retiro_pct: parseFloat(form.objetivo_retiro_pct) || 2,
        regla_consistencia: form.regla_consistencia,
        consistencia_pct: form.regla_consistencia ? (parseFloat(form.consistencia_pct) || 40) : null,
        commission_profile: form.commission_profile,
        commission_per_side_usd: form.commission_profile === 'custom_per_lot'
          ? (parseFloat(form.commission_per_side_usd) || 0)
          : (form.commission_profile === 'alpha_raw' ? 2.5 : 0),
        notas: form.notas.trim(),
        estado: 'activo',
        user_id: 'user_test_123',
        createdAt: new Date().toISOString(),
        en_retiro: false,
        fecha_cobro: null,
        ciclo_actual: 1,
        historial_ciclos: [],
      });
      addToast(`✅ ${form.nombre} creada correctamente.`, 'success');
      navigate('/fondeadas');
    } catch (err) {
      console.error(err);
      addToast('Error al crear la cuenta.', 'error');
    }
    setSaving(false);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.iconButton}>
          <ArrowLeft size={24} color="var(--text-primary)" />
        </button>
        <h1 style={styles.title}>Nueva Cuenta Fondeada</h1>
        <div style={{ width: 40 }} />
      </header>

      <div style={styles.form}>
        {/* Nombre */}
        <div style={styles.field}>
          <label style={styles.label}>Nombre de la cuenta</label>
          <input
            style={styles.input}
            placeholder="Ej: Alpha Capital 10K"
            value={form.nombre}
            onChange={e => handleChange('nombre', e.target.value)}
          />
        </div>

        {/* Broker */}
        <div style={styles.field}>
          <label style={styles.label}>Broker / Firma (Opcional)</label>
          <input
            style={styles.input}
            placeholder="Ej: Alpha Capital, FTMO, The5ers..."
            value={form.broker}
            onChange={e => handleChange('broker', e.target.value)}
          />
        </div>

        {/* Balance */}
        <div style={styles.field}>
          <label style={styles.label}>Balance Inicial (USD)</label>
          <input
            style={styles.input}
            type="number"
            placeholder="Ej: 10000"
            value={form.balance_inicial_usd}
            onChange={e => handleChange('balance_inicial_usd', e.target.value)}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Comisión automática</label>
          <p style={styles.fieldHint}>
            Se usa para estimar la comisión al cargar trades. Después siempre la podés editar trade por trade.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {[
              { key: 'alpha_raw', title: 'Alpha RAW', subtitle: '$2.50 por lado · índices sin comisión' },
              { key: 'custom_per_lot', title: 'Personalizada', subtitle: 'Por lote y por lado' },
              { key: 'none', title: 'Sin comisión', subtitle: 'No calcular automáticamente' },
            ].map(option => (
              <button
                key={option.key}
                style={{
                  flex: 1,
                  minWidth: '140px',
                  padding: '14px 12px',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  border: form.commission_profile === option.key ? '2px solid var(--accent-blue)' : '1px solid var(--border)',
                  backgroundColor: form.commission_profile === option.key ? 'rgba(10,132,255,0.1)' : 'var(--bg-secondary)',
                  textAlign: 'left',
                }}
                onClick={() => handleChange('commission_profile', option.key)}
              >
                <div style={{ fontSize: '14px', fontWeight: '700', color: form.commission_profile === option.key ? 'var(--accent-blue)' : 'var(--text-primary)', marginBottom: '4px' }}>
                  {option.title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {option.subtitle}
                </div>
              </button>
            ))}
          </div>
        </div>

        {form.commission_profile === 'custom_per_lot' && (
          <div style={styles.field}>
            <label style={styles.label}>Comisión por lado (USD)</label>
            <input
              style={styles.input}
              type="number"
              step="0.01"
              placeholder="Ej: 2.50"
              value={form.commission_per_side_usd}
              onChange={e => handleChange('commission_per_side_usd', e.target.value)}
            />
          </div>
        )}

        {/* Target de retiro */}
        <div style={styles.field}>
          <label style={styles.label}>Objetivo de retiro (%)</label>
          <div style={styles.pctRow}>
            {[2, 5, 8, 10].map(pct => (
              <button
                key={pct}
                style={{
                  ...styles.pctBtn,
                  backgroundColor: form.objetivo_retiro_pct == pct ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                  color: form.objetivo_retiro_pct == pct ? '#fff' : 'var(--text-primary)',
                  border: form.objetivo_retiro_pct == pct ? 'none' : '1px solid var(--border)',
                }}
                onClick={() => handleChange('objetivo_retiro_pct', pct)}
              >
                {pct}%
              </button>
            ))}
            <input
              style={{ ...styles.input, flex: 1 }}
              type="number"
              placeholder="Custom %"
              value={[2, 5, 8, 10].includes(Number(form.objetivo_retiro_pct)) ? '' : form.objetivo_retiro_pct}
              onChange={e => handleChange('objetivo_retiro_pct', e.target.value)}
            />
          </div>
        </div>

        {/* Tipo de cuenta */}
        <div style={styles.field}>
          <label style={styles.label}>Tipo de cuenta</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              style={{
                flex: 1, padding: '14px 12px', borderRadius: '14px', cursor: 'pointer',
                border: form.regla_consistencia ? '2px solid var(--accent-blue)' : '1px solid var(--border)',
                backgroundColor: form.regla_consistencia ? 'rgba(10,132,255,0.1)' : 'var(--bg-secondary)',
                textAlign: 'left',
              }}
              onClick={() => handleChange('regla_consistencia', true)}
            >
              <div style={{ fontSize: '14px', fontWeight: '700', color: form.regla_consistencia ? 'var(--accent-blue)' : 'var(--text-primary)', marginBottom: '4px' }}>
                Con consistencia
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                El mejor día no puede superar X% del total
              </div>
            </button>
            <button
              style={{
                flex: 1, padding: '14px 12px', borderRadius: '14px', cursor: 'pointer',
                border: !form.regla_consistencia ? '2px solid var(--accent-blue)' : '1px solid var(--border)',
                backgroundColor: !form.regla_consistencia ? 'rgba(10,132,255,0.1)' : 'var(--bg-secondary)',
                textAlign: 'left',
              }}
              onClick={() => handleChange('regla_consistencia', false)}
            >
              <div style={{ fontSize: '14px', fontWeight: '700', color: !form.regla_consistencia ? 'var(--accent-blue)' : 'var(--text-primary)', marginBottom: '4px' }}>
                Sin consistencia
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Retiro libre al alcanzar el objetivo %
              </div>
            </button>
          </div>
        </div>

        {/* Porcentaje de consistencia (visible solo si está activa) */}
        {form.regla_consistencia && (
          <div style={styles.field}>
            <label style={styles.label}>Límite de consistencia (%)</label>
            <p style={styles.fieldHint}>El mejor día de ganancia no puede superar este % del total acumulado.</p>
            <div style={styles.pctRow}>
              {[30, 40, 50].map(p => (
                <button
                  key={p}
                  style={{
                    ...styles.pctBtn,
                    backgroundColor: form.consistencia_pct == p ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                    color: form.consistencia_pct == p ? '#fff' : 'var(--text-primary)',
                    border: form.consistencia_pct == p ? 'none' : '1px solid var(--border)',
                  }}
                  onClick={() => handleChange('consistencia_pct', p)}
                >
                  {p}%
                </button>
              ))}
              <input
                style={{ ...styles.input, flex: 1 }}
                type="number"
                placeholder="Custom %"
                value={[30, 40, 50].includes(Number(form.consistencia_pct)) ? '' : form.consistencia_pct}
                onChange={e => handleChange('consistencia_pct', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Notas */}
        <div style={styles.field}>
          <label style={styles.label}>Notas (Opcional)</label>
          <textarea
            style={{ ...styles.input, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="Condiciones especiales, notas de la cuenta..."
            value={form.notas}
            onChange={e => handleChange('notas', e.target.value)}
          />
        </div>

        {/* Submit */}
        <button style={styles.submitBtn} onClick={handleSubmit} disabled={saving}>
          {saving ? <Loader2 size={20} className="spinner" /> : 'Crear Cuenta Fondeada'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '16px 24px 60px', maxWidth: '600px', margin: '0 auto' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '28px',
  },
  iconButton: {
    backgroundColor: 'transparent', border: 'none', width: '40px', height: '40px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
  },
  title: { fontSize: '18px', fontWeight: '700' },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  field: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' },
  fieldHint: { fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' },
  input: {
    backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: '14px', padding: '14px 16px', fontSize: '16px',
    color: 'var(--text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  pctRow: { display: 'flex', gap: '8px', alignItems: 'center' },
  pctBtn: {
    padding: '12px 16px', borderRadius: '12px', fontSize: '15px', fontWeight: '600',
    cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
  },
  toggleRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: '14px', padding: '14px 16px',
  },
  toggleLabel: { fontSize: '15px', fontWeight: '600', marginBottom: '3px' },
  toggleSubLabel: { fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '220px' },
  toggle: {
    width: '48px', height: '28px', borderRadius: '14px', border: 'none',
    cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s', flexShrink: 0,
  },
  toggleKnob: {
    width: '24px', height: '24px', borderRadius: '12px', backgroundColor: '#fff',
    position: 'absolute', top: '2px', transition: 'transform 0.2s',
  },
  submitBtn: {
    backgroundColor: 'var(--accent-blue)', color: '#fff', border: 'none',
    borderRadius: '16px', padding: '16px', fontSize: '16px', fontWeight: '700',
    cursor: 'pointer', marginTop: '8px', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: '8px',
  },
};
