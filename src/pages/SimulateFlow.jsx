import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, RadioTower, Server, Send, ShieldAlert, WifiOff, TimerReset, AlertCircle } from 'lucide-react';
import { BTS_TOWERS, getTowerForUser } from '../utils/network';
import { getStoredFaultProfile } from '../utils/faultInjection';

function getFaultIcon(profileId) {
  if (profileId === 'bts_down') return WifiOff;
  if (profileId === 'delayed_routing') return TimerReset;
  return AlertCircle;
}

export default function SimulateFlow() {
  const [users, setUsers] = useState([]);
  const [userLookup, setUserLookup] = useState(new Map());
  const [targetUser, setTargetUser] = useState('');
  const [message, setMessage] = useState('');
  const [activeMessage, setActiveMessage] = useState(null);
  const [messageLogs, setMessageLogs] = useState([]);
  const [activeRoute, setActiveRoute] = useState(null);
  const [faultProfile, setFaultProfile] = useState(() => getStoredFaultProfile());

  const currentUserId = parseInt(localStorage.getItem('gsmUserId'), 10);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase.from('users').select('*');
      if (data) {
        const filtered = data.filter((user) => user.id !== currentUserId);
        setUsers(filtered);
        setUserLookup(new Map(data.map((user) => [user.id, user])));
        if (filtered.length > 0) setTargetUser(String(filtered[0].id));
      }
    };
    fetchUsers();
  }, [currentUserId]);

  useEffect(() => {
    const syncFaultProfile = () => setFaultProfile(getStoredFaultProfile());
    window.addEventListener('gsm:fault-change', syncFaultProfile);
    window.addEventListener('storage', syncFaultProfile);
    return () => {
      window.removeEventListener('gsm:fault-change', syncFaultProfile);
      window.removeEventListener('storage', syncFaultProfile);
    };
  }, []);

  useEffect(() => {
    if (!activeMessage) return;

    const fetchActiveLogs = async () => {
      try {
        const { data: logsData } = await supabase
          .from('message_logs')
          .select('*')
          .eq('message_id', activeMessage)
          .order('timestamp', { ascending: true });

        if (logsData) setMessageLogs(logsData);
      } catch (error) {
        console.error(error);
      }
    };

    fetchActiveLogs();
    const interval = setInterval(fetchActiveLogs, 1000);
    return () => clearInterval(interval);
  }, [activeMessage]);

  const simulateNetworkFlow = async (messageId) => {
    const steps = [
      { node: 'BTS_Sender', action: 'Received from Sender', status: 'BTS_Processing' },
      { node: 'MSC', action: 'Routing via MSC', status: 'MSC_Routing' },
      { node: 'BTS_Receiver', action: 'Transmitting to Target BTS', status: 'Target_BTS' },
      { node: 'Receiver', action: 'Delivered to Receiver', status: 'Delivered' },
    ];

    for (const step of steps) {
      await new Promise((resolve) => setTimeout(resolve, faultProfile.stepDelayMs));
      const action = faultProfile.stepActionOverrides?.[step.node] || step.action;

      if (faultProfile.failAtNode === step.node) {
        await supabase.from('message_logs').insert([{ message_id: messageId, node: step.node, action: faultProfile.failureAction }]);
        await supabase.from('messages').update({ status: faultProfile.failureStatus }).eq('id', messageId);
        return;
      }

      await supabase.from('message_logs').insert([{ message_id: messageId, node: step.node, action }]);
      await supabase.from('messages').update({ status: step.status }).eq('id', messageId);
    }
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if (!message || !targetUser) return;

    try {
      const senderUser = userLookup.get(currentUserId);
      const receiverUser = userLookup.get(Number(targetUser));
      const senderTower = getTowerForUser(senderUser);
      const receiverTower = getTowerForUser(receiverUser);

      const { data: messageData } = await supabase
        .from('messages')
        .insert([
          {
            sender_id: currentUserId,
            receiver_id: targetUser,
            content: message,
            status: 'Sent',
          },
        ])
        .select()
        .single();

      if (!messageData) return;

      setActiveMessage(messageData.id);
      setActiveRoute({ senderUser, receiverUser, senderTower, receiverTower });
      await supabase.from('message_logs').insert([{ message_id: messageData.id, node: 'Sender', action: 'Message Initiated' }]);
      setMessageLogs([{ node: 'Sender', action: 'Message Initiated' }]);
      setMessage('');
      simulateNetworkFlow(messageData.id);
    } catch (error) {
      console.error(error);
    }
  };

  const currentNode = messageLogs.length > 0 ? messageLogs[messageLogs.length - 1].node : null;
  const currentAction = messageLogs.length > 0 ? messageLogs[messageLogs.length - 1].action : null;
  const currentUser = userLookup.get(currentUserId);
  const selectedTarget = users.find((user) => String(user.id) === String(targetUser));
  const currentUserTower = currentUser ? getTowerForUser(currentUser) : BTS_TOWERS[0];
  const targetTower = selectedTarget ? getTowerForUser(selectedTarget) : BTS_TOWERS[0];
  const routeNodes = activeRoute
    ? [
        { id: 'Sender', label: activeRoute.senderUser?.username || 'Sender', sublabel: activeRoute.senderTower.name, x: 12, y: 72, icon: <Smartphone size={28} /> },
        { id: 'BTS_Sender', label: activeRoute.senderTower.name, sublabel: 'Source tower', x: 28, y: 38, icon: <RadioTower size={34} />, accent: activeRoute.senderTower.accent },
        { id: 'MSC', label: 'MSC Core', sublabel: faultProfile.badge, x: 50, y: 18, icon: <Server size={34} />, accent: '#a78bfa' },
        { id: 'BTS_Receiver', label: activeRoute.receiverTower.name, sublabel: 'Target tower', x: 72, y: 38, icon: <RadioTower size={34} />, accent: activeRoute.receiverTower.accent },
        { id: 'Receiver', label: activeRoute.receiverUser?.username || 'Receiver', sublabel: activeRoute.receiverTower.name, x: 88, y: 72, icon: <Smartphone size={28} /> },
      ]
    : [];
  const currentNodeIndex = routeNodes.findIndex((node) => node.id === currentNode);
  const progressPercent = routeNodes.length > 0 && currentNodeIndex >= 0 ? (currentNodeIndex / (routeNodes.length - 1)) * 100 : 0;
  const FaultIcon = getFaultIcon(faultProfile.id);

  return (
    <div className="p-8 max-w-6xl mx-auto h-full flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Network Simulation Environment</h1>
        <p className="text-neutral-400">Send an SMS and trace its path through a live tower-aware topology with fault injection.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl">
          <form onSubmit={handleSend} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr_auto]">
              <select
                className="bg-neutral-950 border border-neutral-800 p-3 rounded-lg outline-none min-w-[200px]"
                value={targetUser}
                onChange={(event) => setTargetUser(event.target.value)}
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username} ({user.phone_number})
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Type your SMS message..."
                className="flex-1 bg-neutral-950 border border-neutral-800 p-3 rounded-lg outline-none focus:border-blue-500"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                required
              />

              <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                <Send size={18} /> Transmit
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-neutral-500">Source Tower</div>
                <div className="mt-2 text-lg font-semibold text-neutral-100">{currentUserTower.name}</div>
                <div className="mt-1 text-sm text-neutral-500">{currentUser?.username || 'Current user'} is anchored here.</div>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-neutral-500">Destination Tower</div>
                <div className="mt-2 text-lg font-semibold text-neutral-100">{targetTower.name}</div>
                <div className="mt-1 text-sm text-neutral-500">{selectedTarget?.username || 'Selected user'} will receive via this BTS.</div>
              </div>
            </div>
          </form>
        </div>

        <div className={`rounded-xl border p-6 ${faultProfile.panelClass}`}>
          <div className="flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-neutral-100">
            <ShieldAlert size={18} />
            Active Fault Profile
          </div>
          <div className="mt-4 flex items-start gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/10 p-3 text-white">
              <FaultIcon size={24} />
            </div>
            <div>
              <div className="text-2xl font-semibold text-neutral-100">{faultProfile.label}</div>
              <p className="mt-2 text-sm text-neutral-300">{faultProfile.description}</p>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-neutral-200">
            Change this from the MSC Dashboard to watch the topology react in real time.
          </div>
        </div>
      </div>

      <div className="bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.22),_transparent_42%),linear-gradient(180deg,#09111f_0%,#05070d_100%)] border border-neutral-800 rounded-xl p-6 lg:p-10 flex-1 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(rgba(148,163,184,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative min-h-[540px]">
          {routeNodes.length > 0 ? (
            <>
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {routeNodes.slice(0, -1).map((node, index) => {
                  const nextNode = routeNodes[index + 1];
                  return (
                    <line
                      key={`${node.id}-${nextNode.id}`}
                      x1={node.x}
                      y1={node.y}
                      x2={nextNode.x}
                      y2={nextNode.y}
                      stroke="rgba(148,163,184,0.3)"
                      strokeWidth="0.6"
                    />
                  );
                })}
                {activeMessage && (
                  <motion.circle
                    r="1.8"
                    fill="url(#pulseGradient)"
                    filter="url(#pulseGlow)"
                    initial={{ offsetDistance: '0%' }}
                    animate={{ offsetDistance: `${progressPercent}%` }}
                    transition={{ duration: 0.8, ease: 'easeInOut' }}
                    style={{ offsetPath: 'path("M 12 72 L 28 38 L 50 18 L 72 38 L 88 72")' }}
                  />
                )}
                <defs>
                  <linearGradient id="pulseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#60a5fa" />
                  </linearGradient>
                  <filter id="pulseGlow">
                    <feGaussianBlur stdDeviation="2.2" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
              </svg>

              {routeNodes.map((node, index) => {
                const isPassed = currentNodeIndex >= index;
                const isCurrent = currentNodeIndex === index;
                const nodeAccent = node.accent || '#60a5fa';

                return (
                  <div
                    key={node.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <motion.div
                        animate={{
                          scale: isCurrent ? 1.12 : 1,
                          borderColor: isPassed ? nodeAccent : '#262626',
                          boxShadow: isCurrent ? `0 0 28px ${nodeAccent}55` : '0 0 0 rgba(0,0,0,0)',
                        }}
                        className="relative flex h-20 w-20 items-center justify-center rounded-3xl border-2 bg-neutral-950 text-neutral-100"
                      >
                        {node.icon}
                        {isCurrent && (
                          <motion.div
                            className="absolute inset-0 rounded-3xl border-2"
                            style={{ borderColor: nodeAccent }}
                            animate={{ scale: [1, 1.25, 1], opacity: [0.95, 0.15, 0.95] }}
                            transition={{ duration: 1.4, repeat: Infinity }}
                          />
                        )}
                      </motion.div>
                      <div className="text-center">
                        <div className="text-sm font-semibold text-neutral-100">{node.label}</div>
                        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">{node.sublabel}</div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="absolute left-6 right-6 top-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {BTS_TOWERS.map((tower) => {
                  const isSenderTower = activeRoute?.senderTower.id === tower.id;
                  const isReceiverTower = activeRoute?.receiverTower.id === tower.id;
                  return (
                    <div key={tower.id} className="rounded-2xl border border-neutral-800/80 bg-neutral-950/75 p-4 backdrop-blur">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-neutral-100">{tower.name}</div>
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: tower.accent, boxShadow: `0 0 18px ${tower.glow}` }} />
                      </div>
                      <div className="mt-2 text-xs uppercase tracking-[0.2em] text-neutral-500">
                        {isSenderTower && isReceiverTower ? 'Source + Destination' : isSenderTower ? 'Source tower' : isReceiverTower ? 'Destination tower' : 'Idle'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex h-[540px] items-center justify-center text-neutral-500">Awaiting route allocation...</div>
          )}
        </div>

        <div className="relative mt-6 rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5 text-center">
          {activeMessage ? (
            <AnimatePresence mode="popLayout">
              <motion.div
                key={`${currentNode}-${currentAction}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2"
              >
                <div className={`text-sm uppercase tracking-[0.28em] ${faultProfile.accent}`}>Current Network State</div>
                <div className="text-xl font-mono text-neutral-100">{currentAction || 'Initializing routing protocol...'}</div>
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="space-y-2">
              <div className={`text-sm uppercase tracking-[0.28em] ${faultProfile.accent}`}>Current Network State</div>
              <div className="text-neutral-500 font-mono">Awaiting transmission...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
