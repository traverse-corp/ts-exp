import { useState, useEffect, useRef } from 'react';
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

// --- [Types] ---
interface LabelInfo {
    label: string;
    riskLevel: string;
}

interface ExtendedTxRow {
    id: string; // Unique Key for React List
    timestamp: number;
    type: 'INFLOW' | 'OUTFLOW';
    amount: number;
    token: string;
    
    // Address & Label Data for each Hop
    hopMinus2?: string;
    hopMinus1?: string;
    hopMe: string;
    hopPlus1?: string;
    hopPlus2?: string;

    // Loading State for this specific row
    isLoadingExtended: boolean;
}

// --- [Icons] ---
const DashIcons = {
    Wallet: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
    PieChart: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>,
    Refresh: () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    Expanded: () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
};

const RATES = { TRX: 450, USDT: 1450 };
const SANCTION_DATA = { ofac: 14205, kofiu: 16843910, crime: 3504589 };

export const ComplianceDashboard = () => {
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
  
  // Extended Mode Data
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

  // --- Actions ---
  const handleAddWallet = () => { if(inputWallet) { addOpWallet(inputWallet); setInputWallet(''); } };
  const handleInstantTrace = (address: string) => { setTraceAddr(address); setMode('autotracer'); };
  const handleOpenReport = (tx: any) => { 
      // 보고서 생성 시 필요한 기본 포맷으로 변환해서 전달
      openReport({ ...tx, counterparty: tx.counterparty || tx.hopMinus1 || tx.hopPlus1 }); 
  };
  const handleCheckKYC = (address: string) => {
      const ci = generateMockCI(address);
      window.prompt(`[KYC 정보 확인]\n\n해당 고객의 식별값(CI)은 아래와 같습니다.`, ci);
  };
  const handleFreeze = (address: string) => {
      const ci = generateMockCI(address);
      if (window.confirm(`[계좌 동결 경고 ]\n\n식별된 CI: ${ci}\n\n해당 유저와 관련된 모든 계정 및 계좌에 대한 동결 조치를 진행하시겠습니까?`)) {
          alert("[System] 현재 서비스 준비 중입니다.\n(Integration pending with Core Banking System)");
      }
  };
  const handleCopyAddr = (address: string) => {
      navigator.clipboard.writeText(address);
      // 토스트 메시지 대신 간단한 콘솔 로그 (또는 UI 피드백 추가 가능)
      console.log('Copied:', address); 
  };

  // 1. Portfolio Logic (10m)
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
      // Async task controller to prevent updates on unmounted components or mode switch
      let isMounted = true;

      const loadData = async () => {
          if (opWallets.length === 0) return;
          if (monitorMode === 'standard') setLoading(true); // Standard만 전체 로딩 표시

          try {
              // (Step A) 기본 데이터 (내 지갑 관련 Txs)
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

              // ---------------- [STANDARD MODE] ----------------
              if (monitorMode === 'standard') {
                  const slicedTxs = allTxs.slice(0, 100);
                  
                  // Labeling
                  const uniqueAddresses = Array.from(new Set(slicedTxs.map(tx => tx.counterparty)));
                  if (uniqueAddresses.length > 0) {
                      const { data: labels } = await supabase.from('address_labels').select('address, label_name, risk_level').in('address', uniqueAddresses);
                      const newLabels: any = {};
                      labels?.forEach((item: any) => newLabels[item.address] = { label: item.label_name, riskLevel: item.risk_level });
                      setLabelMap(prev => ({ ...prev, ...newLabels }));
                  }
                  if (isMounted) setDashboardData(slicedTxs, new Date());
              } 
              // ---------------- [EXTENDED MODE] ----------------
              else {
                  const targetTxs = allTxs.slice(0, 10);
                  
                  // 1. 기본 골격 먼저 렌더링 (로딩 중 상태)
                  const initialRows: ExtendedTxRow[] = targetTxs.map((tx, i) => ({
                      id: tx.txID + i, // Unique key
                      timestamp: tx.timestamp,
                      type: tx.isCustomer ? 'INFLOW' : 'OUTFLOW',
                      amount: tx.amount,
                      token: tx.token,
                      hopMe: tx.ownerWallet,
                      hopMinus1: tx.isCustomer ? tx.sender : undefined,
                      hopPlus1: !tx.isCustomer ? tx.receiver : undefined,
                      isLoadingExtended: true // 로딩 표시 시작
                  }));
                  
                  if (isMounted) setExtendedTxs(initialRows);

                  // 2. 한 줄씩(Row-by-Row) 확장 데이터 조회 및 업데이트
                  targetTxs.forEach(async (tx, index) => {
                      if (!isMounted) return;

                      let hopMinus2 = undefined;
                      let hopPlus2 = undefined;
                      const addressesToLabel: string[] = [];

                      // (Hop -1) 라벨 조회 대상 추가
                      if (tx.isCustomer && tx.sender) addressesToLabel.push(tx.sender);
                      // (Hop +1) 라벨 조회 대상 추가
                      if (!tx.isCustomer && tx.receiver) addressesToLabel.push(tx.receiver);

                      // --- 확장 조회 ---
                      if (tx.isCustomer) {
                          // Inflow: Hop -2 찾기
                          try {
                              const senderHistory = await fetchRecentHistory(tx.sender);
                              const sourceTx = senderHistory.find(h => h.receiver === tx.sender && h.timestamp < tx.timestamp);
                              if (sourceTx) {
                                  hopMinus2 = sourceTx.sender;
                                  addressesToLabel.push(hopMinus2); // Hop -2도 라벨 조회
                              }
                          } catch {}
                      } else {
                          // Outflow: Hop +2 찾기
                          try {
                              const receiverHistory = await fetchRecentHistory(tx.receiver);
                              const destTx = receiverHistory.find(h => h.sender === tx.receiver && h.timestamp > tx.timestamp);
                              if (destTx) {
                                  hopPlus2 = destTx.receiver;
                                  addressesToLabel.push(hopPlus2); // Hop +2도 라벨 조회
                              }
                          } catch {}
                      }

                      // --- 라벨링 (Supabase) ---
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

                      // --- 해당 Row 업데이트 (Progressive Update) ---
                      if (isMounted) {
                          setExtendedTxs(prev => {
                              const newArr = [...prev];
                              // 인덱스가 일치하고 ID가 같은지 확인
                              if (newArr[index] && newArr[index].id === (tx.txID + index)) {
                                  newArr[index] = {
                                      ...newArr[index],
                                      hopMinus2,
                                      hopPlus2,
                                      isLoadingExtended: false // 로딩 끝
                                  };
                              }
                              return newArr;
                          });
                      }
                  });
              }

          } catch (e) { console.error(e); } finally { if(isMounted) setLoading(false); }
      };

      loadData();
      const intervalMs = monitorMode === 'standard' ? 30000 : 180000;
      const interval = setInterval(loadData, intervalMs);
      return () => { isMounted = false; clearInterval(interval); };
  }, [opWallets, monitorMode]);


