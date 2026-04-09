import { Routes, Route } from 'react-router';
import AppShell from './components/layout/AppShell';
import Dashboard from './screens/Dashboard';
import ChallengeList from './screens/ChallengeList';
import ChallengeCreate from './screens/ChallengeCreate';
import ChallengeDetail from './screens/ChallengeDetail';
import TradeCreate from './screens/TradeCreate';
import Historial from './screens/Historial';
import Metricas from './screens/Metricas';
import FundedAccountList from './screens/FundedAccountList';
import FundedAccountDetail from './screens/FundedAccountDetail';
import FundedAccountCreate from './screens/FundedAccountCreate';
import ArchivedList from './screens/ArchivedList';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        {/* Las pantallas se renderizarán dentro de AppShell */}
        <Route path="/" element={<Dashboard />} />
        
        {/* Pantallas placeholder para evitar errores al hacer click en el menú nav */}
        <Route path="/challenges" element={<ChallengeList />} />
        <Route path="/challenges/nuevo" element={<ChallengeCreate />} />
        <Route path="/challenges/:id" element={<ChallengeDetail />} />
        <Route path="/trades/nuevo" element={<TradeCreate />} />
        
        <Route path="/historial" element={<Historial />} />
        <Route path="/metricas" element={<Metricas />} />
        <Route path="/archivadas" element={<ArchivedList />} />

        {/* Cuentas Fondeadas */}
        <Route path="/fondeadas" element={<FundedAccountList />} />
        <Route path="/fondeadas/nueva" element={<FundedAccountCreate />} />
        <Route path="/fondeadas/:id" element={<FundedAccountDetail />} />
      </Route>
    </Routes>
  );
}

// Componente temporal para rutas vacías
function Placeholder({ title }) {
  return (
    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>
      <h1>{title}</h1>
      <p style={{ marginTop: '10px' }}>Pantalla en construcción...</p>
    </div>
  );
}
