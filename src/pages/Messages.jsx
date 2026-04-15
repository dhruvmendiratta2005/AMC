import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Mail, ArrowRight, User, CheckCircle2, Clock } from 'lucide-react';

export default function Messages() {
  const [messages, setMessages] = useState([]);
  const currentUserId = parseInt(localStorage.getItem('gsmUserId'));

  const fetchMessages = async () => {
    try {
      const [{ data: msgs }, { data: allUsers }] = await Promise.all([
        supabase
          .from('messages')
          .select('*')
          .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
          .order('timestamp', { ascending: false }),
        supabase.from('users').select('id, username, phone_number')
      ]);

      if (msgs && allUsers) {
        const userMap = allUsers.reduce((acc, u) => {
           acc[u.id] = `${u.username} (${u.phone_number})`;
           return acc;
        }, {});
        
        const formatted = msgs.map(msg => ({
          ...msg,
          sender: userMap[msg.sender_id] || 'Unknown',
          receiver: userMap[msg.receiver_id] || 'Unknown'
        }));
        setMessages(formatted);
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
             const delivered = msg.status === 'Delivered';

             return (
               <div key={msg.id} className="bg-neutral-950 border border-neutral-800 p-5 rounded-lg flex flex-col gap-3">
                 <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                   <div className="flex items-center gap-3 text-sm font-medium">
                     <span className="text-blue-400 flex items-center gap-1"><User size={16}/> {msg.sender}</span>
                     <ArrowRight size={16} className="text-neutral-500" />
                     <span className="text-green-400 flex items-center gap-1"><User size={16}/> {msg.receiver}</span>
                   </div>
                   <div className="text-xs text-neutral-500">
                     {new Date(msg.timestamp).toLocaleString()}
                   </div>
                 </div>
                 
                 <div className="text-neutral-200">
                   {msg.content}
                 </div>
                 
                 <div className="flex justify-end pt-2">
                    <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${delivered ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                      {delivered ? <CheckCircle2 size={14}/> : <Clock size={14}/>}
                      {msg.status}
                    </span>
                 </div>
               </div>
             )
          })
        )}
      </div>
    </div>
  );
}
