import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, RadioTower, Server, Send } from 'lucide-react';

export default function SimulateFlow() {
  const [users, setUsers] = useState([]);
  const [targetUser, setTargetUser] = useState('');
  const [message, setMessage] = useState('');
  
  const [activeMessage, setActiveMessage] = useState(null);
  const [messageLogs, setMessageLogs] = useState([]);
  
  const currentUserId = parseInt(localStorage.getItem('gsmUserId'));

  // Define the node coordinates conceptually
  const nodes = [
    { id: 'Sender', label: 'Sender', icon: <Smartphone size={32}/> },
    { id: 'BTS_Sender', label: 'Source BTS', icon: <RadioTower size={48}/> },
    { id: 'MSC', label: 'MSC Core', icon: <Server size={48}/> },
    { id: 'BTS_Receiver', label: 'Target BTS', icon: <RadioTower size={48}/> },
    { id: 'Receiver', label: 'Receiver', icon: <Smartphone size={32}/> }
  ];

  useEffect(() => {
    // Fetch users for generic destination dropdown
    const fetchUsers = async () => {
       const { data } = await supabase.from('users').select('*');
       if (data) {
         const filtered = data.filter(u => u.id !== currentUserId);
         setUsers(filtered);
         if (filtered.length > 0) setTargetUser(filtered[0].id);
       }
    };
    fetchUsers();
  }, [currentUserId]);

  useEffect(() => {
    // Poll logs for the active message
    if (!activeMessage) return;
    
    const fetchActiveLogs = async () => {
      try {
        const { data: logsData } = await supabase
           .from('message_logs')
           .select('*')
           .eq('message_id', activeMessage)
           .order('timestamp', { ascending: true });
        
        if (logsData) setMessageLogs(logsData);
      } catch (err) {
        console.error(err);
      }
    };
    
    const interval = setInterval(fetchActiveLogs, 1000);
    return () => clearInterval(interval);
  }, [activeMessage]);

  const simulateNetworkFlow = async (message_id) => {
    const steps = [
      { node: 'BTS_Sender', action: 'Received from Sender', status: 'BTS_Processing' },
      { node: 'MSC', action: 'Routing via MSC', status: 'MSC_Routing' },
      { node: 'BTS_Receiver', action: 'Transmitting to Target BTS', status: 'Target_BTS' },
      { node: 'Receiver', action: 'Delivered to Receiver', status: 'Delivered' }
    ];

    for (const step of steps) {
      await new Promise(r => setTimeout(r, 2000));
      
      await supabase.from('message_logs').insert([{
        message_id,
        node: step.node,
        action: step.action
      }]);
      
      await supabase.from('messages').update({ status: step.status }).eq('id', message_id);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message || !targetUser) return;
    
    try {
      const { data: msgData, error } = await supabase
        .from('messages')
        .insert([{
          sender_id: currentUserId,
          receiver_id: targetUser,
          content: message,
          status: 'Sent'
        }]).select().single();

      if (msgData) {
        setActiveMessage(msgData.id);
        
        await supabase.from('message_logs').insert([{
           message_id: msgData.id,
           node: 'Sender',
           action: 'Message Initiated'
        }]);
        
        setMessageLogs([{ node: 'Sender', action: 'Message Initiated' }]);
        setMessage('');
        
        // Begin simulated node propagation
        simulateNetworkFlow(msgData.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // derived active node
  const currentNode = messageLogs.length > 0 ? messageLogs[messageLogs.length - 1].node : null;
  const currentNodeIndex = nodes.findIndex(n => n.id === currentNode);
  const progressPercent = currentNodeIndex >= 0 ? (currentNodeIndex / (nodes.length - 1)) * 100 : 0;

  return (
    <div className="p-8 max-w-5xl mx-auto h-full flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Network Simulation Environment</h1>
        <p className="text-neutral-400">Send an SMS and trace its path through the simulated GSM architecture.</p>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl">
        <form onSubmit={handleSend} className="flex gap-4">
          <select 
            className="bg-neutral-950 border border-neutral-800 p-3 rounded-lg outline-none min-w-[200px]"
            value={targetUser}
            onChange={(e) => setTargetUser(e.target.value)}
          >
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.username} ({u.phone_number})</option>
            ))}
          </select>
          
          <input 
            type="text" 
            placeholder="Type your SMS message..."
            className="flex-1 bg-neutral-950 border border-neutral-800 p-3 rounded-lg outline-none focus:border-blue-500"
            value={message}
            onChange={e => setMessage(e.target.value)}
            required
          />
          
          <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2">
            <Send size={18} /> Transmit
          </button>
        </form>
      </div>

      {/* Animation Stage */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-12 flex-1 relative overflow-hidden flex flex-col justify-center">
        {/* Connection Line */}
        <div className="absolute left-16 right-16 top-1/2 h-1 bg-neutral-800 -translate-y-1/2 z-0">
           {activeMessage && (
             <motion.div 
               className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
               initial={{ width: 0 }}
               animate={{ width: `${progressPercent}%` }}
               transition={{ duration: 0.5, ease: "easeInOut" }}
             />
           )}
        </div>

        {/* Nodes */}
        <div className="flex justify-between relative z-10">
          {nodes.map((node, i) => {
            const isPassed = currentNodeIndex >= i;
            const isCurrent = currentNodeIndex === i;
            
            return (
              <div key={node.id} className="flex flex-col items-center gap-4 relative">
                <motion.div 
                  initial={{ scale: 1 }}
                  animate={{ 
                    scale: isCurrent ? 1.2 : 1,
                    borderColor: isPassed ? '#3b82f6' : '#262626',
                    backgroundColor: isPassed ? 'rgba(59,130,246,0.1)' : '#171717',
                    color: isPassed ? '#60a5fa' : '#737373'
                  }}
                  className="w-20 h-20 rounded-2xl border-2 flex items-center justify-center relative bg-neutral-900"
                >
                  {node.icon}
                  
                  {isCurrent && (
                    <motion.div 
                      className="absolute inset-0 border-2 border-blue-400 rounded-2xl"
                      animate={{ scale: [1, 1.3, 1], opacity: [1, 0, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}
                </motion.div>
                <div className="text-sm font-medium text-neutral-400 font-mono">{node.label}</div>
              </div>
            )
          })}
        </div>
        
        {/* Status Text */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
           {activeMessage ? (
              <AnimatePresence mode="popLayout">
                <motion.div 
                  key={currentNode}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-lg font-mono text-blue-400"
                >
                  {messageLogs.length > 0 ? messageLogs[messageLogs.length - 1].action : "Initializing routing protocol..."}
                </motion.div>
              </AnimatePresence>
           ) : (
             <div className="text-neutral-600 font-mono">Awaiting transmission...</div>
           )}
        </div>
      </div>
    </div>
  );
}
