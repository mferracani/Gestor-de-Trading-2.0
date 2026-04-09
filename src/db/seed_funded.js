// Script para insertar la cuenta fondeada Alpha Capital 10K
// Ejecutar: node src/db/seed_funded.js

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAHl-pGUiMIrOgLfnZqKZAmmzfqte6bmFE",
  authDomain: "gestor-de-trading-2.firebaseapp.com",
  projectId: "gestor-de-trading-2",
  storageBucket: "gestor-de-trading-2.firebasestorage.app",
  messagingSenderId: "1007682401491",
  appId: "1:1007682401491:web:50050d23d118c513519026",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedFundedAccounts() {
  console.log('🚀 Iniciando seed de cuentas fondeadas...');

  const userId = 'user_test_123';

  // Verificar si ya existe la cuenta
  const q = query(collection(db, 'funded_accounts'), where('nombre', '==', 'Alpha Capital 10K'), where('user_id', '==', userId));
  const existing = await getDocs(q);
  if (!existing.empty) {
    console.log('✅ La cuenta Alpha Capital 10K ya existe. No se duplica.');
    process.exit(0);
  }

  const account = {
    nombre: 'Alpha Capital 10K',
    broker: 'Alpha Capital',
    balance_inicial_usd: 10000,
    balance_actual_usd: 10000,
    pnl_acumulado_usd: 0,
    objetivo_retiro_pct: 2,       // 2% = $200 para retirar
    regla_consistencia: true,     // Activa
    notas: 'Cuenta fondeada Alpha Capital. Objetivo: retirar 2% ($200). Regla de consistencia activa.',
    estado: 'activo',
    user_id: userId,
    createdAt: new Date().toISOString(),
  };

  const ref = await addDoc(collection(db, 'funded_accounts'), account);
  console.log(`✅ Cuenta creada! ID: ${ref.id}`);
  console.log(`   Nombre:    ${account.nombre}`);
  console.log(`   Balance:   $${account.balance_inicial_usd.toLocaleString()}`);
  console.log(`   Target:    ${account.objetivo_retiro_pct}% ($${(account.balance_inicial_usd * account.objetivo_retiro_pct / 100).toLocaleString()})`);
  console.log(`   Broker:    ${account.broker}`);
  console.log(`   Consistencia: Activa`);

  process.exit(0);
}

seedFundedAccounts().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
