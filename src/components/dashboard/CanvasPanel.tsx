import React, { useState, useEffect } from 'react';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useGlobalStore } from '../../stores/useGlobalStore';
import NetworkGraph from '../graph/NetworkGraph'; 
import { SessionManager } from './SessionManager'; 
import { ClusterPanel } from './ClusterPanel';
import { DetailPanel } from './DetailPanel';

export const CanvasPanel = () => {
  // --- Stores ---
  const { 
    tabs, activeTabId, 
    addTab, removeTab, setActiveTab, updateActiveTabData, addNodesToActiveTab,
  } = useCanvasStore();
  
  const { 
    session, signOut, language, setLanguage, setMode,
    layoutMode, setLayoutMode,          
    isPhysicsActive, setIsPhysicsActive,
    graphData, expandingNodes 
  } = useGlobalStore();

  // --- Local State ---
  const [isMounted, setIsMounted] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [searchAddr, setSearchAddr] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  
  // 노트 확장 상태
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);

  // 탭 안전 확보
  const currentTab = tabs.find(t => t.id === activeTabId) || (tabs.length > 0 ? tabs[0] : null);

  // --- 확장 동기화 (AutoTracer -> Canvas) ---
  useEffect(() => {
      if (!currentTab) return;
      if (graphData.nodes.length > 0 && expandingNodes.size > 0) {
          addNodesToActiveTab(graphData.nodes, graphData.links);
      }
  }, [graphData, expandingNodes, addNodesToActiveTab]);

  useEffect(() => { setIsMounted(true); }, []);

  // --- Handlers ---
  const toggleLanguage = () => setLanguage(language === 'ko' ? 'en' : 'ko');
  
  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateActiveTabData({ notes: e.target.value });
  };

  const handleSearchAndAdd = async () => {
      if (!searchAddr || !currentTab) return;
      setIsSearching(true);
      setTimeout(() => {
          const newNode = { id: searchAddr, label: searchAddr.slice(0,6), type: 'wallet', groupId: 'manual' };
          addNodesToActiveTab([newNode], []);
          setSearchAddr('');
          setIsSearching(false);
      }, 500);
  };

  const addToClipboard = (text: string) => {
      if (currentTab && !currentTab.clipboard.includes(text)) {
          updateActiveTabData({ clipboard: [text, ...currentTab.clipboard] });
      }
  };

  if (!isMounted) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col w-screen h-screen bg-slate-100 font-sans overflow-hidden">
      
      {/* 1. HEADER */}
      <header className="h-14 bg-white border-b border-slate-200 flex justify-between items-center px-4 z-50 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
              <button onClick={() => setMode('dashboard')} className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 border px-3 py-2 rounded-lg transition-colors">
                  Exit
              </button>
              <div className="h-4 w-[1px] bg-slate-300 mx-1"></div>
              <h1 className="text-sm font-black text-indigo-700 tracking-tight flex items-center gap-2">
                  TranSight <span className="text-slate-400 font-light">Canvas</span>
              </h1>
          </div>

          {/* Graph Controls */}
          <div className="flex items-center gap-4 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
              <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase hidden sm:block">Layout</span>
                  <div className="bg-white rounded-md p-0.5 shadow-sm border border-slate-200 flex">
                      <button onClick={() => setLayoutMode('physics')} className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${layoutMode === 'physics' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Web</button>
                      <button onClick={() => setLayoutMode('horizontal')} className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${layoutMode === 'horizontal' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Tree</button>
                  </div>
              </div>
              <div className="w-[1px] h-3 bg-slate-300"></div>
              <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase hidden sm:block">Physics</span>
                  <button onClick={() => setIsPhysicsActive(!isPhysicsActive)} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all border shadow-sm flex items-center gap-1.5 ${isPhysicsActive ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}>
                      {isPhysicsActive ? 'Active' : 'Frozen'}
                  </button>
              </div>
          </div>

          {/* User Menu */}
          <div className="relative">
            <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="flex items-center gap-2 hover:bg-slate-50 px-3 py-1.5 rounded-full transition-all border border-transparent hover:border-slate-200">
                <div className="w-7 h-7 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">{session?.user?.email?.[0].toUpperCase() || 'G'}</div>
            </button>
            {isUserMenuOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)}></div>
                    <div className="absolute top-full right-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 p-1">
                        {/* 헤더에서도 SessionManager 사용 가능 */}
                        <SessionManager currentMode="canvas" />
                        <div className="border-t my-1"></div>
                        <button onClick={() => { signOut(); setMode('dashboard'); }} className="w-full text-left px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded">Sign Out</button>
                    </div>
                </>
            )}
          </div>
      </header>

      {/* 2. BODY */}
      <div className="flex-1 flex overflow-hidden w-full h-full relative">
          
          {/* LEFT SIDEBAR */}
          <div className={`bg-white border-r border-slate-200 flex flex-col z-30 transition-all duration-300 ${isSidebarOpen ? 'w-80' : 'w-12'} h-full`}>
            <div className="p-2 border-b flex justify-between bg-slate-50"><button onClick={() => setSidebarOpen(!isSidebarOpen)} className="text-slate-400">{isSidebarOpen ? '◀' : '▶'}</button></div>
            {isSidebarOpen && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    
                    {/* [핵심] Session Manager Integration */}
                    {/* 기존의 복잡한 저장/로드 버튼을 모두 날리고 이거 하나로 통합 */}
                    <div className="bg-indigo-50 p-3 rounded border border-indigo-100">
                        <label className="text-[10px] font-bold text-indigo-400 uppercase flex items-center gap-1 mb-2">💾 Project Files</label>
                        <SessionManager 
                            currentMode="canvas" 
                            trigger={
                                <button className="w-full bg-indigo-600 text-white py-2 rounded text-xs font-bold hover:bg-indigo-700 shadow-sm transition-all flex items-center justify-center gap-2">
                                    <span>📂 Manage Projects</span>
                                </button>
                            }
                        />
                        <div className="text-[9px] text-indigo-400 mt-1 text-center">Save / Load / Merge</div>
                    </div>
                    
                    {currentTab ? (
                        <>  
                            {/* Map Composition */}
                            {currentTab.importHistory && currentTab.importHistory.length > 0 && (
                                <div className="bg-orange-50 p-3 rounded border border-orange-100 animate-in fade-in slide-in-from-left-2">
                                    <label className="text-[10px] font-bold text-orange-400 uppercase flex items-center gap-1 mb-2">🧬 Map Composition</label>
                                    <div className="space-y-1.5">
                                        {currentTab.importHistory.map((record, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border border-orange-100 shadow-sm text-[10px]">
                                                <div className="flex flex-col overflow-hidden">
                                                    <span className="font-bold text-slate-700 truncate">{record.title}</span>
                                                    <span className="text-[9px] text-slate-400">{new Date(record.timestamp).toLocaleTimeString()}</span>
                                                </div>
                                                <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold">+{record.nodeCount}</span>
                                            </div>
                                        ))}
                                        <div className="border-t border-orange-200 mt-2 pt-1 flex justify-between text-[10px] font-bold text-slate-500 px-1">
                                            <span>Total Nodes</span>
                                            <span>{currentTab.nodes.length}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Search */}
                            <div className="bg-slate-50 p-3 rounded border border-slate-200">
                                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-2">🔍 Add Address</label>
                                <div className="flex gap-1"><input value={searchAddr} onChange={e=>setSearchAddr(e.target.value)} className="border p-2 w-full text-xs rounded" placeholder="Address..." /><button onClick={handleSearchAndAdd} className="bg-slate-800 text-white px-2 rounded text-xs">+</button></div>
                            </div>

                            {/* Expandable Notes */}
                            <div className={`flex flex-col transition-all duration-300 ease-in-out ${isNotesExpanded ? 'flex-1 min-h-[300px]' : 'h-40'}`}>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">📝 Notes</label>
                                    <button onClick={() => setIsNotesExpanded(!isNotesExpanded)} className="text-xs text-slate-400 hover:text-indigo-600 px-1 py-0.5 rounded hover:bg-slate-100 transition-colors">{isNotesExpanded ? '✕' : '⤢'}</button>
                                </div>
                                <textarea value={currentTab.notes} onChange={handleNoteChange} className="flex-1 border border-amber-200 rounded p-3 text-xs resize-none bg-amber-50 focus:outline-amber-400 leading-relaxed shadow-inner" placeholder="Analysis notes..." />
                            </div>

                            {/* Clipboard */}
                            <div>
                                <div className="flex justify-between items-end mb-1"><label className="text-[10px] font-bold text-slate-400 uppercase">📋 Clipboard</label><button onClick={() => updateActiveTabData({ clipboard: [] })} className="text-[9px] text-red-400 hover:text-red-600 underline">Clear</button></div>
                                <div className="border border-slate-200 rounded bg-slate-50 h-32 overflow-y-auto p-1 custom-scrollbar">
                                    {currentTab.clipboard.map((item, i) => (
                                        <div key={i} className="group flex justify-between items-center text-[10px] font-mono bg-white border-b border-slate-100 p-2 hover:bg-blue-50">
                                            <span className="truncate w-40 text-slate-600">{item}</span>
                                            <button onClick={() => navigator.clipboard.writeText(item)} className="opacity-0 group-hover:opacity-100 text-blue-600 font-bold">CPY</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : <div className="text-center text-xs text-slate-400 mt-10">No Project Selected</div>}
                </div>
            )}
          </div>

          {/* CENTER CANVAS */}
          <div className="flex-1 flex flex-col relative bg-slate-100 overflow-hidden h-full">
            <div className="flex-1 relative bg-white m-2 rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                
                {/* 탭이 없으면 빈 화면 표시 (버튼 삭제됨) */}
                {(!currentTab || currentTab.nodes.length === 0) ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 select-none bg-white z-10">
                        <div className="text-6xl mb-4 opacity-20">🕸️</div>
                        <div className="text-sm font-bold text-slate-500 mb-2">{!currentTab ? 'No Active Projects' : 'Canvas is Empty'}</div>
                        <div className="text-xs text-slate-400 mt-1">
                            {!currentTab ? "Click '+' below to start" : "Add nodes via sidebar or Load project"}
                        </div>
                    </div>
                ) : (
                    <NetworkGraph 
                        nodes={currentTab.nodes} 
                        links={currentTab.links} 
                        groups={currentTab.groups} 
                        onNodeClick={(n: any) => { addToClipboard(n.id); }} 
                    />
                )}
                
                {currentTab && (
                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded border z-20 shadow-sm pointer-events-none">
                        <h2 className="text-xs font-black">{currentTab.title}</h2>
                        <span className="text-[10px] text-slate-500">{currentTab.nodes.length} Nodes</span>
                    </div>
                )}
                
                <ClusterPanel />
                <DetailPanel />
            </div>
            
            {/* BOTTOM TABS */}
            <div className="h-10 bg-slate-200 border-t border-slate-300 flex items-end px-2 gap-1 overflow-x-auto shrink-0 z-50 relative">
                {tabs.map(tab => (
                    <div key={tab.id} onClick={() => setActiveTab(tab.id)} className={`group relative flex items-center gap-2 px-4 py-2 rounded-t-lg text-xs font-bold cursor-pointer select-none min-w-[120px] max-w-[200px] transition-all ${activeTabId === tab.id ? 'bg-white text-indigo-700 border-t-2 border-indigo-500 h-full mb-0 shadow-sm' : 'bg-slate-300 text-slate-500 h-[85%] hover:bg-slate-100 opacity-80'}`}>
                        <span className="truncate">{tab.title}</span>
                        <button onClick={(e) => { e.stopPropagation(); removeTab(tab.id); }} className="ml-auto w-4 h-4 rounded-full flex items-center justify-center hover:bg-red-100 hover:text-red-500">×</button>
                    </div>
                ))}
                <button onClick={() => addTab()} className="mb-1 ml-1 w-8 h-8 rounded hover:bg-slate-300 text-slate-500 font-bold text-lg flex items-center justify-center z-50 bg-slate-200 hover:bg-white shadow-sm">+</button>
            </div>
          </div>
      </div>
    </div>
  );
};