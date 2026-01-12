import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; // [핵심] Portal 가져오기
import { useGlobalStore } from '../../stores/useGlobalStore';
import { supabase } from '../../lib/supabaseClient';

export const SessionManager = ({ currentMode }: { currentMode: string }) => {
  const { saveSession, loadSession, session, language } = useGlobalStore();
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
      .select('id, title, created_at, mode')
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

  const handleLoad = async (id: string) => {
    if (confirm(language === 'ko' ? "현재 작업을 덮어쓰고 불러오시겠습니까?" : "Overwrite current workspace?")) {
        await loadSession(id);
        setIsOpen(false);
    }
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
      {/* 1. 드롭다운 내부에 위치할 버튼 (스타일링 맞춤) */}
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors flex items-center justify-between group"
      >
        <span className="flex items-center gap-2">💾 {language === 'ko' ? '저장된 세션' : 'Saved Sessions'}</span>
        <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded group-hover:bg-blue-100 group-hover:text-blue-600">Manage</span>
      </button>

      {/* 2. 모달 (Portal을 이용해 드롭다운 탈출!) */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-[400px] rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">
                  {language === 'ko' ? '🗂️ 세션 관리자' : '🗂️ Session Manager'}
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
               
               {/* Save New */}
               <div className="mb-6">
                   <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                       {language === 'ko' ? '현재 상태 저장' : 'Save Current State'}
                   </label>
                   <div className="flex gap-2">
                       <input 
                         type="text" 
                         value={titleInput}
                         onChange={(e) => setTitleInput(e.target.value)}
                         placeholder={language === 'ko' ? "세션 이름 입력..." : "Enter session name..."}
                         className="flex-1 border border-slate-200 rounded px-3 py-1.5 text-sm focus:outline-blue-500"
                         onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                       />
                       <button 
                         onClick={handleSave}
                         disabled={!titleInput.trim()}
                         className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors"
                       >
                         {language === 'ko' ? '저장' : 'Save'}
                       </button>
                   </div>
               </div>

               {/* Load List */}
               <div>
                   <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">
                       {language === 'ko' ? '불러오기' : 'Load Session'}
                   </label>
                   {isLoading ? (
                       <div className="text-center py-4 text-xs text-slate-400">Loading...</div>
                   ) : sessionList.length === 0 ? (
                       <div className="text-center py-4 text-xs text-slate-400 bg-slate-50 rounded border border-dashed border-slate-200">
                           {language === 'ko' ? '저장된 세션이 없습니다.' : 'No saved sessions.'}
                       </div>
                   ) : (
                       <div className="space-y-2">
                           {sessionList.map(s => (
                               <div 
                                 key={s.id}
                                 onClick={() => handleLoad(s.id)}
                                 className="flex items-center justify-between p-3 rounded border border-slate-100 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all group"
                               >
                                   <div>
                                       <div className="font-bold text-sm text-slate-700 group-hover:text-blue-700">{s.title}</div>
                                       <div className="text-[10px] text-slate-400 flex gap-2">
                                           <span>{new Date(s.created_at).toLocaleDateString()}</span>
                                           <span className="uppercase bg-slate-100 px-1 rounded">{s.mode}</span>
                                       </div>
                                   </div>
                                   <button 
                                     onClick={(e) => handleDelete(s.id, e)}
                                     className="text-slate-300 hover:text-red-500 p-1 rounded transition-colors"
                                     title="Delete"
                                   >
                                     🗑️
                                   </button>
                               </div>
                           ))}
                       </div>
                   )}
               </div>
            </div>
          </div>
        </div>,
        document.body // [핵심] 모달을 body 태그 바로 아래에 렌더링
      )}
    </>
  );
};