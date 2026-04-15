import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Activity, MessageSquare, LogOut, Radio, Mail } from 'lucide-react';

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("gsmUserId");
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex">
      {/* Sidebar */}
      <nav className="w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col p-4">
        <div className="flex items-center gap-3 font-semibold text-xl mb-8 text-blue-500">
          <Radio size={28} />
          GSM System
        </div>
        
        <div className="flex flex-col gap-2 flex-grow">
          <Link to="/" className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-800 transition-colors">
            <Activity size={20} /> Dashboard
          </Link>
          <Link to="/messages" className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-800 transition-colors">
            <Mail size={20} /> Inbox & Outbox
          </Link>
          <Link to="/simulate" className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-800 transition-colors">
            <MessageSquare size={20} /> Simulate Route
          </Link>
        </div>

        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 p-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors mt-auto"
        >
          <LogOut size={20} /> Logout
        </button>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
