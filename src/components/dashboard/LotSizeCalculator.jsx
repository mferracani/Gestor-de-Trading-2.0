import { useState, useMemo } from 'react';
import { Calculator } from 'lucide-react';

const PAIRS = [
  { id: 'eurusd', label: 'EUR/USD', pipValue: 10 },
  { id: 'gbpusd', label: 'GBP/USD', pipValue: 10 },
  { id: 'xauusd', label: 'XAU/USD', pipValue: 1000 }, 
  { id: 'xagusd', label: 'XAG/USD', pipValue: 1000 },
  { id: 'us30', label: 'US30', pipValue: 1 },
  { id: 'nas100', label: 'NAS100', pipValue: 1 },
];

export default function LotSizeCalculator({ balance = 10000, defaultRiskPct = 1 }) {
  const [selectedPair, setSelectedPair] = useState(PAIRS[0]);
  const [riskPct, setRiskPct] = useState(defaultRiskPct);
  const [slPips, setSlPips] = useState(10);

  const lotSize = useMemo(() => {
    if (!slPips || slPips <= 0) return 0;
    const riskAmount = balance * (riskPct / 100);
    // Formula: Lot Size = Risk Amount / (SL Pips * Pip Value)
    const size = riskAmount / (slPips * selectedPair.pipValue);
    return size.toFixed(2);
  }, [balance, riskPct, slPips, selectedPair]);

  const riskAmount = useMemo(() => {
    return (balance * (riskPct / 100)).toFixed(2);
  }, [balance, riskPct]);

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.titleWrap}>
          <Calculator size={20} color="var(--accent-green)" />
          <h2 style={styles.title}>Calculadora de Riesgo</h2>
        </div>
      </div>

      <div style={styles.controlsGrid}>
        {/* Riesgo */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Riesgo (%)</label>
          <div style={styles.rangeWrap}>
            <input 
              type="range" 
              min="0.25" 
              max="3" 
              step="0.25"
              value={riskPct}
              onChange={(e) => setRiskPct(Number(e.target.value))}
              style={styles.rangeInput}
            />
            <span style={styles.rangeValue}>{riskPct}% (${riskAmount})</span>
          </div>
        </div>

        {/* Par */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Par a Operar</label>
          <select 
            value={selectedPair.id}
            onChange={(e) => {
              const pair = PAIRS.find(p => p.id === e.target.value);
              setSelectedPair(pair);
            }}
            style={styles.select}
          >
            {PAIRS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* SL en Pips */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Stop Loss (Pips)</label>
          <input 
            type="number" 
            value={slPips}
            onChange={(e) => setSlPips(Number(e.target.value))}
            style={styles.numberInput}
          />
        </div>
      </div>

      <div style={styles.resultBox}>
        <div style={styles.resultLabel}>Lotaje Recomendado</div>
        <div style={styles.resultValue}>{lotSize} lotes</div>
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
    marginBottom: '24px'
  },
  titleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  title: {
    fontSize: '18px',
    fontWeight: '600'
  },
  controlsGrid: {
    display: 'grid',
    gap: '20px',
    marginBottom: '24px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    fontWeight: '500'
  },
  rangeWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  rangeInput: {
    flex: 1,
    accentColor: 'var(--accent-green)'
  },
  rangeValue: {
    fontSize: '15px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    minWidth: '50px',
    textAlign: 'right'
  },
  select: {
    padding: '12px 16px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    color: 'var(--text-primary)',
    fontSize: '16px',
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none'
  },
  numberInput: {
    padding: '12px 16px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    color: 'var(--text-primary)',
    fontSize: '16px',
    outline: 'none'
  },
  resultBox: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderRadius: '16px',
    padding: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    border: '1px solid rgba(52, 199, 89, 0.2)'
  },
  resultLabel: {
    fontSize: '15px',
    color: 'var(--text-secondary)'
  },
  resultValue: {
    fontSize: '28px',
    fontWeight: '700',
    color: 'var(--accent-green)'
  }
};
