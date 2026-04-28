import { useState, useEffect } from 'react';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Trash2, 
  Calendar,
  Filter,
  DollarSign,
  Package,
} from 'lucide-react';
import { api, formatCurrency, PLATFORMS } from '../lib/api';
import { Transaction, Product, Settings } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Transactions({ initialType, settings }: { initialType?: 'Income' | 'Expense', settings?: Settings | null }) {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: initialType || 'Income',
    category: '',
    platform: '',
    amount: 0,
    product_id: '',
    note: '',
    reference_number: ''
  });

  useEffect(() => {
    if (settings) {
      const defaultCat = formData.type === 'Income' 
        ? (settings.income_categories[0] || 'Gelir')
        : (settings.expense_categories[0] || 'Gider');
      setFormData(prev => ({ ...prev, category: defaultCat }));
    }
  }, [settings, initialType, formData.type]);

  useEffect(() => {
    loadData();
    loadProducts();
  }, []);

  const loadData = async () => {
    try {
      const data = await api.get('/transactions');
      setTxs(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await api.get('/products');
      setProducts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/transactions', formData);
      setShowAdd(false);
      loadData();
    } catch (err) {
      alert("İşlem kaydedilemedi.");
    } finally {
      setLoading(false);
    }
  };

  const deleteTx = async (id: string) => {
    setConfirmDeleteId(id);
  };

  const proceedDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await api.delete(`/transactions/${confirmDeleteId}`);
      setConfirmDeleteId(null);
      loadData();
    } catch (err) {
      alert("Silme başarısız.");
    }
  };

  const filteredTxs = initialType ? txs.filter(t => t.type === initialType) : txs;
  const incomeTxs = filteredTxs.filter(t => t.type === 'Income');
  const expenseTxs = filteredTxs.filter(t => t.type === 'Expense');

  const totalIncome = incomeTxs.reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = expenseTxs.reduce((sum, t) => sum + t.amount, 0);

  // Grouping logic
  const groupedTxs = filteredTxs.reduce((acc: any, tx) => {
    const key = tx.product_id || 'unlinked';
    if (!acc[key]) {
      acc[key] = {
        product_title: tx.product_title || 'Diğer / Genel İşlemler',
        income: [],
        expense: []
      };
    }
    if (tx.type === 'Income') acc[key].income.push(tx);
    else acc[key].expense.push(tx);
    return acc;
  }, {});

  const groupKeys = Object.keys(groupedTxs).sort((a, b) => {
    if (a === 'unlinked') return 1;
    if (b === 'unlinked') return -1;
    return groupedTxs[a].product_title.localeCompare(groupedTxs[b].product_title);
  });

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-[#0F172A] tracking-tight">
            {initialType === 'Income' ? 'Gelir Takibi' : initialType === 'Expense' ? 'Gider Takibi' : 'Finansal İşlemler'}
          </h2>
          <p className="text-xs lg:text-sm text-[#64748B]">
            {initialType === 'Income' ? 'Satış ve diğer gelirlerinizi yönetin.' : initialType === 'Expense' ? 'Kargo, komisyon ve maliyetlerinizi takip edin.' : 'İşlemleri ürün bazlı takip edin.'}
          </p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="flex items-center justify-center px-5 py-3 lg:py-2.5 bg-[#0F172A] text-white rounded-xl font-bold text-sm shadow-lg shadow-gray-200 hover:scale-[1.02] transition-all w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          Yeni {initialType === 'Income' ? 'Gelir' : initialType === 'Expense' ? 'Gider' : 'İşlem'} Ekle
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(!initialType || initialType === 'Income') && (
          <SummaryCard title="Toplam Gelir" value={formatCurrency(totalIncome)} color="text-success" bg="bg-green-50" icon={TrendingUp} />
        )}
        {(!initialType || initialType === 'Expense') && (
          <SummaryCard title="Toplam Gider" value={formatCurrency(totalExpense)} color="text-danger" bg="bg-red-50" icon={TrendingDown} />
        )}
        {!initialType && (
          <SummaryCard title="Net Kar" value={formatCurrency(totalIncome - totalExpense)} color="text-primary" bg="bg-blue-50" icon={DollarSign} />
        )}
        {initialType === 'Income' && (
          <SummaryCard title="En Çok Gelir Getiren Ürün" value={groupKeys.length > 0 ? groupedTxs[groupKeys[0]].product_title : '-'} color="text-primary" bg="bg-blue-50" icon={Package} />
        )}
        {initialType === 'Expense' && (
          <SummaryCard title="En Yüksek Gider Kalemi" value="Lojistik/Kargo" color="text-primary" bg="bg-blue-50" icon={Package} />
        )}
      </div>

      <div className="space-y-12">
        {groupKeys.map(key => {
          const group = groupedTxs[key];
          return (
            <section key={key} className="space-y-4">
              <div className="flex items-center space-x-3 px-2">
                <div className="w-8 h-8 rounded-lg bg-bg-main border border-border-color flex items-center justify-center">
                  <Package className="w-4 h-4 text-text-muted" />
                </div>
                <h3 className="font-bold text-lg text-text-main tracking-tight">{group.product_title}</h3>
              </div>

              <div className="card shadow-sm overflow-hidden divide-y divide-border-color">
                {/* Income Sub-section */}
                {group.income.length > 0 && (!initialType || initialType === 'Income') && (
                  <div>
                    <div className="px-6 py-3 bg-green-50/30 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-success uppercase tracking-widest flex items-center">
                        <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                        Gelirler
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <tbody className="divide-y divide-border-color">
                          {group.income.map((tx: any) => (
                            <TransactionRow key={tx.id} tx={tx} onDelete={() => deleteTx(tx.id)} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Expense Sub-section */}
                {group.expense.length > 0 && (!initialType || initialType === 'Expense') && (
                  <div>
                    <div className="px-6 py-3 bg-red-50/30 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-danger uppercase tracking-widest flex items-center">
                        <TrendingDown className="w-3.5 h-3.5 mr-1.5" />
                        Giderler
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <tbody className="divide-y divide-border-color">
                          {group.expense.map((tx: any) => (
                            <TransactionRow key={tx.id} tx={tx} onDelete={() => deleteTx(tx.id)} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}

        {filteredTxs.length === 0 && (
          <div className="py-24 text-center bg-white rounded-3xl border-2 border-dashed border-border-color">
            <DollarSign className="w-16 h-16 text-border-color mx-auto mb-4" />
            <h3 className="text-xl font-bold text-text-main">İşlem bulunamadı</h3>
            <p className="text-text-muted mt-1">Henüz bir finansal hareket kaydetmediniz.</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-sidebar-bg/60 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)}></div>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200">
            <h3 className="font-bold text-gray-900 mb-2">İşlemi Sil</h3>
            <p className="text-gray-600 mb-6 font-medium text-sm">
              Bu işlemi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
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
           <div className="absolute inset-0 bg-sidebar-bg/60 backdrop-blur-sm" onClick={() => setShowAdd(false)}></div>
           <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden relative animate-in zoom-in-95 duration-300">
              <div className="px-8 py-6 border-b border-border-color flex items-center justify-between">
                <h3 className="font-bold text-lg text-text-main">Yeni İşlem Girişi</h3>
                <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-bg-main rounded-xl text-text-muted"><Plus className="w-5 h-5 rotate-45" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-5">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest px-1">Tarih</label>
                       <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="form-input" />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest px-1">Tür</label>
                       <select 
                         disabled={!!initialType}
                         value={formData.type} 
                         onChange={e => setFormData({...formData, type: e.target.value as any})} 
                         className="form-input"
                       >
                          <option value="Income">Gelir (+)</option>
                          <option value="Expense">Gider (-)</option>
                       </select>
                    </div>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest px-1">Kategori</label>
                    <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="form-input">
                       {formData.type === 'Income' ? (
                          settings?.income_categories.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))
                       ) : (
                          settings?.expense_categories.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))
                       )}
                    </select>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest px-1">Platform</label>
                       <select value={formData.platform} onChange={e => setFormData({...formData, platform: e.target.value})} className="form-input">
                          <option value="">Belirtilmedi</option>
                          {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                       </select>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest px-1">Tutar (₺)</label>
                       <input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})} className="form-input font-bold text-base" />
                    </div>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest px-1">İlgili Ürün (Opsiyonel)</label>
                    <select value={formData.product_id} onChange={e => setFormData({...formData, product_id: e.target.value})} className="form-input">
                       <option value="">Ürün Seçiniz</option>
                       {products.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                 </div>

                 <button 
                  disabled={loading}
                  className="w-full btn-primary h-12 flex items-center justify-center mt-4"
                 >
                   <span>{loading ? 'Kaydediliyor...' : 'İşlemi Tamamla'}</span>
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}

function TransactionRow({ tx, onDelete }: any) {
  return (
    <tr className="hover:bg-bg-main transition-colors group">
      <td className="px-4 lg:px-6 py-4 text-text-muted text-xs lg:text-sm">{new Date(tx.date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}</td>
      <td className="px-4 lg:px-6 py-4">
        <p className="font-bold text-text-main text-sm">{tx.category}</p>
        <p className="text-[9px] lg:text-[10px] text-text-muted font-bold uppercase tracking-tighter">{tx.type === 'Income' ? 'Gelir' : 'Gider'}</p>
      </td>
      <td className="px-4 lg:px-6 py-4 hidden sm:table-cell">
        {tx.platform ? <span className="px-2 py-0.5 rounded bg-bg-main border border-border-color text-text-main text-[10px] font-bold uppercase tracking-tight">{tx.platform}</span> : <span className="text-gray-400 text-xs">-</span>}
      </td>
      <td className={cn("px-4 lg:px-6 py-4 font-bold text-sm lg:text-base", tx.type === 'Income' ? 'text-success' : 'text-danger')}>
        {tx.type === 'Income' ? '+' : '-'}{formatCurrency(tx.amount)}
      </td>
      <td className="px-4 lg:px-6 py-4 max-w-[120px] lg:max-w-[200px]">
        <p className="text-[10px] lg:text-xs font-medium text-text-muted truncate">{tx.product_title || '-'}</p>
      </td>
      <td className="px-4 lg:px-6 py-4 text-right">
        <button 
          onClick={onDelete}
          className="p-2 text-text-muted hover:text-danger hover:bg-red-50 rounded-lg transition-all lg:opacity-0 lg:group-hover:opacity-100"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

function SummaryCard({ title, value, color, bg, icon: Icon }: any) {
  return (
    <div className={cn("p-4 lg:p-6 rounded-2xl bg-white border border-[#E2E8F0] flex items-center justify-between shadow-sm")}>
       <div>
         <p className="text-[9px] lg:text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">{title}</p>
         <p className={cn("text-xl lg:text-2xl font-extrabold tracking-tight", color)}>{value}</p>
       </div>
       <div className={cn("p-2 lg:p-3 rounded-xl", bg)}>
          <Icon className={cn("w-5 h-5 lg:w-6 lg:h-6", color)} />
       </div>
    </div>
  );
}
