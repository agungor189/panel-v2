import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { 
  BarChart2, 
  Package, 
  Layers, 
  Filter, 
  AlertTriangle, 
  ShoppingCart, 
  Download,
  Calendar,
  Search,
  Network
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';

// --- Type definition ---
type ViewTab = 'cross' | 'material' | 'model' | 'size' | 'reorder';

export default function ProductAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<ViewTab>('cross');
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [materialFilter, setMaterialFilter] = useState('Tümü');
  const [modelFilter, setModelFilter] = useState('Tümü');
  const [sizeFilter, setSizeFilter] = useState('Tümü');
  const [tubeTypeFilter, setTubeTypeFilter] = useState('Tümü');

  const [targetStockDays, setTargetStockDays] = useState(60);
  const [safetyStockRate, setSafetyStockRate] = useState(20);
  const [minOrderQty, setMinOrderQty] = useState(50);
  
  // Data State
  const [summary, setSummary] = useState<any>({});
  const [materials, setMaterials] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [cross, setCross] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const q = new URLSearchParams();
      if (startDate) q.append('startDate', startDate);
      if (endDate) q.append('endDate', endDate);
      if (materialFilter !== 'Tümü') q.append('material', materialFilter);
      if (modelFilter !== 'Tümü') q.append('model', modelFilter);
      if (sizeFilter !== 'Tümü') q.append('size', sizeFilter);
      if (tubeTypeFilter !== 'Tümü') q.append('tubeType', tubeTypeFilter);

      const qs = q.toString();
      
      const [sumRes, matRes, modRes, szRes, crsRes, sugRes] = await Promise.all([
        api.get(`/analytics/products/summary?${qs}`),
        api.get(`/analytics/products/by-material?${qs}`),
        api.get(`/analytics/products/by-model?${qs}`),
        api.get(`/analytics/products/by-size?${qs}`),
        api.get(`/analytics/products/cross?${qs}`),
        api.get(`/analytics/products/reorder-suggestions?${qs}`),
      ]);

      setSummary(sumRes);
      setMaterials(matRes);
      setModels(modRes);
      setSizes(szRes);
      setCross(crsRes);
      
      // Calculate suggestions client-side or use backend
      const loadedSuggestions = sugRes.map((s: any) => {
        // days elapsed logic
        const days = 30; // assume 30 days period if no strict dates provided for MVP
        const dailyAvg = s.soldQty / (days > 0 ? days : 1);
        const targetReq = dailyAvg * targetStockDays;
        const safety = targetReq * (safetyStockRate / 100);
        let rawSugg = (targetReq + safety) - s.currentStock;
        if (rawSugg < 0) rawSugg = 0;
        
        let rounded = Math.ceil(rawSugg / minOrderQty) * minOrderQty;
        if (rawSugg > 0 && rawSugg < minOrderQty) rounded = minOrderQty;
        
        let priority = 'Talep Yok';
        if (s.soldQty > 0) {
          if (s.currentStock <= dailyAvg * 15) priority = 'Acil Sipariş';
          else if (s.currentStock <= dailyAvg * 30) priority = 'Sipariş Ver';
          else if (rawSugg > 0) priority = 'İzle';
          else priority = 'Sipariş Gerekmez';
        }

        const score = Math.min(100, Math.round(((s.soldQty / 100) * 40) + ((s.revenue / 1000) * 20)));
        
        return {
          ...s,
          dailyAvg: dailyAvg.toFixed(2),
          rawSugg: Math.round(rawSugg),
          rounded,
          priority,
          score
        };
      });

      setSuggestions(loadedSuggestions.sort((a: any, b: any) => b.score - a.score));

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => 
      Object.values(row).map(v => typeof v === 'string' ? `"${v}"` : v).join(',')
    ).join('\n');
    
    const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-primary" /> Ürün Analizi
          </h1>
          <p className="text-gray-500 font-medium mt-1">Materyal, model ve ölçü bazlı gelişmiş satış ve stok planlama raporları.</p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Materyal</label>
          <select value={materialFilter} onChange={e => setMaterialFilter(e.target.value)} className="w-[150px] text-sm border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
             <option>Tümü</option>
             <option>Alüminyum</option>
             <option>Demir Döküm</option>
             <option>Karbon Çelik</option>
             <option>PPR</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Model</label>
          <select value={modelFilter} onChange={e => setModelFilter(e.target.value)} className="w-[150px] text-sm border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
             <option>Tümü</option>
             <option>Tee</option>
             <option>Elbow</option>
             <option>3 Way</option>
             <option>4 Way</option>
             <option>5 Way</option>
             <option>Cross</option>
             <option>Base</option>
             <option>Coupling</option>
             <option>Long Tee</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Boru Tipi</label>
          <select value={tubeTypeFilter} onChange={e => setTubeTypeFilter(e.target.value)} className="w-[150px] text-sm border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
             <option>Tümü</option>
             <option>Yuvarlak</option>
             <option>Kare</option>
          </select>
        </div>
        
        <button onClick={fetchAnalytics} disabled={isLoading} className="bg-primary text-white font-bold px-6 py-2 rounded-xl flex items-center gap-2 hover:bg-primary/90 transition-all">
          <Search className="w-4 h-4" /> Filtrele
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-sm font-bold text-gray-500 flex items-center gap-2 mb-2"><Package className="w-4 h-4" /> Toplam Satılan Adet</p>
          <p className="text-3xl font-black text-gray-900">{summary.totalSoldQty || 0}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-sm font-bold text-gray-500 flex items-center gap-2 mb-2"><Layers className="w-4 h-4" /> En Çok Satan Materyal</p>
          <p className="text-xl font-bold text-primary truncate">{summary.topMaterial || '-'}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-sm font-bold text-gray-500 flex items-center gap-2 mb-2"><Network className="w-4 h-4" /> En Çok Satan Model</p>
          <p className="text-xl font-bold text-blue-600 truncate">{summary.topModel || '-'}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-sm font-bold text-gray-500 flex items-center gap-2 mb-2"><Filter className="w-4 h-4" /> En Çok Satan Ölçü</p>
          <p className="text-xl font-bold text-purple-600 truncate">{summary.topSize || '-'}</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'cross', label: 'Matris & Çapraz Analiz', icon: Network },
          { id: 'reorder', label: 'Akıllı Sipariş Önerisi', icon: ShoppingCart },
          { id: 'material', label: 'Materyal Raporu', icon: Layers },
          { id: 'model', label: 'Model Raporu', icon: Package },
          { id: 'size', label: 'Ölçü Raporu', icon: Filter },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ViewTab)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all text-sm whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-primary text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
         <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-sm">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500 font-bold">Veriler hesaplanıyor...</p>
         </div>
      ) : (
        <>
          {activeTab === 'material' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden">
               <div className="flex justify-between items-center mb-6">
                 <h2 className="text-lg font-black text-gray-900">Materyal Bazlı Analiz</h2>
                 <button onClick={() => downloadCSV(materials, 'materyal-analizi')} className="text-sm font-bold text-gray-600 flex items-center gap-2 hover:text-primary"><Download className="w-4 h-4" /> CSV İndir</button>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="h-64">
                    <h3 className="text-center font-bold text-gray-500 text-xs mb-2">Satılan Adet</h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={materials}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                        <XAxis dataKey="material" tick={{fontSize: 12}} />
                        <YAxis tick={{fontSize: 12}} />
                        <RechartsTooltip cursor={{fill: '#f8fafc'}} />
                        <Bar dataKey="soldQty" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-64">
                    <h3 className="text-center font-bold text-gray-500 text-xs mb-2">Talep Payı</h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                         <Pie data={materials} dataKey="soldQty" nameKey="material" cx="50%" cy="50%" outerRadius={80} label>
                            {materials.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                         </Pie>
                         <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
               </div>

               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                   <thead>
                     <tr className="text-gray-500 border-b border-gray-100">
                        <th className="py-3">Materyal</th>
                        <th className="py-3 text-right">Satılan Adet</th>
                        <th className="py-3 text-right">Mevcut Stok</th>
                        <th className="py-3 text-right">Stok Devir Hızı</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                     {materials.map(m => {
                        const ratio = m.currentStock > 0 ? (m.soldQty / m.currentStock * 100).toFixed(1) + '%' : '-';
                        return (
                         <tr key={m.material} className="hover:bg-gray-50">
                           <td className="py-4 font-bold text-gray-900">{m.material}</td>
                           <td className="py-4 text-right font-black text-primary">{m.soldQty}</td>
                           <td className="py-4 text-right font-bold text-gray-600">{m.currentStock}</td>
                           <td className="py-4 text-right"><span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg font-bold">{ratio}</span></td>
                         </tr>
                       )
                     })}
                   </tbody>
                 </table>
               </div>
            </div>
          )}

          {activeTab === 'model' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden">
               <div className="flex justify-between items-center mb-6">
                 <h2 className="text-lg font-black text-gray-900">Model Bazlı Analiz</h2>
                 <button onClick={() => downloadCSV(models, 'model-analizi')} className="text-sm font-bold text-gray-600 flex items-center gap-2 hover:text-primary"><Download className="w-4 h-4" /> CSV İndir</button>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                   <thead>
                     <tr className="text-gray-500 border-b border-gray-100">
                        <th className="py-3">Model</th>
                        <th className="py-3 text-right">Satılan Adet</th>
                        <th className="py-3 text-right">Mevcut Stok</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                     {models.map(m => (
                       <tr key={m.model} className="hover:bg-gray-50">
                         <td className="py-4 font-bold text-gray-900">{m.model}</td>
                         <td className="py-4 text-right font-black text-primary">{m.soldQty}</td>
                         <td className="py-4 text-right font-bold text-gray-600">{m.currentStock}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          )}

          {activeTab === 'size' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden">
               <div className="flex justify-between items-center mb-6">
                 <h2 className="text-lg font-black text-gray-900">Ölçü Bazlı Analiz</h2>
                 <button onClick={() => downloadCSV(sizes, 'olcu-analizi')} className="text-sm font-bold text-gray-600 flex items-center gap-2 hover:text-primary"><Download className="w-4 h-4" /> CSV İndir</button>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                   <thead>
                     <tr className="text-gray-500 border-b border-gray-100">
                        <th className="py-3">Ölçü</th>
                        <th className="py-3 text-right">Satılan Adet</th>
                        <th className="py-3 text-right">Mevcut Stok</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                     {sizes.map(m => (
                       <tr key={m.size} className="hover:bg-gray-50">
                         <td className="py-4 font-mono font-bold text-gray-900">{m.size}</td>
                         <td className="py-4 text-right font-black text-primary">{m.soldQty}</td>
                         <td className="py-4 text-right font-bold text-gray-600">{m.currentStock}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          )}

          {activeTab === 'cross' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden">
               <div className="flex justify-between items-center mb-6">
                 <h2 className="text-lg font-black text-gray-900">Çapraz Analiz (Materyal + Model + Ölçü)</h2>
                 <button onClick={() => downloadCSV(cross, 'capraz-analiz')} className="text-sm font-bold text-gray-600 flex items-center gap-2 hover:text-primary"><Download className="w-4 h-4" /> CSV İndir</button>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                   <thead>
                     <tr className="text-gray-500 border-b border-gray-100">
                        <th className="py-3">Kombinasyon (Mat - Mod - Ölçü)</th>
                        <th className="py-3">Boru Tipi</th>
                        <th className="py-3 text-center">SKU Adedi</th>
                        <th className="py-3 text-right">Satılan Adet</th>
                        <th className="py-3 text-right">Mevcut Stok</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                     {cross.map((c, idx) => (
                       <tr key={idx} className="hover:bg-gray-50">
                         <td className="py-4 font-bold text-gray-800">
                            {c.material} <span className="text-gray-400 font-normal mx-1">/</span> {c.model} <span className="text-gray-400 font-normal mx-1">/</span> <span className="font-mono text-xs">{c.size}</span>
                         </td>
                         <td className="py-4 text-gray-600">{c.tubeType}</td>
                         <td className="py-4 text-center font-bold text-indigo-600">{c.skuCount}</td>
                         <td className="py-4 text-right font-black text-primary">{c.soldQty}</td>
                         <td className="py-4 text-right font-bold text-gray-600">{c.currentStock}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          )}

          {activeTab === 'reorder' && (
            <div className="space-y-6">
               <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                 <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-indigo-600"/> Sipariş Önerisi Ayarları</h2>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Hedef Stok Süresi (Gün)</label>
                      <input type="number" min="15" value={targetStockDays} onChange={e => setTargetStockDays(parseInt(e.target.value) || 30)} className="w-full text-lg font-bold bg-gray-50 border-gray-200 rounded-xl px-4 py-3" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Güvenlik Stoku Oranı (%)</label>
                      <input type="number" min="0" value={safetyStockRate} onChange={e => setSafetyStockRate(parseInt(e.target.value) || 0)} className="w-full text-lg font-bold bg-gray-50 border-gray-200 rounded-xl px-4 py-3" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Minimum Sipariş Yuvarlama</label>
                      <input type="number" min="1" value={minOrderQty} onChange={e => setMinOrderQty(parseInt(e.target.value) || 1)} className="w-full text-lg font-bold bg-gray-50 border-gray-200 rounded-xl px-4 py-3" />
                    </div>
                 </div>
                 <div className="mt-4">
                    <button onClick={fetchAnalytics} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl transition-all">Önerileri Yeniden Hesapla</button>
                 </div>
               </div>

               <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden">
                 <div className="flex justify-between items-center mb-6">
                   <h2 className="text-lg font-black text-gray-900">Akıllı Sipariş Önerileri</h2>
                   <button onClick={() => downloadCSV(suggestions, 'siparis-onerileri')} className="text-sm font-bold bg-green-50 text-green-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-100"><Download className="w-4 h-4" /> Excel'e Aktar</button>
                 </div>
                 
                 <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm whitespace-nowrap">
                     <thead>
                       <tr className="text-gray-500 border-b border-gray-100">
                          <th className="py-3">SKU</th>
                          <th className="py-3">Model Detayı</th>
                          <th className="py-3 text-center">Talep Skoru</th>
                          <th className="py-3 text-right">Satılan Adet</th>
                          <th className="py-3 text-right">Mevcut Stok</th>
                          <th className="py-3 text-right text-indigo-600 font-bold">Önerilen Sipariş</th>
                          <th className="py-3 text-center">Öncelik</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                       {suggestions.slice(0, 100).map(s => (
                         <tr key={s.id} className="hover:bg-gray-50">
                           <td className="py-4 font-mono font-bold text-gray-600 text-xs">{s.sku}</td>
                           <td className="py-4">
                              <p className="font-bold text-gray-900">{s.name}</p>
                              <p className="text-xs text-gray-500">{s.material} / {s.model} / {s.size}</p>
                           </td>
                           <td className="py-4 text-center">
                              <span className="inline-block w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-black leading-8 text-center text-xs">{s.score}</span>
                           </td>
                           <td className="py-4 text-right font-black text-gray-900">{s.soldQty}</td>
                           <td className="py-4 text-right font-bold text-gray-500">{s.currentStock}</td>
                           <td className="py-4 text-right font-black text-lg text-indigo-600 bg-indigo-50/30">{s.rounded > 0 ? `+${s.rounded}` : '-'}</td>
                           <td className="py-4 text-center">
                             <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                s.priority === 'Acil Sipariş' ? 'bg-red-100 text-red-700' :
                                s.priority === 'Sipariş Ver' ? 'bg-orange-100 text-orange-700' :
                                s.priority === 'İzle' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-500'
                             }`}>
                               {s.priority}
                             </span>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
