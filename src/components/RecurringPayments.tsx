import { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Building2,
  Home,
  FileText,
  DollarSign
} from 'lucide-react';
import { api, formatCurrency } from '../lib/api';
import { RecurringPayment, Settings, Transaction } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function RecurringPayments({ settings }: { settings: Settings | null }) {
  const [items, setItems] = useState<RecurringPayment[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [txs, setTxs] = useState<Transaction[]>([]);
  
  // Navigation state
  const [viewDate, setViewDate] = useState(new Date());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    day_of_month: 1,
    amount: 0,
    category: settings?.expense_categories[0] || 'Kira',
    note: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [payments, transactions] = await Promise.all([
        api.get('/recurring-payments'),
        api.get('/transactions')
      ]);
      setItems(payments);
      setTxs(transactions);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/recurring-payments', formData);
      setShowAdd(false);
      loadData();
      setFormData({
        title: '',
        day_of_month: 1,
        amount: 0,
        category: settings?.expense_categories[0] || 'Kira',
        note: ''
      });
    } catch (err) {
      alert("Tahakkuk kaydı başarısız.");
    } finally {
      setLoading(false);
    }
  };

  const processPayments = async () => {
    setLoading(true);
    try {
      await api.post('/recurring-payments/process', {});
      await loadData();
      alert("Bu ayın ödemeleri başarıyla kasaya işlendi.");
    } catch (err) {
      alert("Ödemeler işlenirken hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (id: string) => {
    setConfirmDeleteId(id);
  };

  const proceedDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await api.delete(`/recurring-payments/${confirmDeleteId}`);
      setConfirmDeleteId(null);
      loadData();
    } catch (err) {
      alert("Silme başarısız.");
    }
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1);
    setViewDate(newDate);
  };

  // Calendar Construction Logic
  const monthInfo = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
    // Adjust to Monday-start calendar
    const startingBlankDays = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(viewDate);
    
    const calendarDays = [];
    
    // Leading blanks
    for (let i = 0; i < startingBlankDays; i++) {
      calendarDays.push({ blank: true });
    }
    
    // Month days
    for (let i = 1; i <= daysInMonth; i++) {
      const dayPayments = items.filter(p => p.day_of_month === i);
      const isProcessed = (id: string) => txs.some(t => {
         const tDate = new Date(t.date);
         const monthMatch = tDate.getMonth() === month && tDate.getFullYear() === year;
         return t.recurring_id?.startsWith(id) && monthMatch;
      });
      
      calendarDays.push({
        day: i,
        payments: dayPayments.map(p => ({ ...p, processed: isProcessed(p.id) })),
        current: i === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear()
      });
    }
    
    return { calendarDays, monthName };
  }, [items, txs, viewDate]);

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 max-w-[1600px] mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-text-main tracking-tight">Ödeme Takvimi</h2>
          <p className="text-xs lg:text-sm text-text-muted">Aylık finansal yükümlülüklerinizi ve vadesi gelen ödemeleri takip edin.</p>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto">
          <button 
            disabled={loading}
            onClick={processPayments}
            className="flex-1 sm:flex-none flex items-center justify-center px-4 sm:px-5 py-2.5 bg-success text-white rounded-xl font-bold text-sm shadow-lg shadow-green-100 hover:scale-[1.02] transition-all disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            <span className="truncate">Ödemeleri İşle</span>
          </button>
          <button 
            onClick={() => setShowAdd(true)}
            className="flex-1 sm:flex-none flex items-center justify-center px-4 sm:px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-100 hover:scale-[1.02] transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="truncate">Plan Ekle</span>
          </button>
        </div>
      </div>

      {/* Full Monthly Calendar */}
      <div className="card shadow-2xl border-none overflow-hidden flex flex-col min-h-fit sm:min-h-[800px] bg-white">
        <div className="px-5 lg:px-8 py-4 lg:py-6 border-b border-border-color flex flex-col sm:flex-row sm:items-center justify-between bg-white gap-4">
          <div className="flex items-center justify-between sm:justify-start sm:space-x-8">
            <h3 className="text-lg lg:text-2xl font-black text-text-main truncate sm:min-w-[220px]">{monthInfo.monthName}</h3>
            <div className="flex items-center space-x-1 sm:space-x-2 p-1 bg-bg-main rounded-2xl border border-border-color">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-text-muted transition-all">
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button 
                onClick={() => setViewDate(new Date())}
                className="px-3 sm:px-5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold text-text-main hover:bg-white hover:shadow-sm rounded-xl transition-all"
              >
                Bugün
              </button>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-text-muted transition-all">
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-6 sm:space-x-8 text-[9px] sm:text-[10px] font-bold text-text-muted uppercase tracking-[0.1em] sm:tracking-[0.2em]">
            <div className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-success mr-2 shadow-sm shadow-green-200"></div> İşlendi</div>
            <div className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-amber-400 mr-2 shadow-sm shadow-amber-200"></div> Bekliyor</div>
          </div>
        </div>

        <div className="hidden sm:grid grid-cols-7 bg-bg-main border-b border-border-color">
           {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(d => (
             <div key={d} className="py-4 text-center text-[10px] font-black text-text-muted uppercase tracking-widest border-r border-border-color last:border-0">{d}</div>
           ))}
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-7 auto-rows-fr bg-[#F1F5F9] gap-[1px]">
           {monthInfo.calendarDays.map((d, idx) => (
             <div 
               key={idx} 
               className={cn(
                 "p-4 bg-white flex flex-col group transition-all duration-300 relative",
                 d.blank ? "bg-bg-main/30 hidden sm:flex" : "hover:bg-bg-main/50 cursor-pointer min-h-[100px] sm:min-h-[140px]",
                 d.current ? "bg-primary/5" : "",
                 !d.blank && d.payments && d.payments.length === 0 ? "hidden sm:flex" : ""
               )}
             >
                {!d.blank && (
                  <>
                    <div className="flex justify-between items-start mb-3">
                      <span className={cn(
                        "w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl text-xs font-black transition-all",
                        d.current ? "bg-primary text-white shadow-lg scale-110" : "text-text-muted group-hover:text-text-main"
                      )}>
                        {d.day}
                      </span>
                      {d.payments && d.payments.length > 0 && (
                        <div className="text-right">
                          <p className="text-[10px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-full">
                            {formatCurrency(d.payments.reduce((sum: number, p: any) => sum + p.amount, 0))}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 space-y-1.5 overflow-y-auto sm:max-h-[120px] custom-scrollbar">
                       {d.payments?.map((p: any, pIdx: number) => (
                         <div 
                           key={pIdx} 
                           className={cn(
                             "px-3 py-2 rounded-xl border text-[10px] font-bold flex flex-col transition-all shadow-sm",
                             p.processed 
                               ? "bg-green-50/80 border-success/20 text-success" 
                               : "bg-amber-50/80 border-amber-200 text-amber-700"
                           )}
                         >
                            <span className="truncate leading-tight mb-0.5" title={p.title}>{p.title}</span>
                            <div className="flex justify-between items-center mt-1">
                               <span className="font-black text-[11px]">{formatCurrency(p.amount)}</span>
                               {p.processed && <CheckCircle2 className="w-3 h-3" />}
                            </div>
                         </div>
                       ))}
                    </div>
                  </>
                )}
             </div>
           ))}
        </div>
      </div>

      {/* Additional Details and Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
           <div className="card p-6 bg-primary text-white border-none shadow-xl relative overflow-hidden">
              <div className="relative z-10 space-y-4">
                 <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">{monthInfo.monthName} Toplam</p>
                 <h4 className="text-3xl font-black">{formatCurrency(items.reduce((sum, p) => sum + p.amount, 0))}</h4>
                 <div className="pt-2">
                    <p className="text-[10px] font-bold opacity-70">Ödenen: {formatCurrency(
                       txs.filter(t => t.recurring_id && new Date(t.date).getMonth() === viewDate.getMonth() && new Date(t.date).getFullYear() === viewDate.getFullYear())
                           .reduce((sum, t) => sum + t.amount, 0)
                    )}</p>
                 </div>
              </div>
              <CalendarIcon className="absolute -bottom-4 -right-4 w-24 h-24 text-white/10 rotate-12" />
           </div>

           <div className="card p-6 border-dashed border-2 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-bg-main flex items-center justify-center">
                 <Building2 className="w-6 h-6 text-text-muted" />
              </div>
              <div>
                 <p className="text-sm font-bold text-text-main">Hızlı İpucu</p>
                 <p className="text-xs text-text-muted mt-1 leading-relaxed">Ödemelerinizi her ayın başında "İşle" butonuyla kasaya kaydedebilirsiniz.</p>
              </div>
           </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
           <div className="flex items-center justify-between px-2">
              <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest">Tüm Ödeme Planları</h4>
              <span className="text-xs font-bold text-text-muted">{items.length} Plan Kayıtlı</span>
           </div>
           <div className="card overflow-hidden">
             <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-bg-main border-b border-border-color text-[10px] font-black text-text-muted uppercase tracking-widest">
                    <th className="px-6 py-4">Gün</th>
                    <th className="px-6 py-4 text-center">Tür</th>
                    <th className="px-6 py-4">Başlık</th>
                    <th className="px-6 py-4 text-right">Tutar</th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-bg-main transition-colors group">
                      <td className="px-6 py-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-center font-black text-sm text-primary">
                          {item.day_of_month}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                         <span className="text-[9px] font-black uppercase tracking-tight px-2 py-1 bg-white border border-border-color rounded-lg text-text-muted shadow-sm">{item.category}</span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-text-main">{item.title}</p>
                        {item.note && <p className="text-[10px] text-text-muted mt-0.5">{item.note}</p>}
                      </td>
                      <td className="px-6 py-4 font-black text-text-main text-right">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => deleteItem(item.id)}
                          className="p-2 text-text-muted hover:text-danger hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-text-muted italic">Herhangi bir plan bulunamadı.</td>
                    </tr>
                  )}
                </tbody>
             </table>
           </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-sidebar-bg/60 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)}></div>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200">
            <h3 className="font-bold text-gray-900 mb-2">Ödemeyi Sil</h3>
            <p className="text-gray-600 mb-6 font-medium text-sm">
              Bu periyodik ödemeyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Vazgeç
              </button>
              <button 
                onClick={proceedDelete}
                className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-sm" onClick={() => setShowAdd(false)}></div>
           <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl flex flex-col overflow-hidden relative animate-in zoom-in-95 duration-300">
              <div className="px-10 py-8 border-b border-border-color flex items-center justify-between">
                <div>
                  <h3 className="font-black text-xl text-text-main">Yeni Ödeme Planı</h3>
                  <p className="text-xs text-text-muted mt-1">Düzenli giderlerinizi takvime işleyin.</p>
                </div>
                <button onClick={() => setShowAdd(false)} className="p-3 hover:bg-bg-main rounded-2xl text-text-muted transition-all">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-10 space-y-6">
                 <div className="space-y-2">
                    <label className="text-[11px] font-black text-text-muted uppercase tracking-widest px-1">Ödeme Başlığı</label>
                    <input required placeholder="Örn: Depo Kirası" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="form-input h-12" />
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[11px] font-black text-text-muted uppercase tracking-widest px-1">Ayın Günü</label>
                       <input type="number" min="1" max="31" required value={formData.day_of_month} onChange={e => setFormData({...formData, day_of_month: parseInt(e.target.value)})} className="form-input h-12 font-black text-lg" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[11px] font-black text-text-muted uppercase tracking-widest px-1">Tutar (₺)</label>
                       <input type="number" step="0.01" required value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})} className="form-input h-12 font-black text-lg" />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[11px] font-black text-text-muted uppercase tracking-widest px-1">Kategori</label>
                    <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="form-input h-12 font-bold focus:ring-primary/20">
                       {settings?.expense_categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[11px] font-black text-text-muted uppercase tracking-widest px-1">Not (Opsiyonel)</label>
                    <input placeholder="Ek bilgi..." value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className="form-input h-12" />
                 </div>
                 <button disabled={loading} className="w-full btn-primary h-14 flex items-center justify-center mt-6 text-lg">
                   <span>{loading ? 'Kaydediliyor...' : 'Planı Kaydet'}</span>
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}