const renderHopCell = (address: string | undefined, type: 'customer' | 'normal' | 'source' | 'dest', txData?: any) => {
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
      // 2. Known Entity (Labeled)
      else if (hasLabel) {
          bgClass = "bg-indigo-50 text-indigo-700 border-indigo-100";
      }

      // 3. [NEW] Deposit Address Logic (Hop +1이 대상이고, Hop +2에 라벨이 있는 경우)
      // 조건: 현재 렌더링 중인 주소가 Hop+1이고, Hop+2 주소가 존재하며, Hop+2에 라벨이 있을 때
      if (txData && address === txData.hopPlus1 && txData.hopPlus2) {
          const nextHopLabel = labelMap[txData.hopPlus2]?.label;
          if (nextHopLabel) {
              displayLabel = `입금 주소 : ${nextHopLabel}`;
              // Hot Wallet 입금 주소 느낌의 붉은색/장미색 스타일
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
                  {displayLabel === 'Unknown' ? `${address.slice(0,6)}...` : displayLabel}
              </div>

              {/* Hover Menu (No Emojis) */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 hidden group-hover:flex flex-col gap-1 bg-white shadow-xl border border-slate-200 rounded p-1.5 z-50 w-36 animate-in fade-in slide-in-from-top-1 duration-200">
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
                  
                  {type === 'customer' && (
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

        {/* Header & KPI (기존 코드 유지) */}
        <div className="mb-8 flex justify-between items-end">
            <div>
                <div className="flex items-baseline gap-3 mb-1">
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <span className="text-blue-700">TranSight</span> Enterprise for <span className="text-blue-700">{userName}</span>
                    </h1>
                </div>
                <p className="text-slate-500 font-medium text-sm">{t.dash_subtitle}</p>
            </div>
            <div className="flex gap-4">
                 <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm text-right">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{t.card_risk_score}</div>
                    <div className="text-xl font-black text-green-500">Low (12/100)</div>
                </div>
                <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm text-right">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{t.card_monitored_vol}</div>
                    <div className="text-xl font-black text-blue-600">$42.5M</div>
                </div>
            </div>
        </div>

        {/* Charts & Asset/Wallet Columns (기존 코드 유지 - 생략 없이 포함됨) */}
        <div className="grid grid-cols-12 gap-6 mb-6">
            {/* Sanction Stats (기존 유지) */}
            <div className="col-span-4 bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><span>{t.sanc_title}</span></h3>
                <div className="space-y-4">
                    <div className="flex justify-between items-center group cursor-pointer hover:bg-slate-50 p-2 rounded transition-colors">
                        <span className="text-sm font-bold text-slate-500 group-hover:text-red-600">{t.sanc_ofac}</span>
                        <span className="text-lg font-black text-slate-800 font-mono">{SANCTION_DATA.ofac.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-2"><div className="w-[85%] h-full bg-red-500"></div></div>
                    <div className="flex justify-between items-center group cursor-pointer hover:bg-slate-50 p-2 rounded transition-colors">
                        <span className="text-sm font-bold text-slate-500 group-hover:text-orange-600">{t.sanc_kofiu}</span>
                        <span className="text-lg font-black text-slate-800 font-mono">{SANCTION_DATA.kofiu.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-2"><div className="w-[45%] h-full bg-orange-500"></div></div>
                    <div className="flex justify-between items-center group cursor-pointer hover:bg-slate-50 p-2 rounded transition-colors">
                        <span className="text-sm font-bold text-slate-500 group-hover:text-slate-800">{t.sanc_crime}</span>
                        <span className="text-lg font-black text-slate-800 font-mono">{SANCTION_DATA.crime.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden"><div className="w-[60%] h-full bg-slate-600"></div></div>
                </div>
            </div>
            {/* Risk Chart (기존 유지) */}
            <div className="col-span-8 bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col">
                <h3 className="font-bold text-slate-700 mb-4">Risk Distribution (Weekly)</h3>
                <div className="flex-1 flex items-end justify-between px-6 gap-4">
                    {[35, 55, 40, 70, 45, 90, 60].map((h, i) => (
                        <div key={i} className="w-full flex flex-col items-center gap-2 group">
                            <div className="w-full bg-blue-50 rounded-t-md relative overflow-hidden h-40 transition-all group-hover:bg-blue-100">
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-600 to-indigo-500 rounded-t-md transition-all duration-500 group-hover:from-blue-500 group-hover:to-cyan-400" style={{ height: `${h}%` }}>
                                    {h > 60 && <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white/50 rounded-full animate-ping" />}
                                </div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="grid grid-cols-12 gap-6 h-[600px]">
            {/* Left Column (Asset & Wallet List) */}
            <div className="col-span-4 flex flex-col gap-6 h-full">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2"><DashIcons.PieChart /> Asset Portfolio</h3>
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

            {/* Right Column: Real-time Monitor */}
            <div className="col-span-8 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
                
                {/* Global Loading (Standard) */}
                {loading && monitorMode === 'standard' && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-100 z-20"><div className="h-full bg-blue-500 animate-loading-bar"></div></div>
                )}
                <style>{`@keyframes loading-bar { 0% { width: 0%; margin-left: 0; } 50% { width: 50%; margin-left: 25%; } 100% { width: 0%; margin-left: 100%; } } .animate-loading-bar { animation: loading-bar 1.5s infinite linear; }`}</style>

                {/* Monitor Header */}
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            Real-time Inflow/Outflow Monitor
                        </h3>
                        <div className="flex bg-slate-200 rounded p-0.5 ml-2">
                            <button onClick={() => setMonitorMode('standard')} className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${monitorMode === 'standard' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Standard</button>
                            <button onClick={() => setMonitorMode('extended')} className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all flex items-center gap-1 ${monitorMode === 'extended' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}><DashIcons.Expanded /> Extended</button>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                        <DashIcons.Refresh /> Updated: {dashboardLastUpdated ? dashboardLastUpdated.toLocaleTimeString() : 'Syncing...'}
                    </div>
                </div>
                
                <div className="flex-1 overflow-hidden relative bg-white">
                    
                    {/* === STANDARD MODE === */}
                    {monitorMode === 'standard' && (
                        <div className="h-full overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase sticky top-0 z-10">
                                <tr>
                                    <th className="p-3 border-b border-slate-100">Time</th>
                                    <th className="p-3 border-b border-slate-100">Type</th>
                                    <th className="p-3 border-b border-slate-100">Ops Wallet (Me)</th>
                                    {/* [Fix] 가운데 정렬 적용 */}
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
                                        <td className="p-3 font-mono text-slate-500 w-24">
                                            {new Date(tx.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                                        </td>
                                        <td className="p-3 w-20">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${tx.isCustomer ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>{tx.isCustomer ? 'INFLOW' : 'OUTFLOW'}</span>
                                        </td>
                                        <td className="p-3 w-32">
                                            <div className="font-mono text-slate-500 truncate w-28 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded" title={tx.ownerWallet}>{tx.ownerWallet.slice(0,4)}...{tx.ownerWallet.slice(-4)}</div>
                                        </td>
                                        <td className="p-3 relative">
                                            {/* Standard Mode는 Customer면 customer 타입, 아니면 normal */}
                                            {renderHopCell(tx.counterparty, tx.isCustomer ? 'customer' : 'normal', tx)}
                                        </td>
                                        <td className="p-3 text-right font-bold font-mono w-28">{tx.amount.toLocaleString()} <span className="text-[9px] text-slate-400 font-sans font-normal">{tx.token}</span></td>
                                        <td className="p-3 text-center w-16">
                                            {labelInfo ? <div className={`w-3 h-3 rounded-full inline-block ${getRiskColorClass(labelInfo.riskLevel)} ring-2 ring-white`} title={`Risk: ${labelInfo.riskLevel}`}></div> : <span className="w-2 h-2 rounded-full inline-block bg-slate-200"></span>}
                                        </td>
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
                                        const risks = [row.hopMinus2, row.hopMinus1, row.hopPlus1, row.hopPlus2]
                                            .map(addr => addr ? labelMap[addr]?.riskLevel : null)
                                            .filter(Boolean);
                                        const hasSevere = risks.some(r => ['SEVERE','HIGH'].includes(r || ''));
                                        const hasLow = risks.includes('LOW');
                                        const rowRiskColor = hasSevere ? 'bg-red-500' : (hasLow ? 'bg-green-500' : 'bg-slate-200');

                                        return (
                                        <tr key={row.id} className="border-b border-slate-200 bg-white hover:bg-blue-50/20 transition-colors h-14 relative group/row">
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
                                                <div className="bg-white border border-blue-200 text-blue-800 px-2 py-1 rounded truncate text-[10px] shadow-sm cursor-pointer" onClick={() => handleCopyAddr(row.hopMe)} title={row.hopMe}>
                                                    {row.hopMe.slice(0,4)}...{row.hopMe.slice(-4)}
                                                </div>
                                                <div className="text-[10px] font-bold mt-1 text-slate-600">{row.amount.toLocaleString()} {row.token}</div>
                                            </td>

                                            <td className="p-2 border-r border-slate-100 text-center relative">
                                                {/* [Fix] Outflow일 때 Hop+1은 External(normal)로 처리하여 Customer 라벨 제거 */}
                                                {renderHopCell(row.hopPlus1, 'normal', row)}
                                            </td>

                                            <td className="p-2 border-r border-slate-100 text-center relative">
                                                {row.hopPlus2 && <div className="absolute top-1/2 -left-2 w-4 h-[1px] bg-slate-300"></div>}
                                                {renderHopCell(row.hopPlus2, 'dest', row)}
                                            </td>

                                            <td className="p-2 text-center">
                                                <div className={`w-3 h-3 rounded-full inline-block ${rowRiskColor} ring-2 ring-white`} title={`Risk Detected`}></div>
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