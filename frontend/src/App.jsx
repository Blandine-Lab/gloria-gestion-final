import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Stocks from './pages/Stocks';
import Entrees from './pages/Entrees';
import EntreesOperateurs from './pages/EntreesOperateurs';
import Sorties from './pages/Sorties';
import VentesMega from './pages/VentesMega';
import OperatorSales from './pages/OperatorSales';
import Clients from './pages/Clients';
import Vendeurs from './pages/Vendeurs';
import Caisse from './pages/Caisse';
import Rapports from './pages/Rapports';
import Utilisateurs from './pages/Utilisateurs';
import Parametres from './pages/Parametres';
import Sauvegarde from './pages/Sauvegarde';
import Admin from './pages/Admin';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Route publique de connexion */}
          <Route path="/login" element={<Login />} />

          {/* Routes protégées avec Layout */}
          <Route element={<Layout />}>
            <Route path="/" element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute requiredRole="dashboard">
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/stocks" element={
              <ProtectedRoute requiredRole="stocks">
                <Stocks />
              </ProtectedRoute>
            } />
            <Route path="/entrees" element={
              <ProtectedRoute requiredRole="stocks">
                <Entrees />
              </ProtectedRoute>
            } />
            <Route path="/entrees-operateurs" element={
              <ProtectedRoute requiredRole="admin">
                <EntreesOperateurs />
              </ProtectedRoute>
            } />
            <Route path="/sorties" element={
              <ProtectedRoute requiredRole="sorties">
                <Sorties />
              </ProtectedRoute>
            } />
            <Route path="/ventes-mega" element={
              <ProtectedRoute requiredRole="ventes-mega">
                <VentesMega />
              </ProtectedRoute>
            } />
            <Route path="/ventes-mega/operator/:id" element={
              <ProtectedRoute requiredRole="ventes-mega">
                <OperatorSales />
              </ProtectedRoute>
            } />
            <Route path="/clients" element={
              <ProtectedRoute requiredRole="clients">
                <Clients />
              </ProtectedRoute>
            } />
            <Route path="/vendeurs" element={
              <ProtectedRoute requiredRole="vendeurs">
                <Vendeurs />
              </ProtectedRoute>
            } />
            <Route path="/caisse" element={
              <ProtectedRoute requiredRole="caisse">
                <Caisse />
              </ProtectedRoute>
            } />
            <Route path="/rapports" element={
              <ProtectedRoute requiredRole="rapports">
                <Rapports />
              </ProtectedRoute>
            } />
            <Route path="/utilisateurs" element={
              <ProtectedRoute requiredRole="admin">
                <Utilisateurs />
              </ProtectedRoute>
            } />
            <Route path="/parametres" element={
              <ProtectedRoute requiredRole="parametres">
                <Parametres />
              </ProtectedRoute>
            } />
            <Route path="/sauvegarde" element={
              <ProtectedRoute requiredRole="sauvegarde">
                <Sauvegarde />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute requiredRole="admin">
                <Admin />
              </ProtectedRoute>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;