import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Activity, RadioTower, ServerCog, UsersRound } from 'lucide-react';

const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const TRAFFIC_WINDOW_MS = 30 * 60 * 1000;
const BTS_TOWERS = ['BTS North', 'BTS East', 'BTS South', 'BTS West'];
const QUEUE_STATUSES = ['Sent', 'BTS_Processing', 'MSC_Routing', 'Target_BTS'];

function getTowerForUser(user) {
  const numericSeed = Number.parseInt(`${user?.phone_number || user?.id || 0}`.replace(/\D/g, '').slice(-2), 10);
  const safeSeed = Number.isNaN(numericSeed) ? Number(user?.id || 0) : numericSeed;
  return BTS_TOWERS[safeSeed % BTS_TOWERS.length];
}

function formatRelativeWindow(minutes) {
  return `Last ${minutes} min`;
}

function StatCard({ title, value, subtitle, icon: Icon, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  };

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm uppercase tracking-[0.2em] text-neutral-500">{title}</div>
          <div className="mt-3 text-4xl font-semibold text-neutral-100">{value}</div>
          <div className="mt-2 text-sm text-neutral-500">{subtitle}</div>
        </div>
        <div className={`rounded-2xl border p-3 ${tones[tone]}`}>
          <Icon size={26} />
        </div>
      </div>
    </div>
  );
}

function QueueBars({ items }) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-neutral-300">{item.label}</span>
            <span className="text-neutral-500">{item.value}</span>
          </div>
          <div className="h-3 rounded-full bg-neutral-800">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500"
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TrafficBars({ items }) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-5">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-2 flex items-center justify-between text-sm">
            <div>
              <div className="font-medium text-neutral-200">{item.label}</div>
              <div className="text-xs text-neutral-500">{item.description}</div>
            </div>
            <div className="text-sm font-medium text-neutral-300">{item.value}</div>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400"
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RingChart({ activeCount, totalCount }) {
  const safeTotal = Math.max(totalCount, 1);
  const percentage = Math.round((activeCount / safeTotal) * 100);
  const degrees = (percentage / 100) * 360;

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div
        className="flex h-44 w-44 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(#38bdf8 ${degrees}deg, rgba(38, 38, 38, 1) ${degrees}deg 360deg)`,
        }}
      >
        <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-neutral-950">
          <div className="text-3xl font-semibold text-neutral-100">{percentage}%</div>
          <div className="text-xs uppercase tracking-[0.25em] text-neutral-500">Active</div>
        </div>
      </div>
      <div className="text-sm text-neutral-400">
        {activeCount} active users out of {totalCount} registered nodes
      </div>
    </div>
  );
}

