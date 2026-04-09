import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { nanoid } from 'nanoid';

export async function seedDatabase() {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    if (!usersSnap.empty) {
      console.log('Database already seeded, skipping...');
      return;
    }

    console.log('Seeding database with test data...');
    
    // 1. Create a dummy user
    const userId = 'user_test_123';
    await setDoc(doc(db, 'users', userId), {
      nombre: 'Matias',
      email: 'trading@test.com',
      riesgo_por_defecto_pct: 2,
      created_at: new Date().toISOString()
    });

    // 2. Create a Challenge
    const challengeId = nanoid();
    await setDoc(doc(db, 'challenges', challengeId), {
      user_id: userId,
      nombre: 'FTMO 10k',
      broker: 'FTMO',
      tipo_cuenta: 'Challenge',
      estado: 'activo',
      tamano_cuenta_usd: 10000,
      fase_actual: 1,
      objetivo_usd: 1000,
      max_loss_usd: 1000,
      max_daily_loss_usd: 500,
      activo: true,
      created_at: new Date().toISOString()
    });

    // 3. Create 3 Accounts for that Challenge
    const accountsData = [
      { label: 'Cuenta A', orden_rotacion: 1, estado: 'operable', es_cuenta_activa: true },
      { label: 'Cuenta B', orden_rotacion: 2, estado: 'operable', es_cuenta_activa: false },
      { label: 'Cuenta C', orden_rotacion: 3, estado: 'operable', es_cuenta_activa: false }
    ];

    for (const acc of accountsData) {
      const accId = nanoid();
      await setDoc(doc(db, 'accounts', accId), {
        challenge_id: challengeId,
        label: acc.label,
        balance_inicial_usd: 10000,
        balance_actual_usd: 10000,
        equity_maxima_usd: 10000,
        pnl_acumulado_usd: 0,
        estado: acc.estado,
        es_cuenta_activa: acc.es_cuenta_activa,
        orden_rotacion: acc.orden_rotacion,
        created_at: new Date().toISOString()
      });
    }

    console.log('Seed complete! 🚀');
  } catch (error) {
    console.error('Error seeding DB:', error);
  }
}
