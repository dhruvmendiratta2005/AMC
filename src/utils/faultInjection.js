const STORAGE_KEY = 'gsmFaultProfile';

export const FAULT_PROFILES = [
  {
    id: 'normal',
    label: 'Nominal Traffic',
    description: 'Healthy network path with normal latency.',
    badge: 'Nominal',
    accent: 'text-emerald-300',
    panelClass: 'border-emerald-500/20 bg-emerald-500/10',
    stepDelayMs: 1500,
  },
  {
    id: 'msc_congestion',
    label: 'MSC Congestion',
    description: 'The MSC queues traffic and visibly slows routing decisions.',
    badge: 'Congestion',
    accent: 'text-amber-300',
    panelClass: 'border-amber-500/20 bg-amber-500/10',
    stepDelayMs: 3200,
    queuePressure: 3,
    stepActionOverrides: {
      MSC: 'MSC congested, message held in queue before reroute',
    },
  },
  {
    id: 'delayed_routing',
    label: 'Delayed Routing',
    description: 'Extra handoff latency affects both BTS towers and the MSC.',
    badge: 'Delayed',
    accent: 'text-sky-300',
    panelClass: 'border-sky-500/20 bg-sky-500/10',
    stepDelayMs: 2600,
    stepActionOverrides: {
      BTS_Sender: 'Source BTS waiting for channel allocation',
      BTS_Receiver: 'Target BTS delaying final downlink delivery',
    },
  },
  {
    id: 'bts_down',
    label: 'Target BTS Down',
    description: 'The destination BTS is unavailable and the delivery stops there.',
    badge: 'BTS Down',
    accent: 'text-rose-300',
    panelClass: 'border-rose-500/20 bg-rose-500/10',
    stepDelayMs: 1700,
    failAtNode: 'BTS_Receiver',
    failureStatus: 'Failed_BTS_Down',
    failureAction: 'Target BTS offline, delivery aborted',
  },
  {
    id: 'packet_loss',
    label: 'Packet Loss',
    description: 'The SMS payload is dropped at the MSC because of corruption.',
    badge: 'Packet Loss',
    accent: 'text-fuchsia-300',
    panelClass: 'border-fuchsia-500/20 bg-fuchsia-500/10',
    stepDelayMs: 1800,
    failAtNode: 'MSC',
    failureStatus: 'Failed_Packet_Loss',
    failureAction: 'MSC detected packet corruption and dropped the payload',
  },
  {
    id: 'receiver_unreachable',
    label: 'Receiver Unreachable',
    description: 'The handset never acknowledges the final delivery.',
    badge: 'Unreachable',
    accent: 'text-red-300',
    panelClass: 'border-red-500/20 bg-red-500/10',
    stepDelayMs: 1900,
    failAtNode: 'Receiver',
    failureStatus: 'Failed_Receiver_Unreachable',
    failureAction: 'Receiver handset unreachable, final delivery failed',
  },
];

export function getFaultProfileById(profileId) {
  return FAULT_PROFILES.find((profile) => profile.id === profileId) || FAULT_PROFILES[0];
}

export function getStoredFaultProfile() {
  const storedId = localStorage.getItem(STORAGE_KEY);
  return getFaultProfileById(storedId);
}

export function setStoredFaultProfile(profileId) {
  localStorage.setItem(STORAGE_KEY, profileId);
  window.dispatchEvent(new Event('gsm:fault-change'));
}
