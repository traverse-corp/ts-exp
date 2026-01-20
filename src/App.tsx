import React, { useEffect, useState } from 'react';
// [Router 제거] -> 단일 페이지 모드 전환 방식
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
import { CanvasPanel } from './components/dashboard/CanvasPanel';

function App() {
  const { 
    mode, setMode,
    language, setLanguage,
    layoutMode, setLayoutMode, 
    isPhysicsActive, setIsPhysicsActive,
    inputAddr, setInputAddr,
    traceAddr, setTraceAddr, 
    hopCount, setHopCount, 
    txLimit, setTxLimit,
    traceMode, setTraceMode, 
    startTime, setStartTime,
    isMonitoring, setIsMonitoring,
    riskNodes,
    addNodes,
    session, setSession, signOut,
    fetchOpWallets,
    bb, at
  } = useGlobalStore();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const toggleLanguage = () => setLanguage(language === 'ko' ? 'en' : 'ko');

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

  useEffect(() => {
    if (session?.user) fetchOpWallets();
  }, [session, fetchOpWallets]);
  
  const localBB = useAutoTrace(isMonitoring && mode === 'bigbrother');
  const localAT = useDeepTrace();
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
    localAT.startDeepTrace(traceAddr, hopCount, txLimit, traceMode, startTime);
  };

  const handleStopAutoTrace = () => {
    localAT.stopDeepTrace();
  };

  // 1. 로그인 안됐으면 로그인 모달 표시
  if (!session) {
    return (
        <div className="relative w-full h-screen bg-slate-50 overflow-hidden">
            <NetworkGraph /> 
            <AuthModal />
        </div>
    );
  }

  // 2. [핵심] Mode가 'canvas'라면, CanvasPanel을 전체 화면으로 렌더링하고 나머지는 무시
  if (mode === 'canvas') {
      return <CanvasPanel />;
  }

  // 3. 기존 Dashboard / AutoTracer / BigBrother 화면
  return (
    <div className="relative w-full h-screen flex bg-slate-50 font-sans overflow-hidden">
        
        {/* 메인 뷰 (그래프 vs 대시보드) */}
        <div className="flex-1 h-full relative">
            {mode === 'dashboard' ? (
                <div className="absolute inset-0 z-20"><ComplianceDashboard /></div>
            ) : (
                <NetworkGraph />
            )}
        </div>

        {/* 좌측 상단 컨트롤러 (Canvas 모드가 아닐 때만 표시) */}
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
                <button onClick={() => setMode('dashboard')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${mode === 'dashboard' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}>Dashboard</button>
                <button onClick={() => setMode('autotracer')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'autotracer' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}>AutoTracer</button>
                <button onClick={() => { setMode('bigbrother'); setIsMonitoring(false); }} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'bigbrother' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}>BigBrother</button>
                
                {/* [NEW] Canvas 버튼: URL 이동 대신 setMode('canvas') 호출 */}
                <div className="w-[1px] h-4 bg-slate-300 mx-1 self-center"></div>
                <button onClick={() => setMode('canvas')} className="px-3 py-1.5 rounded-full text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Go to Canvas Workspace">Canvas ↗</button>
            </div>

            {/* 그래프 옵션 (대시보드 모드 아닐 때만) */}
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

        {/* 중앙 상단 커맨드바 (대시보드에선 숨김) */}
        {mode !== 'dashboard' && (
            <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300">
                {mode === 'bigbrother' && (
                    <div className="w-[600px] bg-white/90 backdrop-blur-xl shadow-2xl rounded-full p-1.5 flex items-center border border-slate-200 transition-all focus-within:ring-2 focus-within:ring-blue-500/50">
                        <textarea value={inputAddr} onChange={(e) => setInputAddr(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleStartBigBrother(); } }} placeholder="Paste addresses to monitor (Real-time)..." className="flex-1 bg-transparent border-none px-4 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none resize-none h-9 overflow-hidden leading-5" />
                        <button onClick={handleStartBigBrother} className="bg-blue-600 hover:bg-blue-700 text-white w-24 h-9 rounded-full text-xs font-bold shadow-md flex items-center justify-center gap-1">MONITOR</button>
                    </div>
                )}
                {mode === 'autotracer' && (
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-[750px] bg-white/90 backdrop-blur-xl shadow-2xl rounded-full p-1.5 flex items-center gap-2 border border-indigo-100 transition-all focus-within:ring-2 focus-within:ring-indigo-500/50">
                            <input type="text" value={traceAddr} onChange={(e) => setTraceAddr(e.target.value)} placeholder="Target Address..." className="flex-[2] bg-transparent border-none px-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none" />
                            <div className="flex items-center gap-2 pr-2 border-l border-slate-200 pl-3">
                                <div className="flex flex-col items-center w-14"><label className="text-[9px] text-slate-400 font-bold uppercase">{language === 'ko' ? '거리' : 'HOPS'}</label><input type="number" min="1" max="10" value={hopCount} onChange={(e) => setHopCount(Number(e.target.value))} className="w-full text-center text-sm font-bold text-indigo-600 bg-transparent outline-none" /></div>
                                <div className="flex flex-col items-center w-14 border-l border-slate-200 pl-2"><label className="text-[9px] text-slate-400 font-bold uppercase">{language === 'ko' ? 'TX/거리' : 'TX/HOP'}</label><input type="number" min="10" max="100" value={txLimit} onChange={(e) => setTxLimit(Number(e.target.value))} className="w-full text-center text-sm font-bold text-indigo-600 bg-transparent outline-none" /></div>
                            </div>
                            {!localAT.isTracing ? <button onClick={handleStartAutoTrace} className="bg-indigo-600 hover:bg-indigo-700 text-white w-28 h-9 rounded-full text-xs font-bold shadow-md flex items-center justify-center gap-1 transition-colors">ANALYZE</button> : <button onClick={handleStopAutoTrace} className="bg-red-500 hover:bg-red-600 text-white w-28 h-9 rounded-full text-xs font-bold shadow-md flex items-center justify-center gap-1 transition-colors animate-pulse">■ STOP</button>}
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* 우측 상단 유저 메뉴 & 로그 패널 */}
        <div className="absolute top-6 right-6 flex flex-col items-end gap-3 z-[90]">
            {/* User Dropdown */}
            <div className="relative z-50">
                <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="bg-white/90 backdrop-blur-xl border border-slate-200 shadow-md px-4 py-2 rounded-full flex items-center gap-2 hover:bg-slate-50 transition-all active:scale-95">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-xs font-bold">{session?.user?.email?.[0].toUpperCase() || 'G'}</div>
                    <span className="text-xs font-bold text-slate-700 max-w-[100px] truncate">{session?.user?.email?.split('@')[0] || 'Guest User'}</span>
                    <span className="text-[10px] text-slate-400">▼</span>
                </button>
                {isUserMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 w-64 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200 origin-top-right ring-1 ring-slate-900/5">
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50"><div className="text-xs font-bold text-slate-800">Signed in as</div><div className="text-[10px] text-slate-500 font-mono truncate">{session?.user?.email}</div></div>
                        <div className="p-1">
                            <button onClick={() => { toggleLanguage(); setIsUserMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors flex items-center justify-between group">
                                <span className="flex items-center gap-2">🌐 Language</span><span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">{language === 'ko' ? '한국어' : 'English'}</span>
                            </button>
                            <div className="border-t border-slate-100 my-1"></div>
                            <div className="py-1"><SessionManager currentMode={mode} /></div>
                            <div className="border-t border-slate-100 my-1"></div>
                            <button onClick={() => { signOut(); setIsUserMenuOpen(false); setMode('dashboard'); }} className="w-full text-left px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2">Sign Out</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Log Panel (Canvas 아닐 때만) */}
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
                    <div className="bg-slate-900/90 backdrop-blur text-green-400 p-3 rounded-xl shadow-xl w-full max-h-60 overflow-y-auto custom-scrollbar border border-slate-700/50">
                        <div className="space-y-1 font-mono text-[10px] leading-relaxed">
                            {displayLogs.map((log: string, i: number) => (<div key={i} className="break-all opacity-90 hover:opacity-100"><span className="text-slate-500 mr-1">{`>`}</span>{log}</div>))}
                            {displayLogs.length === 0 && <span className="text-slate-600 italic">System Ready.</span>}
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Bottom Panels */}
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