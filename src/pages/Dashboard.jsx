import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Activity, Users, MessageSquareText, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({ total_messages: 0, total_users: 0, active_users: 0 });
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  
  const [newAlertMsg, setNewAlertMsg] = useState('');

  const fetchData = async () => {
    try {
      // Stats
      const [{ count: totalMessages }, { count: totalUsers }] = await Promise.all([
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true })
      ]);
      
      setStats({
        total_messages: totalMessages || 0,
        total_users: totalUsers || 0,
        active_users: totalUsers || 0
      });
      
      // Logs
      const { data: logsData } = await supabase
         .from('message_logs')
         .select('*')
         .order('timestamp', { ascending: false })
         .limit(100);
      setLogs(logsData || []);
      
      // Alerts
      const { data: alertsData } = await supabase
         .from('alerts')
         .select('*')
         .order('timestamp', { ascending: false });
      setAlerts(alertsData || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!newAlertMsg) return;
    try {
      await supabase.from('alerts').insert([{ message: newAlertMsg, priority: 'High' }]);
      setNewAlertMsg('');
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <Activity className="text-blue-500" /> System Dashboard
      </h1>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl flex items-center gap-4">
          <div className="bg-blue-500/20 text-blue-500 p-3 rounded-lg"><MessageSquareText size={24} /></div>
          <div>
            <div className="text-neutral-400 text-sm">Total Messages</div>
            <div className="text-2xl font-bold">{stats.total_messages}</div>
          </div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl flex items-center gap-4">
          <div className="bg-green-500/20 text-green-500 p-3 rounded-lg"><Users size={24} /></div>
          <div>
            <div className="text-neutral-400 text-sm">Registered Nodes</div>
            <div className="text-2xl font-bold">{stats.total_users}</div>
          </div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl flex items-center gap-4">
          <div className="bg-purple-500/20 text-purple-500 p-3 rounded-lg"><Activity size={24} /></div>
          <div>
            <div className="text-neutral-400 text-sm">Active Connections</div>
            <div className="text-2xl font-bold">{stats.active_users}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Network Logs List */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col h-[500px]">
          <div className="p-4 border-b border-neutral-800 font-medium">Global Network Logs</div>
          <div className="p-4 overflow-y-auto flex-1 font-mono text-sm space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-4 p-2 hover:bg-neutral-800/50 rounded">
                <span className="text-neutral-500 min-w-[70px]">{new Date(log.timestamp).toLocaleTimeString([], {hour12:false})}</span>
                <span className="text-blue-400 min-w-[100px]">[{log.node}]</span>
                <span className="text-neutral-300 flex-1">{log.action}</span>
                <span className="text-neutral-500 text-xs">MsgID: {log.message_id}</span>
              </div>
            ))}
            {logs.length === 0 && <div className="text-neutral-500 text-center py-8">No logs generated yet.</div>}
          </div>
        </div>

        {/* Alert Broadcasting Area */}
        <div className="space-y-8 h-[500px] flex flex-col">
          <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-6">
            <h2 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
              <AlertTriangle /> Override & Broadcast Mode
            </h2>
            <form onSubmit={handleBroadcast} className="flex gap-3">
              <input 
                type="text" 
                placeholder="Enter emergency message..."
                className="flex-1 bg-neutral-950 border border-red-900/50 rounded-lg p-3 outline-none focus:border-red-500"
                value={newAlertMsg}
                onChange={e => setNewAlertMsg(e.target.value)}
                required
              />
              <button className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                Broadcast Area
              </button>
            </form>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b border-neutral-800 font-medium">Recent Emergency Alerts</div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {alerts.map(a => (
                <div key={a.id} className="p-4 rounded-lg bg-red-950/30 border border-red-900/50">
                  <div className="flex justify-between items-start mb-2">
                    <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded font-bold">{a.priority} Priority</span>
                    <span className="text-xs text-neutral-500">{new Date(a.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-red-100">{a.message}</p>
                </div>
              ))}
              {alerts.length === 0 && <div className="text-neutral-500 text-center py-8">No active alerts.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
