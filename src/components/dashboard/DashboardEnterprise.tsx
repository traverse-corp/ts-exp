import { useState, useEffect, type JSX } from 'react';
import { useGlobalStore } from '../../stores/useGlobalStore';
import { TRANSLATIONS } from '../../constants/lang';
import { fetchRecentHistory } from '../../services/tronScanner';
import { supabase } from '../../lib/supabaseClient';
import { ReportPanel } from './ReportPanel';
import axios from 'axios';

// --- [Utilities] ---
const generateMockCI = (address: string) => {
    let hash = 0;
    for (let i = 0; i < address.length; i++) {
        const char = address.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
    return `CI_${hex}9X2B${address.slice(0,3).toUpperCase()}`; 
};

// --- [Types & Icons] ---
interface LabelInfo { label: string; riskLevel: string; }
interface ExtendedTxRow {
    id: string; timestamp: number; type: 'INFLOW' | 'OUTFLOW'; amount: number; token: string;
    hopMinus2?: string; hopMinus1?: string; hopMe: string; hopPlus1?: string; hopPlus2?: string;
    isLoadingExtended: boolean;
}

const DashIcons = {
    Wallet: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
    PieChart: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>,
    Refresh: () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    Expanded: () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>,
    BarChart: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
};

const RATES = { TRX: 450, USDT: 1450 };

// -----------------------------------------------------------------------------
// [DATA] 위험 노출 이력 데이터
// -----------------------------------------------------------------------------
const RISK_EXPOSURE_DATA = [
    { id: 1, label: "국제제재대상 (Sanctions)", count: 654, volume: 322815134, risk: 'severe', color: '#ef4444' }, // Red
    { id: 2, label: "FIU 미신고 VASP", count: 1045, volume: 506945606, risk: 'high', color: '#f18306ff' }, // Orange
    { id: 3, label: "마약 거래", count: 0, volume: 0, risk: 'high', color: '#eab308' }, // Yellow
    { id: 4, label: "불법 음란물", count: 0, volume: 0, risk: 'medium', color: '#84cc16' }, // Lime
    { id: 5, label: "불법 도박", count: 1747, volume: 322907950, risk: 'high', color: '#06b6d4' }, // Cyan
    { id: 6, label: "보이스피싱", count: 0, volume: 0, risk: 'high', color: '#3b82f6' }, // Blue
    { id: 7, label: "기타 사기", count: 1, volume: 470323, risk: 'medium', color: '#6366f1' } // Indigo
];

const MAX_COUNT = Math.max(...RISK_EXPOSURE_DATA.map(d => d.count));
const MAX_VOL = Math.max(...RISK_EXPOSURE_DATA.map(d => d.volume));
const TOTAL_RISK_COUNT = RISK_EXPOSURE_DATA.reduce((acc, cur) => acc + cur.count, 0);
const SANCTION_DATA = { ofac: 14205, kofiu: 16943992, crime: 3129205 };

export const DashboardEnterprise = () => {
  const { 
      language, session,
      opWallets, addOpWallet, removeOpWallet,
      setMode, setTraceAddr,
      dashboardTxs, dashboardLastUpdated, setDashboardData,
      openReport,
      monitorMode, setMonitorMode
  } = useGlobalStore();
  const t = TRANSLATIONS[language];
  const userName = session?.user?.email?.split('@')[0] || 'Guest';

  const [inputWallet, setInputWallet] = useState('');
  const [loading, setLoading] = useState(false);
  const [labelMap, setLabelMap] = useState<Record<string, LabelInfo>>({});
  const [extendedTxs, setExtendedTxs] = useState<ExtendedTxRow[]>([]);
  
  const [portfolio, setPortfolio] = useState<any>({
      totalKrw: 0, totalUsd: 0, trxBalance: 0, usdtBalance: 0, 
      trxValueKrw: 0, usdtValueKrw: 0, trxRatio: 0, usdtRatio: 0
  });

  const getRiskColorClass = (riskLevel?: string) => {
      if (!riskLevel) return 'bg-slate-300'; 
      const level = riskLevel.toUpperCase();
      if (['SEVERE', 'HIGH', 'MEDIUM'].includes(level)) return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
      if (level === 'LOW') return 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]';
      return 'bg-slate-300';
  };

  const handleCopyAddr = (address: string) => { navigator.clipboard.writeText(address); };

  // --- Actions ---
  const handleAddWallet = () => { if(inputWallet) { addOpWallet(inputWallet); setInputWallet(''); } };
  const handleInstantTrace = (address: string) => { setTraceAddr(address); setMode('autotracer'); };
  const handleOpenReport = (tx: any) => { openReport({ ...tx, counterparty: tx.counterparty || tx.hopMinus1 || tx.hopPlus1 }); };
  const handleCheckKYC = (address: string) => { window.prompt(`[KYC 정보 확인]\n\nCI:`, generateMockCI(address)); };
  const handleFreeze = (address: string) => { if(window.confirm(`CI: ${generateMockCI(address)}\n동결하시겠습니까?`)) alert("서비스 준비 중입니다."); };

  // 1. Portfolio Logic
  useEffect(() => {
    const fetchBalances = async () => {
        if (opWallets.length === 0) return;
        try {
            let sumTrx = 0, sumUsdt = 0;
            const promises = opWallets.map(addr => axios.get(`https://api.trongrid.io/v1/accounts/${addr}`));
            const responses = await Promise.all(promises);
            responses.forEach(res => {
                const data = res.data.data[0];
                if (data) {
                    sumTrx += (data.balance || 0) / 1_000_000;
                    const trc20 = data.trc20 || [];
                    const usdtObj = trc20.find((token: any) => Object.keys(token)[0] === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
                    if (usdtObj) sumUsdt += (parseInt(Object.values(usdtObj)[0] as string) || 0) / 1_000_000;
                }
            });
            const valTrx = sumTrx * RATES.TRX;
            const valUsdt = sumUsdt * RATES.USDT;
            const totalKrw = valTrx + valUsdt;
            setPortfolio({
                totalKrw, totalUsd: totalKrw / RATES.USDT,
                trxBalance: sumTrx, usdtBalance: sumUsdt,
                trxRatio: totalKrw > 0 ? (valTrx / totalKrw) * 100 : 0,
                usdtRatio: totalKrw > 0 ? (valUsdt / totalKrw) * 100 : 0
            });
        } catch (e) { console.error("Balance Error:", e); }
    };
    fetchBalances();
    const interval = setInterval(fetchBalances, 600000);
    return () => clearInterval(interval);
  }, [opWallets]);

  // 2. Monitoring Logic
  useEffect(() => {
      let isMounted = true;
      const loadData = async () => {
          if (opWallets.length === 0) return;
          if (monitorMode === 'standard') setLoading(true);

          try {
              const promises = opWallets.map(addr => fetchRecentHistory(addr));
              const results = await Promise.all(promises);
              let allTxs: any[] = [];
              results.forEach((txs, idx) => {
                  const ownerWallet = opWallets[idx];
                  const tagged = txs.map(tx => ({
                      ...tx,
                      ownerWallet,
                      isCustomer: tx.receiver === ownerWallet, 
                      counterparty: tx.receiver === ownerWallet ? tx.sender : tx.receiver
                  }));
                  allTxs = [...allTxs, ...tagged];
              });
              allTxs.sort((a, b) => b.timestamp - a.timestamp);

              if (monitorMode === 'standard') {
                  const slicedTxs = allTxs.slice(0, 100);
                  const uniqueAddresses = Array.from(new Set(slicedTxs.map(tx => tx.counterparty)));
                  if (uniqueAddresses.length > 0) {
                      const { data: labels } = await supabase.from('address_labels').select('address, label_name, risk_level').in('address', uniqueAddresses);
                      const newLabels: any = {};
                      labels?.forEach((item: any) => newLabels[item.address] = { label: item.label_name, riskLevel: item.risk_level });
                      setLabelMap(prev => ({ ...prev, ...newLabels }));
                  }
                  if (isMounted) setDashboardData(slicedTxs, new Date());
              } else {
                  const targetTxs = allTxs.slice(0, 10);
                  const initialRows: ExtendedTxRow[] = targetTxs.map((tx, i) => ({
                      id: tx.txID + i, timestamp: tx.timestamp, type: tx.isCustomer ? 'INFLOW' : 'OUTFLOW', amount: tx.amount, token: tx.token,
                      hopMe: tx.ownerWallet, hopMinus1: tx.isCustomer ? tx.sender : undefined, hopPlus1: !tx.isCustomer ? tx.receiver : undefined,
                      isLoadingExtended: true
                  }));
                  if (isMounted) setExtendedTxs(initialRows);

                  targetTxs.forEach(async (tx, index) => {
                      if (!isMounted) return;
                      let hopMinus2: string | undefined, hopPlus2: string | undefined;
                      const addressesToLabel: string[] = [];
                      if (tx.isCustomer && tx.sender) addressesToLabel.push(tx.sender);
                      if (!tx.isCustomer && tx.receiver) addressesToLabel.push(tx.receiver);

                      if (tx.isCustomer) {
                          try {
                              const senderHistory = await fetchRecentHistory(tx.sender);
                              const sourceTx = senderHistory.find(h => h.receiver === tx.sender && h.timestamp < tx.timestamp);
                              if (sourceTx) { hopMinus2 = sourceTx.sender; addressesToLabel.push(hopMinus2); }
                          } catch {}
                      } else {
                          try {
                              const receiverHistory = await fetchRecentHistory(tx.receiver);
                              const destTx = receiverHistory.find(h => h.sender === tx.receiver && h.timestamp > tx.timestamp);
                              if (destTx) { hopPlus2 = destTx.receiver; addressesToLabel.push(hopPlus2); }
                          } catch {}
                      }

                      if (addressesToLabel.length > 0) {
                          const { data: labels } = await supabase.from('address_labels').select('address, label_name, risk_level').in('address', addressesToLabel);
                          if (labels && labels.length > 0) {
                              setLabelMap(prev => {
                                  const updates: any = {};
                                  labels.forEach((l: any) => updates[l.address] = { label: l.label_name, riskLevel: l.risk_level });
                                  return { ...prev, ...updates };
                              });
                          }
                      }
                      if (isMounted) {
                          setExtendedTxs(prev => {
                              const newArr = [...prev];
                              if (newArr[index] && newArr[index].id === (tx.txID + index)) {
                                  newArr[index] = { ...newArr[index], hopMinus2, hopPlus2, isLoadingExtended: false };
                              }
                              return newArr;
                          });
                      }
                  });
              }
          } catch (e) { console.error(e); } finally { if(isMounted) setLoading(false); }
      };

      loadData();
      const intervalMs = monitorMode === 'standard' ? 30000 : 120000;
      const interval = setInterval(loadData, intervalMs);
      return () => { isMounted = false; clearInterval(interval); };
  }, [opWallets, monitorMode]);

const renderHopCell = (address: string | undefined, type: 'customer' | 'normal' | 'source' | 'dest' | 'center', txData?: any) => {
      if (!address) return <span className="text-slate-300">-</span>;

      const labelInfo = labelMap[address];
      const hasLabel = !!labelInfo;
      
      let displayLabel = labelInfo?.label || 'Unknown';
      let bgClass = "bg-slate-100 text-slate-500"; // Default (Unknown)

      // 1. Customer (Inflow Sender)
      if (type === 'customer') {
          displayLabel = 'Customer (Deposit)';
          bgClass = "bg-green-50 text-green-700 border-green-100";
      }
      // 2. Center (Ops Wallet) - [NEW]
      else if (type === 'center') {
          // Center는 주소 그대로 보여주거나 별칭
          displayLabel = `${address.slice(0,4)}...${address.slice(-4)}`; 
          bgClass = "bg-white border-blue-200 text-blue-800 shadow-sm"; 
      }
      // 3. Known Entity (Labeled)
      else if (hasLabel) {
          bgClass = "bg-indigo-50 text-indigo-700 border-indigo-100";
      }

      // 4. Deposit Address Logic (Hop +1 -> Hop +2 Label)
      if (type === 'normal' && txData && address === txData.hopPlus1 && txData.hopPlus2) {
          const nextHopLabel = labelMap[txData.hopPlus2]?.label;
          if (nextHopLabel) {
              displayLabel = `입금 주소 : ${nextHopLabel}`;
              bgClass = "bg-rose-50 text-rose-700 border-rose-100 font-bold";
          }
      }

      return (
          <div className="relative group flex justify-center w-full">
              <div 
                  onClick={() => handleCopyAddr(address)}
                  className={`border px-2 py-1 rounded truncate text-[10px] font-bold cursor-pointer hover:scale-105 transition-transform max-w-[120px] w-full text-center ${bgClass}`} 
                  title={`${address} (Click to Copy)`}
              >
                  {/* Center일 때는 이미 위에서 포맷팅 함, 아니면 Unknown 처리 */}
                  {type === 'center' ? displayLabel : (displayLabel === 'Unknown' ? `${address.slice(0,6)}...` : displayLabel)}
              </div>

              {/* Hover Menu (For ALL addresses including Center) */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 hidden group-hover:flex flex-col gap-1 bg-white shadow-xl border border-slate-200 rounded p-1.5 z-[100] w-36 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="text-[9px] font-mono text-slate-400 border-b border-slate-100 pb-1 mb-1 truncate text-center">{address}</div>
                  
                  <button onClick={() => handleInstantTrace(address)} className="text-[10px] bg-amber-50 text-amber-700 px-2 py-1 rounded hover:bg-amber-100 font-bold border border-amber-100 w-full text-left">
                      Instant Trace
                  </button>
                  <button 
                      onClick={() => openReport({ ...txData, counterparty: address })} 
                      className="text-[10px] bg-slate-50 text-slate-700 px-2 py-1 rounded hover:bg-slate-100 font-bold border border-slate-200 w-full text-left"
                  >
                      STR Report
                  </button>
                  
                  {/* Customer or High Risk Action */}
                  {(type === 'customer' || hasLabel) && (
                      <>
                          <button onClick={() => handleCheckKYC(address)} className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-100 font-bold border border-indigo-100 w-full text-left">
                              Check KYC
                          </button>
                          <button onClick={() => handleFreeze(address)} className="text-[10px] bg-red-50 text-red-700 px-2 py-1 rounded hover:bg-red-100 font-bold border border-red-100 w-full text-left">
                              Freeze Wallet
                          </button>
                      </>
                  )}
              </div>
          </div>
      );
  };

  return (
    <div className="w-full h-full bg-slate-100 px-8 pb-8 pt-32 overflow-y-auto custom-scrollbar font-sans text-slate-800">
        <ReportPanel />

{/* Header */}
        <div className="mb-8 flex justify-between items-end">
            <div>
                <div className="flex items-baseline gap-3 mb-1">
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <span className="text-blue-700">TranSight</span> Enterprise
                    </h1>
                    <span className="text-sm font-bold text-slate-500 animate-in slide-in-from-left-2 duration-500 delay-150">
                        안녕하세요, <span className="text-indigo-600 border-b border-indigo-200 pb-0.5">{userName}</span> 담당자님.
                    </span>
                </div>
                <p className="text-slate-500 font-medium text-sm">{t.dash_subtitle}</p>
            </div>
            
            {/* KPI Cards */}
            <div className="flex gap-4 h-full items-stretch">
                
                {/* 1. Risk Score */}
                 <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm text-right flex flex-col justify-center min-w-[120px]">
                    <div className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">{t.card_risk_score}</div>
                    <div className="text-xl font-black text-green-500">Low (12)</div>
                </div>

                {/* 2. Monitored Volume */}
                <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm text-right flex flex-col justify-center min-w-[120px]">
                    <div className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">{t.card_monitored_vol}</div>
                    <div className="text-xl font-black text-blue-600">$42.5M</div>
                </div>

                {/* [NEW] 3. Sanction Stats Mini-Box (Compact View) */}
                <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-center min-w-[160px]">
                    <div className="text-[10px] text-slate-400 font-bold uppercase mb-1 flex justify-between items-center">
                        <span>TranSight Risk DB</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <div className="flex justify-between items-center text-[10px]">
                            <span className="font-bold text-slate-500">OFAC</span>
                            <span className="font-mono font-bold text-red-600 bg-red-50 px-1.5 rounded">{SANCTION_DATA.ofac.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                            <span className="font-bold text-slate-500">KoFIU</span>
                            <span className="font-mono font-bold text-orange-600 bg-orange-50 px-1.5 rounded">{SANCTION_DATA.kofiu.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                            <span className="font-bold text-slate-500">Crime</span>
                            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 rounded">{SANCTION_DATA.crime.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>

        {/* Row 2: Charts Area */}
        <div className="grid grid-cols-12 gap-6 mb-6">
            
            {/* [Main] Historical Risk Exposure Bar Chart (8/12) */}
            <div className="col-span-8 bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <DashIcons.BarChart /> {t.aml_history || "Historical Risk Exposure"}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-1">
                            당사 운영지갑과 연관된 고위험 주소군과의 거래 빈도 및 규모 분석
                        </p>
                    </div>
                    <div className="text-[10px] bg-slate-50 text-slate-500 px-2 py-1 rounded border border-slate-100 font-mono">
                        Period: All Time
                    </div>
                </div>

                {/* [Layout Change] Flex Column -> Grid 2 Cols to remove scroll */}
                <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2 overflow-hidden">
                    {RISK_EXPOSURE_DATA.map(item => {
                        const countWidth = Math.max((item.count / MAX_COUNT) * 100, 2);
                        const volWidth = Math.max((item.volume / MAX_VOL) * 100, 2);
                        
                        return (
                        <div key={item.id} className="group bg-white rounded border border-slate-100 p-2 hover:border-blue-200 hover:shadow-sm transition-all">
                            {/* Title Row */}
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-2">
                                <span className={`flex items-center gap-1 truncate ${item.risk === 'severe' ? 'text-red-600' : 'text-slate-700'}`} title={item.label}>
                                    {/* 번호와 텍스트가 너무 길면 잘리므로 truncate 적용 */}
                                    <span className="truncate">{item.label}</span>
                                    {item.risk === 'severe' && <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>}
                                </span>
                            </div>
                            
                            {/* Dual Bar Layout (Compact) */}
                            <div className="grid grid-cols-2 gap-3 items-center">
                                {/* Left: Count Bar */}
                                <div className="flex flex-col justify-center border-r border-slate-100 pr-3">
                                    <div className="flex justify-between items-end text-[9px] text-slate-500 mb-1">
                                        <span>건수</span>
                                        <span className="font-bold text-blue-600">{item.count.toLocaleString()}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-blue-500 rounded-full transition-all duration-1000" 
                                            style={{ width: `${countWidth}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Right: Volume Bar */}
                                <div className="flex flex-col justify-center">
                                    <div className="flex justify-between items-end text-[9px] text-slate-500 mb-1">
                                        <span>금액</span>
                                        <span className="font-bold text-slate-700 tracking-tight">
                                            {/* 공간 절약을 위해 억 단위 등으로 줄이거나, 그냥 숫자로 표현 */}
                                            {item.volume > 100000000 
                                                ? `₩ ${(item.volume/100000000).toFixed(1)}억` 
                                                : `₩ ${(item.volume/10000).toFixed(0)}만`}
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-1000 ${item.risk === 'severe' ? 'bg-red-500' : 'bg-slate-500'}`} 
                                            style={{ width: `${volWidth}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )})}
                </div>
            </div>

            {/* [Side] Risk Proportion Pie Chart (4/12) */}
            <div className="col-span-4 bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col relative overflow-hidden">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 z-10">
                    <span>◓ {t.sanc_title || "Risk Composition"}</span>
                </h3>
                
                {/* Donut Chart Implementation */}
                <div className="flex-1 flex flex-col items-center justify-center relative z-10">
                    <div className="w-40 h-40 relative">
                        <svg viewBox="0 0 32 32" className="w-full h-full transform -rotate-90">
                            {RISK_EXPOSURE_DATA.reduce((acc, item, idx) => {
                                const percentage = (item.count / TOTAL_RISK_COUNT) * 100;
                                const dashArray = `${percentage} ${100 - percentage}`;
                                const dashOffset = 100 - acc.currentOffset + 25; // start from top
                                
                                // SVG Circle Logic
                                // Circumference of r=16 is ~100. We map % directly.
                                // We use stroke-dasharray to draw segments.
                                const segment = (
                                    <circle 
                                        key={item.id}
                                        cx="16" cy="16" r="8" // r=8 means circumference ~50? No, let's use r=15.915 for circumference=100
                                        // Standard normalized SVG circle trick: r=15.91549430918954 -> C=100
                                        fill="transparent" 
                                        stroke={item.color} 
                                        strokeWidth="8"
                                        strokeDasharray={`${percentage} 100`}
                                        strokeDashoffset={-acc.currentOffset}
                                    />
                                );
                                acc.elements.push(segment);
                                acc.currentOffset += percentage;
                                return acc;
                            }, { elements: [] as JSX.Element[], currentOffset: 0 }).elements}
                            
                            {/* Inner Circle for Donut Effect */}
                            <circle cx="16" cy="16" r="10" fill="white" />
                        </svg>
                        
                        {/* Center Text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Total Cases</span>
                            <span className="text-xl font-black text-slate-800">{TOTAL_RISK_COUNT}</span>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="w-full mt-6 grid grid-cols-2 gap-x-2 gap-y-1.5 px-2">
                        {RISK_EXPOSURE_DATA.map(item => (
                            <div key={item.id} className="flex items-center gap-1.5 text-[10px] text-slate-600 truncate">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                                <span className="truncate" title={item.label}>{item.label.split('(')[0]}</span>
                                <span className="text-slate-400 font-mono ml-auto">{Math.round((item.count/TOTAL_RISK_COUNT)*100)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {/* Row 3: Asset & Monitor (기존 유지 - 생략 없이 포함) */}
        <div className="grid grid-cols-12 gap-6 h-[600px]">
            {/* Left Column: Asset & Ops List */}
            <div className="col-span-4 flex flex-col gap-6 h-full">
                {/* Asset Portfolio Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2"><DashIcons.PieChart /> {t.asset_portfolio || "Asset Portfolio Status"}</h3>
                        <div className="text-[9px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">10m Update</div>
                    </div>
                    <div className="mb-6">
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Estimated Value</div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-slate-800 tracking-tight">₩ {Math.floor(portfolio.totalKrw).toLocaleString()}</span>
                            <span className="text-sm font-bold text-slate-400">($ {Math.floor(portfolio.totalUsd).toLocaleString()})</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative w-24 h-24 shrink-0">
                            <svg viewBox="0 0 32 32" className="w-full h-full transform -rotate-90">
                                <circle cx="16" cy="16" r="16" fill="#f1f5f9" />
                                <circle cx="16" cy="16" r="8" fill="transparent" stroke="#f97316" strokeWidth="16" strokeDasharray={`${portfolio.trxRatio} 100`} />
                                <circle cx="16" cy="16" r="8" fill="transparent" stroke="#0ea5e9" strokeWidth="16" strokeDasharray={`${portfolio.usdtRatio} 100`} strokeDashoffset={`-${portfolio.trxRatio}`} />
                            </svg>
                            <circle cx="16" cy="16" r="8" fill="white" />
                        </div>
                        <div className="flex-1 space-y-3">
                            <div>
                                <div className="flex justify-between text-xs font-bold text-slate-700 mb-0.5"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500"></span> TRX</span><span>{portfolio.trxRatio.toFixed(1)}%</span></div>
                                <div className="text-[10px] text-slate-400 font-mono text-right">{portfolio.trxBalance.toLocaleString()} TRX</div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs font-bold text-slate-700 mb-0.5"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-500"></span> USDT</span><span>{portfolio.usdtRatio.toFixed(1)}%</span></div>
                                <div className="text-[10px] text-slate-400 font-mono text-right">{portfolio.usdtBalance.toLocaleString()} USDT</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Ops Wallets List */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden flex-1">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2"><DashIcons.Wallet /> {t.ops_title}</h3>
                        <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold">{opWallets.length} Active</span>
                    </div>
                    <div className="p-4 border-b border-slate-100">
                        <div className="flex gap-2">
                            <input type="text" value={inputWallet} onChange={(e) => setInputWallet(e.target.value)} placeholder={t.ops_add_placeholder} className="flex-1 text-xs border border-slate-200 rounded px-3 py-2 bg-slate-50 focus:bg-white focus:outline-blue-500" />
                            <button onClick={handleAddWallet} className="bg-slate-800 text-white px-3 py-1 rounded text-xs font-bold hover:bg-slate-900">{t.ops_btn_add}</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                        {opWallets.map(addr => (
                            <div key={addr} className="flex justify-between items-center p-3 border border-slate-100 rounded bg-white hover:border-blue-200 group transition-all">
                                <div>
                                    <div className="text-[10px] font-bold text-blue-600 mb-0.5">Hot Wallet</div>
                                    <div className="text-xs font-mono text-slate-600 truncate w-48">{addr}</div>
                                </div>
                                <button onClick={() => removeOpWallet(addr)} className="text-slate-300 hover:text-red-500">✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Column: Real-time Monitor (기존 유지) */}
            <div className="col-span-8 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
                {loading && monitorMode === 'standard' && <div className="absolute top-0 left-0 w-full h-1 bg-blue-100 z-20"><div className="h-full bg-blue-500 animate-loading-bar"></div></div>}
                <style>{`@keyframes loading-bar { 0% { width: 0%; margin-left: 0; } 50% { width: 50%; margin-left: 25%; } 100% { width: 0%; margin-left: 100%; } } .animate-loading-bar { animation: loading-bar 1.5s infinite linear; }`}</style>

                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> {t.realtime_data_table || "Real-time Inflow/Outflow Monitor"}</h3>
                        <div className="flex bg-slate-200 rounded p-0.5 ml-2">
                            <button onClick={() => setMonitorMode('standard')} className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${monitorMode === 'standard' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Standard</button>
                            <button onClick={() => setMonitorMode('extended')} className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all flex items-center gap-1 ${monitorMode === 'extended' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}><DashIcons.Expanded /> Extended (5-Hop)</button>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono"><DashIcons.Refresh /> Updated: {dashboardLastUpdated ? dashboardLastUpdated.toLocaleTimeString() : 'Syncing...'}</div>
                </div>
                
                <div className="flex-1 overflow-hidden relative bg-white">
                    {/* STANDARD TABLE */}
                    {monitorMode === 'standard' && (
                        <div className="h-full overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase sticky top-0 z-10">
                                <tr>
                                    <th className="p-3 border-b border-slate-100">Time</th>
                                    <th className="p-3 border-b border-slate-100">Type</th>
                                    <th className="p-3 border-b border-slate-100">Ops Wallet (Me)</th>
                                    <th className="p-3 border-b border-slate-100 text-center">Counterparty</th>
                                    <th className="p-3 border-b border-slate-100 text-right">Amount</th>
                                    <th className="p-3 border-b border-slate-100 text-center">Risk</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs">
                                {dashboardTxs.map((tx, idx) => {
                                    const labelInfo = labelMap[tx.counterparty];
                                    return (
                                    <tr key={tx.txID + idx} className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                                        <td className="p-3 font-mono text-slate-500 w-24">{new Date(tx.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}</td>
                                        <td className="p-3 w-20"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${tx.isCustomer ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>{tx.isCustomer ? 'INFLOW' : 'OUTFLOW'}</span></td>
                                        <td className="p-3 w-32"><div className="font-mono text-slate-500 truncate w-28 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded" title={tx.ownerWallet}>{tx.ownerWallet.slice(0,4)}...{tx.ownerWallet.slice(-4)}</div></td>
                                        <td className="p-3 relative">{renderHopCell(tx.counterparty, tx.isCustomer ? 'customer' : 'normal', tx)}</td>
                                        <td className="p-3 text-right font-bold font-mono w-28">{tx.amount.toLocaleString()} <span className="text-[9px] text-slate-400 font-sans font-normal">{tx.token}</span></td>
                                        <td className="p-3 text-center w-16">{labelInfo ? <div className={`w-3 h-3 rounded-full inline-block ${getRiskColorClass(labelInfo.riskLevel)} ring-2 ring-white`} title={`Risk: ${labelInfo.riskLevel}`}></div> : <span className="w-2 h-2 rounded-full inline-block bg-slate-200"></span>}</td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                        </div>
                    )}
                    {/* === EXTENDED MODE === */}
{monitorMode === 'extended' && (
                        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50/50">
                             <table className="w-full text-left border-collapse table-fixed">
                                <thead className="bg-slate-100 text-[10px] font-bold text-slate-500 uppercase sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-3 w-20 text-center border-r border-slate-200">Time</th>
                                        <th className="p-3 w-32 bg-slate-50/50 text-center border-r border-slate-200">Hop -2 (Src)</th>
                                        <th className="p-3 w-32 bg-green-50/30 text-center border-r border-slate-200 text-green-700">Hop -1 (Cust)</th>
                                        <th className="p-3 w-40 bg-blue-50/30 text-center border-r border-slate-200 text-blue-700 border-b-2 border-b-blue-400">Ops Wallet (Me)</th>
                                        <th className="p-3 w-32 bg-slate-50/50 text-center border-r border-slate-200">Hop +1 (Recv)</th>
                                        <th className="p-3 w-32 bg-slate-50/50 text-center border-r border-slate-200">Hop +2 (Dst)</th>
                                        <th className="p-3 w-12 text-center bg-slate-100">Risk</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-mono">
                                    {extendedTxs.map((row) => {
                                        const checkStrictRisk = (addr?: string) => {
                                            if (!addr) return false;
                                            const info = labelMap[addr];
                                            if (!info) return true; // Unknown = Risk
                                            if (info.riskLevel?.toUpperCase() !== 'LOW') return true; // Not Low = Risk
                                            return false;
                                        };
                                        const isRiskDetected = checkStrictRisk(row.hopMinus2) || checkStrictRisk(row.hopPlus2);
                                        const rowRiskColor = isRiskDetected ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse' : 'bg-green-400 opacity-50';

                                        return (
                                        <tr key={row.id} className="border-b border-slate-200 bg-white hover:bg-blue-50/20 transition-colors h-14 relative group/row hover:z-20">
                                            {row.isLoadingExtended && (
                                                <td colSpan={7} className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
                                                    <div className="h-0.5 w-20 bg-blue-100 overflow-hidden rounded-full"><div className="h-full bg-blue-500 animate-loading-bar"></div></div>
                                                </td>
                                            )}

                                            <td className="p-2 text-center text-slate-400 border-r border-slate-100">
                                                {new Date(row.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit' })}
                                            </td>
                                            
                                            <td className="p-2 border-r border-slate-100 text-center relative">
                                                {renderHopCell(row.hopMinus2, 'source', row)}
                                                {row.hopMinus2 && <div className="absolute top-1/2 -right-2 w-4 h-[1px] bg-slate-300"></div>}
                                            </td>

                                            <td className="p-2 border-r border-slate-100 text-center relative">
                                                {renderHopCell(row.hopMinus1, row.type === 'INFLOW' ? 'customer' : 'normal', row)}
                                            </td>

                                            <td className="p-2 border-r border-slate-100 text-center bg-blue-50/10 relative">
                                                <div className="font-bold text-blue-700 text-[10px] mb-1">{row.type}</div>
                                                {renderHopCell(row.hopMe, 'center', row)}
                                                <div className="text-[10px] font-bold mt-1 text-slate-600">{row.amount.toLocaleString()} {row.token}</div>
                                            </td>

                                            <td className="p-2 border-r border-slate-100 text-center relative">
                                                {renderHopCell(row.hopPlus1, 'normal', row)}
                                            </td>

                                            <td className="p-2 border-r border-slate-100 text-center relative">
                                                {row.hopPlus2 && <div className="absolute top-1/2 -left-2 w-4 h-[1px] bg-slate-300"></div>}
                                                {renderHopCell(row.hopPlus2, 'dest', row)}
                                            </td>

                                            <td className="p-2 text-center">
                                                <div className={`w-3 h-3 rounded-full inline-block ring-2 ring-white transition-all ${rowRiskColor}`} title={isRiskDetected ? "High Risk Detected" : "Low Risk Verified"}></div>
                                            </td>
                                        </tr>
                                    )})}
                                    {extendedTxs.length === 0 && (
                                        <tr><td colSpan={7} className="p-8 text-center text-slate-400">Waiting for next cycle...</td></tr>
                                    )}
                                </tbody>
                             </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};