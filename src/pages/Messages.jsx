import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Mail, ArrowRight, User, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

export default function Messages() {
  const [messages, setMessages] = useState([]);
  const currentUserId = parseInt(localStorage.getItem('gsmUserId'));

  const fetchMessages = async () => {
    try {
      const [{ data: msgs }, { data: allUsers }, { data: alerts }] = await Promise.all([
        supabase
          .from('messages')
          .select('*')
          .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
          .order('timestamp', { ascending: false }),
        supabase.from('users').select('id, username, phone_number'),
        supabase.from('alerts').select('*').order('timestamp', { ascending: false })
      ]);

      if (msgs && allUsers) {
        const userMap = allUsers.reduce((acc, u) => {
           acc[u.id] = `${u.username} (${u.phone_number})`;
           return acc;
        }, {});
        
        const formattedMessages = msgs.map(msg => ({
          ...msg,
          itemType: 'message',
          sender: userMap[msg.sender_id] || 'Unknown',
          receiver: userMap[msg.receiver_id] || 'Unknown'
        }));

        const formattedAlerts = (alerts || []).map((alert) => ({
          ...alert,
          itemType: 'alert',
          sender: 'MSC Emergency Broadcast',
          receiver: 'All Registered Nodes',
          content: alert.message,
          status: `${alert.priority} Priority`,
        }));

        const timeline = [...formattedAlerts, ...formattedMessages].sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        );

        setMessages(timeline);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 h-full flex flex-col">
      <h1 className="text-3xl font-bold flex items-center gap-3">
        <Mail className="text-blue-500" /> Device Inbox & Outbox
      </h1>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex-1 overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-neutral-500 py-12">No messages to display.</div>
        ) : (
          messages.map(msg => {
             const isAlert = msg.itemType === 'alert';
             const delivered = msg.status === 'Delivered';

             return (
               <div
                 key={`${msg.itemType}-${msg.id}`}
                 className={`p-5 rounded-lg flex flex-col gap-3 border ${
                   isAlert
                     ? 'bg-red-950/30 border-red-900/50'
                     : 'bg-neutral-950 border-neutral-800'
                 }`}
               >
                 <div className={`flex justify-between items-center pb-3 border-b ${isAlert ? 'border-red-900/50' : 'border-neutral-800'}`}>
                   <div className="flex items-center gap-3 text-sm font-medium">
                     <span className={`flex items-center gap-1 ${isAlert ? 'text-red-300' : 'text-blue-400'}`}>
                       {isAlert ? <AlertTriangle size={16} /> : <User size={16} />}
                       {msg.sender}
                     </span>
                     <ArrowRight size={16} className={isAlert ? 'text-red-700' : 'text-neutral-500'} />
                     <span className={`flex items-center gap-1 ${isAlert ? 'text-red-200' : 'text-green-400'}`}>
                       {isAlert ? <AlertTriangle size={16} /> : <User size={16} />}
                       {msg.receiver}
                     </span>
                   </div>
                   <div className={`text-xs ${isAlert ? 'text-red-200/70' : 'text-neutral-500'}`}>
                     {new Date(msg.timestamp).toLocaleString()}
                   </div>
                 </div>
                 
                 <div className={isAlert ? 'text-red-50 font-medium' : 'text-neutral-200'}>
                   {msg.content}
                 </div>
                 
                 <div className="flex justify-end pt-2">
                    {isAlert ? (
                      <span className="text-xs px-2 py-1 rounded-full flex items-center gap-1 bg-red-500/20 text-red-300 border border-red-500/20">
                        <AlertTriangle size={14} />
                        {msg.status}
                      </span>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${delivered ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                        {delivered ? <CheckCircle2 size={14}/> : <Clock size={14}/>}
                        {msg.status}
                      </span>
                    )}
                 </div>
               </div>
             )
          })
        )}
      </div>
    </div>
  );
}
