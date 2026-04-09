import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import ProgressBar from './ProgressBar';

export default function ChallengeCard({ account }) {
  const navigate = useNavigate();

  // Balance Inicial y Actual según la imagen
  const balanceInicial = account.balance_inicial_usd || 10000;
  const pnl = account.pnl_acumulado_usd || 0;
  const balanceActual = balanceInicial + pnl;

  // Límite y Meta
  const maxLoss = account.max_loss_usd || 1000;
  const target = account.objetivo_usd || 1000;
  const remaining = Math.max(0, target - pnl);

  return (
    <div style={{
      ...styles.card,
      borderColor: account.es_cuenta_activa ? 'var(--accent-blue)' : 'var(--border)',
      boxShadow: account.es_cuenta_activa ? '0 0 15px rgba(10, 132, 255, 0.15)' : '0 4px 20px rgba(0,0,0,0.1)'
    }} onClick={() => navigate(`/challenges/${account.id}`)}>
      <div style={styles.header}>
        <div style={{
          ...styles.statusBadge,
          color: account.estado === 'danger' ? 'var(--accent-red)' : account.estado === 'quemada' ? 'var(--text-muted)' : 'var(--accent-orange)',
          backgroundColor: account.estado === 'danger' ? 'rgba(255, 69, 58, 0.1)' : account.estado === 'quemada' ? 'rgba(255,255,255,0.05)' : 'rgba(255, 159, 10, 0.1)'
        }}>
          {account.estado === 'danger' ? '⚠️ Peligro' : account.estado === 'quemada' ? '💀 Quemada' : account.estado === 'aprobada' ? '🏆 Aprobada' : '⚡ Activo'}
        </div>
        
        {account.es_cuenta_activa && account.estado !== 'quemada' && (
          <span style={{ fontSize: '12px', color: 'var(--accent-blue)', fontWeight: '600', marginLeft: 'auto', marginRight: '10px' }}>
            En Uso Actual
          </span>
        )}
        
        <span style={styles.challengeName}>{account.nombre || `${account.fase_actual} FTMO 10k`}</span>
      </div>

      <div style={styles.balanceGrid}>
        <div style={styles.balanceRow}>
          <span style={styles.balanceLabel}>Balance Inicial:</span>
          <span style={styles.balanceValue}>${balanceInicial.toLocaleString()}</span>
        </div>
        <div style={styles.balanceRow}>
          <span style={styles.balanceLabel}>Balance Actual:</span>
          <span style={styles.balanceValue}>${balanceActual.toLocaleString()}</span>
        </div>
        <div style={{ ...styles.balanceRow, marginTop: '4px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={styles.balanceLabel}>Faltan:</span>
          <span style={{ ...styles.balanceValue, color: remaining <= 0 ? '#30d158' : '#ff9f0a', fontSize: '16px' }}>
            {remaining <= 0 ? '🏆 ¡Objetivo alcanzado!' : `$${remaining.toLocaleString()}`}
          </span>
        </div>
      </div>

      <div style={styles.progressSection}>
        <ProgressBar 
          pnl={pnl} 
          maxLoss={maxLoss} 
          target={target} 
        />
      </div>

      <div style={styles.footer}>
        <span style={styles.footerAction}>
          Ver Detalle
          <ChevronRight size={16} />
        </span>
      </div>
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '20px',
    padding: '24px',
    border: '1px solid var(--border)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: 'var(--accent-orange)',
    backgroundColor: 'rgba(255, 159, 10, 0.1)',
    padding: '4px 10px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600'
  },
  challengeName: {
    fontSize: '15px',
    fontWeight: '500',
    color: 'var(--text-secondary)'
  },
  balanceGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '24px',
    backgroundColor: 'var(--bg-tertiary)',
    padding: '16px',
    borderRadius: '12px'
  },
  balanceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '12px',
  },
  balanceLabel: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    width: '120px'
  },
  balanceValue: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--text-primary)'
  },
  progressSection: {
    marginBottom: '20px'
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-start',
    borderTop: '1px solid var(--border)',
    paddingTop: '16px',
    marginTop: '8px'
  },
  footerAction: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: 'var(--text-secondary)',
    fontSize: '14px',
    fontWeight: '500'
  }
};
