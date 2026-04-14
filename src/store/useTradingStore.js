import { create } from 'zustand';
import { collection, query, where, getDocs, getDoc, doc, writeBatch, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { buildTradeFinancials } from '../lib/tradeMath';

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

      const { grossPnl, commission, swap, netPnl, estimatedCommission, commissionSource } = buildTradeFinancials(tradeData, account);
      const finalPnl = netPnl;
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
        lotes: tradeData.lotes ?? null,
        gross_pnl_usd: grossPnl,
        comision_usd: commission,
        comision_estimada_usd: estimatedCommission,
        comision_fuente: commissionSource,
        swap_usd: swap,
        net_pnl_usd: netPnl,
        pnl_usd: finalPnl,
        fecha: new Date().toISOString()
      });

      // 2. Determinar Rotación
      // Solo rotamos si la cuenta actual ES la activa designada.
      // Si se carga un trade en una cuenta que no es la activa (acceso directo al detalle),
      // solo actualizamos balance/estado sin tocar es_cuenta_activa de ninguna cuenta.
      const isCurrentlyActive = account.es_cuenta_activa === true;
      let nextActiveAccountId = null;
      let newIsActive = isCurrentlyActive; // por defecto mantenemos el estado actual

      const needsRotation = isCurrentlyActive &&
        (tradeData.resultado === 'LOSS' || newEstado === 'quemada' || newEstado === 'aprobada');

      if (needsRotation) {
        // Encontrar la siguiente cuenta operativa
        const rotActiveAccounts = accounts.filter(a => a.estado === 'activo' || a.estado === 'danger');
        rotActiveAccounts.sort((a, b) => a.orden_rotacion - b.orden_rotacion);
        
        let currentIndex = rotActiveAccounts.findIndex(a => a.id === account.id);
        if (currentIndex === -1) currentIndex = 0; // fallback
        
        let nextIndex = (currentIndex + 1) % rotActiveAccounts.length;
        let candidate = rotActiveAccounts[nextIndex];
        
        if (candidate && candidate.id !== account.id) {
           nextActiveAccountId = candidate.id;
           newIsActive = false; // Cedemos el estado activo a la siguiente
        } else if (newEstado === 'quemada' || newEstado === 'aprobada') {
           newIsActive = false; // No hay siguiente, cerramos sesión
        }
        // Si el candidato somos nosotros mismos (única cuenta), no rotamos
      }

      // Actualizamos la cuenta actual
      const accountRef = doc(db, 'accounts', account.id);
      batch.update(accountRef, {
        balance_actual_usd: newBalance,
        pnl_acumulado_usd: (account.pnl_acumulado_usd || 0) + finalPnl,
        estado: newEstado || 'activo',
        es_cuenta_activa: newIsActive
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
  },

  registerFundedTrade: async (accountId, tradeData) => {
    try {
      // Buscar la cuenta en la colección correcta: funded_accounts
      const accountRef = doc(db, 'funded_accounts', accountId);
      const accountSnap = await getDoc(accountRef);
      if (!accountSnap.exists()) throw new Error('Cuenta no encontrada');

      const account = { id: accountSnap.id, ...accountSnap.data() };
      const { grossPnl, commission, swap, netPnl, estimatedCommission, commissionSource } = buildTradeFinancials(tradeData, account);
      const finalPnl = netPnl;
      const inicial = account.balance_inicial_usd || 0;
      const newBalance = (account.balance_actual_usd || inicial) + finalPnl;
      const newPnl = (account.pnl_acumulado_usd || 0) + finalPnl;

      // Check max loss
      const maxLossAbs = account.max_loss_usd ? (inicial - account.max_loss_usd) : (inicial * 0.9);
      let newEstado = account.estado || 'activo';
      let stopTradingReason = null;

      if (newBalance <= maxLossAbs) {
        newEstado = 'quemada';
        stopTradingReason = 'Cuenta Quemada';
      }

      const batch = writeBatch(db);

      // Crear el trade vinculado a la cuenta fondeada
      const newTradeRef = doc(collection(db, 'trades'));
      batch.set(newTradeRef, {
        ...tradeData,
        user_id: account.user_id || 'user_test_123',
        account_id: accountId,
        tipo_cuenta: 'fondeada',
        lotes: tradeData.lotes ?? null,
        gross_pnl_usd: grossPnl,
        comision_usd: commission,
        comision_estimada_usd: estimatedCommission,
        comision_fuente: commissionSource,
        swap_usd: swap,
        net_pnl_usd: netPnl,
        pnl_usd: finalPnl,
        fecha: new Date().toISOString()
      });

      // Actualizar balance y PnL de la cuenta fondeada
      batch.update(accountRef, {
        balance_actual_usd: newBalance,
        pnl_acumulado_usd: newPnl,
        estado: newEstado
      });

      await batch.commit();
      return { success: true, reason: stopTradingReason };
    } catch (error) {
      console.error('Error registrando trade fondeada:', error);
      throw error;
    }
  },

  stopParaRetiro: async (accountId, fechaCobro) => {
    const accountRef = doc(db, 'funded_accounts', accountId);
    const snap = await getDoc(accountRef);
    if (!snap.exists()) throw new Error('Cuenta no encontrada');
    const data = snap.data();
    if (data.en_retiro) throw new Error('La cuenta ya está en proceso de retiro');
    await updateDoc(accountRef, {
      en_retiro: true,
      fecha_cobro: fechaCobro || null,
      fecha_stop_retiro: new Date().toISOString(),
    });
    return { success: true };
  },

  iniciarNuevoCiclo: async (accountId) => {
    const accountRef = doc(db, 'funded_accounts', accountId);
    const snap = await getDoc(accountRef);
    if (!snap.exists()) throw new Error('Cuenta no encontrada');
    const data = snap.data();
    if (!data.en_retiro) throw new Error('La cuenta no está en proceso de retiro');

    const tradesSnap = await getDocs(
      query(collection(db, 'trades'), where('account_id', '==', accountId))
    );

    const cicloEntry = {
      ciclo: data.ciclo_actual ?? 1,
      pnl_usd: data.pnl_acumulado_usd ?? 0,
      balance_inicial_usd: data.balance_inicial_usd ?? 0,
      fecha_stop: data.fecha_stop_retiro ?? new Date().toISOString(),
      fecha_cobro: data.fecha_cobro ?? null,
      num_trades: tradesSnap.size,
    };

    await updateDoc(accountRef, {
      balance_actual_usd: data.balance_inicial_usd,
      pnl_acumulado_usd: 0,
      en_retiro: false,
      fecha_cobro: null,
      fecha_stop_retiro: null,
      ciclo_actual: (data.ciclo_actual ?? 1) + 1,
      historial_ciclos: [...(data.historial_ciclos ?? []), cicloEntry],
    });
    return { success: true };
  },
}));
