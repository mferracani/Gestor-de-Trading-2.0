import { create } from 'zustand';
import { collection, query, where, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const useTradingStore = create((set) => ({
  activeChallenge: null,
  accounts: [],
  isLoading: true,
  error: null,

  fetchDashboardData: async () => {
    set({ isLoading: true, error: null });
    try {
      const userId = 'user_test_123';
      
      const qAccounts = query(
        collection(db, 'accounts'), 
        where('user_id', '==', userId),
        where('estado', '==', 'activo')
      );
      
      const accountsSnap = await getDocs(qAccounts);
      const accounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Sort logically by rotation order (1=A, 2=B, 3=C)
      accounts.sort((a, b) => a.orden_rotacion - b.orden_rotacion);

      // Buscar la cuenta activa designada. Si ninguna está activa por error de sincronización, usamos la de menor orden.
      const activeChallenge = accounts.find(a => a.es_cuenta_activa) || (accounts.length > 0 ? accounts[0] : null);

      set({ activeChallenge, accounts, isLoading: false });
    } catch (error) {
      console.error("Error al cargar datos del Dashboard:", error);
      set({ error: error.message, isLoading: false });
    }
  },

  fetchAccounts: async () => {
    set({ isLoading: true, error: null });
    console.log("Iniciando fetchAccounts...");
    try {
      const userId = 'user_test_123';
      
      const qAccounts = query(
        collection(db, 'accounts'), 
        where('user_id', '==', userId),
        where('estado', '==', 'activo')
      );
      
      console.log("Cargando cuentas de Firebase...");
      const accountsSnap = await getDocs(qAccounts);
      const accounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log("Cuentas cargadas exitosamente:", accounts.length);

      set({ accounts, isLoading: false });
    } catch (error) {
      console.error("Error al cargar lista de cuentas (slots):", error);
      set({ error: error.message, isLoading: false });
    }
  },

  registerTrade: async (accountId, tradeData) => {
    try {
      // Garantizar que tenemos las cuentas cargadas antes de procesar rotación
      await useTradingStore.getState().fetchAccounts();
      
      const { accounts } = useTradingStore.getState();
      const account = accounts.find(a => a.id === accountId);
      if (!account) throw new Error("Cuenta no encontrada");

      const finalPnl = Number(tradeData.pnl_usd || 0);
      const newBalance = (account.balance_actual_usd || account.balance_inicial_usd) + finalPnl;

      // 1. Evaluar si la cuenta pasa a peligro (danger) o se quema
      const initialBal = account.balance_inicial_usd || 10000;
      const maxLossAbs = initialBal - (account.max_loss_usd || 1000);
      const limitDanger = maxLossAbs + (initialBal * 0.02); // 2% por encima del max loss
      const limitWin = initialBal + (account.objetivo_usd || 1000);
      
      let newEstado = account.estado;
      let stopTradingReason = null;

      if (newBalance <= maxLossAbs) {
        newEstado = 'quemada';
        stopTradingReason = 'Cuenta Quemada';
      } else if (newBalance >= limitWin && account.objetivo_usd > 0) {
        newEstado = 'aprobada';
        stopTradingReason = 'Objetivo Alcanzado';
      } else if (newBalance <= limitDanger) {
        newEstado = 'danger'; // En peligro
      }

      // Crear transaccion/batch
      const batch = writeBatch(db);

      // Crear el trade
      const newTradeRef = doc(collection(db, 'trades'));
      batch.set(newTradeRef, {
        ...tradeData,
        user_id: account.user_id || 'user_test_123',
        account_id: account.id,
        pnl_usd: finalPnl,
        fecha: new Date().toISOString()
      });

      // 2. Determinar Rotación (Si perdió y sigue viva, o si murió, rotamos)
      // Si el estado es quemada/aprobada, hay que rotar a la fuerza.
      // Si el trade fue LOSS y no murió aún, rotamos a la siguiente.
      let isActive = account.es_cuenta_activa ?? true; // Si es vieja, asumimos que era la activa porque nos dejó operar.
      let nextActiveAccountId = null;

      const needsRotation = (tradeData.resultado === 'LOSS' || newEstado === 'quemada' || newEstado === 'aprobada');

      if (needsRotation && isActive) {
        // Encontrar siguiente
        const rotActiveAccounts = accounts.filter(a => a.estado === 'activo' || a.estado === 'danger');
        rotActiveAccounts.sort((a, b) => a.orden_rotacion - b.orden_rotacion);
        
        let currentIndex = rotActiveAccounts.findIndex(a => a.id === account.id);
        if (currentIndex === -1) currentIndex = 0; // fallback
        
        // Iterar para encontrar la siguiente que pueda operarse (debe estar en 'activo' o a lo sumo en 'danger' si la persona insiste)
        // Preferimos una cuenta que no sea estemos rotando DE ella.
        let nextIndex = (currentIndex + 1) % rotActiveAccounts.length;
        let candidate = rotActiveAccounts[nextIndex];
        
        // Evitamos volver a nosotros mismos si es la unica (en tal caso se queda, pero si se quemó se va)
        if (candidate && candidate.id !== account.id) {
           nextActiveAccountId = candidate.id;
           isActive = false; // Nos quitamos el active
        } else if (newEstado === 'quemada' || newEstado === 'aprobada') {
           isActive = false; // Nos la quitamos, no hay nadie mas, game over para la sesión
        }
      }

      // Actualizamos la cuenta actual
      const accountRef = doc(db, 'accounts', account.id);
      batch.update(accountRef, {
        balance_actual_usd: newBalance,
        pnl_acumulado_usd: (account.pnl_acumulado_usd || 0) + finalPnl,
        estado: newEstado || 'activo',
        es_cuenta_activa: isActive ?? false
      });

      // Si hay una cuenta siguiente, la activamos
      if (nextActiveAccountId) {
        const nextAccountRef = doc(db, 'accounts', nextActiveAccountId);
        batch.update(nextAccountRef, { es_cuenta_activa: true });
      }

      await batch.commit();

      // Recargar datos
      await useTradingStore.getState().fetchDashboardData();
      return { success: true, rotatedTo: nextActiveAccountId, reason: stopTradingReason };
    } catch (error) {
      console.error("Error registrando trade:", error);
      throw error;
    }
  }
}));
