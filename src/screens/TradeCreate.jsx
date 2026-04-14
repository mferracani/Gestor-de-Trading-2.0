import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { useTradingStore } from '../store/useTradingStore';
import { useToast } from '../components/ui/Toast';
import { db } from '../lib/firebase';
import { buildTradeFinancials, inferCommissionProfile, getCommissionPerSide } from '../lib/tradeMath';

export default function TradeCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const accountId = searchParams.get('accountId') || '';
  const tipo = searchParams.get('tipo') || 'challenge'; // 'fondeada' | 'challenge'
  
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState(null);
  
  const [formData, setFormData] = useState({
    activo: 'EURUSD',
    lotes: '',
    resultado: 'WIN', // WIN | LOSS | BE
    gross_pnl_usd: '',
    comision_usd: '',
    swap_usd: '',
    notas: ''
  });

  useEffect(() => {
    async function loadAccount() {
      if (!accountId) return;
      try {
        const collectionName = tipo === 'fondeada' ? 'funded_accounts' : 'accounts';
        const snap = await getDoc(doc(db, collectionName, accountId));
        if (snap.exists()) setAccount({ id: snap.id, ...snap.data() });
      } catch (err) {
        console.error('Error cargando cuenta para estimar comisión:', err);
      }
    }

    loadAccount();
  }, [accountId, tipo]);

  const normalizedGross = (() => {
    const raw = Number(formData.gross_pnl_usd || 0);
    if (formData.resultado === 'LOSS') return -Math.abs(raw);
    if (formData.resultado === 'BE') return 0;
    return Math.abs(raw);
  })();

  const tradePreview = buildTradeFinancials({
    gross_pnl_usd: normalizedGross,
    lotes: formData.lotes,
    comision_usd: formData.comision_usd,
    swap_usd: formData.swap_usd,
    activo: formData.activo,
  }, account);

  const profile = inferCommissionProfile(account || {});
  const perSide = getCommissionPerSide(account || {});

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!accountId) {
      toast('No se especificó la cuenta origen', 'error');
      return;
    }
    
    setLoading(true);
    try {
      // 1. Usar el store global — elegir función según tipo de cuenta
      const { registerTrade, registerFundedTrade } = useTradingStore.getState();
      const tradeData = {
        activo: formData.activo,
        lotes: formData.lotes === '' ? null : Number(formData.lotes),
        resultado: formData.resultado,
        gross_pnl_usd: normalizedGross,
        comision_usd: formData.comision_usd === '' ? null : Number(formData.comision_usd),
        swap_usd: formData.swap_usd === '' ? null : Number(formData.swap_usd),
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
            <option value="US500">US500 (S&P 500)</option>
          </select>
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Lotes (Opcional)</label>
          <input
            type="number"
            step="0.01"
            placeholder="Ej: 1.00"
            value={formData.lotes}
            onChange={e => setFormData({...formData, lotes: e.target.value})}
            style={styles.input}
          />
          <span style={styles.helperText}>
            Si lo cargás, la app puede estimar sola la comisión de brokers que cobran por lote.
          </span>
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

        <div style={styles.inputGroup}>
          <label style={styles.label}>
            PnL Bruto (USD) {formData.resultado === 'LOSS' ? 'en negativo de forma automática' : ''}
          </label>
          <input
            type="number"
            required={formData.resultado !== 'BE'}
            step="0.01"
            placeholder={formData.resultado === 'BE' ? '0' : 'Ej: 500'}
            value={formData.gross_pnl_usd}
            onChange={e => setFormData({...formData, gross_pnl_usd: e.target.value})}
            style={styles.input}
          />
          <span style={styles.helperText}>
            Cargá el beneficio o pérdida antes de comisiones y swap.
          </span>
        </div>

        <div style={styles.inlineGrid}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Comisión (USD)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder={tradePreview.estimatedCommission > 0 ? tradePreview.estimatedCommission.toFixed(2) : 'Se estima automática si aplica'}
              value={formData.comision_usd}
              onChange={e => setFormData({...formData, comision_usd: e.target.value})}
              style={styles.input}
            />
            <span style={styles.helperText}>
              Si lo dejás vacío, usamos la estimación automática y después la podés corregir.
            </span>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Swap (USD)</label>
            <input
              type="number"
              step="0.01"
              placeholder="Ej: -1.25 o 0.80"
              value={formData.swap_usd}
              onChange={e => setFormData({...formData, swap_usd: e.target.value})}
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.netCard}>
          <div style={styles.netLabel}>Impacto real en la cuenta</div>
          <div style={{
            ...styles.netValue,
            color: tradePreview.netPnl > 0 ? '#30d158' : tradePreview.netPnl < 0 ? '#ff453a' : 'var(--text-primary)'
          }}>
            {tradePreview.netPnl > 0 ? '+' : ''}${tradePreview.netPnl.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={styles.netBreakdown}>
            Bruto {tradePreview.grossPnl > 0 ? '+' : ''}${tradePreview.grossPnl.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {' '}· Comisión -${tradePreview.commission.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {' '}· Swap {tradePreview.swap > 0 ? '+' : ''}${tradePreview.swap.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={styles.netHint}>
            {tradePreview.commissionSource === 'manual' && 'Comisión cargada manualmente.'}
            {tradePreview.commissionSource === 'auto' && `Comisión estimada automáticamente (${profile === 'alpha_raw' ? `Alpha Capital RAW · $${perSide.toFixed(2)} por lado` : 'perfil por lote'}).`}
            {tradePreview.commissionSource === 'none' && 'Sin comisión calculada por ahora. Podés dejarla así y ajustarla después.'}
          </div>
        </div>

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
  inlineGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  label: { fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' },
  input: { backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '16px', borderRadius: '16px', fontSize: '16px', outline: 'none' },
  inputArea: { backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '16px', borderRadius: '16px', fontSize: '16px', outline: 'none', resize: 'vertical' },
  helperText: { fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' },
  optionsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' },
  option: { padding: '13px 0', textAlign: 'center', borderRadius: '14px', fontWeight: '700', cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s', letterSpacing: '0.3px' },
  netCard: { backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px' },
  netLabel: { fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600' },
  netValue: { fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px' },
  netBreakdown: { marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' },
  netHint: { marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.45' },
  submitBtn: { backgroundColor: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '14px', padding: '14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginTop: '8px' }
};
