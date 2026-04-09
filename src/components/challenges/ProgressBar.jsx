export default function ProgressBar({ pnl, maxLoss, target }) {
  const totalSpan = maxLoss + target;
  if (totalSpan === 0) return null;

  // Where the zero line sits (percentage from left)
  const zeroPct = (maxLoss / totalSpan) * 100;

  // Calculate fill
  let fillLeft = zeroPct;
  let fillWidth = 0;
  let fillColor = 'transparent';

  if (pnl > 0) {
    // Green fill: from zero line to the right
    fillColor = '#30d158'; // bright green
    fillLeft = zeroPct;
    fillWidth = Math.min((pnl / target) * (100 - zeroPct), 100 - zeroPct);
    // Minimum visible width
    if (fillWidth > 0 && fillWidth < 2) fillWidth = 2;
  } else if (pnl < 0) {
    // Red fill: from zero line to the left
    fillColor = '#ff453a'; // bright red
    fillWidth = Math.min((Math.abs(pnl) / maxLoss) * zeroPct, zeroPct);
    fillLeft = zeroPct - fillWidth;
    // Minimum visible width
    if (fillWidth > 0 && fillWidth < 2) fillWidth = 2;
  }

  return (
    <div style={styles.container}>
      {/* Track */}
      <div style={styles.track}>
        {/* Left zone (loss) — subtle red tint */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${zeroPct}%`,
          backgroundColor: 'rgba(255, 69, 58, 0.08)',
          borderRadius: '10px 0 0 10px'
        }} />

        {/* Right zone (profit) — subtle green tint */}
        <div style={{
          position: 'absolute',
          left: `${zeroPct}%`,
          top: 0,
          bottom: 0,
          width: `${100 - zeroPct}%`,
          backgroundColor: 'rgba(48, 209, 88, 0.08)',
          borderRadius: '0 10px 10px 0'
        }} />

        {/* Fill Bar */}
        {fillWidth > 0 && (
          <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${fillLeft}%`,
            width: `${fillWidth}%`,
            backgroundColor: fillColor,
            borderRadius: '10px',
            transition: 'all 0.4s ease',
            zIndex: 1,
            boxShadow: `0 0 8px ${fillColor}66`
          }} />
        )}

        {/* Zero line */}
        <div style={{
          position: 'absolute',
          top: '-2px',
          bottom: '-2px',
          left: `${zeroPct}%`,
          width: '2px',
          backgroundColor: 'rgba(255,255,255,0.3)',
          transform: 'translateX(-50%)',
          zIndex: 2
        }} />
      </div>

      {/* Labels */}
      <div style={styles.labels}>
        <span style={{ color: '#ff453a', fontSize: '11px', fontWeight: '500' }}>
          -${maxLoss}
        </span>
        <span style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: '11px',
          fontWeight: '500'
        }}>
          0
        </span>
        <span style={{ color: '#30d158', fontSize: '11px', fontWeight: '500' }}>
          +${target}
        </span>
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
    padding: '8px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  track: {
    height: '8px',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: '10px',
    position: 'relative',
    overflow: 'visible'
  },
  labels: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  }
};
