import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalStore } from '../../stores/useGlobalStore';

export const AuthModal = () => {
  const { setSession, setUserType } = useGlobalStore(); // setUserType 가져오기
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // [NEW] 가입 유형 선택 상태
  const [selectedType, setSelectedType] = useState<'enterprise' | 'lea'>('enterprise');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isSignUp) {
        // [회원가입] 메타데이터에 user_type 저장
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { user_type: selectedType } 
          }
        });
        if (error) throw error;
        alert(language === 'ko' ? "가입 확인 메일을 확인해주세요." : "Check your email for confirmation.");
      } else {
        // [로그인]
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // 로그인 성공 시 스토어 업데이트 (setSession 내부에서 처리되지만 명시적으로 한번 더 해도 무방)
        if (data.session) {
            const uType = data.session.user.user_metadata?.user_type || 'enterprise';
            setUserType(uType);
            setSession(data.session);
        }
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const { language } = useGlobalStore();

  return (
    <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-96 border border-slate-200 animate-in zoom-in-95 duration-200">
        <h2 className="text-2xl font-black text-slate-800 mb-1">TranSight</h2>
        <p className="text-xs text-slate-500 mb-6 font-medium">Crypto Compliance & Investigation</p>
        
        {/* [NEW] 유저 타입 선택 탭 (가입 시에만 표시) */}
        {isSignUp && (
            <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
                <button 
                    type="button"
                    onClick={() => setSelectedType('enterprise')}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${selectedType === 'enterprise' ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    🏢 Enterprise
                </button>
                <button 
                    type="button"
                    onClick={() => setSelectedType('lea')}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${selectedType === 'lea' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    👮 L.E.A (Police)
                </button>
            </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all" required placeholder="name@org.com" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all" required placeholder="••••••••" />
          </div>
          
          <button disabled={loading} className={`w-full py-3 rounded-lg text-white font-bold text-sm transition-all shadow-md active:scale-95 flex justify-center items-center ${selectedType === 'lea' && isSignUp ? 'bg-blue-800 hover:bg-blue-900' : 'bg-slate-800 hover:bg-slate-900'}`}>
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (isSignUp ? (selectedType === 'lea' ? 'Sign Up for Investigation' : 'Sign Up for Enterprise') : 'Sign In')}
          </button>
        </form>
        
        <div className="mt-6 text-center border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-400 mb-1">{isSignUp ? "Already have an account?" : "No account yet?"}</p>
          <button onClick={() => setIsSignUp(!isSignUp)} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors">
            {isSignUp ? "Sign In" : "Create New Account"}
          </button>
        </div>
      </div>
    </div>
  );
};