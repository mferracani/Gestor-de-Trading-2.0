import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Edit3, Archive, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useTradingStore } from '../store/useTradingStore';

export default function ChallengeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchAccounts } = useTradingStore();
  
  const [account, setAccount] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const docRef = doc(db, 'accounts', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setAccount({ id: docSnap.id, ...docSnap.data() });
        }

        // Fetch Trades — sin orderBy para evitar necesidad de índice compuesto en Firestore
        const qTrades = query(collection(db, 'trades'), where('account_id', '==', id));
        const tradesSnap = await getDocs(qTrades);
        const _trades = tradesSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')); // Ordenar desc por fecha en cliente
        setTrades(_trades);

      } catch(err) {
        console.error('Error cargando detalle de cuenta o trades:', err);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const handleArchive = async () => {
    if(!window.confirm('¿Seguro quieres archivar esta cuenta? Desaparecerá de los slots activos.')) return;
    try {
      await updateDoc(doc(db, 'accounts', id), {
        estado: 'archivada',
        activo: false // Sacar de circulación del slot
      });
      await fetchAccounts();
      navigate('/challenges');
    } catch(err) {
      alert('Error archivando');
    }
  };

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando cuenta...</div>;
  }

  if (!account) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--accent-red)' }}>Cuenta no encontrada.</div>;
  }

  const pnlColor = (account.pnl_acumulado_usd || 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
  const pnlSign = (account.pnl_acumulado_usd || 0) > 0 ? '+' : '';

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.iconButton}>
          <ArrowLeft size={24} color="var(--text-primary)" />
        </button>
        <div style={styles.actions}>
          <button style={styles.iconButton} onClick={handleArchive} title="Mover a archivados">
            <Archive size={20} color="var(--text-secondary)" />
          </button>
          <button style={styles.iconButton}>
            <Edit3 size={20} color="var(--text-secondary)" />
          </button>
        </div>
      </header>

      <div style={styles.challengeInfo}>
        <div style={styles.statusBadge}>
          ⚡ {account.estado} (Slot {account.slot})
        </div>
        <h1 style={styles.title}>{account.nombre}</h1>
        
        <div style={styles.balanceGrid}>
            <div>
                <div style={styles.label}>Balance Actual</div>
                <div style={styles.value}>${(account.balance_actual_usd || account.balance_inicial_usd).toLocaleString()}</div>
            </div>
            <div>
                <div style={styles.label}>PnL Acumulado</div>
                <div style={{...styles.value, color: pnlColor}}>{pnlSign}${(account.pnl_acumulado_usd || 0).toLocaleString()}</div>
            </div>
        </div>

        {/* Indicador de cuánto falta para el objetivo */}
        {(() => {
          const pnl = account.pnl_acumulado_usd || 0;
          const objetivo = account.objetivo_usd || 1000;
          const falta = Math.max(0, objetivo - pnl);
          const progresoPct = Math.min(100, (pnl / objetivo) * 100);
          return (
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  {falta <= 0 ? '🏆 ¡Objetivo alcanzado!' : 'Faltan para el objetivo'}
                </div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: falta <= 0 ? '#30d158' : '#ff9f0a' }}>
                  {falta <= 0 ? `+$${pnl.toLocaleString()}` : `$${falta.toLocaleString()}`}
                </div>
              </div>
              <div style={{
                width: '52px', height: '52px',
                borderRadius: '50%',
                border: '3px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative'
              }}>
                <svg width="52" height="52" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
                  <circle cx="26" cy="26" r="22" fill="none" stroke={falta <= 0 ? '#30d158' : '#ff9f0a'} strokeWidth="3"
                    strokeDasharray={`${(Math.max(0, progresoPct) / 100) * 138} 138`}
                    strokeLinecap="round"
                  />
                </svg>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {Math.round(Math.max(0, progresoPct))}%
                </span>
              </div>
            </div>
          );
        })()}
        
        <div style={styles.limitsRow}>
          <span>Meta: <strong style={{color: 'var(--accent-green)'}}>${account.objetivo_usd}</strong></span>
          <span style={styles.dot}>•</span>
          <span>Límite Global: <strong style={{color: 'var(--accent-red)'}}>${account.max_loss_usd}</strong></span>
          <span style={styles.dot}>•</span>
          <span>Lím. Día: <strong style={{color: 'var(--accent-orange)'}}>${account.max_daily_loss_usd}</strong></span>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>HISTORIAL DE TRADES</h3>
          <button 
            style={styles.linkBtn}
            onClick={() => navigate(`/trades/nuevo?accountId=${account.id}`)}
          >
            + Registrar Trade
          </button>
        </div>
        
        <div style={styles.tradesPanelWrapper}>
          {trades.length === 0 ? (
            <div style={styles.tradesPanel}>
              <div style={styles.emptyTrades}>Aún no hay trades registrados en esta cuenta.</div>
            </div>
          ) : (
            <div style={styles.tradesList}>
              {trades.map(trade => {
                const isWin = trade.resultado === 'WIN';
                const isLoss = trade.resultado === 'LOSS';
                
                return (
                  <div key={trade.id} style={styles.tradeCard}>
                    <div style={styles.tradeIcon}>
                      {isWin && <TrendingUp size={20} color="var(--accent-green)" />}
                      {isLoss && <TrendingDown size={20} color="var(--accent-red)" />}
                      {!isWin && !isLoss && <Minus size={20} color="#8e8e93" />}
                    </div>
                    
                    <div style={styles.tradeDetails}>
                      <div style={styles.tradeAsset}>{trade.activo}</div>
                      <div style={styles.tradeDate}>
                        {new Date(trade.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    
                    <div style={{
                      ...styles.tradePnl,
                      color: isWin ? 'var(--accent-green)' : (isLoss ? 'var(--accent-red)' : 'var(--text-secondary)')
                    }}>
                      {isWin ? '+' : ''}{trade.pnl_usd === 0 ? 'B.E.' : `$${trade.pnl_usd}`}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '16px 24px 40px 24px',
    maxWidth: '800px',
    margin: '0 auto',
    height: '100%',
    overflowY: 'auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  iconButton: {
    backgroundColor: 'transparent',
    border: 'none',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0
  },
  actions: {
    display: 'flex',
    gap: '8px'
  },
  challengeInfo: {
    marginBottom: '32px'
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    color: 'var(--accent-orange)',
    backgroundColor: 'rgba(255, 159, 10, 0.1)',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '12px'
  },
  title: {
    fontSize: '26px',
    fontWeight: '700',
    marginBottom: '16px'
  },
  balanceGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px',
      backgroundColor: 'var(--bg-secondary)',
      padding: '20px',
      borderRadius: '16px',
      marginBottom: '16px',
      border: '1px solid var(--border)'
  },
  label: {
      fontSize: '13px',
      color: 'var(--text-secondary)',
      marginBottom: '4px'
  },
  value: {
      fontSize: '22px',
      fontWeight: '700'
  },
  limitsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    flexWrap: 'wrap'
  },
  dot: {
    color: 'var(--border)'
  },
  section: {
    marginBottom: '32px'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    letterSpacing: '0.5px'
  },
  linkBtn: {
    backgroundColor: 'var(--accent-blue)',
    border: 'none',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    padding: '8px 16px',
    borderRadius: '12px'
  },
  tradesPanelWrapper: {
    marginTop: '16px'
  },
  tradesPanel: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '40px 24px',
    textAlign: 'center'
  },
  emptyTrades: {
    color: 'var(--text-muted)',
    fontSize: '14px'
  },
  tradesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  tradeCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '16px',
  },
  tradeIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    backgroundColor: 'var(--bg-tertiary)',
    marginRight: '12px'
  },
  tradeDetails: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  tradeAsset: {
    fontSize: '15px',
    fontWeight: '600',
    color: 'var(--text-primary)'
  },
  tradeDate: {
    fontSize: '13px',
    color: 'var(--text-secondary)'
  },
  tradePnl: {
    fontSize: '16px',
    fontWeight: '700'
  }
};
