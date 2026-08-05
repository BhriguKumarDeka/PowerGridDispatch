import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api, setupWebSocket } from './api/client';
import { ToastContainer } from './components/common/Toast';
import { NavSidebar } from './components/layout/NavSidebar';
import { TopHeader } from './components/layout/TopHeader';
import { GridMap } from './components/map/GridMap';
import { GridSummary } from './components/sidebar/GridSummary';
import { IssueQueue } from './components/sidebar/IssueQueue';
import { InspectionModal } from './components/modals/InspectionModal';
import { SimulatorModal } from './components/modals/SimulatorModal';

function App() {
  const [status, setStatus] = useState('connecting');
  const [wsConnected, setWsConnected] = useState(false);
  const [stats, setStats] = useState(null);
  const [transformers, setTransformers] = useState([]);
  const [substations, setSubstations] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [outages, setOutages] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showSimulator, setShowSimulator] = useState(false);
  const [simTab, setSimTab] = useState('fault');
  const [simMessage, setSimMessage] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [ticketFilter, setTicketFilter] = useState('active');
  const [activeNav, setActiveNav] = useState('dashboard');
  const [toasts, setToasts] = useState([]);

  // Simulator Form State
  const [faultType, setFaultType] = useState('span');
  const [targetId, setTargetId] = useState('P-000005');
  const [noiseType, setNoiseType] = useState('dead_sensor');
  const [noiseTarget, setNoiseTarget] = useState('P-000010');
  const [outageScope, setOutageScope] = useState('feeder');
  const [outageTarget, setOutageTarget] = useState('F-01-01');
  const [outageDuration, setOutageDuration] = useState(60);
  const [outageReason, setOutageReason] = useState('Substation Transformer Maintenance');

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const loadData = async () => {
    try {
      await api('/health');
      setStatus('connected');

      const [statsData, txData, ticketsData, outagesData, subsData] = await Promise.all([
        api('/network/stats').catch(() => null),
        api('/network/transformers').catch(() => []),
        api('/tickets/').catch(() => []),
        api('/outages/scheduled').catch(() => []),
        api('/network/substations').catch(() => []),
      ]);

      if (statsData) setStats(statsData);
      if (Array.isArray(txData)) setTransformers(txData);
      if (Array.isArray(subsData)) setSubstations(subsData);
      if (Array.isArray(ticketsData)) setTickets(ticketsData);
      if (Array.isArray(outagesData)) setOutages(outagesData);
    } catch (err) {
      console.error('Connection failed', err);
      setStatus('disconnected');
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const cleanup = setupWebSocket(
      (data) => {
        if (data.type === 'ticket_created') {
          addToast(`LINE FAILURE DETECTED: Issue #${data.ticket_id} on ${data.dt_id}`, 'error');
          loadData();
        } else if (data.type === 'ticket_verified') {
          addToast(`POWER RESTORED: Issue #${data.ticket_id} verified online`, 'success');
          loadData();
        }
      },
      (connected) => setWsConnected(connected)
    );
    return cleanup;
  }, []);

  const handleStatusTransition = async (ticketId, nextStatus) => {
    try {
      await api(`/tickets/${ticketId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      addToast(`Status updated successfully`, 'info');
      await loadData();
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
    } catch (e) {
      addToast(`Transition Error: ${e.message}`, 'error');
    }
  };

  const handleGenerateAi = async (ticketId) => {
    setLoadingAi(true);
    try {
      const res = await api('/ai/summarize-ticket', {
        method: 'POST',
        body: JSON.stringify({ ticket_id: ticketId }),
      });
      addToast(`Field summary generated`, 'success');
      await loadData();
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket((prev) => (prev ? { ...prev, ai_summary: res.ai_summary } : null));
      }
    } catch (e) {
      addToast(`Summary Error: ${e.message}`, 'error');
    } finally {
      setLoadingAi(false);
    }
  };

  const handleInjectFault = async () => {
    try {
      setSimMessage('Simulating line break signal...');
      const res = await api('/simulator/inject-fault', {
        method: 'POST',
        body: JSON.stringify({ fault_type: faultType, target_id: targetId }),
      });
      setSimMessage(`LINE BREAK SIMULATED: ${res.events_generated} sensor signals received.`);
      addToast(`Simulated line break on ${targetId}`, 'warning');
      await loadData();
    } catch (e) {
      setSimMessage(`ERROR: ${e.message}`);
    }
  };

  const handleRepairTicket = async (ticketId) => {
    try {
      setSimMessage('Transmitting power restoration signals...');
      const res = await api('/simulator/repair', {
        method: 'POST',
        body: JSON.stringify({ ticket_id: ticketId }),
      });
      setSimMessage(`RESTORATION SIGNAL SENT. Verification: ${res.verification_result?.status || 'updated'}`);
      addToast(`Power restoration signal sent`, 'success');
      await loadData();
    } catch (e) {
      setSimMessage(`ERROR: ${e.message}`);
    }
  };

  const handleInjectNoise = async () => {
    try {
      setSimMessage('Injecting sensor error...');
      const res = await api('/simulator/inject-noise', {
        method: 'POST',
        body: JSON.stringify({ noise_type: noiseType, target_id: noiseTarget }),
      });
      setSimMessage(`SENSOR ERROR SIMULATED: ${res.status}.`);
      addToast(`Sensor error simulated`, 'info');
      await loadData();
    } catch (e) {
      setSimMessage(`ERROR: ${e.message}`);
    }
  };

  const handleCreateScheduledOutage = async () => {
    try {
      setSimMessage('Scheduling planned maintenance...');
      const now = new Date();
      const endTime = new Date(now.getTime() + outageDuration * 60000);
      const res = await api('/outages/scheduled', {
        method: 'POST',
        body: JSON.stringify({
          scope: outageScope,
          target_id: outageTarget,
          start_time: now.toISOString(),
          end_time: endTime.toISOString(),
          reason: outageReason,
        }),
      });
      setSimMessage(`PLANNED MAINTENANCE SAVED: ${res.id}.`);
      addToast(`Planned maintenance set on ${outageTarget}`, 'info');
      await loadData();
    } catch (e) {
      setSimMessage(`ERROR: ${e.message}`);
    }
  };

  const handleResetSystem = async () => {
    if (!window.confirm('Confirm complete system reset? All line issues will be cleared.')) return;
    try {
      setSimMessage('Resetting system state...');
      await api('/simulator/reset', { method: 'POST' });
      setSimMessage('SYSTEM RESET COMPLETE.');
      addToast('System reset to clean status', 'info');
      setTickets([]);
      setSelectedTicket(null);
      await loadData();
    } catch (e) {
      setSimMessage(`ERROR: ${e.message}`);
    }
  };

  const activeCount = tickets.filter((t) => t.status !== 'closed').length;
  const unackCount = tickets.filter((t) => t.status === 'detected').length;

  return (
    <div className="flex h-screen w-screen bg-[#090a0f] text-slate-100 font-sans overflow-hidden select-none">
      <ToastContainer toasts={toasts} />

      <NavSidebar
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        unackCount={unackCount}
        status={status}
        wsConnected={wsConnected}
        onOpenConsole={(tab) => { setShowSimulator(true); setSimTab(tab); }}
      />

      <div className="flex-1 flex flex-col p-5 gap-4 overflow-hidden">
        <TopHeader
          unackCount={unackCount}
          activeCount={activeCount}
          onOpenConsole={(tab) => { setShowSimulator(true); setSimTab(tab); }}
        />

        <div className="flex flex-1 gap-5 overflow-hidden">
          <GridMap
            transformers={transformers}
            tickets={tickets}
            substations={substations}
            onSelectTicket={setSelectedTicket}
          />

          <aside className="flex-1 max-w-[420px] bg-[#16171a] rounded-2xl p-4 flex flex-col gap-4 overflow-hidden shadow-lg">
            {/* Top Panel Tab Switcher */}
            <div className="flex border-b border-white/5 pb-2.5 flex-shrink-0">
              <button
                className={`flex-1 pb-1 text-center text-[10px] font-semibold tracking-widest transition-all relative ${
                  activeNav === 'dashboard' ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
                onClick={() => setActiveNav('dashboard')}
              >
                SUMMARY
                {activeNav === 'dashboard' && (
                  <motion.div layoutId="panelTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                )}
              </button>
              <button
                className={`flex-1 pb-1 text-center text-[10px] font-semibold tracking-widest transition-all relative ${
                  activeNav === 'incidents' ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
                onClick={() => setActiveNav('incidents')}
              >
                ISSUES
                {activeNav === 'incidents' && (
                  <motion.div layoutId="panelTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-0.5 flex flex-col min-h-0">
              {activeNav === 'dashboard' ? (
                <GridSummary stats={stats} wsConnected={wsConnected} />
              ) : (
                <IssueQueue
                  tickets={tickets}
                  selectedTicket={selectedTicket}
                  ticketFilter={ticketFilter}
                  setTicketFilter={setTicketFilter}
                  unackCount={unackCount}
                  onSelectTicket={setSelectedTicket}
                  onStatusTransition={handleStatusTransition}
                  onRepairTicket={handleRepairTicket}
                />
              )}
            </div>
          </aside>
        </div>
      </div>

      <InspectionModal
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onStatusTransition={handleStatusTransition}
        onRepairTicket={handleRepairTicket}
        onGenerateAi={handleGenerateAi}
        loadingAi={loadingAi}
      />

      <SimulatorModal
        show={showSimulator}
        onClose={() => setShowSimulator(false)}
        simTab={simTab}
        setSimTab={setSimTab}
        simMessage={simMessage}
        faultType={faultType}
        setFaultType={setFaultType}
        targetId={targetId}
        setTargetId={setTargetId}
        noiseType={noiseType}
        setNoiseType={setNoiseType}
        noiseTarget={noiseTarget}
        setNoiseTarget={setNoiseTarget}
        outageScope={outageScope}
        setOutageScope={setOutageScope}
        outageTarget={outageTarget}
        setOutageTarget={setOutageTarget}
        outageDuration={outageDuration}
        setOutageDuration={setOutageDuration}
        outageReason={outageReason}
        setOutageReason={setOutageReason}
        onInjectFault={handleInjectFault}
        onInjectNoise={handleInjectNoise}
        onCreateOutage={handleCreateScheduledOutage}
        onResetSystem={handleResetSystem}
      />
    </div>
  );
}

export default App;
