import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function AccountRecommendationCard({ accounts }) {
  if (!accounts || accounts.length === 0) return null;

  // Busca la cuenta que está activa
  const activeAccount = accounts.find(acc => acc.es_cuenta_activa) || accounts[0];

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h2 style={styles.title}>Recomendación Actual</h2>
        <div style={styles.badge}>
          <span style={styles.badgeDot}></span>
          Regla Rotativa
        </div>
      </div>
      
      <div style={styles.recommendationAlert}>
        <CheckCircle2 size={24} color="var(--success)" />
        <div>
          <p style={styles.recText}>
            Debes operar la <strong>{activeAccount.label}</strong>
          </p>
          <p style={styles.recSub}>
            Las otras cuentas están en descanso.
          </p>
        </div>
      </div>

      <div style={styles.accountsGrid}>
        {accounts.map(acc => {
          const isActive = acc.id === activeAccount.id;
          return (
            <div 
              key={acc.id} 
              style={{
                ...styles.accountItem,
                borderColor: isActive ? 'var(--accent-blue)' : 'transparent',
                backgroundColor: isActive ? 'rgba(10, 132, 255, 0.1)' : 'var(--bg-primary)'
              }}
            >
              <h3 style={{...styles.accName, color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)'}}>
                {acc.label}
              </h3>
              <p style={styles.accStatus}>
                {isActive ? 'Activa ahora' : 'En espera'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '24px',
    padding: '24px',
    border: '1px solid var(--border)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  title: {
    fontSize: '18px',
    fontWeight: '600'
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'var(--bg-tertiary)',
    padding: '6px 12px',
    borderRadius: '100px',
    fontSize: '13px',
    color: 'var(--text-secondary)'
  },
  badgeDot: {
    width: '8px',
    height: '8px',
    backgroundColor: 'var(--accent-blue)',
    borderRadius: '50%'
  },
  recommendationAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    backgroundColor: 'var(--bg-tertiary)',
    padding: '16px',
    borderRadius: '16px',
    marginBottom: '20px'
  },
  recText: {
    fontSize: '16px',
    color: 'var(--text-primary)'
  },
  recSub: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginTop: '2px'
  },
  accountsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px'
  },
  accountItem: {
    padding: '16px 12px',
    borderRadius: '16px',
    border: '1px solid',
    textAlign: 'center',
    transition: 'all 0.2s ease',
  },
  accName: {
    fontSize: '15px',
    fontWeight: '600',
    marginBottom: '4px'
  },
  accStatus: {
    fontSize: '13px',
    color: 'var(--text-secondary)'
  }
};
