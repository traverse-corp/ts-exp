import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCanvasStore } from '../stores/useCanvasStore';
import { useGlobalStore } from '../stores/useGlobalStore';
import  NetworkGraph  from '../components/graph/NetworkGraph'; 
import { supabase } from '../lib/supabaseClient';
import { SessionManager } from '../components/dashboard/SessionManager'; // 우측 상단 메뉴용

export const CanvasPage = () => {
  const navigate = useNavigate();
  
  // --- Stores ---
  const { 
    tabs, activeTabId, 
    addTab, removeTab, setActiveTab, updateActiveTabData, addNodesToActiveTab,
    importSession 
  } = useCanvasStore();
  
  const { 
    session, signOut, language, setLanguage 
  } = useGlobalStore();

  // --- Local State ---
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [searchAddr, setSearchAddr] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Canvas 전용 Load Modal (사이드바 버튼용)
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [savedFiles, setSavedFiles] = useState<any[]>([]);

  // User Menu Dropdown State
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // 현재 탭
  const activeTab = tabs.find(t => t.id === activeTabId);

  // --- Handlers: User Menu ---
  const toggleLanguage = () => {
      setLanguage(language === 'ko' ? 'en' : 'ko');
  };

  // --- Handlers: Canvas Actions ---
  const handleSaveToDB = async () => {
      if (!activeTab || !session?.user) return;
      const saveName = prompt("저장할 프로젝트 이름을 입력하세요:", activeTab.title);
      if (!saveName) return;

      try {
          const { error } = await supabase.from('saved_sessions').insert({
              user_id: session.user.id,
              title: saveName,
              mode: 'canvas', 
              nodes: activeTab.nodes,
              links: activeTab.links,
              notes: activeTab.notes,
          });
          if (error) throw error;
          alert("✅ Saved to Cloud successfully.");
          updateActiveTabData({ title: saveName });
      } catch (e: any) {
          alert("Save failed: " + e.message);
      }
  };

  const fetchSavedFiles = async () => {
      if (!session?.user) return;
      const { data } = await supabase
          .from('saved_sessions')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('mode', 'canvas')
          .order('created_at', { ascending: false });
      if (data) setSavedFiles(data);
      setIsLoadModalOpen(true);
  };

  const handleLoadFile = (file: any, mode: 'merge' | 'new') => {
      importSession({
          id: file.id,
          title: file.title,
          nodes: file.nodes,
          links: file.links,
          notes: file.notes
      }, mode === 'new' ? 'new_tab' : 'merge');
      setIsLoadModalOpen(false);
  };

  const handleSearchAndAdd = async () => {
      if (!searchAddr || !activeTab) return;
      setIsSearching(true);
      // Mockup Logic: 실제로는 API 호출 필요
      setTimeout(() => {
          const newNode = { 
              id: searchAddr, 
              label: searchAddr.slice(0,6), 
              type: 'wallet',
              groupId: 'manual_search' 
          };
          addNodesToActiveTab([newNode], []);
          setSearchAddr('');
          setIsSearching(false);
      }, 500);
  };

  const handleNodeExpand = (nodeId: string) => {
      // Mockup Expand
      const mockNewNode = { id: `T_${Math.random().toString(36).substr(2,5)}`, label: 'New', type: 'wallet' };
      const mockLink = { source: nodeId, target: mockNewNode.id, value: 50 };
      addNodesToActiveTab([mockNewNode], [mockLink]);
  };

  const handleNoteChange = (e: any) => {
      updateActiveTabData({ notes: e.target.value });
  };

  const addToClipboard = (text: string) => {
      if (activeTab && !activeTab.clipboard.includes(text)) {
          updateActiveTabData({ clipboard: [text, ...activeTab.clipboard] });
      }
  };

  // 초기 진입 시 탭 생성
  useEffect(() => {
      if (tabs.length === 0) addTab('Untitled Project');
  }, []);

  if (!activeTab) return <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-400">Initializing Workspace...</div>;

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 font-sans overflow-hidden">
      
      {/* ==================================================================================== */}
      {/* 1. HEADER (Global Navigation) */}
      {/* ==================================================================================== */}
      <header className="h-14 bg-white border-b border-slate-200 flex justify-between items-center px-4 z-50 shadow-sm flex-shrink-0">
          
          {/* Left: Exit Button */}
          <div className="flex items-center gap-4">
              <button 
                  onClick={() => navigate('/')}
                  className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-3 py-2 rounded-lg transition-all"
              >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  Exit Canvas
              </button>
              <div className="h-4 w-[1px] bg-slate-300 mx-2"></div>
              <h1 className="text-sm font-black text-indigo-700 tracking-tight flex items-center gap-2">
                  TranSight <span className="text-slate-400 font-light">Canvas</span>
              </h1>
          </div>

          {/* Right: User Menu (Same as Dashboard) */}
          <div className="relative">
            <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 hover:bg-slate-50 px-3 py-1.5 rounded-full transition-all border border-transparent hover:border-slate-200"
            >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                    {session?.user?.email?.[0].toUpperCase() || 'G'}
                </div>
                <div className="text-right hidden sm:block">
                    <div className="text-xs font-bold text-slate-700 leading-none">
                        {session?.user?.email?.split('@')[0]}
                    </div>
                    <div className="text-[9px] text-slate-400 leading-none mt-0.5">Analyst</div>
                </div>
                <span className="text-[10px] text-slate-400">▼</span>
            </button>

            {/* Dropdown */}
            {isUserMenuOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)}></div>
                    <div className="absolute top-full right-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                            <div className="text-xs font-bold text-slate-800">Account</div>
                            <div className="text-[10px] text-slate-500 font-mono truncate">{session?.user?.email}</div>
                        </div>
                        <div className="p-1">
                            <button onClick={() => { toggleLanguage(); setIsUserMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors flex items-center justify-between group">
                                <span>🌐 Language</span>
                                <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] group-hover:bg-blue-100 group-hover:text-blue-600">
                                    {language === 'ko' ? '한국어' : 'English'}
                                </span>
                            </button>
                            <div className="border-t border-slate-100 my-1"></div>
                            
                            {/* [Unified Session Manager] */}
                            <div className="py-1">
                                <SessionManager currentMode="canvas" />
                            </div>
                            
                            <div className="border-t border-slate-100 my-1"></div>
                            <button onClick={() => { signOut(); setIsUserMenuOpen(false); navigate('/'); }} className="w-full text-left px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2">
                                Sign Out
                            </button>
                        </div>
                    </div>
                </>
            )}
          </div>
      </header>

      {/* ==================================================================================== */}
      {/* 2. BODY (Sidebar + Canvas) */}
      {/* ==================================================================================== */}
      <div className="flex-1 flex overflow-hidden">
          
          {/* --- LEFT SIDEBAR (TOOLS) --- */}
          <div className={`bg-white border-r border-slate-200 transition-all duration-300 flex flex-col shadow-lg z-20 ${isSidebarOpen ? 'w-80' : 'w-12'}`}>
            <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                {isSidebarOpen && <span className="font-extrabold text-slate-700 text-xs flex items-center gap-2">🛠️ ANALYST TOOLS</span>}
                <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="text-slate-400 hover:text-indigo-600 transition-colors">{isSidebarOpen ? '◀' : '▶'}</button>
            </div>

            {isSidebarOpen && (
                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                    
                    {/* [Section] File Management (Canvas Native) */}
                    <div className="bg-indigo-50 p-3 rounded border border-indigo-100">
                        <label className="text-[10px] font-bold text-indigo-400 uppercase flex items-center gap-1 mb-2">💾 Project Files</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={handleSaveToDB} className="bg-white text-indigo-700 border border-indigo-200 px-3 py-2 rounded text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center justify-center gap-1">
                                <span>☁️ Save</span>
                            </button>
                            <button onClick={fetchSavedFiles} className="bg-indigo-600 text-white px-3 py-2 rounded text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm flex items-center justify-center gap-1">
                                <span>📂 Load</span>
                            </button>
                        </div>
                    </div>

                    {/* [Section] Search */}
                    <div className="bg-slate-50 p-3 rounded border border-slate-200">
                        <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-2">🔍 Add Address</label>
                        <div className="flex gap-1">
                            <input type="text" value={searchAddr} onChange={(e) => setSearchAddr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchAndAdd()} className="w-full text-xs border border-slate-300 rounded p-2 focus:outline-blue-500 font-mono" placeholder="Target Address..." />
                            <button onClick={handleSearchAndAdd} disabled={isSearching} className="bg-slate-800 text-white px-3 rounded text-xs font-bold hover:bg-slate-900 disabled:bg-slate-400">{isSearching ? '...' : '+'}</button>
                        </div>
                    </div>

                    {/* [Section] Layers */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">🗺️ Active Layers</label>
                        <div className="space-y-1.5">
                            {activeTab.groups.map((group, idx) => (
                                <div key={group.id + idx} className="flex items-center gap-2 text-xs bg-white border border-slate-100 p-2 rounded shadow-sm">
                                    <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: group.color }}></span>
                                    <span className="truncate font-medium text-slate-700">{group.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* [Section] Notepad */}
                    <div className="flex flex-col h-64">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">📝 Notes</label>
                        <textarea className="flex-1 border border-amber-200 rounded p-3 text-xs resize-none focus:outline-amber-400 bg-amber-50 text-slate-700 leading-relaxed shadow-inner" value={activeTab.notes} onChange={handleNoteChange} placeholder="Write analysis notes..." />
                    </div>

                    {/* [Section] Clipboard */}
                    <div>
                        <div className="flex justify-between items-end mb-1"><label className="text-[10px] font-bold text-slate-400 uppercase">📋 Clipboard</label><button onClick={() => updateActiveTabData({ clipboard: [] })} className="text-[9px] text-red-400 hover:text-red-600 underline">Clear</button></div>
                        <div className="border border-slate-200 rounded bg-slate-50 min-h-[120px] max-h-[200px] overflow-y-auto p-1 custom-scrollbar">
                            {activeTab.clipboard.map((item, i) => (
                                <div key={i} className="group flex justify-between items-center text-[10px] font-mono bg-white border-b border-slate-100 p-2 hover:bg-blue-50">
                                    <span className="truncate w-40 text-slate-600">{item}</span>
                                    <button onClick={() => navigator.clipboard.writeText(item)} className="opacity-0 group-hover:opacity-100 text-blue-600 font-bold">CPY</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
          </div>

          {/* --- CENTER (GRAPH & TABS) --- */}
          <div className="flex-1 flex flex-col relative bg-slate-100 overflow-hidden">
            
            {/* Graph Area */}
            <div className="flex-1 relative bg-white m-2 rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                {activeTab.nodes.length > 0 ? (
                    <NetworkGraph 
                        nodes={activeTab.nodes} 
                        links={activeTab.links} 
                        groups={activeTab.groups} 
                        onNodeClick={(n: any) => { handleNodeExpand(n.id); addToClipboard(n.id); }} 
                    />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 select-none">
                        <div className="text-6xl mb-4 opacity-30 grayscale">🕸️</div>
                        <div className="text-sm font-bold">Canvas is Empty</div>
                        <div className="text-xs mt-1 opacity-60">Use tools on the left to start</div>
                    </div>
                )}
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-sm border border-slate-200 z-10 pointer-events-none">
                    <h2 className="text-sm font-black text-slate-800">{activeTab.title}</h2>
                    <span className="text-[10px] text-slate-500">{activeTab.nodes.length} Nodes • {activeTab.links.length} Links</span>
                </div>
            </div>
            
            {/* Bottom Tabs */}
            <div className="h-10 bg-slate-200 border-t border-slate-300 flex items-end px-2 gap-1 overflow-x-auto custom-scrollbar flex-shrink-0">
                {tabs.map(tab => (
                    <div key={tab.id} onClick={() => setActiveTab(tab.id)} className={`group relative flex items-center gap-2 px-4 py-2 rounded-t-lg text-xs font-bold cursor-pointer select-none transition-all min-w-[120px] max-w-[200px] ${activeTabId === tab.id ? 'bg-white text-indigo-700 shadow-[0_-2px_5px_rgba(0,0,0,0.05)] h-full mb-0 border-t-2 border-indigo-500' : 'bg-slate-300 text-slate-500 hover:bg-slate-100 h-[85%] mb-0 opacity-80'}`}>
                        <span className="truncate">{tab.title}</span>
                        <button onClick={(e) => { e.stopPropagation(); removeTab(tab.id); }} className={`ml-auto w-4 h-4 rounded-full flex items-center justify-center hover:bg-red-100 hover:text-red-500 transition-colors ${activeTabId === tab.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>×</button>
                    </div>
                ))}
                <button onClick={() => addTab()} className="mb-1 ml-1 w-8 h-8 rounded hover:bg-slate-300 text-slate-500 font-bold text-lg flex items-center justify-center transition-colors">+</button>
            </div>
          </div>
      </div>

      {/* ==================================================================================== */}
      {/* 3. MODALS (Load Canvas Specific) */}
      {/* ==================================================================================== */}
      {isLoadModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white w-[500px] max-h-[80vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-slate-800">📂 Load Saved Project</h3>
                      <button onClick={() => setIsLoadModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                  </div>
                  <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-2">
                      {savedFiles.length === 0 ? (
                          <div className="text-center py-8 text-slate-400 text-xs">No saved canvas files found.</div>
                      ) : (
                          savedFiles.map(file => (
                              <div key={file.id} className="border border-slate-200 rounded p-3 hover:border-indigo-300 hover:bg-indigo-50 transition-all group bg-white">
                                  <div className="flex justify-between mb-2">
                                      <span className="font-bold text-slate-700 text-sm">{file.title}</span>
                                      <span className="text-[10px] text-slate-400">{new Date(file.created_at).toLocaleDateString()}</span>
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                      <button onClick={() => handleLoadFile(file, 'merge')} className="text-[10px] bg-white border border-slate-300 px-2 py-1 rounded hover:bg-slate-100 font-medium">Add to Current Map</button>
                                      <button onClick={() => handleLoadFile(file, 'new')} className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 font-bold shadow-sm">Open in New Tab</button>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};