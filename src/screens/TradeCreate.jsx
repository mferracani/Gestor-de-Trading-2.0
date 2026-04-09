import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useTradingStore } from '../store/useTradingStore';
import { useToast } from '../components/ui/Toast';

export default function TradeCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const accountId = searchParams.get('accountId') || '';
  const tipo = searchParams.get('tipo') || 'challenge'; // 'fondeada' | 'challenge'
  
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    activo: 'EURUSD',
    resultado: 'WIN', // WIN | LOSS | BE
    pnl_usd: '',
    notas: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!accountId) {
      toast('No se especificó la cuenta origen', 'error');
      return;
    }
    
    setLoading(true);
    try {
      let finalPnl = Number(formData.pnl_usd || 0);
      
      if (formData.resultado === 'LOSS') {
        finalPnl = -Math.abs(finalPnl);
      } else if (formData.resultado === 'BE') {
        finalPnl = 0;
      } else {
        finalPnl = Math.abs(finalPnl);
      }

      // 1. Usar el store global — elegir función según tipo de cuenta
      const { registerTrade, registerFundedTrade } = useTradingStore.getState();
      const tradeData = {
        activo: formData.activo,
        resultado: formData.resultado,
        pnl_usd: finalPnl,
        notas: formData.notas
      };

      const result = tipo === 'fondeada'
        ? await registerFundedTrade(accountId, tradeData)
        : await registerTrade(accountId, tradeData);
      
      if (result.reason) {
        toast(result.reason, result.reason.includes('Quemada') ? 'error' : 'warning');
      } else {
        toast('Trade registrado correctamente', 'success');
      }
      
      // Navegar de vuelta al detalle de la cuenta para forzar recarga de datos y recomendaciones
      if (result.rotatedTo) {
        navigate('/');
      } else if (tipo === 'fondeada') {
        navigate(`/fondeadas/${accountId}`, { replace: true });
      } else {
        navigate(`/challenges/${accountId}`, { replace: true });
      }
    } catch (err) {
      console.error('TradeError:', err);
      toast('Error: ' + (err.message || 'Algo salió mal'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.iconButton}>
          <ArrowLeft size={24} color="var(--text-primary)" />
        </button>
        <h1 style={styles.title}>Registrar Trade</h1>
        <div style={{ width: 44 }}></div>
      </header>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Activo / Par</label>
          <select 
            value={formData.activo}
            onChange={e => setFormData({...formData, activo: e.target.value})}
            style={styles.input}
          >
            <option value="EURUSD">EUR / USD</option>
            <option value="GBPUSD">GBP / USD</option>
            <option value="XAUUSD">XAU / USD (Oro)</option>
            <option value="XAGUSD">XAG / USD (Plata)</option>
            <option value="USOIL">USOIL (Petróleo WTI)</option>
            <option value="US30">US30 (Dow)</option>
            <option value="NAS100">NAS100 (Nasdaq)</option>
          </select>
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Resultado</label>
          <div style={styles.optionsGrid}>
            <div 
              style={{
                ...styles.option, 
                backgroundColor: formData.resultado === 'WIN' ? 'rgba(48,209,88,0.18)' : 'var(--bg-secondary)',
                border: formData.resultado === 'WIN' ? '1px solid #30d158' : '1px solid var(--border)',
                color: formData.resultado === 'WIN' ? '#30d158' : 'var(--text-secondary)'
              }}
              onClick={() => setFormData({...formData, resultado: 'WIN'})}
            >
              WIN
            </div>
            <div 
              style={{
                ...styles.option, 
                backgroundColor: formData.resultado === 'LOSS' ? 'rgba(255,69,58,0.15)' : 'var(--bg-secondary)',
                border: formData.resultado === 'LOSS' ? '1px solid #ff453a' : '1px solid var(--border)',
                color: formData.resultado === 'LOSS' ? '#ff453a' : 'var(--text-secondary)'
              }}
              onClick={() => setFormData({...formData, resultado: 'LOSS'})}
            >
              LOSS
            </div>
            <div 
              style={{
                ...styles.option, 
                backgroundColor: formData.resultado === 'BE' ? 'rgba(142,142,147,0.15)' : 'var(--bg-secondary)',
                border: formData.resultado === 'BE' ? '1px solid #8e8e93' : '1px solid var(--border)',
                color: formData.resultado === 'BE' ? '#aeaeb2' : 'var(--text-secondary)'
              }}
              onClick={() => setFormData({...formData, resultado: 'BE'})}
            >
              B.E.
            </div>
          </div>
        </div>

        {formData.resultado !== 'BE' && (
          <div style={styles.inputGroup}>
            <label style={styles.label}>
              PnL (USD) {formData.resultado === 'LOSS' ? 'en negativo de forma automática' : ''}
            </label>
            <input 
              type="number"
              required
              step="0.01"
              placeholder="Ej: 500" 
              value={formData.pnl_usd}
              onChange={e => setFormData({...formData, pnl_usd: e.target.value})}
              style={styles.input}
            />
          </div>
        )}

        <div style={styles.inputGroup}>
          <label style={styles.label}>Notas u Observaciones (Opcional)</label>
          <textarea 
            rows="3"
            placeholder="¿Por qué tomaste este trade?..." 
            value={formData.notas}
            onChange={e => setFormData({...formData, notas: e.target.value})}
            style={styles.inputArea}
          />
        </div>

        <button type="submit" style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
              Guardando...
            </span>
          ) : 'Registrar Trade'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: { padding: '16px 24px 40px 24px', maxWidth: '800px', margin: '0 auto', height: '100%', overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
  title: { fontSize: '20px', fontWeight: '600' },
  iconButton: { backgroundColor: 'transparent', border: 'none', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', cursor: 'pointer', padding: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: '24px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' },
  input: { backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '16px', borderRadius: '16px', fontSize: '16px', outline: 'none' },
  inputArea: { backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '16px', borderRadius: '16px', fontSize: '16px', outline: 'none', resize: 'vertical' },
  optionsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' },
  option: { padding: '13px 0', textAlign: 'center', borderRadius: '14px', fontWeight: '700', cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s', letterSpacing: '0.3px' },
  submitBtn: { backgroundColor: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '14px', padding: '14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginTop: '8px' }
};

