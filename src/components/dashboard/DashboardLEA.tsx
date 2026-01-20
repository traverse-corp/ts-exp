import React, { useEffect, useState } from 'react';
import { useGlobalStore } from '../../stores/useGlobalStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { supabase } from '../../lib/supabaseClient';
import { TRANSLATIONS } from '../../constants/lang'; // 다국어 불러오기

export const DashboardLEA = () => {
  const { session, setMode, language } = useGlobalStore();
  const { importSession } = useCanvasStore();
  const t = TRANSLATIONS[language]; // 언어 설정 적용
  
  const [cases, setCases] = useState<any[]>([]);
  const [threats, setThreats] = useState<any[]>([]);
  const [targets, setTargets] = useState<string[]>([]);

  useEffect(() => {
    if (!session?.user) return;

    const fetchCases = async () => {
        const { data } = await supabase
            .from('saved_sessions')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })
            .limit(6); 
        if (data) setCases(data);
    };

    setTargets(['0x7a2...3f1 (DarkWeb)', 'TRc9...21a (Sanction)', '0x881...bba (Scam)']);
    setThreats([
        { id: 1, time: '10:42:01', target: '0x7a2...3f1', action: 'Deposit', entity: 'Binance', amount: '50.2 ETH', risk: 'Critical' },
        { id: 2, time: '10:40:15', target: 'TRc9...21a', action: 'Swap', entity: 'Tornado', amount: '100,000 USDT', risk: 'High' },
        { id: 3, time: '09:12:33', target: '0x881...bba', action: 'Bridge', entity: 'RenBridge', amount: '2.5 BTC', risk: 'Medium' },
        { id: 4, time: '08:55:10', target: '0x7a2...3f1', action: 'Transfer', entity: 'Unknown', amount: '10 ETH', risk: 'Low' },
    ]);

    fetchCases();
  }, [session]);

  const handleLoadCase = (caseData: any) => {
      const msg = language === 'ko' ? `"${caseData.title}" 케이스를 여시겠습니까?` : `Open Case "${caseData.title}" in Canvas?`;
      if (confirm(msg)) {
          importSession(caseData, 'new_tab');
          setMode('canvas');
      }
  };

  return (
    // [수정] pt-24를 추가하여 상단 헤더와의 겹침 해결
    <div className="h-full w-full bg-slate-50 p-6 pt-24 overflow-y-auto custom-scrollbar flex flex-col gap-6">
      
      {/* 1. Header Area */}
      <div className="flex justify-between items-end">
        <div>
            <div className="flex items-center gap-2 mb-1">
                <span className="bg-blue-900 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                    {t.lea_title}
                </span>
                <span className="text-xs text-slate-400 font-mono">{session?.user.email}</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                TranSight <span className="text-blue-600">L.E.A</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">{t.lea_subtitle}</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setMode('canvas')} className="bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 px-4 py-2.5 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-2">
                <span>📂 {t.btn_case_manager}</span>
            </button>
            <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold shadow-md transition-all flex items-center gap-2 animate-pulse">
                <span>{t.btn_iaan_request}</span>
            </button>
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{t.kpi_active_cases}</div>
            <div className="text-3xl font-black text-slate-800">{cases.length}</div>
            <div className="text-[10px] text-slate-400 mt-2">{t.kpi_running_investigations}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{t.kpi_target_watchlist}</div>
            <div className="text-3xl font-black text-blue-600">{targets.length}</div>
            <div className="text-[10px] text-slate-400 mt-2">{t.kpi_monitored}</div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-white p-5 rounded-xl border border-red-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
            <div className="absolute right-2 top-2 text-red-100 text-6xl">🚨</div>
            <div className="text-[10px] font-bold text-red-500 uppercase mb-1 relative z-10">{t.kpi_threat_alerts}</div>
            <div className="text-3xl font-black text-red-600 relative z-10">{threats.length}</div>
            <div className="text-[10px] text-red-400 mt-2 relative z-10">{t.kpi_realtime_detect}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{t.kpi_evidence}</div>
            <div className="text-3xl font-black text-slate-800">124</div>
            <div className="text-[10px] text-slate-400 mt-2">{t.kpi_tagged_tx}</div>
        </div>
      </div>

      {/* 3. Main Split View */}
      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* Left: Threat Detection Feed */}
        <div className="col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    {t.sec_threat_feed}
                </h3>
                <button className="text-[10px] text-blue-600 hover:underline font-bold">{t.btn_view_all_bb}</button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase sticky top-0 z-10">
                        <tr>
                            <th className="p-3 pl-4">{t.col_time}</th>
                            <th className="p-3">{t.col_risk}</th>
                            <th className="p-3">{t.col_target}</th>
                            <th className="p-3">{t.col_action}</th>
                            <th className="p-3 text-right pr-4">{t.col_analysis}</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs text-slate-600 divide-y divide-slate-100">
                        {threats.map((t_item) => (
                            <tr key={t_item.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="p-3 pl-4 font-mono text-slate-400">{t_item.time}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${t_item.risk === 'Critical' ? 'bg-red-100 text-red-600' : t_item.risk === 'High' ? 'bg-orange-100 text-orange-600' : 'bg-yellow-100 text-yellow-600'}`}>
                                        {t_item.risk}
                                    </span>
                                </td>
                                <td className="p-3">
                                    <div className="font-bold text-slate-700">{t_item.target.split(' ')[0]}</div>
                                    <div className="text-[9px] text-slate-400">{t_item.target.split(' ')[1] || 'Unknown'}</div>
                                </td>
                                <td className="p-3">
                                    <div className="font-bold text-slate-800">{t_item.action} via {t_item.entity}</div>
                                    <div className="text-[10px] text-slate-500 font-mono">{t_item.amount}</div>
                                </td>
                                <td className="p-3 text-right pr-4">
                                    <button className="text-[10px] bg-white border border-slate-300 text-slate-600 px-2 py-1 rounded hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors font-bold shadow-sm">
                                        {t.btn_trace} ↗
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {threats.length < 5 && <tr className="h-20"><td colSpan={5} className="text-center text-xs text-slate-300">{t.msg_scanning}</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Right: Case Files */}
        <div className="col-span-5 flex flex-col gap-6">
            {/* Recent Cases */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">🗂️ {t.sec_recent_cases}</h3>
                    <button onClick={() => setMode('canvas')} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded font-bold hover:bg-indigo-100">{t.btn_new_case}</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    {cases.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                            <span className="text-2xl opacity-20">📁</span>
                            <span>{t.msg_no_cases}</span>
                        </div>
                    ) : (
                        cases.map(c => (
                            <div key={c.id} onClick={() => handleLoadCase(c)} className="border border-slate-100 rounded-lg p-3 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer group bg-white shadow-sm hover:shadow-md">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="font-bold text-slate-800 group-hover:text-indigo-700">{c.title}</div>
                                    <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{new Date(c.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="flex gap-2 text-[10px] text-slate-500 items-center">
                                    <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{c.nodes?.length || 0} Nodes</span>
                                    <span className="text-slate-300">|</span>
                                    <span className="truncate max-w-[150px]">{c.notes ? t.lbl_has_notes : t.lbl_no_notes}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Target Watchlist Mini */}
            <div className="h-40 bg-slate-800 rounded-xl border border-slate-700 shadow-sm flex flex-col overflow-hidden text-white p-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-xs uppercase text-slate-400">{t.sec_watchlist_mini}</h3>
                    <span className="text-[10px] bg-slate-700 px-1.5 rounded text-slate-300">{targets.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                    {targets.map((t_target, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-700/50 last:border-0">
                            <span className="font-mono text-blue-300">{t_target.split(' ')[0]}</span>
                            <span className="text-slate-400 text-[10px]">{t_target.split(' ')[1] || 'Unknown'}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};