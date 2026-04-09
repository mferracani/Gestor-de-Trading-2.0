import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAHl-pGUiMIrOgLfnZqKZAmmzfqte6bmFE",
  authDomain: "gestor-de-trading-2.firebaseapp.com",
  projectId: "gestor-de-trading-2",
  storageBucket: "gestor-de-trading-2.firebasestorage.app",
  messagingSenderId: "1007682401491",
  appId: "1:1007682401491:web:50050d23d118c513519026",
  measurementId: "G-RKJ9WB2YCR"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testConnection() {
  console.log("Intentando conectar a DB gestor-de-trading-2...");
  const start = Date.now();
  try {
    const q = query(collection(db, 'accounts'), where('user_id', '==', 'user_test_123'));
    const snap = await getDocs(q);
    const end = Date.now();
    console.log(`Conexión exitosa. Encontrados ${snap.docs.length} documentos.`);
    console.log(`Tiempo de respuesta: ${(end - start) / 1000} segundos.`);
    process.exit(0);
  } catch (err) {
    console.error("Error al conectar:", err);
    process.exit(1);
  }
}

testConnection();
