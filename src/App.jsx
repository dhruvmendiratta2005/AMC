import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import SimulateFlow from './pages/SimulateFlow';
import Messages from './pages/Messages';
import MSCDashboard from './pages/MSCDashboard';
import { supabase } from './supabaseClient';
import { getStoredUserId, clearSessionUser, isAdminUser } from './utils/session';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const storedUserId = getStoredUserId();

      if (!storedUserId) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', storedUserId)
        .single();

      if (error || !data) {
        clearSessionUser();
        setCurrentUser(null);
      } else {
        setCurrentUser(data);
      }

      setIsLoading(false);
    };

    restoreSession();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 px-6 py-4 text-sm text-neutral-400">
          Restoring GSM session...
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/auth"
          element={currentUser ? <Navigate to="/" replace /> : <Auth onAuthSuccess={setCurrentUser} />}
        />
        
        {/* Protected Routes */}
        <Route
          path="/"
          element={currentUser ? <Layout currentUser={currentUser} onLogout={() => setCurrentUser(null)} /> : <Navigate to="/auth" replace />}
        >
          <Route index element={<Dashboard />} />
          <Route path="simulate" element={<SimulateFlow />} />
          <Route path="messages" element={<Messages />} />
          <Route
            path="msc-dashboard"
            element={isAdminUser(currentUser) ? <MSCDashboard /> : <Navigate to="/" replace />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
