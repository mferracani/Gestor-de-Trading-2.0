import { TrendingUp, Shield } from 'lucide-react';

export default function MiniMetricsStrip({ challenge }) {
  if (!challenge) return null;

  // PnL de la cuenta activa
  const pnl = challenge.pnl_acumulado_usd || 0;
  const objetivo = challenge.objetivo_usd || 1000;
  const maxLoss = challenge.max_loss_usd || 1000;

  // Progreso hacia el objetivo (0% a 100%)
  const progresoPct = Math.max(0, Math.min(100, (pnl / objetivo) * 100));
  
  // Cuánto margen de pérdida queda
  const margenRestante = maxLoss + pnl; // Si pnl=-300 y maxLoss=1000, te quedan $700
  const margenUsadoPct = Math.max(0, Math.min(100, ((maxLoss - margenRestante) / maxLoss) * 100));

  return (
    <div style={styles.container}>
      {/* Métrica: Progreso hacia el objetivo */}
      <div style={styles.metricItem}>
        <div style={styles.metricHeader}>
          <div style={styles.labelGroup}>
            <TrendingUp size={16} color="var(--accent-blue)" />
            <span style={styles.label}>Progreso</span>
          </div>
          <span style={{...styles.value, color: pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}}>
            {pnl > 0 ? '+' : ''}${pnl.toLocaleString()}
          </span>
        </div>
        <div style={styles.progressBarBg}>
          <div style={{
            ...styles.progressBarFill, 
            width: `${progresoPct}%`, 
            backgroundColor: pnl >= 0 ? 'var(--accent-blue)' : 'var(--accent-red)'
          }}></div>
        </div>
        <div style={styles.progressFooter}>
          <span>0</span>
          <span>Meta: ${objetivo.toLocaleString()}</span>
        </div>
      </div>

      {/* Divisor */}
      <div style={styles.divider}></div>

      {/* Métrica: Margen de pérdida restante */}
      <div style={styles.metricItem}>
        <div style={styles.metricHeader}>
          <div style={styles.labelGroup}>
            <Shield size={16} color={margenRestante < maxLoss * 0.3 ? 'var(--accent-red)' : 'var(--accent-green)'} />
            <span style={styles.label}>Margen Disponible</span>
          </div>
          <span style={{
            ...styles.value, 
            color: margenRestante < maxLoss * 0.3 ? 'var(--accent-red)' : 'var(--accent-green)'
          }}>
            ${margenRestante.toLocaleString()}
          </span>
        </div>
        <div style={styles.progressBarBg}>
          <div style={{
            ...styles.progressBarFill, 
            width: `${100 - margenUsadoPct}%`, 
            backgroundColor: margenRestante < maxLoss * 0.3 ? 'var(--accent-red)' : 'var(--accent-green)'
          }}></div>
        </div>
        <div style={styles.progressFooter}>
          <span>0</span>
          <span>Límite: -${maxLoss.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '20px',
    border: '1px solid var(--border)',
    padding: '20px',
    gap: '20px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
  },
  metricItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  divider: {
    width: '1px',
    backgroundColor: 'var(--border)',
    alignSelf: 'stretch'
  },
  metricHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  labelGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  label: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontWeight: '500'
  },
  value: {
    fontSize: '15px',
    fontWeight: '600'
  },
  progressBarBg: {
    height: '6px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: '100px',
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    borderRadius: '100px',
    transition: 'width 0.4s ease'
  },
  progressFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: 'var(--text-muted)'
  }
};