export default function MSCDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [snapshot, setSnapshot] = useState({
    totalUsers: 0,
    activeUsers: 0,
    queueDepth: 0,
    queueBreakdown: QUEUE_STATUSES.map((status) => ({ label: status.replaceAll('_', ' '), value: 0 })),
    trafficByTower: BTS_TOWERS.map((tower) => ({
      label: tower,
      value: 0,
      description: 'No recent routed traffic',
    })),
  });

  useEffect(() => {
    const fetchSnapshot = async () => {
      try {
        const activityThreshold = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
        const trafficThreshold = new Date(Date.now() - TRAFFIC_WINDOW_MS).toISOString();

        const [
          { data: usersData },
          { data: recentMessages },
          { data: queuedMessages },
          { data: recentTrafficMessages },
        ] = await Promise.all([
          supabase.from('users').select('id, username, phone_number'),
          supabase.from('messages').select('sender_id, receiver_id, timestamp').gte('timestamp', activityThreshold),
          supabase.from('messages').select('id, status').neq('status', 'Delivered'),
          supabase
            .from('messages')
            .select('sender_id, receiver_id, timestamp')
            .gte('timestamp', trafficThreshold),
        ]);

        const allUsers = usersData || [];
        const activeUserIds = new Set();

        (recentMessages || []).forEach((message) => {
          activeUserIds.add(message.sender_id);
          activeUserIds.add(message.receiver_id);
        });

        const queueCounts = QUEUE_STATUSES.reduce((accumulator, status) => {
          accumulator[status] = 0;
          return accumulator;
        }, {});

        (queuedMessages || []).forEach((message) => {
          if (queueCounts[message.status] !== undefined) {
            queueCounts[message.status] += 1;
          }
        });

        const userMap = new Map(allUsers.map((user) => [user.id, user]));
        const trafficCounts = BTS_TOWERS.reduce((accumulator, tower) => {
          accumulator[tower] = 0;
          return accumulator;
        }, {});

        (recentTrafficMessages || []).forEach((message) => {
          const senderTower = getTowerForUser(userMap.get(message.sender_id));
          const receiverTower = getTowerForUser(userMap.get(message.receiver_id));

          trafficCounts[senderTower] += 1;
          trafficCounts[receiverTower] += 1;
        });

        setSnapshot({
          totalUsers: allUsers.length,
          activeUsers: activeUserIds.size,
          queueDepth: (queuedMessages || []).length,
          queueBreakdown: QUEUE_STATUSES.map((status) => ({
            label: status.replaceAll('_', ' '),
            value: queueCounts[status],
          })),
          trafficByTower: BTS_TOWERS.map((tower) => ({
            label: tower,
            value: trafficCounts[tower],
            description:
              trafficCounts[tower] > 0
                ? `${trafficCounts[tower]} message handoffs in ${formatRelativeWindow(TRAFFIC_WINDOW_MS / 60000)}`
                : `No message handoffs in ${formatRelativeWindow(TRAFFIC_WINDOW_MS / 60000)}`,
          })),
        });
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSnapshot();
    const interval = setInterval(fetchSnapshot, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 p-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm uppercase tracking-[0.35em] text-cyan-400">MSC Control Plane</div>
          <h1 className="mt-2 text-4xl font-semibold text-neutral-100">MSC Admin Dashboard</h1>
          <p className="mt-3 max-w-3xl text-neutral-400">
            Live oversight for simulated subscriber activity, current message pressure on the MSC, and BTS traffic balance.
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
          Refresh cadence: every 3 seconds
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <StatCard
          title="Active Nodes"
          value={snapshot.activeUsers}
          subtitle={`${formatRelativeWindow(ACTIVE_WINDOW_MS / 60000)} network participation`}
          icon={UsersRound}
          tone="blue"
        />
        <StatCard
          title="MSC Queue"
          value={snapshot.queueDepth}
          subtitle="Messages not yet marked as Delivered"
          icon={ServerCog}
          tone="amber"
        />
        <StatCard
          title="Traffic Surface"
          value={snapshot.trafficByTower.reduce((sum, tower) => sum + tower.value, 0)}
          subtitle={`${formatRelativeWindow(TRAFFIC_WINDOW_MS / 60000)} BTS handoff volume`}
          icon={Activity}
          tone="emerald"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-cyan-300">
              <UsersRound size={22} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-neutral-100">Total Active Users Right Now</h2>
              <p className="text-sm text-neutral-500">Derived from send/receive activity in the last 5 minutes.</p>
            </div>
          </div>
          <div className="flex min-h-[320px] items-center justify-center">
            <RingChart activeCount={snapshot.activeUsers} totalCount={snapshot.totalUsers} />
          </div>
        </section>

        <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-300">
              <ServerCog size={22} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-neutral-100">Real-Time Network Load</h2>
              <p className="text-sm text-neutral-500">Current queue depth across the MSC routing stages.</p>
            </div>
          </div>
          <QueueBars items={snapshot.queueBreakdown} />
        </section>
      </div>

      <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-300">
            <RadioTower size={22} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-neutral-100">Traffic Distribution Between BTS Towers</h2>
            <p className="text-sm text-neutral-500">
              Towers are assigned deterministically from the simulated node identities so the current schema can still show balanced traffic.
            </p>
          </div>
        </div>
        <TrafficBars items={snapshot.trafficByTower} />
      </section>

      {isLoading && <div className="text-sm text-neutral-500">Loading live MSC metrics...</div>}
    </div>
  );
}
