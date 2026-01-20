import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useGlobalStore } from '../../stores/useGlobalStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { supabase } from '../../lib/supabaseClient';

// [NEW] 어디서든 다른 버튼 모양으로 호출할 수 있게 trigger prop 추가
interface SessionManagerProps {
  currentMode: string;
  trigger?: React.ReactNode; 
}

export const SessionManager = ({ currentMode, trigger }: SessionManagerProps) => {
  const { saveSession, loadSession, session, language, setMode } = useGlobalStore();
  const { importSession } = useCanvasStore(); // Canvas 불러오기 함수

  const [isOpen, setIsOpen] = useState(false);
  const [sessionList, setSessionList] = useState<any[]>([]);
  const [titleInput, setTitleInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 세션 목록 불러오기
  const fetchSessions = async () => {
    if (!session?.user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('saved_sessions')
      .select('id, title, created_at, mode, nodes, links, groups, notes') 
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    
    if (!error && data) setSessionList(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) fetchSessions();
  }, [isOpen]);

  // 저장 핸들러
  const handleSave = async () => {
    if (!titleInput.trim()) return;
    
    // [Canvas 모드일 때 저장 처리]
    // 원래는 여기서 CanvasStore 데이터를 가져와 저장해야 하지만, 
    // 현재 CanvasPanel 내부에서 별도 저장 로직을 쓰고 있으므로, 
    // 이 통합 매니저에서의 저장은 GlobalStore 기준(AutoTrace/Dashboard)으로 동작하게 둡니다.
    // (Canvas에서는 사이드바의 'Save' 버튼을 주력으로 사용)
    const success = await saveSession(titleInput, currentMode);

    if (success) {
      setTitleInput('');
      fetchSessions();
      alert(language === 'ko' ? "저장되었습니다." : "Session Saved.");
    }
  };

  // 리스트 아이템 클릭 핸들러 (통합 로드)
  const handleLoadAction = async (sessionData: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // 1. [Canvas 모드] -> 병합/새탭 선택 (기존 경고창 대신 바로 기능 실행)
    if (currentMode === 'canvas') {
        const msg = language === 'ko' 
            ? `"${sessionData.title}" 불러오기\n\n[확인] = 현재 탭에 병합 (Merge)\n[취소] = 새 탭으로 열기 (New Tab)`
            : `Load "${sessionData.title}"\n\n[OK] = Merge to current\n[Cancel] = Open in new tab`;
        
        if (window.confirm(msg)) {
            importSession(sessionData, 'merge');
        } else {
            importSession(sessionData, 'new_tab');
        }
        setIsOpen(false);
    } 
    // 2. [다른 모드] -> 덮어쓰기 로드
    else {
        const msg = language === 'ko' ? "현재 작업을 덮어쓰고 불러오시겠습니까?" : "Overwrite current workspace?";
        if (confirm(msg)) {
            await loadSession(sessionData.id);
            setIsOpen(false);
        }
    }
  };

  // [To Canvas] 버튼 핸들러
  const handleToCanvas = (sessionData: any, e: React.MouseEvent) => {
      e.stopPropagation();
      const msg = language === 'ko' ? "이 세션을 캔버스로 보내시겠습니까?" : "Send this session to Canvas?";
      
      if (confirm(msg)) {
          importSession(sessionData, 'new_tab'); // 새 탭으로 열기
          setMode('canvas'); // 화면 전환
          setIsOpen(false);
      }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const msg = language === 'ko' ? "삭제하시겠습니까?" : "Delete this session?";
      if(confirm(msg)) {
          await supabase.from('saved_sessions').delete().eq('id', id);
          fetchSessions();
      }
  }

  return (
    <>
      {/* 1. 트리거 (커스텀 버튼 or 기본 메뉴 버튼) */}
      {trigger ? (
          <div onClick={() => setIsOpen(true)}>{trigger}</div>
      ) : (
          <button 
            onClick={() => setIsOpen(true)}
            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors flex items-center justify-between group"
          >
            <span className="flex items-center gap-2">💾 {language === 'ko' ? '저장된 세션' : 'Saved Sessions'}</span>
            <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded group-hover:bg-blue-100 group-hover:text-blue-600">Manage</span>
          </button>
      )}

      {/* 2. 모달 (Portal) */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-[450px] rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  🗂️ {language === 'ko' ? '세션 관리자' : 'Session Manager'}
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 bg-white">
               
               {/* Save Area (Canvas 모드가 아닐 때만 노출하거나, 필요 시 활성화) */}
               {/* Canvas 모드에서는 사이드바 저장이 메인이므로 여기선 숨길 수도 있지만, 일단 유지 */}
               <div className="mb-8">
                   <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wider">
                       {language === 'ko' ? '현재 작업 저장' : 'Save Current Workspace'}
                   </label>
                   <div className="flex gap-2">
                       <input 
                         type="text" 
                         value={titleInput}
                         onChange={(e) => setTitleInput(e.target.value)}
                         placeholder={language === 'ko' ? "프로젝트 이름..." : "Enter project name..."}
                         className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-blue-500 transition-all"
                         onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                       />
                       <button 
                         onClick={handleSave}
                         disabled={!titleInput.trim()}
                         className="bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-400 text-white px-4 py-2 rounded text-xs font-bold shadow-sm active:scale-95 transition-all"
                       >
                         {language === 'ko' ? '저장' : 'Save'}
                       </button>
                   </div>
               </div>

               {/* Load List */}
               <div>
                   <div className="flex justify-between items-end mb-3">
                       <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                           {language === 'ko' ? '불러오기' : 'Load Session'}
                       </label>
                       <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                           Total: {sessionList.length}
                       </span>
                   </div>

                   {isLoading ? (
                       <div className="text-center py-8 text-xs text-slate-400">Syncing...</div>
                   ) : sessionList.length === 0 ? (
                       <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                           {language === 'ko' ? '저장된 세션이 없습니다.' : 'No saved sessions found.'}
                       </div>
                   ) : (
                       <div className="space-y-2">
                           {sessionList.map(s => (
                               <div 
                                 key={s.id}
                                 onClick={() => handleLoadAction(s)}
                                 className="relative flex flex-col p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all group bg-white"
                               >
                                   <div className="flex justify-between items-start mb-2">
                                       <div className="font-bold text-sm text-slate-700 group-hover:text-blue-700 truncate pr-8">
                                           {s.title}
                                       </div>
                                       <button 
                                         onClick={(e) => handleDelete(s.id, e)}
                                         className="absolute top-2 right-2 text-slate-300 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors"
                                         title="Delete"
                                       >
                                         🗑️
                                       </button>
                                   </div>
                                   
                                   <div className="flex justify-between items-end">
                                       <div className="text-[10px] text-slate-400 flex flex-col gap-0.5">
                                           <span className="font-mono">{new Date(s.created_at).toLocaleDateString()}</span>
                                           <span className="uppercase bg-slate-100 px-1.5 py-0.5 rounded w-fit text-[9px] font-bold tracking-tight text-slate-500 border border-slate-100">
                                               {s.mode} Mode
                                           </span>
                                       </div>

                                       {/* 캔버스 모드가 아닐 때만 'To Canvas' 버튼 표시 (캔버스에선 리스트 클릭이 곧 로드임) */}
                                       {currentMode !== 'canvas' && (
                                           <button 
                                               onClick={(e) => handleToCanvas(s, e)}
                                               className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2.5 py-1.5 rounded hover:bg-indigo-100 border border-indigo-100 transition-colors flex items-center gap-1 shadow-sm active:scale-95"
                                           >
                                               To Canvas ↗
                                           </button>
                                       )}
                                   </div>
                               </div>
                           ))}
                       </div>
                   )}
               </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};