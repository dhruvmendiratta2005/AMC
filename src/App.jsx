import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import SimulateFlow from './pages/SimulateFlow';
import Messages from './pages/Messages';

function App() {
  const isAuth = !!localStorage.getItem("gsmUserId");

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        
        {/* Protected Routes */}
        <Route path="/" element={isAuth ? <Layout /> : <Navigate to="/auth" />}>
          <Route index element={<Dashboard />} />
          <Route path="simulate" element={<SimulateFlow />} />
          <Route path="messages" element={<Messages />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
