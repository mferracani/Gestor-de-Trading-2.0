import { Target } from 'lucide-react';
import { useNavigate } from 'react-router';

export default function AlertBanner({ challenge }) {
  const navigate = useNavigate();
  if (!challenge) return null;

  const slotLabels = { 1: 'A', 2: 'B', 3: 'C', 4: 'D' };
  const displayName = challenge.nombre && isNaN(challenge.nombre)
    ? challenge.nombre
    : `Cuenta ${slotLabels[challenge.orden_rotacion] || challenge.orden_rotacion}`;
  const pnl = challenge.pnl_acumulado_usd || 0;
  const objetivo = challenge.objetivo_usd || 1000;
  const falta = Math.max(0, objetivo - pnl);
  const logrado = falta <= 0;

  return (
    <div 
      style={styles.banner} 
      onClick={() => navigate(`/challenges/${challenge.id}`)}
    >
      <Target size={20} color={logrado ? '#30d158' : 'var(--accent-blue)'} style={{ flexShrink: 0, marginTop: '2px' }} />
      <div style={styles.content}>
        <p style={styles.title}>
          Cuenta activa: {displayName}
        </p>
        <p style={styles.message}>
          {logrado 
            ? '🏆 ¡Objetivo alcanzado! Revisá el estado de tu cuenta.'
            : `Te faltan $${falta.toLocaleString()} para llegar al objetivo de $${objetivo.toLocaleString()}.`
          }
        </p>
      </div>
    </div>
  );
}

const styles = {
  banner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
    border: '1px solid rgba(10, 132, 255, 0.2)',
    borderRadius: '16px',
    padding: '16px',
    marginBottom: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  title: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--accent-blue)'
  },
  message: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.4'
  }
};
