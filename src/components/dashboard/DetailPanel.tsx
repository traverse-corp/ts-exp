import { useEffect, useState } from 'react';
import { useGlobalStore } from '../../stores/useGlobalStore';
import { fetchAccountDetail, fetchRecentHistory, type AccountDetail, type CleanTx } from '../../services/tronScanner';
import { checkAddressesRisk } from '../../services/riskChecker';
import { RequestModal } from './RequestModal';
import { TRANSLATIONS } from '../../constants/lang'; // Import

export const DetailPanel = () => {
  const { selectedNode, selectedLink, setSelectedNode, setSelectedLink, removeNode, updateNode, addNodes, language } = useGlobalStore();
  const t = TRANSLATIONS[language]; // 딕셔너리

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [accountInfo, setAccountInfo] = useState<AccountDetail | null>(null);
  const [history, setHistory] = useState<(CleanTx & { riskLabel?: string })[]>([]);
  const [nodeLoading, setNodeLoading] = useState(false);
  const [memoInput, setMemoInput] = useState('');
  const [colorInput, setColorInput] = useState('#22c55e');
  
  const [linkTransactions, setLinkTransactions] = useState<CleanTx[]>([]);
  const [linkTotalUSDT, setLinkTotalUSDT] = useState(0);
  const [linkTotalTRX, setLinkTotalTRX] = useState(0);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  const handleClose = () => {
    setSelectedNode(null);
    setSelectedLink(null);
  };

  useEffect(() => {
    if (selectedNode) {
      setAccountInfo(null);
      setHistory([]);
      setNodeLoading(true);

      setMemoInput(selectedNode.memo || '');
      setColorInput(selectedNode.customColor || (selectedNode.group === 'risk' ? '#ef4444' : selectedNode.group === 'exchange' ? '#3b82f6' : '#22c55e'));
      
      Promise.all([
          fetchAccountDetail(selectedNode.id),
          fetchRecentHistory(selectedNode.id)
      ]).then(async ([info, txs]) => {
        setAccountInfo(info);
        const inAddresses = txs.filter(tx => tx.receiver === selectedNode.id).map(tx => tx.sender);
        const riskMap = await checkAddressesRisk(inAddresses);
        const enrichedTxs = txs.map(tx => {
           if (tx.receiver === selectedNode.id) {
               const risk = riskMap.get(tx.sender);
               return { ...tx, riskLabel: risk?.label };
           }
           return tx;
        });
        setHistory(enrichedTxs);
        setNodeLoading(false);
      });
    }
  }, [selectedNode?.id]);

  useEffect(() => {
      if (selectedLink) {
          setLinkTransactions([]);
          setLinkTotalUSDT(0);
          setLinkTotalTRX(0);

          const txs: CleanTx[] = (selectedLink as any).txDetails || [];
          setLinkTransactions(txs);
          
          setLinkTotalUSDT(txs.filter(tx => tx.token === 'USDT').reduce((acc, cur) => acc + cur.amount, 0));
          setLinkTotalTRX(txs.filter(tx => tx.token === 'TRX').reduce((acc, cur) => acc + cur.amount, 0));
      }
  }, [selectedLink]);

  const handleSaveMemo = () => {
    if (selectedNode) {
      updateNode(selectedNode.id, { memo: memoInput });
      showToast(t.toast_memo_saved);
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setColorInput(newColor);
    if (selectedNode) updateNode(selectedNode.id, { customColor: newColor });
  };

  const handleCopy = (text: string, label: string) => {
      navigator.clipboard.writeText(text);
      showToast(`${label} ${t.toast_copied}`);
  };

  const handleAddFromHistory = (address: string) => {
      addNodes([{
          id: address,
          group: 'target',
          val: 10,
          isTerminal: false,
          createdAt: Date.now()
      }]);
      showToast(t.toast_trace_started);
  };

  const Skeleton = ({ className }: { className: string }) => (
      <div className={`bg-slate-200 animate-pulse rounded ${className}`}></div>
  );

  if (!selectedNode && !selectedLink) return null;

  return (
    <>
    {toastMsg && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-full shadow-lg text-sm z-[70] animate-fade-in-up pointer-events-none">
            {toastMsg}
        </div>
    )}

    {selectedNode && (
        <RequestModal 
            isOpen={isRequestModalOpen}
            onClose={() => setIsRequestModalOpen(false)}
            node={selectedNode}
            history={history}
            showToast={showToast}
        />
    )}

    <div className="absolute right-4 top-16 bottom-4 w-[420px] bg-white/95 backdrop-blur-md border border-slate-300 shadow-2xl rounded-xl z-[60] flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-white shadow-sm z-10 space-y-3">
        <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            {selectedNode ? t.inspector_node : t.inspector_link}
            </h2>
            <div className="flex gap-2">
                {selectedNode && (
                    <button 
                        onClick={() => { if(confirm(t.confirm_delete_node)) { removeNode(selectedNode.id); handleClose(); } }}
                        className="text-xs text-red-500 hover:bg-red-50 border border-red-200 px-3 py-1.5 rounded transition-colors font-bold"
                    >
                        {t.btn_delete}
                    </button>
                )}
                <button onClick={handleClose} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded text-xs font-bold transition-colors">
                    {t.btn_close} ✕
                </button>
            </div>
        </div>

        {selectedNode && (
            <button 
                onClick={() => setIsRequestModalOpen(true)}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
            >
                <span>{t.btn_req_coop}</span>
            </button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/50">
        
        {/* CASE 1: 노드 정보 */}
        {selectedNode ? (
            <div className="space-y-6">
                {selectedNode.label && selectedNode.isTerminal && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100 shadow-sm">
                        <div className="text-[10px] text-blue-500 uppercase font-bold mb-1">{t.label_identified}</div>
                        <div className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <span>🏢 {selectedNode.label}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full text-white ${selectedNode.group === 'exchange' ? 'bg-blue-500' : 'bg-red-500'}`}>
                                {selectedNode.group.toUpperCase()}
                            </span>
                        </div>
                    </div>
                )}
                
                <div className="flex gap-2 items-end bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex-1">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">{t.label_memo}</label>
                        <div className="flex gap-1 mt-1">
                            <input 
                                type="text" value={memoInput} onChange={e => setMemoInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveMemo()}
                                className="flex-1 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 text-sm focus:border-yellow-500 outline-none" placeholder={t.placeholder_tag}
                            />
                            <button onClick={handleSaveMemo} className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-2 rounded text-xs font-bold">{t.btn_save}</button>
                        </div>
                    </div>
                    <div className="flex flex-col items-center">
                        <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">{t.label_color}</label>
                        <input type="color" value={colorInput} onChange={handleColorChange} className="w-8 h-8 rounded cursor-pointer border-0 p-0 shadow-sm" />
                    </div>
                </div>

                <div>
                   <div className="text-xs text-slate-500 uppercase font-bold mb-1 ml-1">{t.label_address}</div>
                   <div onClick={() => handleCopy(selectedNode.id, "Address")} className="text-sm font-mono break-all text-blue-600 cursor-pointer hover:bg-white bg-white p-3 rounded-lg border border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-blue-300" title="Click to copy">
                     {selectedNode.id}
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                        <div className="text-[10px] text-green-600 uppercase font-bold mb-1">{t.bal_usdt}</div>
                        <div className="text-lg font-bold text-slate-800 truncate h-7 flex items-center">
                            {nodeLoading || !accountInfo ? <Skeleton className="w-24 h-5" /> : (
                                <span>{accountInfo.balance_usdt.toLocaleString()} <span className="text-xs text-slate-400 font-normal">$</span></span>
                            )}
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                        <div className="text-[10px] text-blue-600 uppercase font-bold mb-1">{t.bal_trx}</div>
                        <div className="text-lg font-bold text-slate-800 truncate h-7 flex items-center">
                            {nodeLoading || !accountInfo ? <Skeleton className="w-24 h-5" /> : (
                                <span>{accountInfo.balance_trx.toLocaleString()}</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                   <h3 className="text-xs font-bold text-slate-700 p-3 border-b border-slate-100 flex justify-between bg-slate-50">
                       <span>{t.recent_tx}</span>
                       <span className="font-normal text-slate-400">
                           {nodeLoading ? t.loading : `${history.length} ${t.items}`}
                       </span>
                   </h3>
                   <div className="max-h-80 overflow-y-auto min-h-[100px]">
                      {nodeLoading ? (
                          <div className="p-4 space-y-3">
                              {[1,2,3].map(i => (
                                  <div key={i} className="flex justify-between">
                                      <Skeleton className="w-12 h-8" />
                                      <div className="flex-1 px-4 space-y-2">
                                          <Skeleton className="w-full h-3" /><Skeleton className="w-1/2 h-3" />
                                      </div>
                                      <Skeleton className="w-16 h-8" />
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <table className="w-full text-xs text-left table-fixed">
                              <tbody className="divide-y divide-slate-100">
                                 {history.length === 0 ? <tr><td colSpan={3} className="p-4 text-center text-slate-400">{t.no_tx_limit}</td></tr> :
                                  history.map((tx) => {
                                      const isIn = tx.receiver === selectedNode.id;
                                      const otherAddr = isIn ? tx.sender : tx.receiver;
                                      const date = new Date(tx.timestamp).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                      return (
                                          <tr key={tx.txID} className="hover:bg-slate-50 transition-colors">
                                              <td className="p-3 align-top w-24">
                                                  <div className="flex items-center gap-1 mb-1">
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isIn ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>{isIn ? 'IN' : 'OUT'}</span>
                                                  </div>
                                                  <div className="text-[9px] text-slate-400 leading-tight">{date}</div>
                                              </td>
                                              <td className="p-3 align-top w-auto overflow-hidden">
                                                  <div className="flex items-center gap-1 mb-1">
                                                    <div onClick={() => handleCopy(otherAddr, "Address")} className="font-mono text-slate-700 cursor-pointer hover:text-blue-600 truncate font-medium" title={otherAddr}>
                                                        {otherAddr.slice(0, 6)}...{otherAddr.slice(-4)}
                                                    </div>
                                                    {tx.riskLabel && <span className="bg-red-100 text-red-600 text-[9px] px-1.5 rounded-full font-bold truncate max-w-[60px] border border-red-200">{tx.riskLabel}</span>}
                                                  </div>
                                                  {isIn && <button onClick={() => handleAddFromHistory(otherAddr)} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 rounded hover:bg-blue-100 mb-1 inline-block">+ {t.btn_trace}</button>}
                                                  <div onClick={() => handleCopy(tx.txID, "TX Hash")} className="text-[9px] text-slate-400 font-mono cursor-pointer hover:text-slate-600 hover:underline truncate" title={`TX: ${tx.txID}`}>TX: {tx.txID.slice(0, 8)}...</div>
                                              </td>
                                              <td className="p-3 text-right align-top w-24 font-bold text-slate-700">
                                                  {tx.amount < 1000 ? tx.amount.toFixed(1) : Math.floor(tx.amount).toLocaleString()}
                                                  <span className="text-[9px] text-slate-400 block font-normal">{tx.token}</span>
                                              </td>
                                          </tr>
                                      )
                                  })}
                              </tbody>
                          </table>
                      )}
                   </div>
                </div>
            </div>
        ) : selectedLink ? (
            /* CASE 2: 링크 정보 */
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                        <div className="text-[10px] text-green-600 uppercase font-bold mb-1">{t.total_usdt}</div>
                        <div className="text-lg font-black text-slate-800 tracking-tight">
                            {linkTotalUSDT.toLocaleString()} <span className="text-xs font-normal text-slate-400">$</span>
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                        <div className="text-[10px] text-blue-600 uppercase font-bold mb-1">{t.total_trx}</div>
                        <div className="text-lg font-black text-slate-800 tracking-tight">
                            {linkTotalTRX.toLocaleString()}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between text-xs bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex flex-col w-24">
                        <span className="text-[9px] text-slate-400 uppercase font-bold mb-1">{t.label_from}</span>
                        <span className="font-mono truncate cursor-pointer hover:text-blue-600 bg-slate-50 p-1 rounded" title={(selectedLink.source as any).id} onClick={() => handleCopy((selectedLink.source as any).id, "Address")}>
                            {(selectedLink.source as any).id}
                        </span>
                    </div>
                    <span className="text-slate-300">──▶</span>
                    <div className="flex flex-col w-24 text-right">
                        <span className="text-[9px] text-slate-400 uppercase font-bold mb-1">{t.label_to}</span>
                        <span className="font-mono truncate cursor-pointer hover:text-blue-600 bg-slate-50 p-1 rounded" title={(selectedLink.target as any).id} onClick={() => handleCopy((selectedLink.target as any).id, "Address")}>
                            {(selectedLink.target as any).id}
                        </span>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                   <h3 className="text-xs font-bold text-slate-700 p-3 border-b border-slate-100 bg-slate-50 flex justify-between">
                       <span>{t.included_tx}</span>
                       <span className="font-normal text-slate-400">{linkTransactions.length} {t.items}</span>
                   </h3>
                   <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-xs text-left table-fixed">
                          <tbody className="divide-y divide-slate-100">
                              {linkTransactions.length === 0 ? (
                                  <tr><td colSpan={3} className="p-4 text-center text-slate-400">{t.no_details}</td></tr>
                              ) : (
                                  linkTransactions.map((tx: any) => {
                                      const date = new Date(tx.timestamp).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                      return (
                                          <tr key={tx.txID} className="hover:bg-slate-50">
                                              <td className="p-3 text-[10px] text-slate-500 w-24 align-top">{date}</td>
                                              <td className="p-3 w-auto align-top">
                                                  <div className="font-mono text-blue-600 cursor-pointer hover:underline truncate" onClick={() => handleCopy(tx.txID, "TX Hash")} title={tx.txID}>{tx.txID.slice(0, 10)}...</div>
                                              </td>
                                              <td className="p-3 text-right w-24 align-top font-bold text-slate-700">
                                                  {tx.amount.toLocaleString()}
                                                  <span className="block text-[9px] text-slate-400 font-normal">{tx.token}</span>
                                              </td>
                                          </tr>
                                      )
                                  })
                              )}
                          </tbody>
                      </table>
                   </div>
                </div>
            </div>
        ) : null}
      </div>
    </div>
    </>
  );
};