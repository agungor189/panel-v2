import { useState, useEffect } from 'react';
import { 
  Save, 
  Info, 
  Settings as SettingsIcon, 
  Percent, 
  Building2, 
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  ListFilter
} from 'lucide-react';
import { api } from '../lib/api';
import { Settings } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SettingsViewProps {
  onUpdate: () => void;
}

export default function SettingsView({ onUpdate }: SettingsViewProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const [newCat, setNewCat] = useState({ product: '', income: '', expense: '' });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.get('/settings');
      setSettings(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setLoading(true);
    try {
      await api.put('/settings', settings);
      setSaved(true);
      onUpdate();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert("Ayarlar kaydedilemedi.");
    } finally {
      setLoading(false);
    }
  };

  const addCategory = (type: 'product' | 'income' | 'expense') => {
    if (!settings) return;
    const key = `${type}_categories` as keyof Settings;
    const value = newCat[type].trim();
    if (!value) return;
    
    const currentList = settings[key] as string[];
    if (currentList.includes(value)) return;

    setSettings({
      ...settings,
      [key]: [...currentList, value]
    });
    setNewCat({ ...newCat, [type]: '' });
  };

  const removeCategory = (type: 'product' | 'income' | 'expense', value: string) => {
    if (!settings) return;
    const key = `${type}_categories` as keyof Settings;
    const currentList = settings[key] as string[];
    
    setSettings({
      ...settings,
      [key]: currentList.filter(c => c !== value)
    });
  };

  if (!settings) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-text-main tracking-tight">Sistem Ayarları</h2>
          <p className="text-xs lg:text-sm text-text-muted">Panel yapılandırmasını buradan özelleştirin.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={loading}
          className="btn-primary h-11 px-8 flex items-center justify-center w-full sm:w-auto"
        >
          <span>{loading ? 'Kaydediliyor...' : saved ? 'Ayarlar Kaydedildi' : 'Değişiklikleri Kaydet'}</span>
          {saved ? <CheckCircle2 className="w-4 h-4 ml-2" /> : <Save className="w-4 h-4 ml-2" />}
        </button>
      </div>

      <div className="card overflow-hidden divide-y divide-border-color">
         {/* General Info */}
         <div className="p-6 lg:p-8 space-y-6">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center">
               <Building2 className="w-4 h-4 mr-3 text-primary" />
               Genel Panel Bilgileri
            </h3>
            <div className="grid grid-cols-1 gap-6">
               <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest px-1">Şirket / Panel Adı</label>
                  <input 
                    type="text" 
                    value={settings.company_name} 
                    onChange={e => setSettings({...settings, company_name: e.target.value})}
                    className="form-input font-bold"
                   />
               </div>
               <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest px-1">Kritik Stok Sınırı</label>
                    <input 
                      type="number" 
                      value={settings.low_stock_threshold} 
                      onChange={e => setSettings({...settings, low_stock_threshold: parseInt(e.target.value)})}
                      className="form-input font-bold"
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest px-1">Para Birimi</label>
                    <input 
                      type="text" 
                      value={settings.currency_symbol} 
                      onChange={e => setSettings({...settings, currency_symbol: e.target.value})}
                      className="form-input font-bold text-center"
                    />
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest px-1">USD Kuru ($ → ₺)</label>
                    <div className="relative">
                      <div className="absolute left-4 top-3 text-text-muted font-bold text-sm">₺</div>
                      <input 
                        type="number" 
                        step="0.01"
                        value={settings.usd_exchange_rate} 
                        onChange={e => setSettings({...settings, usd_exchange_rate: parseFloat(e.target.value)})}
                        className="form-input font-bold pl-10"
                      />
                    </div>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest px-1">Varsayılan Buffer (%)</label>
                    <div className="relative">
                      <div className="absolute right-4 top-3 text-text-muted font-bold text-sm">%</div>
                      <input 
                        type="number" 
                        value={settings.default_buffer_percentage} 
                        onChange={e => setSettings({...settings, default_buffer_percentage: parseInt(e.target.value)})}
                        className="form-input font-bold pr-10"
                      />
                    </div>
                 </div>
               </div>
            </div>
         </div>

         {/* Category Management */}
         <div className="p-8 space-y-6">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center">
               <ListFilter className="w-4 h-4 mr-3 text-primary" />
               Malzeme & Kategori Yönetimi
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               {/* Product Categories */}
               <CategoryList 
                  title="Ürün Malzemeleri" 
                  categories={settings.product_categories} 
                  newValue={newCat.product} 
                  onNewValueChange={(v) => setNewCat({...newCat, product: v})}
                  onAdd={() => addCategory('product')}
                  onRemove={(c) => removeCategory('product', c)}
               />

               {/* Income Categories */}
               <CategoryList 
                  title="Gelirler" 
                  categories={settings.income_categories} 
                  newValue={newCat.income} 
                  onNewValueChange={(v) => setNewCat({...newCat, income: v})}
                  onAdd={() => addCategory('income')}
                  onRemove={(c) => removeCategory('income', c)}
               />

               {/* Expense Categories */}
               <CategoryList 
                  title="Giderler" 
                  categories={settings.expense_categories} 
                  newValue={newCat.expense} 
                  onNewValueChange={(v) => setNewCat({...newCat, expense: v})}
                  onAdd={() => addCategory('expense')}
                  onRemove={(c) => removeCategory('expense', c)}
               />
            </div>
         </div>

         {/* Commission Rates */}
         <div className="p-8 space-y-6">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center">
               <Percent className="w-4 h-4 mr-3 text-primary" />
               Platform Komisyon Oranları
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
               {Object.entries(settings.commission_rates).map(([platform, rate]) => (
                  <div key={platform} className="flex items-center justify-between p-4 bg-bg-main rounded-xl border border-border-color group focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
                     <span className="text-[11px] font-bold text-text-main uppercase tracking-tight">{platform}</span>
                     <div className="flex items-center space-x-1.5">
                        <input 
                           type="number" 
                           step="0.1"
                           value={rate} 
                           onChange={e => {
                              const newRates = {...settings.commission_rates, [platform]: parseFloat(e.target.value)};
                              setSettings({...settings, commission_rates: newRates});
                           }}
                           className="w-12 bg-transparent text-right outline-none font-bold text-text-main text-sm"
                        />
                        <span className="text-text-muted font-bold text-[10px]">%</span>
                     </div>
                  </div>
               ))}
            </div>
            <div className="flex items-start p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
               <Info className="w-4 h-4 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
               <p className="text-[11px] text-blue-700 leading-relaxed font-bold uppercase tracking-tight opacity-80">Bu oranlar, finansal raporlar ve platform karşılaştırmalarında net kar hesaplamaları için kullanılmaktadır.</p>
            </div>
         </div>
      </div>

      <div className="p-6 bg-red-50/50 border border-red-100 rounded-2xl flex items-center justify-between">
         <div className="flex items-center">
           <AlertCircle className="w-5 h-5 text-danger mr-4" />
           <div>
              <h4 className="text-sm font-bold text-danger uppercase tracking-tight">Veritabanı Bakımı</h4>
              <p className="text-xs text-text-muted mt-0.5">Sistem verileri yerel SQLite dosyasında saklanmaktadır.</p>
           </div>
         </div>
         <button className="px-5 py-2 bg-white border border-red-200 text-danger rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-danger hover:text-white transition-all shadow-sm active:scale-95">Yedek Al</button>
      </div>
    </div>
  );
}

function CategoryList({ title, categories, newValue, onNewValueChange, onAdd, onRemove }: any) {
   return (
      <div className="space-y-4">
         <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">{title}</h4>
         <div className="space-y-2">
            <div className="flex space-x-2">
               <input 
                  type="text" 
                  value={newValue}
                  onChange={(e) => onNewValueChange(e.target.value)}
                  placeholder="Ekleyin..."
                  className="form-input text-xs py-1.5"
                  onKeyDown={(e) => e.key === 'Enter' && onAdd()}
               />
               <button 
                  onClick={onAdd}
                  className="p-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
               >
                  <Plus className="w-4 h-4" />
               </button>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
               {categories.map((c: string) => (
                  <div key={c} className="flex items-center justify-between px-3 py-2 bg-bg-main rounded-lg border border-border-color group">
                     <span className="text-xs font-bold text-text-main">{c}</span>
                     <button 
                        onClick={() => onRemove(c)}
                        className="text-text-muted hover:text-danger p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                     >
                        <Trash2 className="w-3 h-3" />
                     </button>
                  </div>
               ))}
            </div>
         </div>
      </div>
   );
}
