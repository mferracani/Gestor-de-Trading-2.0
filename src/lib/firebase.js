import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAHl-pGUiMIrOgLfnZqKZAmmzfqte6bmFE",
  authDomain: "gestor-de-trading-2.firebaseapp.com",
  projectId: "gestor-de-trading-2",
  storageBucket: "gestor-de-trading-2.firebasestorage.app",
  messagingSenderId: "1007682401491",
  appId: "1:1007682401491:web:50050d23d118c513519026",
  measurementId: "G-RKJ9WB2YCR"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar y exportar servicios
export const db = getFirestore(app);
export const auth = getAuth(app);
