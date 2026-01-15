import React, { useEffect, useState } from 'react';
import NetworkGraph from './components/graph/NetworkGraph';
import { useGlobalStore } from './stores/useGlobalStore';
import { useAutoTrace } from './hooks/useAutoTrace';
import { useDeepTrace } from './hooks/useDeepTrace';
import { DetailPanel } from './components/dashboard/DetailPanel';
import { ClusterPanel } from './components/dashboard/ClusterPanel';
import { AuthModal } from './components/auth/AuthModal';
import { SessionManager } from './components/dashboard/SessionManager';
import { supabase } from './lib/supabaseClient';
import { ComplianceDashboard } from './components/dashboard/ComplianceDashboard';

function App() {
  // [핵심 수정] 로컬 useState 대신 Store에서 모든 상태를 가져옵니다.
  const { 
    // 1. 상태값 가져오기
    mode, setMode,
    language, setLanguage,
    layoutMode, setLayoutMode, 
    isPhysicsActive, setIsPhysicsActive,
    
    // 2. 입력값들 (대시보드와 공유됨)
    inputAddr, setInputAddr,
    traceAddr, setTraceAddr, 
    hopCount, setHopCount, 
    txLimit, setTxLimit,
    traceMode, setTraceMode, 
    startTime, setStartTime,

    // 3. 내부 로직 상태
    isMonitoring, setIsMonitoring,
    riskNodes,
    
    // 4. 기능 및 데이터
    addNodes, graphData,
    session, setSession, signOut,
    fetchOpWallets, opWallets,
    
    // 5. Hooks 상태 공유용 (필요시)
    bb, at
  } = useGlobalStore();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const toggleLanguage = () => {
    setLanguage(language === 'ko' ? 'en' : 'ko');
  };

  // -- Auth Init --
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, [setSession]);

  // [NEW] 세션이 생기면(로그인하면) 운영 지갑 목록 불러오기
  useEffect(() => {
    if (session?.user) {
        fetchOpWallets();
    }
  }, [session, fetchOpWallets]);
  
  // -- BigBrother Hook 연결 --
  // Store에 있는 bb 객체를 업데이트하기 위해 로컬 훅 결과를 Store에 동기화할 수도 있지만,
  // 여기서는 간편하게 로컬 변수로 쓰고, 렌더링에 사용합니다.
  const localBB = useAutoTrace(isMonitoring && mode === 'bigbrother');
  
  // -- AutoTracer Hook 연결 --
  const localAT = useDeepTrace();

  // Store의 bb, at 상태를 훅의 결과로 동기화 (선택 사항이지만 로그 출력을 위해 필요)
  // 편의상 렌더링 시점에 직접 매핑하여 사용합니다.
  const displayLogs = mode === 'bigbrother' ? localBB.logs : localAT.traceLog;
  
  // Handlers
  const handleStartBigBrother = () => {
    if (!inputAddr) return;
    const addresses = inputAddr.split(/[\n, ]+/).map(s => s.trim()).filter(s => s.length > 0);
    if (addresses.length === 0) return;

    if (addresses.length > 20) {
        if (!confirm(`Only the first 20 addresses will be added. Continue?`)) return;
        addresses.length = 20; 
    }
    const newNodes = addresses.map(addr => ({
        id: addr,
        group: 'target',
        val: 20,
        isTerminal: false,
        createdAt: Date.now(),
        isStart: true
    }));
    
    // @ts-ignore
    addNodes(newNodes);
    setIsMonitoring(true);
    setInputAddr('');
  };

  const handleStartAutoTrace = () => {
    if (!traceAddr) return;
    if (traceMode === 'timeflow' && !startTime) {
        alert("Please select a Start Time for Time-Flow analysis.");
        return;
    }
    // Hook 실행
    localAT.startDeepTrace(traceAddr, hopCount, txLimit, traceMode, startTime);
  };

  const handleStopAutoTrace = () => {
    localAT.stopDeepTrace();
  };

  // 로그인 체크
  if (!session) {
    return (
        <div className="relative w-full h-screen bg-slate-50 overflow-hidden">
            <NetworkGraph /> 
            <AuthModal />
        </div>
    );
  }

  return (
    <div className="relative w-full h-screen flex bg-slate-50 font-sans overflow-hidden">
        
        {/* 1. 메인 뷰 (그래프 vs 대시보드) */}
        <div className="flex-1 h-full relative">
            {mode === 'dashboard' ? (
                <div className="absolute inset-0 z-20">
                    <ComplianceDashboard />
                </div>
            ) : (
                <NetworkGraph />
            )}
        </div>

        {/* 2. 좌측 상단 컨트롤러 */}
        <div className="absolute top-6 left-6 z-30 flex flex-col gap-4">
            {mode !== 'dashboard' && (
                <h1 className="text-2xl font-bold tracking-tighter text-blue-700 drop-shadow-sm select-none">
                TranSight <span className="text-slate-600 font-light not-italic">
                    {mode === 'autotracer' ? 'AutoTracer' : 'BigBrother'}
                </span>
                </h1>
            )}
        
            {/* 모드 스위처 */}
            <div className="bg-white/90 backdrop-blur rounded-full p-1 shadow-md border border-slate-200 flex w-fit">
                <button onClick={() => setMode('dashboard')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${mode === 'dashboard' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}>
                    Dashboard
                </button>
                <button onClick={() => setMode('autotracer')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'autotracer' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}>AutoTracer</button>
                <button onClick={() => { setMode('bigbrother'); setIsMonitoring(false); }} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'bigbrother' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}>BigBrother</button>
            </div>

            {/* 그래프 옵션 (대시보드 모드 아닐 때만 표시) */}
            {mode !== 'dashboard' && (
                <>
                    <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-300">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{language === 'ko' ? '맵 구조' : 'Map Layout'}</span>
                        <div className="bg-white/90 backdrop-blur rounded-lg p-1 shadow-sm border border-slate-200 flex w-fit">
                            <button onClick={() => setLayoutMode('physics')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${layoutMode === 'physics' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>Web</button>
                            <button onClick={() => setLayoutMode('horizontal')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${layoutMode === 'horizontal' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>Tree</button>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase w-10">{language === 'ko' ? '물리 엔진' : 'Physics'}</span>
                        <button onClick={() => setIsPhysicsActive(!isPhysicsActive)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm flex items-center gap-2 ${isPhysicsActive ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' : 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'}`}>
                            {isPhysicsActive ? '⚡ Active' : '❄️ Frozen'}
                        </button>
                    </div>
                </>
            )}
        </div>

        {/* 3. 중앙 상단 커맨드바 (대시보드에선 숨김) */}
        {mode !== 'dashboard' && (
         <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300">
        
            {/* BigBrother Input */}
            {mode === 'bigbrother' && (
                <div className="w-[600px] bg-white/90 backdrop-blur-xl shadow-2xl rounded-full p-1.5 flex items-center border border-slate-200 transition-all focus-within:ring-2 focus-within:ring-blue-500/50">
                    <textarea 
                        value={inputAddr}
                        onChange={(e) => setInputAddr(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleStartBigBrother(); } }}
                        placeholder="Paste addresses to monitor (Real-time)..." 
                        className="flex-1 bg-transparent border-none px-4 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none resize-none h-9 overflow-hidden leading-5"
                    />
                    <button onClick={handleStartBigBrother} className="bg-blue-600 hover:bg-blue-700 text-white w-24 h-9 rounded-full text-xs font-bold shadow-md flex items-center justify-center gap-1">MONITOR</button>
                </div>
            )}

            {/* AutoTracer Input */}
            {mode === 'autotracer' && (
                <div className="flex flex-col items-center gap-2">
                    <div className="w-[750px] bg-white/90 backdrop-blur-xl shadow-2xl rounded-full p-1.5 flex items-center gap-2 border border-indigo-100 transition-all focus-within:ring-2 focus-within:ring-indigo-500/50">
                        {/* [핵심] traceAddr가 Store 값과 연동됨 */}
                        <input type="text" value={traceAddr} onChange={(e) => setTraceAddr(e.target.value)} placeholder="Target Address..." className="flex-[2] bg-transparent border-none px-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none" />
                        
                        <div className="flex items-center gap-2 pr-2 border-l border-slate-200 pl-3">
                            <div className="flex flex-col items-center w-14">
                                <label className="text-[9px] text-slate-400 font-bold uppercase">{language === 'ko' ? '거리' : 'HOPS'}</label>
                                <input type="number" min="1" max="10" value={hopCount} onChange={(e) => setHopCount(Number(e.target.value))} className="w-full text-center text-sm font-bold text-indigo-600 bg-transparent outline-none" />
                            </div>
                            <div className="flex flex-col items-center w-14 border-l border-slate-200 pl-2">
                                <label className="text-[9px] text-slate-400 font-bold uppercase">{language === 'ko' ? 'TX/거리' : 'TX/HOP'}</label>
                                <input type="number" min="10" max="100" value={txLimit} onChange={(e) => setTxLimit(Number(e.target.value))} className="w-full text-center text-sm font-bold text-indigo-600 bg-transparent outline-none" />
                            </div>
                        </div>
                        {!localAT.isTracing ? (
                        <button onClick={handleStartAutoTrace} className="bg-indigo-600 hover:bg-indigo-700 text-white w-28 h-9 rounded-full text-xs font-bold shadow-md flex items-center justify-center gap-1 transition-colors">ANALYZE</button>
                        ) : (
                        <button onClick={handleStopAutoTrace} className="bg-red-500 hover:bg-red-600 text-white w-28 h-9 rounded-full text-xs font-bold shadow-md flex items-center justify-center gap-1 transition-colors animate-pulse">■ STOP</button>
                        )}
                    </div>

                    {/* 옵션 바 */}
                    <div className="flex gap-4 bg-white/80 backdrop-blur px-4 py-1.5 rounded-full shadow-sm border border-slate-100 animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-3 border-r border-slate-200 pr-4">
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name="tm" checked={traceMode === 'relation'} onChange={() => setTraceMode('relation')} className="accent-indigo-600"/>
                                <span className="text-xs text-slate-600 font-medium">{language === 'ko' ? '관계성 분석' : 'Relation'}</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name="tm" checked={traceMode === 'timeflow'} onChange={() => setTraceMode('timeflow')} className="accent-indigo-600"/>
                                <span className="text-xs text-slate-600 font-medium">{language === 'ko' ? '시간 순 분석' : 'Time Flow'}</span>
                            </label>
                        </div>
                        <div className={`flex items-center gap-2 transition-opacity duration-200 ${traceMode === 'timeflow' ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                            <label className="text-[10px] text-slate-400 font-bold uppercase">Start:</label>
                            <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="text-xs border border-slate-200 rounded px-1 py-0.5 text-slate-700 focus:outline-indigo-500 bg-white" />
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-[700px] mt-2 h-8 relative">
                    {localAT.isTracing && localAT.progress && (
                        <div className="w-[700px] mt-2 animate-in slide-in-from-top-4 fade-in duration-300">
                            <div className="flex justify-between text-[10px] font-bold text-indigo-600 mb-1 px-2 uppercase tracking-wider">
                                <span>Hop {localAT.progress.currentHop} / {localAT.progress.maxHop}</span>
                                <span className="animate-pulse">Scanning... {Math.round(localAT.progress.percentage)}%</span>
                            </div>
                            <div className="h-3 w-full bg-indigo-100 rounded-full overflow-hidden shadow-inner border border-indigo-200 relative">
                                <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full transition-all duration-300 ease-out relative" style={{ width: `${localAT.progress.percentage}%`, boxShadow: '0 0 10px rgba(99, 102, 241, 0.5)' }}>
                                    <div className="absolute inset-0 w-full h-full opacity-30" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem', animation: 'progress-stripes 1s linear infinite' }} />
                                </div>
                            </div>
                        </div>
                    )}
                    </div>    
                </div>
            )}
         </div>
        )}

      <style>{`@keyframes progress-stripes { from { background-position: 1rem 0; } to { background-position: 0 0; } }`}</style>

      {/* 4. 우측 상단 유저 메뉴 & 로그 패널 */}
      <div className="absolute top-6 right-6 flex flex-col items-end gap-3 z-[90]">
        
        {/* User Dropdown Trigger */}
        <div className="relative z-50">
            <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="bg-white/90 backdrop-blur-xl border border-slate-200 shadow-md px-4 py-2 rounded-full flex items-center gap-2 hover:bg-slate-50 transition-all active:scale-95"
            >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-xs font-bold">
                    {session?.user?.email?.[0].toUpperCase() || 'G'}
                </div>
                <span className="text-xs font-bold text-slate-700 max-w-[100px] truncate">
                    {session?.user?.email?.split('@')[0] || 'Guest User'}
                </span>
                <span className="text-[10px] text-slate-400">▼</span>
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200 origin-top-right ring-1 ring-slate-900/5">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                        <div className="text-xs font-bold text-slate-800">Signed in as</div>
                        <div className="text-[10px] text-slate-500 font-mono truncate">{session?.user?.email}</div>
                    </div>

                    <div className="p-1">
                        <button 
                            onClick={() => { toggleLanguage(); setIsUserMenuOpen(false); }}
                            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors flex items-center justify-between group"
                        >
                            <span className="flex items-center gap-2">🌐 Language</span>
                            <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                {language === 'ko' ? '한국어' : 'English'}
                            </span>
                        </button>

                        <div className="border-t border-slate-100 my-1"></div>

                        <div className="py-1">
                            <SessionManager currentMode={mode} />
                        </div>
                        
                        <div className="border-t border-slate-100 my-1"></div>

                        <button 
                            onClick={() => { signOut(); setIsUserMenuOpen(false); }}
                            className="w-full text-left px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* Log Panel */}
        {mode !== 'dashboard' && (
            <div className="pointer-events-auto w-72 flex flex-col items-end gap-3 mt-2 relative z-0">
                {mode === 'autotracer' && localAT.progress && (
                    <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full border border-indigo-100 shadow-lg w-full">
                        <div className="flex justify-between text-[10px] text-indigo-600 font-bold mb-1">
                            <span>Layer {localAT.progress.currentHop} / {localAT.progress.maxHop}</span>
                            <span className="animate-pulse">Running</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${(localAT.progress.currentHop / localAT.progress.maxHop) * 100}%` }} />
                        </div>
                    </div>
                )}

                {mode === 'bigbrother' && isMonitoring && (
                    <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full border border-blue-100 shadow-lg flex items-center gap-3 text-xs font-mono text-slate-600 self-end">
                        <div className="flex flex-col items-end leading-none">
                            <span className="text-[9px] text-slate-400 uppercase font-bold">Updated</span>
                            <span className="font-bold text-blue-600">{localBB.lastUpdated || 'Scanning...'}</span>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent ${localBB.isRefreshing ? 'animate-spin' : ''}`} />
                    </div>
                )}

                <div className="bg-slate-900/90 backdrop-blur text-green-400 p-3 rounded-xl shadow-xl w-full max-h-60 overflow-y-auto custom-scrollbar border border-slate-700/50">
                    <div className="text-[9px] text-slate-500 uppercase font-bold mb-2 border-b border-slate-700 pb-1 flex justify-between">
                        <span>{mode === 'bigbrother' ? 'Monitor Log' : 'Trace Log'}</span>
                        <span className={mode === 'bigbrother' ? 'text-blue-400' : 'text-indigo-400'}>● Output</span>
                    </div>
                    <div className="space-y-1 font-mono text-[10px] leading-relaxed">
                        {displayLogs.map((log: string, i: number) => (
                            <div key={i} className="break-all opacity-90 hover:opacity-100">
                                <span className="text-slate-500 mr-1">{`>`}</span>
                                {log}
                            </div>
                        ))}
                        {displayLogs.length === 0 && <span className="text-slate-600 italic">System Ready.</span>}
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* 5. Bottom Panels */}
      {mode !== 'dashboard' && (
          <>
            <ClusterPanel />
            {mode === 'bigbrother' && (
            <div className="absolute bottom-6 right-6 w-80 bg-white/95 backdrop-blur border border-red-100 shadow-2xl rounded-xl p-4 z-10">
                <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2">🚨 Threat Detection</span>
                    {riskNodes.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{riskNodes.length}</span>}
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                    {riskNodes.length === 0 ? <div className="text-center py-4 text-xs text-slate-400">Clean.</div> : 
                    riskNodes.map((n: any) => (
                        <div key={n.id} className="flex items-start gap-2 bg-red-50 p-2 rounded border border-red-100 hover:bg-red-100 transition-colors cursor-pointer">
                        <div className="mt-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <div className="overflow-hidden">
                            <p className="text-xs font-bold text-slate-800">{n.label || 'Risk'}</p>
                            <p className="text-[10px] text-slate-500 font-mono truncate w-40">{n.id}</p>
                        </div>
                        </div>
                    ))
                    }
                </div>
            </div>
            )}
            <DetailPanel />
          </>
      )}
    </div>
  );
}

export default App;