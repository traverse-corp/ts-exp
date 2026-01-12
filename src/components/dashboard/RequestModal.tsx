import { useState, useMemo, useEffect } from 'react';
import type { CleanTx } from '../../services/tronScanner';
import { useGlobalStore } from '../../stores/useGlobalStore';
import { TRANSLATIONS } from '../../constants/lang';

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: any; 
  history: CleanTx[]; 
  showToast: (msg: string) => void;
}

type RequestType = 'freeze' | 'kyc' | 'token_freeze' | null;
type ReasonType = 'voice_phishing' | 'fraud' | 'hacking' | '';

export const RequestModal = ({ isOpen, onClose, node, history, showToast }: RequestModalProps) => {
  const { language } = useGlobalStore(); // 언어 설정 가져오기
  const t = TRANSLATIONS[language];      // 딕셔너리 선택

  const [step, setStep] = useState<'menu' | 'form'>('menu');
  const [reqType, setReqType] = useState<RequestType>(null);
  const [vaspName, setVaspName] = useState<string | null>(null);
  const [reason, setReason] = useState<ReasonType>('');
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setStep('menu');
      setReqType(null);
      setVaspName(null);
      setReason('');
      setSelectedTxIds(new Set());
    }
  }, [isOpen]);

  const parseVaspName = () => {
    if (!node.memo) return null;
    const match = node.memo.match(/Deposit Address of (.+)/i);
    return match ? match[1].trim() : null;
  };

  const handleTypeSelect = (type: RequestType) => {
    if (type === 'token_freeze') {
      showToast(t.msg_coming_soon);
      return;
    }

    const extractedName = parseVaspName();
    
    if (!extractedName) {
      alert(t.msg_not_vasp);
      return;
    }

    setVaspName(extractedName);
    setReqType(type);
    setStep('form');
  };

  const handleToggleTx = (txId: string) => {
    const next = new Set(selectedTxIds);
    if (next.has(txId)) next.delete(txId);
    else next.add(txId);
    setSelectedTxIds(next);
  };

  const handleSubmit = () => {
    if (!reason) { alert(t.req_reason_label); return; } // 간단히 재사용
    if (selectedTxIds.size === 0) { alert(t.req_tx_label); return; }

    const payload = {
      target_vasp: vaspName,
      request_type: reqType,
      reason: reason,
      target_address: node.id,
      evidence_txs: history.filter(tx => selectedTxIds.has(tx.txID))
    };
    
    console.log("Sending Request:", payload);
    
    showToast(`${t.msg_sent_success} (${vaspName})`);
    onClose();
  };

  const inflowTxs = useMemo(() => {
    return history.filter(tx => tx.receiver === node.id);
  }, [history, node.id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-[500px] rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            {t.req_title}
            {vaspName && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{t.req_target} {vaspName}</span>}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto custom-scrollbar">
          
          {step === 'menu' && (
            <div className="space-y-3">
              <button onClick={() => handleTypeSelect('freeze')} className="w-full text-left p-4 border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group">
                <div className="font-bold text-slate-700 group-hover:text-blue-700">{t.req_menu_1}</div>
                <div className="text-xs text-slate-500 mt-1">{t.req_menu_1_desc}</div>
              </button>

              <button onClick={() => handleTypeSelect('kyc')} className="w-full text-left p-4 border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group">
                <div className="font-bold text-slate-700 group-hover:text-blue-700">{t.req_menu_2}</div>
                <div className="text-xs text-slate-500 mt-1">{t.req_menu_2_desc}</div>
              </button>

              <button onClick={() => handleTypeSelect('token_freeze')} className="w-full text-left p-4 border border-slate-200 rounded-lg hover:border-slate-400 bg-slate-50 opacity-70 group cursor-not-allowed">
                <div className="font-bold text-slate-500">{t.req_menu_3}</div>
                <div className="text-xs text-slate-400 mt-1">{t.req_menu_3_desc}</div>
              </button>
            </div>
          )}

          {step === 'form' && (
            <div className="space-y-5">
              {/* Option 1 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t.req_reason_label}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'voice_phishing', label: t.reason_vp },
                    { id: 'fraud', label: t.reason_fraud },
                    { id: 'hacking', label: t.reason_hack }
                  ].map(opt => (
                    <div 
                      key={opt.id}
                      onClick={() => setReason(opt.id as ReasonType)}
                      className={`cursor-pointer text-xs font-bold p-2 text-center rounded border transition-all ${reason === opt.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Option 2 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  {t.req_tx_label} ({selectedTxIds.size})
                </label>
                <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto bg-slate-50 p-1">
                  {inflowTxs.length === 0 ? (
                    <div className="text-center p-4 text-xs text-slate-400">{t.req_no_inflow}</div>
                  ) : (
                    inflowTxs.map(tx => (
                      <div 
                        key={tx.txID}
                        onClick={() => handleToggleTx(tx.txID)}
                        className={`flex items-center gap-3 p-2 rounded mb-1 cursor-pointer transition-colors ${selectedTxIds.has(tx.txID) ? 'bg-blue-100 border border-blue-200' : 'hover:bg-white border border-transparent'}`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center bg-white ${selectedTxIds.has(tx.txID) ? 'border-blue-500' : 'border-slate-300'}`}>
                          {selectedTxIds.has(tx.txID) && <div className="w-2.5 h-2.5 bg-blue-500 rounded-[1px]" />}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="text-[10px] font-mono text-slate-500 truncate w-24">{tx.txID.slice(0, 8)}...</span>
                            <span className="text-[10px] text-slate-400">{new Date(tx.timestamp).toLocaleDateString()}</span>
                          </div>
                          <div className="font-bold text-xs text-slate-700">
                            +{tx.amount.toLocaleString()} {tx.token}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-yellow-50 p-3 rounded border border-yellow-100 text-xs text-yellow-800 leading-relaxed">
                {language === 'en' ? (
                    <>
                        You are requesting <b>{vaspName}</b> to {reqType === 'freeze' ? 'FREEZE assets' : 'provide KYC info'} associated with this address. 
                        <br/>Selected <b>{selectedTxIds.size}</b> transactions as evidence.
                    </>
                ) : (
                    <>
                        <b>{vaspName}</b>에게 해당 주소에 대한 <b>{reqType === 'freeze' ? '자산 동결' : 'KYC 정보 제공'}</b>을 요청합니다.
                        <br/>총 <b>{selectedTxIds.size}</b>개의 증거 트랜잭션이 선택되었습니다.
                    </>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          {step === 'form' && (
            <button onClick={() => setStep('menu')} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded transition-colors">
              {t.btn_back}
            </button>
          )}
          {step === 'form' ? (
            <button 
              onClick={handleSubmit}
              disabled={!reason || selectedTxIds.size === 0}
              className="bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white px-6 py-2 rounded text-xs font-bold transition-colors shadow-sm flex items-center gap-2"
            >
              <span>🚀 {t.btn_send}</span>
            </button>
          ) : (
            <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700">{t.btn_cancel}</button>
          )}
        </div>

      </div>
    </div>
  );
};