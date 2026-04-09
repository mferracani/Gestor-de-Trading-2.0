import { useEffect } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTradingStore } from '../store/useTradingStore';
import ChallengeCard from '../components/challenges/ChallengeCard';

export default function ChallengeList() {
  const navigate = useNavigate();
  const { accounts, isLoading, fetchAccounts } = useTradingStore();

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Queremos 3 slots siempre. Asumimos identidades 'A', 'B', 'C'
  const SLOTS = ['A', 'B', 'C'];

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Mis Challenges</h1>
      </header>

      {isLoading ? (
        <div style={styles.loadingState}>
          <Loader2 className="spinner" size={32} color="var(--accent-blue)" />
          <p>Cargando slots...</p>
        </div>
      ) : (
        <div className="challenges-grid">
          {SLOTS.map(slotId => {
            // Buscamos si hay una cuenta activa en este slot
            // Podemos mapear 'A' -> 'Cuenta A' si está así en BD
            const account = accounts.find(a => a.label === `Cuenta ${slotId}` || a.slot === slotId);

            if (account) {
              return <ChallengeCard key={account.id} account={account} />;
            }

            return (
              <div 
                key={`empty-${slotId}`} 
                style={styles.emptySlot}
                onClick={() => navigate(`/challenges/nuevo?slot=${slotId}`)}
              >
                <div style={styles.emptyContent}>
                  <Plus size={24} color="var(--text-secondary)" />
                  <span style={styles.emptyText}>Agregar Cuenta {slotId}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '24px 24px',
    maxWidth: '800px',
    margin: '0 auto',
    height: '100%',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    letterSpacing: '-0.5px'
  },
  list: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px'
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: '12px',
    color: 'var(--text-secondary)'
  },
  emptySlot: {
    backgroundColor: 'var(--bg-primary)',
    border: '2px dashed var(--border)',
    borderRadius: '20px',
    padding: '40px 24px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  emptyContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px'
  },
  emptyText: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text-secondary)'
  }
};
