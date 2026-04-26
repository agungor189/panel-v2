import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, User, LogIn, ShieldCheck, Zap, BarChart3, Globe } from 'lucide-react';

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate brief network delay for better UI feel
    setTimeout(() => {
      if (username === 'admin' && password === 'admin') {
        try {
          localStorage.setItem('isAuthenticated', 'true');
        } catch {
          // ignore
        }
        onLogin();
      } else {
        setError('Geçersiz kullanıcı adı veya şifre.');
        setLoading(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl animate-pulse" />

      <div className="w-full max-w-md relative z-10">
        {/* Branding for Mobile/Small views moved above form */}
        <div className="flex items-center justify-center space-x-3 mb-12">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
             <Zap className="text-white w-6 h-6 fill-white" />
          </div>
          <span className="text-2xl font-black tracking-tight text-text-main uppercase">DSDST Panel</span>
        </div>

        {/* Login Form */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="flex justify-center"
        >
          <div className="w-full bg-white rounded-[30px] lg:rounded-[40px] shadow-2xl shadow-blue-900/5 p-8 lg:p-12 border border-border-color relative">
            <div className="text-center mb-8 lg:mb-10">
              <h2 className="text-2xl lg:text-3xl font-black text-text-main tracking-tight">Hoş Geldiniz</h2>
              <p className="text-sm text-text-muted mt-2 font-medium">Devam etmek için giriş yapın.</p>
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-[0.2em] mt-4 opacity-70">
                Giriş Bilgileri: <span className="text-primary italic lowercase">admin / admin</span>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-text-muted uppercase tracking-widest px-1">Kullanıcı Adı</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
                    <User className="w-5 h-5" />
                  </div>
                  <input 
                    required
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Kullanıcı adınızı girin"
                    className="w-full h-14 pl-12 pr-4 bg-bg-main border border-border-color rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-text-muted uppercase tracking-widest px-1">Şifre</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input 
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Şifrenizi girin"
                    className="w-full h-14 pl-12 pr-4 bg-bg-main border border-border-color rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium"
                  />
                </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 text-red-600 text-xs font-bold p-4 rounded-xl flex items-center"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  {error}
                </motion.div>
              )}

              <button 
                disabled={loading}
                className="w-full h-14 bg-primary text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-200 hover:scale-[1.02] transition-all flex items-center justify-center group"
              >
                {loading ? (
                  <div className="w-6 h-6 border-b-2 border-white rounded-full animate-spin" />
                ) : (
                  <>
                    Giriş Yap
                    <LogIn className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

          </div>
        </motion.div>
      </div>
      
      {/* Footer Info */}
      <div className="mt-20 text-[10px] font-black text-text-muted uppercase tracking-[0.3em] opacity-40">
        © 2026 DSDST Global Operations Center
      </div>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: any) {
  return (
    <div className="flex items-start space-x-3">
       <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-primary" />
       </div>
       <div>
          <p className="text-xs font-black text-text-main">{title}</p>
          <p className="text-[10px] text-text-muted mt-0.5">{desc}</p>
       </div>
    </div>
  );
}
