import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; // [핵심] Portal 가져오기 (드롭다운 탈출용)
import { useNavigate } from 'react-router-dom'; // [NEW] 라우터 이동용
import { useGlobalStore } from '../../stores/useGlobalStore';
import { useCanvasStore } from '../../stores/useCanvasStore'; // [NEW] 캔버스 스토어
import { supabase } from '../../lib/supabaseClient';

export const SessionManager = ({ currentMode }: { currentMode: string }) => {
  const { saveSession, loadSession, session, language } = useGlobalStore();
  const { importSession } = useCanvasStore(); // [NEW] 캔버스 임포트 함수
  const navigate = useNavigate(); // [NEW] 페이지 이동

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
      .select('id, title, created_at, mode, nodes, links, notes') // nodes, links 등 필요한 데이터 select
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    
    if (!error && data) setSessionList(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) fetchSessions();
  }, [isOpen]);

  const handleSave = async () => {
    if (!titleInput.trim()) return;
    const success = await saveSession(titleInput, currentMode);
    if (success) {
      setTitleInput('');
      fetchSessions(); // 목록 갱신
      alert(language === 'ko' ? "저장되었습니다." : "Session Saved.");
    }
  };

  // 기존 대시보드 로드 (덮어쓰기)
  const handleLoad = async (id: string) => {
    if (confirm(language === 'ko' ? "현재 작업을 덮어쓰고 불러오시겠습니까?" : "Overwrite current workspace?")) {
        await loadSession(id);
        setIsOpen(false);
    }
  };

  // [NEW] 캔버스로 불러오기
  const handleLoadToCanvas = async (sessionData: any, e: React.MouseEvent) => {
    e.stopPropagation(); // 부모 클릭 방지

    // 사용자에게 열기 방식 물어보기
    const isKorean = language === 'ko';
    const msg = isKorean 
        ? `"${sessionData.title}" 맵을 캔버스로 불러옵니다.\n\n[확인] = 현재 캔버스에 병합 (Merge)\n[취소] = 새 탭으로 열기 (New Tab)`
        : `Load "${sessionData.title}" into Canvas.\n\n[OK] = Merge into current canvas\n[Cancel] = Open in new tab`;

    if (window.confirm(msg)) {
        importSession(sessionData, 'merge');
    } else {
        importSession(sessionData, 'new_tab');
    }

    setIsOpen(false); // 모달 닫기
    navigate('/canvas'); // 캔버스 페이지로 이동
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if(confirm(language === 'ko' ? "삭제하시겠습니까?" : "Delete this session?")) {
          await supabase.from('saved_sessions').delete().eq('id', id);
          fetchSessions();
      }
  }

  return (
    <>
      {/* 1. 드롭다운 트리거 버튼 */}
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors flex items-center justify-between group"
      >
        <span className="flex items-center gap-2">💾 {language === 'ko' ? '저장된 세션' : 'Saved Sessions'}</span>
        <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded group-hover:bg-blue-100 group-hover:text-blue-600">Manage</span>
      </button>

      {/* 2. 모달 (Portal 사용) */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
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
               
               {/* Save New Session */}
               <div className="mb-8">
                   <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wider">
                       {language === 'ko' ? '현재 작업 저장' : 'Save Workspace'}
                   </label>
                   <div className="flex gap-2">
                       <input 
                         type="text" 
                         value={titleInput}
                         onChange={(e) => setTitleInput(e.target.value)}
                         placeholder={language === 'ko' ? "세션 이름 (예: OO사건 분석)" : "Session Name..."}
                         className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                         onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                       />
                       <button 
                         onClick={handleSave}
                         disabled={!titleInput.trim()}
                         className="bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-400 text-white px-4 py-2 rounded text-xs font-bold transition-all shadow-sm active:scale-95"
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
                       <div className="flex flex-col items-center justify-center py-8 text-slate-300 gap-2">
                           <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
                           <span className="text-xs">Syncing...</span>
                       </div>
                   ) : sessionList.length === 0 ? (
                       <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                           {language === 'ko' ? '저장된 세션이 없습니다.' : 'No saved sessions found.'}
                       </div>
                   ) : (
                       <div className="space-y-2">
                           {sessionList.map(s => (
                               <div 
                                 key={s.id}
                                 // 기본 클릭: 현재 대시보드에 로드 (기존 기능)
                                 onClick={() => handleLoad(s.id)}
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
                                         <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                       </button>
                                   </div>
                                   
                                   <div className="flex justify-between items-end">
                                       <div className="text-[10px] text-slate-400 flex flex-col gap-0.5">
                                           <span className="font-mono">{new Date(s.created_at).toLocaleDateString()}</span>
                                           <span className="uppercase bg-slate-100 px-1.5 py-0.5 rounded w-fit text-[9px] font-bold tracking-tight text-slate-500 border border-slate-100">
                                               {s.mode} Mode
                                           </span>
                                       </div>

                                       {/* [NEW] Canvas Button */}
                                       <button 
                                           onClick={(e) => handleLoadToCanvas(s, e)}
                                           className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2.5 py-1.5 rounded hover:bg-indigo-100 border border-indigo-100 transition-colors flex items-center gap-1 shadow-sm active:scale-95"
                                       >
                                           <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                           To Canvas
                                       </button>
                                   </div>
                               </div>
                           ))}
                       </div>
                   )}
               </div>
            </div>
          </div>
        </div>,
        document.body // Portal Target
      )}
    </>
  );
};