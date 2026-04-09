import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useTradingStore } from '../store/useTradingStore';

export default function ChallengeCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const slotParam = searchParams.get('slot') || 'A';
  
  const [loading, setLoading] = useState(false);
  const { fetchAccounts } = useTradingStore();

  const [formData, setFormData] = useState({
    nombre: '', // Ej: "Fase 1 FTMO 10k"
    tamano_cuenta_usd: '10000',
    objetivo_usd: '1000',
    max_loss_usd: '1000',
    max_daily_loss_usd: '500'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nombre) return;
    
    setLoading(true);
    try {
      const userId = 'user_test_123'; // Hardcoded for now
      
      const newAccount = {
        user_id: userId,
        slot: slotParam, // 'A', 'B', or 'C'
        label: `Cuenta ${slotParam}`,
        nombre: formData.nombre,
        fase_actual: 'Fase 1',
        estado: 'activo',
        balance_inicial_usd: Number(formData.tamano_cuenta_usd),
        balance_actual_usd: Number(formData.tamano_cuenta_usd), // Arranca en initial
        objetivo_usd: Number(formData.objetivo_usd),
        max_loss_usd: Number(formData.max_loss_usd),
        max_daily_loss_usd: Number(formData.max_daily_loss_usd),
        pnl_acumulado_usd: 0,
        orden_rotacion: slotParam === 'A' ? 1 : (slotParam === 'B' ? 2 : 3), // For logic rotation component
        es_cuenta_activa: slotParam === 'A',
        created_at: new Date().toISOString()
      };

      console.log("Intentando guardar en Firebase:", newAccount);

      await addDoc(collection(db, 'accounts'), newAccount);
      
      console.log("Guardado exitoso. Actualizando vista local...");
      // Update global store
      await fetchAccounts();
      
      // Redirect back to list
      navigate(`/challenges`);
    } catch (err) {
      console.error("Error capturado:", err);
      alert(`Error creando cuenta: ${err.message}`);
      setLoading(false);
    }
  };

  const handleBack = () => navigate(-1);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={handleBack} style={styles.iconButton}>
          <ArrowLeft size={24} color="var(--text-primary)" />
        </button>
        <h1 style={styles.title}>Nueva Cuenta ({slotParam})</h1>
        <div style={{ width: 44 }}></div>
      </header>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Nombre de Identificación</label>
          <input 
            type="text"
            required
            placeholder="Ej: Fase 1 FTMO 10k" 
            value={formData.nombre}
            onChange={e => setFormData({...formData, nombre: e.target.value})}
            style={styles.input}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Tamaño (Balance Inicial)</label>
          <input 
            type="number"
            required
            value={formData.tamano_cuenta_usd}
            onChange={e => setFormData({...formData, tamano_cuenta_usd: e.target.value})}
            style={styles.input}
          />
        </div>

        <div style={styles.limitsBox}>
          <h3 style={styles.limitsTitle}>Límites y Reglas (USD)</h3>
          
          <div style={styles.inputGroup}>
            <label style={styles.label}>Meta de Ganancia (Target)</label>
            <input 
              type="number"
              required
              value={formData.objetivo_usd}
              onChange={e => setFormData({...formData, objetivo_usd: e.target.value})}
              style={styles.inputAlt}
            />
          </div>

          <div style={styles.row}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Límite Global</label>
              <input 
                type="number"
                required
                value={formData.max_loss_usd}
                onChange={e => setFormData({...formData, max_loss_usd: e.target.value})}
                style={styles.inputAlt}
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Límite Diario</label>
              <input 
                type="number"
                required
                value={formData.max_daily_loss_usd}
                onChange={e => setFormData({...formData, max_daily_loss_usd: e.target.value})}
                style={styles.inputAlt}
              />
            </div>
          </div>
        </div>

        <button type="submit" style={styles.submitBtn} disabled={loading}>
          {loading ? 'Creando...' : 'Crear Cuenta'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  // same styles as before, omited to keep simple but mapped accurately
  container: { padding: '16px 20px 40px 20px', height: '100%', overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
  title: { fontSize: '20px', fontWeight: '600' },
  iconButton: { backgroundColor: 'transparent', border: 'none', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', cursor: 'pointer', padding: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  row: { display: 'flex', gap: '16px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 },
  label: { fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' },
  input: { backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '16px', borderRadius: '16px', fontSize: '16px', outline: 'none' },
  inputAlt: { backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '16px', borderRadius: '16px', fontSize: '16px', outline: 'none' },
  limitsBox: { backgroundColor: 'var(--bg-secondary)', borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' },
  limitsTitle: { fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' },
  submitBtn: { backgroundColor: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '16px', padding: '18px', fontSize: '17px', fontWeight: '600', cursor: 'pointer', marginTop: '20px' }
};
