import { useState, useEffect } from 'react';
import { useGlobalStore } from '../../stores/useGlobalStore';
import { TRANSLATIONS } from '../../constants/lang';
import { generateSTR } from '../../services/openaiService';
import { supabase } from '../../lib/supabaseClient';

type SuspicionType = 'sanction' | 'unreg_vasp' | 'fraud' | 'sexual' | 'gambling' | 'drug';

// [UI Component] 깔끔한 SVG 아이콘들
const Icons = {
  Sanction: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  VASP: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-3m-4 3v-3m12 3v-3m-4 3v-3" /></svg>,
  Fraud: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Warning: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  Camera: () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Close: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
};

export const ReportPanel = () => {
  const { isReportOpen, closeReport, reportTargetTx, language, session } = useGlobalStore();
  const t = TRANSLATIONS[language];

  const [reason, setReason] = useState<SuspicionType | ''>('');
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Evidence States
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [savedSessions, setSavedSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  // Loading Steps State (UI Animation)
  const [loadingStep, setLoadingStep] = useState(0);

  // 1. 초기화 및 세션 목록 로드
  useEffect(() => {
    if (isReportOpen) {
        setReason('');
        setGeneratedText('');
        setIsGenerating(false);
        setScreenshot(null);
        setSelectedSessionId('');
        setLoadingStep(0);
        fetchSavedSessions();
    }
  }, [isReportOpen]);

  const fetchSavedSessions = async () => {
      if (!session?.user) return;
      const { data } = await supabase.from('saved_sessions').select('id, title, created_at').eq('user_id', session.user.id).order('created_at', { ascending: false });
      if (data) setSavedSessions(data);
  };

  if (!isReportOpen || !reportTargetTx) return null;

  // 2. 화면 캡처
  const handleCaptureScreen = () => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
          const imgData = canvas.toDataURL('image/png');
          setScreenshot(imgData);
      } else {
          alert("Screen canvas not found.");
      }
  };

  // 3. 실제 GPT 호출
  const handleGenerate = async () => {
    if (!reason) return alert("Please select a suspicion reason.");
    
    setIsGenerating(true);
    setLoadingStep(1); // 1. 데이터 수집 시작

    // Loading Animation Simulation
    setTimeout(() => setLoadingStep(2), 1000); // 2. 6하 원칙 분석
    setTimeout(() => setLoadingStep(3), 2500); // 3. 보고서 작성 중

    let evidenceSummary = "Attached Evidence:";
    if (screenshot) evidenceSummary += "\n- [Snapshot] Network Graph Screenshot included.";
    if (selectedSessionId) {
        const session = savedSessions.find(s => s.id === selectedSessionId);
        if (session) evidenceSummary += `\n- [Reference Map] Saved Session: "${session.title}" (Date: ${new Date(session.created_at).toLocaleDateString()})`;
    }

    try {
        // [수정] apiKey 없이 호출 (Service 내부에서 처리)
        const report = await generateSTR(reportTargetTx, reason, evidenceSummary);
        setGeneratedText(report);
    } catch (error: any) {
        alert("Report Generation Failed: " + error.message);
    } finally {
        setIsGenerating(false);
        setLoadingStep(0);
    }
  };

  const handleCopy = () => {
      navigator.clipboard.writeText(generatedText);
      alert(t.msg_copied);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-[900px] h-[85vh] rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden font-sans">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-white flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                AI STR Report Generator
            </h3>
            <button onClick={closeReport} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Icons.Close />
            </button>
        </div>

        <div className="flex-1 flex overflow-hidden bg-slate-50">
            {/* Left: Input & Options */}
            <div className="w-5/12 border-r border-slate-200 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar bg-white">
                
                {/* 1. Target Info */}
                <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Target Transaction</label>
                    <div className="bg-slate-50 p-3 rounded border border-slate-200 text-xs space-y-1">
                        <div className="flex justify-between text-slate-600"><span>Date</span> <span className="font-mono">{new Date(reportTargetTx.timestamp).toLocaleDateString()}</span></div>
                        <div className="flex justify-between text-slate-600"><span>Amount</span> <span className="font-bold text-slate-800">{reportTargetTx.amount.toLocaleString()} {reportTargetTx.token}</span></div>
                        <div className="pt-2 mt-2 border-t border-slate-200">
                            <span className="block text-[10px] text-slate-400 mb-0.5">Counterparty Address</span>
                            <div className="font-mono text-[10px] text-blue-600 truncate bg-blue-50 px-2 py-1 rounded">{reportTargetTx.counterparty}</div>
                        </div>
                    </div>
                </div>

                {/* 2. Reason Selector */}
                <div className="space-y-2">
                     <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t.report_step1}</label>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { id: 'sanction', label: "Sanctions", icon: <Icons.Sanction/> },
                            { id: 'unreg_vasp', label: "Unregistered VASP", icon: <Icons.VASP/> },
                            { id: 'fraud', label: "Fraud / Scam", icon: <Icons.Fraud/> },
                            { id: 'sexual', label: "Sexual Crime", icon: <Icons.Warning/> },
                            { id: 'gambling', label: "Illegal Gambling", icon: <Icons.Warning/> },
                            { id: 'drug', label: "Narcotics", icon: <Icons.Warning/> },
                        ].map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setReason(opt.id as SuspicionType)}
                                className={`text-left px-3 py-2.5 rounded border text-xs font-medium transition-all flex items-center gap-2
                                    ${reason === opt.id 
                                        ? 'bg-slate-800 text-white border-slate-800 shadow-md ring-1 ring-slate-800' 
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'}
                                `}
                            >
                                <span className={reason === opt.id ? 'text-white' : 'text-slate-400'}>{opt.icon}</span> 
                                <span className="truncate">{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 3. Evidence Attachment */}
                <div className="pt-4 border-t border-slate-100 space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Evidence</label>
                    
                    {/* (A) Screenshot */}
                    <div>
                        <button onClick={handleCaptureScreen} className="w-full border border-slate-200 rounded p-2 text-xs text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center justify-center gap-2 bg-white mb-2">
                            <Icons.Camera /> Capture Graph Snapshot
                        </button>
                        {screenshot && (
                            <div className="relative group w-full h-24 bg-slate-100 rounded border border-slate-200 overflow-hidden">
                                <img src={screenshot} alt="Evidence" className="w-full h-full object-cover opacity-90" />
                                <button onClick={() => setScreenshot(null)} className="absolute top-1 right-1 bg-slate-900 text-white w-5 h-5 rounded flex items-center justify-center text-[10px] hover:bg-red-600 transition-colors">✕</button>
                                <div className="absolute bottom-0 left-0 right-0 bg-slate-900/70 text-white text-[9px] px-2 py-0.5">Snapshot Attached</div>
                            </div>
                        )}
                    </div>

                    {/* (B) Saved Session */}
                    <div>
                        <select 
                            value={selectedSessionId} 
                            onChange={(e) => setSelectedSessionId(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded p-2 bg-white text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        >
                            <option value="">Select Reference Map (Session)...</option>
                            {savedSessions.map(s => (
                                <option key={s.id} value={s.id}>{s.title}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <button 
                    onClick={handleGenerate}
                    disabled={!reason || isGenerating}
                    className="mt-auto w-full py-3 rounded bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-sm active:scale-[0.99]"
                >
                    {isGenerating ? 'Processing...' : 'Generate Report'}
                </button>
            </div>

            {/* Right: Generated Output (with Fancy Loading) */}
            <div className="w-7/12 p-8 overflow-y-auto bg-slate-50 custom-scrollbar relative">
                
                {/* [UI] Loading State */}
                {isGenerating && (
                    <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
                        <div className="w-64 space-y-6">
                            {/* Animated Bar */}
                            <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-600 animate-[loading-bar_1.5s_infinite_linear]"></div>
                            </div>
                            
                            {/* Steps */}
                            <div className="space-y-3">
                                <LoadingStep step={1} current={loadingStep} text="Collecting Transaction Data..." />
                                <LoadingStep step={2} current={loadingStep} text="Analyzing with 6W1H Principle..." />
                                <LoadingStep step={3} current={loadingStep} text="Drafting STR Narrative..." />
                            </div>
                        </div>
                    </div>
                )}
                
                {generatedText ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 bg-white border border-slate-200 shadow-sm rounded-lg min-h-full flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-white sticky top-0 z-10 rounded-t-lg">
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">STR Draft Preview</h4>
                            <button onClick={handleCopy} className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded hover:bg-slate-200 font-bold transition-colors">
                                Copy Text
                            </button>
                        </div>
                        
                        <div className="p-8 prose prose-sm max-w-none text-slate-700 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                            {generatedText}
                        </div>

                        {/* Screenshot Preview in Report */}
                        {screenshot && (
                            <div className="p-8 pt-0 border-t border-dashed border-slate-200 mt-auto bg-slate-50/50 rounded-b-lg">
                                <h5 className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-wider">[Attachment] Visual Evidence</h5>
                                <div className="border border-slate-200 p-2 bg-white rounded shadow-sm inline-block">
                                    <img src={screenshot} alt="Evidence" className="max-h-[250px] w-auto rounded" />
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    !isGenerating && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 select-none">
                            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-2">
                                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </div>
                            <div className="text-sm font-bold text-slate-400">Ready to Generate</div>
                            <div className="text-xs text-center text-slate-400 max-w-xs leading-relaxed">
                                Select a reason and attach evidence to create an AI-powered Suspicious Transaction Report.
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
      </div>
      <style>{`@keyframes loading-bar { 0% { width: 0%; margin-left: 0; } 50% { width: 50%; margin-left: 25%; } 100% { width: 0%; margin-left: 100%; } }`}</style>
    </div>
  );
};

// [UI Component] Loading Step Indicator
const LoadingStep = ({ step, current, text }: { step: number, current: number, text: string }) => {
    const isActive = step === current;
    const isDone = step < current;
    
    return (
        <div className={`flex items-center gap-3 transition-all duration-300 ${isActive || isDone ? 'opacity-100' : 'opacity-30'}`}>
            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border transition-colors
                ${isDone ? 'bg-indigo-600 border-indigo-600 text-white' : 
                  isActive ? 'border-indigo-600 text-indigo-600 animate-pulse' : 'border-slate-300 text-slate-300'}
            `}>
                {isDone ? '✓' : step}
            </div>
            <span className={`text-xs font-medium ${isActive ? 'text-indigo-700' : 'text-slate-500'}`}>{text}</span>
        </div>
    );
}