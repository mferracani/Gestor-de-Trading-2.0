import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div style={styles.container}>
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onClose }) {
  const icons = {
    success: <CheckCircle size={18} color="#30d158" />,
    error: <XCircle size={18} color="#ff453a" />,
    warning: <AlertTriangle size={18} color="#ff9f0a" />,
  };

  const colors = {
    success: 'rgba(48,209,88,0.15)',
    error: 'rgba(255,69,58,0.15)',
    warning: 'rgba(255,159,10,0.15)',
  };

  const borders = {
    success: 'rgba(48,209,88,0.3)',
    error: 'rgba(255,69,58,0.3)',
    warning: 'rgba(255,159,10,0.3)',
  };

  return (
    <div style={{
      ...styles.toast,
      backgroundColor: colors[toast.type] || colors.success,
      borderColor: borders[toast.type] || borders.success,
    }}>
      {icons[toast.type]}
      <span style={styles.message}>{toast.message}</span>
      <button onClick={onClose} style={styles.closeBtn}>
        <X size={14} color="rgba(255,255,255,0.5)" />
      </button>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    top: '80px',
    right: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    zIndex: 9999,
    maxWidth: '320px',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 16px',
    borderRadius: '14px',
    border: '1px solid',
    backdropFilter: 'blur(20px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    animation: 'slideIn 0.25s ease',
  },
  message: {
    flex: 1,
    fontSize: '14px',
    color: 'var(--text-primary)',
    fontWeight: '500',
    lineHeight: '1.4',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
};

// Keyframe para animación
if (typeof document !== 'undefined' && !document.getElementById('toast-style')) {
  const style = document.createElement('style');
  style.id = 'toast-style';
  style.textContent = `
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `;
  document.head.appendChild(style);
}
