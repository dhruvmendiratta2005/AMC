import { useEffect, useMemo, useRef, useState } from 'react';
import { Phone, PhoneCall, PhoneOff, Mic, RadioTower, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { getStoredUserId } from '../utils/session';
import { getTowerForUser } from '../utils/network';

const ACTIVE_CALL_STATUSES = ['pending', 'connecting', 'connected'];
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

function getErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return error.message || 'Unknown error';
}

function isMissingCallSchema(message) {
  return message.includes('calls') || message.includes('call_candidates');
}

function formatParticipant(user) {
  const tower = getTowerForUser(user);
  return `${user.username} (${user.phone_number}) • ${tower.name}`;
}

export default function Calls() {
  const currentUserId = getStoredUserId();
  const [users, setUsers] = useState([]);
  const [callState, setCallState] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [statusText, setStatusText] = useState('Idle and ready for a voice session.');
  const [setupError, setSetupError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const processedCandidateIdsRef = useRef(new Set());
  const remoteAudioRef = useRef(null);

  const currentUser = useMemo(() => users.find((user) => user.id === currentUserId) || null, [users, currentUserId]);
  const selectedUser = useMemo(
    () => users.find((user) => String(user.id) === String(selectedUserId)) || null,
    [users, selectedUserId]
  );

  const releaseMedia = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }

    processedCandidateIdsRef.current = new Set();
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('users').select('id, username, phone_number').order('id');
    if (error) throw error;
    const filtered = (data || []).filter((user) => user.id !== currentUserId);
    setUsers(data || []);
    if (!selectedUserId && filtered.length > 0) {
      setSelectedUserId(String(filtered[0].id));
    }
  };

  const fetchCallState = async () => {
    const { data, error } = await supabase
      .from('calls')
      .select('*')
      .or(`caller_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      .in('status', ACTIVE_CALL_STATUSES)
      .order('started_at', { ascending: false });

    if (error) throw error;

    const allCalls = data || [];
    const nextIncoming =
      allCalls.find(
        (call) =>
          call.receiver_id === currentUserId &&
          !call.answer &&
          ['pending', 'connecting'].includes(call.status)
      ) || null;

    const activeCall =
      allCalls.find((call) => call.id === nextIncoming?.id) ||
      allCalls.find((call) => call.caller_id === currentUserId || call.receiver_id === currentUserId) ||
      null;

    setCallState(activeCall);
    setIncomingCall(nextIncoming);
  };

  const ensureLocalStream = async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    return stream;
  };

  const createPeerConnection = async (callId) => {
    if (peerRef.current) {
      peerRef.current.close();
    }

    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const stream = await ensureLocalStream();

    stream.getTracks().forEach((track) => peer.addTrack(track, stream));

    peer.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };

    peer.onicecandidate = async (event) => {
      if (!event.candidate) return;
      await supabase.from('call_candidates').insert([
        {
          call_id: callId,
          user_id: currentUserId,
          candidate: event.candidate.toJSON(),
        },
      ]);
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        setStatusText('Voice link connected. You can speak now.');
      }

      if (['disconnected', 'failed', 'closed'].includes(peer.connectionState)) {
        setStatusText('Call ended or connection lost.');
      }
    };

    peerRef.current = peer;
    processedCandidateIdsRef.current = new Set();
    return peer;
  };

  const hydratePeerForCall = async (call) => {
    if (!call) return;
    if (peerRef.current && peerRef.current.__callId === call.id) return peerRef.current;
    const peer = await createPeerConnection(call.id);
    peer.__callId = call.id;
    return peer;
  };

  const syncCallDescriptions = async (call) => {
    if (!call) return;
    const peer = await hydratePeerForCall(call);
    if (!peer) return;

    if (
      call.caller_id === currentUserId &&
      call.answer &&
      peer.signalingState === 'have-local-offer'
    ) {
      await peer.setRemoteDescription(new RTCSessionDescription(call.answer));
      setStatusText('Receiver joined. Finalizing voice path...');
      if (call.status !== 'connected') {
        await supabase.from('calls').update({ status: 'connected', answered_at: new Date().toISOString() }).eq('id', call.id);
      }
    }

    if (
      call.receiver_id === currentUserId &&
      call.offer &&
      peer.signalingState === 'stable' &&
      !peer.remoteDescription
    ) {
      await peer.setRemoteDescription(new RTCSessionDescription(call.offer));
    }
  };

  const fetchAndApplyCandidates = async (callId) => {
    if (!callId || !peerRef.current) return;

    const { data, error } = await supabase
      .from('call_candidates')
      .select('*')
      .eq('call_id', callId)
      .neq('user_id', currentUserId)
      .order('id');

    if (error) throw error;

    for (const candidateRow of data || []) {
      if (processedCandidateIdsRef.current.has(candidateRow.id)) continue;
      try {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(candidateRow.candidate));
        processedCandidateIdsRef.current.add(candidateRow.id);
      } catch (candidateError) {
        console.error(candidateError);
      }
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await fetchUsers();
        await fetchCallState();
      } catch (error) {
        const message = getErrorMessage(error);
        if (isMissingCallSchema(message)) {
          setSetupError('Call tables are missing. Run supabase/calls_schema.sql in the Supabase SQL editor first.');
        } else {
          setStatusText(message);
        }
      }
    };

    bootstrap();

    const callsChannel = supabase
      .channel(`calls-realtime-${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, async () => {
        await fetchCallState();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_candidates' }, async (payload) => {
        if (payload.new?.call_id === callState?.id || payload.old?.call_id === callState?.id) {
          await fetchAndApplyCandidates(callState?.id);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(callsChannel);
      releaseMedia();
    };
  }, [currentUserId, callState?.id]);

  useEffect(() => {
    if (!callState) {
      releaseMedia();
      return;
    }

    syncCallDescriptions(callState).then(() => fetchAndApplyCandidates(callState.id)).catch((error) => {
      setStatusText(getErrorMessage(error));
    });

      if (callState.receiver_id === currentUserId && !callState.answer) {
        setStatusText('Incoming call ready to join.');
      } else if (callState.status === 'pending') {
        setStatusText(callState.caller_id === currentUserId ? 'Calling... waiting for the other user to join.' : 'Incoming call ready to join.');
      } else if (callState.status === 'connected') {
        setStatusText('Voice link connected. You can speak now.');
    } else if (callState.status === 'connecting') {
      setStatusText('Connecting voice session...');
    }
  }, [callState, currentUserId]);

  const handleStartCall = async () => {
    if (!selectedUserId) return;
    setIsBusy(true);
    try {
      const { data: insertedCall, error: insertError } = await supabase
        .from('calls')
        .insert([
          {
            caller_id: currentUserId,
            receiver_id: Number(selectedUserId),
            status: 'pending',
          },
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      const peer = await createPeerConnection(insertedCall.id);
      peer.__callId = insertedCall.id;
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      const { data: updatedCall, error: updateError } = await supabase
        .from('calls')
        .update({ offer, status: 'pending' })
        .eq('id', insertedCall.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setCallState(updatedCall);
      setStatusText(`Calling ${selectedUser?.username || 'receiver'}... waiting for join.`);
    } catch (error) {
      setStatusText(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  const handleJoinCall = async () => {
    if (!incomingCall) return;
    setIsBusy(true);
    try {
      const { data: latestCall, error: latestCallError } = await supabase
        .from('calls')
        .select('*')
        .eq('id', incomingCall.id)
        .single();

      if (latestCallError) throw latestCallError;
      if (!latestCall?.offer) {
        setStatusText('Caller is still preparing the voice offer. Try Join again in a second.');
        return;
      }

      const peer = await createPeerConnection(latestCall.id);
      peer.__callId = latestCall.id;
      await peer.setRemoteDescription(new RTCSessionDescription(latestCall.offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      const { data: updatedCall, error } = await supabase
        .from('calls')
        .update({
          answer,
          status: 'connected',
          answered_at: new Date().toISOString(),
        })
        .eq('id', latestCall.id)
        .select()
        .single();

      if (error) throw error;

      setCallState(updatedCall);
      setIncomingCall(null);
      setStatusText('Joining voice session...');
    } catch (error) {
      setStatusText(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeclineCall = async () => {
    if (!incomingCall) return;
    await supabase.from('calls').update({ status: 'declined', ended_at: new Date().toISOString() }).eq('id', incomingCall.id);
    setIncomingCall(null);
    setStatusText('Incoming call declined.');
  };

  const handleEndCall = async () => {
    if (!callState) return;
    await supabase.from('calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', callState.id);
    setCallState(null);
    setIncomingCall(null);
    releaseMedia();
    setStatusText('Call ended.');
  };

  const otherParticipantId = callState
    ? callState.caller_id === currentUserId
      ? callState.receiver_id
      : callState.caller_id
    : incomingCall
      ? incomingCall.caller_id
      : null;

  const otherParticipant = users.find((user) => user.id === otherParticipantId);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-8">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <PhoneCall className="text-emerald-400" /> Voice Calls
        </h1>
        <p className="mt-2 text-neutral-400">
          Start a direct voice connection with another node. The receiver simply taps join to bridge the audio channel.
        </p>
      </div>

      {setupError && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-100">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle size={18} /> Setup needed
          </div>
          <div className="mt-2 text-sm">{setupError}</div>
          <div className="mt-3 text-xs text-amber-200/80">File to run: `supabase/calls_schema.sql`</div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-6">
          <div className="text-sm uppercase tracking-[0.25em] text-neutral-500">Call Directory</div>
          <div className="mt-5 space-y-3">
            {users
              .filter((user) => user.id !== currentUserId)
              .map((user) => {
                const isSelected = String(user.id) === String(selectedUserId);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUserId(String(user.id))}
                    className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                      isSelected
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-neutral-800 bg-neutral-950 hover:bg-neutral-900'
                    }`}
                  >
                    <div className="font-medium text-neutral-100">{user.username}</div>
                    <div className="mt-1 text-sm text-neutral-400">{formatParticipant(user)}</div>
                  </button>
                );
              })}
          </div>

          <button
            type="button"
            onClick={handleStartCall}
            disabled={!selectedUserId || !!callState || isBusy || !!setupError}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-neutral-700"
          >
            <Phone size={18} /> Call {selectedUser?.username || 'User'}
          </button>
        </section>

        <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-[0.25em] text-neutral-500">Call Control</div>
              <div className="mt-2 text-2xl font-semibold text-neutral-100">
                {otherParticipant ? otherParticipant.username : incomingCall ? 'Incoming Call' : 'No Active Call'}
              </div>
            </div>
            <div className="rounded-full border border-neutral-700 px-4 py-2 text-sm text-neutral-300">
              {callState?.status || incomingCall?.status || 'idle'}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
            <div className="flex items-center gap-3 text-neutral-100">
              <Mic size={18} className="text-emerald-400" />
              <span className="font-medium">{statusText}</span>
            </div>
            <div className="mt-3 text-sm text-neutral-500">
              {otherParticipant
                ? `Current path: ${currentUser ? formatParticipant(currentUser) : 'Current user'} -> ${formatParticipant(otherParticipant)}`
                : 'Select a node, place a call, and wait for the other side to join.'}
            </div>
          </div>

          {incomingCall && (
            <div className="mt-6 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-5">
              <div className="flex items-center gap-2 text-sm uppercase tracking-[0.25em] text-sky-200">
                <RadioTower size={16} /> Incoming Call
              </div>
              <div className="mt-3 text-lg font-semibold text-white">
                {users.find((user) => user.id === incomingCall.caller_id)?.username || 'Caller'} wants to connect.
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleJoinCall}
                  disabled={isBusy}
                  className="rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:bg-neutral-700"
                >
                  Join
                </button>
                <button
                  type="button"
                  onClick={handleDeclineCall}
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 font-medium text-red-200 hover:bg-red-500/20"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {callState && (
            <button
              type="button"
              onClick={handleEndCall}
              className="mt-6 flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 font-medium text-red-200 hover:bg-red-500/20"
            >
              <PhoneOff size={18} /> End Call
            </button>
          )}

          <audio ref={remoteAudioRef} autoPlay />
        </section>
      </div>
    </div>
  );
}
