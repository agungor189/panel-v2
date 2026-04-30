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
import { useCurrency } from '../CurrencyContext';
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
  const { refreshRate, activeRate } = useCurrency();
  const [exchangeRateInfo, setExchangeRateInfo] = useState<any>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const [newCat, setNewCat] = useState({ product: '', income: '', expense: '' });
  const [restoreProgress, setRestoreProgress] = useState<{ percentage: number; text: string } | null>(null);
  const [confirmRestoreFile, setConfirmRestoreFile] = useState<File | null>(null);
  const [confirmInputText, setConfirmInputText] = useState("");

  useEffect(() => {
    loadSettings();
    loadExchangeRate();
  }, []);

  const loadExchangeRate = async () => {
    try {
      const data = await api.get('/api/exchange-rate'); // actually the base is already /api, so api.get('/exchange-rate')
      setExchangeRateInfo(await api.get('/exchange-rate'));
    } catch(e) {}
  };

  const handleRefreshRate = async () => {
    try {
      setLoading(true);
      const res = await api.post('/exchange-rate/refresh', {});
      setExchangeRateInfo(res);
      await refreshRate(); // Update global context too
    } catch(e) {
      alert("Kur güncellenemedi.");
    } finally {
      setLoading(false);
    }
  };

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
    
    const currentList = (settings[key] as string[]) || [];
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
    const currentList = (settings[key] as string[]) || [];
    
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
               <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                 <div className="space-y-1.5 col-span-2 lg:col-span-1">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest px-1">Güncel USD/TRY Kuru (Oto)</label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <div className="absolute left-4 top-3 text-text-muted font-bold text-sm">₺</div>
                        <input 
                          type="number" 
                          readOnly
                          value={exchangeRateInfo?.rate || activeRate || 0} 
                          className="form-input font-bold pl-10 bg-bg-muted text-text-muted cursor-not-allowed"
                        />
                      </div>
                      <button 
                        onClick={handleRefreshRate}
                        disabled={loading}
                        className="px-3 py-2.5 bg-primary/10 text-primary hover:bg-primary/20 font-bold rounded-xl whitespace-nowrap text-sm"
                      >Yenile
                      </button>
                    </div>
                    {exchangeRateInfo && (
                      <p className="text-[10px] text-text-muted mt-1 px-1">
                        K: {exchangeRateInfo.source} | Son: {new Date(exchangeRateInfo.fetched_at).toLocaleTimeString('tr-TR')}
                      </p>
                    )}
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
                 <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest px-1">Varsayılan Kar Marjı (%)</label>
                    <div className="relative">
                      <div className="absolute right-4 top-3 text-text-muted font-bold text-sm">%</div>
                      <input 
                        type="number" 
                        value={settings?.default_profit_percentage || 0} 
                        onChange={e => setSettings({...settings, default_profit_percentage: parseInt(e.target.value)})}
                        className="form-input font-bold pr-10"
                      />
                    </div>
                 </div>
               </div>
               
               <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest px-1">Entegrasyon API Anahtarı (n8n)</label>
                  <input 
                    type="text" 
                    value={settings.api_key || ''} 
                    onChange={e => setSettings({...settings, api_key: e.target.value})}
                    placeholder="Boş bırakılırsa tüm dış API istekleri reddedilir"
                    className="form-input font-mono text-sm tracking-tight text-primary"
                  />
                  <p className="text-[10px] text-text-muted mt-1 px-1">Dış sistemlerden (Ön: n8n) API ile bağlanırken bu anahtarı <code className="bg-bg-main px-1 rounded">x-api-key</code> veya <code className="bg-bg-main px-1 rounded">Authorization: Bearer</code> olarak kullanın.</p>
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
                  categories={settings.product_categories || []} 
                  newValue={newCat.product} 
                  onNewValueChange={(v) => setNewCat({...newCat, product: v})}
                  onAdd={() => addCategory('product')}
                  onRemove={(c) => removeCategory('product', c)}
               />

               {/* Income Categories */}
               <CategoryList 
                  title="Gelirler" 
                  categories={settings.income_categories || []} 
                  newValue={newCat.income} 
                  onNewValueChange={(v) => setNewCat({...newCat, income: v})}
                  onAdd={() => addCategory('income')}
                  onRemove={(c) => removeCategory('income', c)}
               />

               {/* Expense Categories */}
               <CategoryList 
                  title="Giderler" 
                  categories={settings.expense_categories || []} 
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

      <div className="p-6 bg-red-50/50 border border-red-100 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
         <div className="flex items-start md:items-center">
           <AlertCircle className="w-5 h-5 text-danger mr-4 mt-1 md:mt-0" />
           <div>
              <h4 className="text-sm font-bold text-danger uppercase tracking-tight">Veritabanı Bakımı & Yedekleme</h4>
              <p className="text-xs text-text-muted mt-0.5">Olası çökme ve veri kayıplarına karşı yedek alabilirsiniz. Aldığınız yedeği "Geri Yükle" ile tekrar sisteme aktarabilirsiniz (Bu işlem mevcut verileri siler).</p>
           </div>
         </div>
         <div className="flex items-center gap-3 w-full md:w-auto">
           <label className="px-5 py-2 cursor-pointer bg-white border border-red-200 text-danger rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-danger/10 transition-all shadow-sm active:scale-95 text-center flex-1 md:flex-none">
             Geri Yükle
             <input type="file" accept=".zip" className="hidden" onClick={(e) => (e.target as HTMLInputElement).value = ''} onChange={(e) => {
               const file = e.target.files?.[0];
               if (!file) return;
               
               setConfirmRestoreFile(file);
             }} />
           </label>
           <button 
             onClick={() => {
               window.location.href = '/api/backup/download';
             }}
             className="px-5 py-2 bg-danger border border-transparent text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-sm active:scale-95 text-center flex-1 md:flex-none"
           >
             Yedek İndir
           </button>
         </div>
      </div>

      {confirmRestoreFile && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
               <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
               <h3 className="text-xl font-black text-danger mb-2">DİKKAT</h3>
               <p className="text-sm font-medium text-text-muted mb-6">Mevcut sisteminizdeki tüm veriler (ürünler, satışlar, loglar) silinip yerine yüklediğiniz yedek dosyası geçecek. Bu işlem <span className="font-bold text-danger">Geri Alınamaz!</span></p>
               <p className="text-xs font-bold text-text-main mb-3">Onaylamak için büyük harflerle "ONAY" yazın:</p>
               <input 
                  type="text" 
                  autoFocus
                  className="form-input text-center font-black tracking-widest text-lg mb-6"
                  value={confirmInputText}
                  onChange={(e) => setConfirmInputText(e.target.value)}
                  placeholder="ONAY"
               />
               <div className="flex gap-3">
                 <button 
                   className="flex-1 bg-gray-100 text-text-main py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                   onClick={() => {
                     setConfirmRestoreFile(null);
                     setConfirmInputText("");
                   }}
                 >
                   İptal
                 </button>
                 <button 
                   className="flex-1 bg-danger text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                   disabled={confirmInputText !== "ONAY"}
                   onClick={() => {
                     const file = confirmRestoreFile;
                     setConfirmRestoreFile(null);
                     setConfirmInputText("");
                     
                     if (!file) return;

                     const formData = new FormData();
                     formData.append("zipfile", file);
                     
                     setRestoreProgress({ percentage: 0, text: "Yükleniyor... %0" });
                     
                     const xhr = new XMLHttpRequest();
                     xhr.open("POST", "/api/backup/restore", true);
                     
                     xhr.upload.onprogress = (event) => {
                       if (event.lengthComputable) {
                         const percent = Math.round((event.loaded / event.total) * 90);
                         setRestoreProgress({ percentage: percent, text: `Yükleniyor... %${percent}` });
                       }
                     };
                     
                     xhr.onload = () => {
                       if (xhr.status >= 200 && xhr.status < 300) {
                         setRestoreProgress({ percentage: 100, text: "Dosyalar çıkarılıyor ve geri yükleme tamamlanıyor..." });
                         setTimeout(() => {
                           alert("Sistem başarıyla yeni yedeğe geçirildi. Uygulama yeniden yüklenecek.");
                           window.location.reload();
                         }, 1000);
                       } else {
                         let errMsg = "Geri yükleme başarısız.";
                         try {
                           const err = JSON.parse(xhr.responseText);
                           if (err.error) errMsg = err.error;
                         } catch(e) {}
                         alert(errMsg);
                         setRestoreProgress(null);
                       }
                     };
                     
                     xhr.onerror = () => {
                       alert("Yükleme sırasında ağ hatası oluştu.");
                       setRestoreProgress(null);
                     };
                     
                     xhr.send(formData);
                   }}
                 >
                   Onaylıyorum
                 </button>
               </div>
           </div>
        </div>
      )}

      {restoreProgress && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
               <AlertCircle className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
               <h3 className="text-xl font-black text-text-main mb-2">Sistem Geri Yükleniyor</h3>
               <p className="text-sm font-medium text-text-muted mb-6">{restoreProgress.text}</p>
               <div className="w-full bg-gray-100 rounded-full h-3 mb-2 overflow-hidden">
                   <div 
                     className="bg-primary h-3 rounded-full transition-all duration-300 ease-out"
                     style={{ width: `${restoreProgress.percentage}%` }}
                   ></div>
               </div>
               <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-4">
                 Lütfen sekmeyi kapatmayın...
               </p>
           </div>
        </div>
      )}
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
