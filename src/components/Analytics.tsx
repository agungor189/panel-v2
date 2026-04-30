import { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  ShoppingBag,
  ArrowUpRight,
  AlertTriangle,
  Package,
  Activity,
  Layers,
  Banknote,
  Search
} from 'lucide-react';
import { api } from '../lib/api';
import { useCurrency } from '../CurrencyContext';
import { Transaction, Product, Settings } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F43F5E'];

type TabView = 'financial' | 'products' | 'platform' | 'cashflow' | 'risk';

export default function Analytics({ settings }: { settings: Settings | null }) {
  const { FormatAmount, activeRate } = useCurrency();
  const [activeTab, setActiveTab] = useState<TabView>('financial');
  
  const [sales, setSales] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cashTxs, setCashTxs] = useState<any[]>([]);
  const [cashAccounts, setCashAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [salesData, txData, prodData, cxData, caData] = await Promise.all([
          api.get('/sales'),
          api.get('/transactions'),
          api.get('/products'),
          api.get('/cash-transactions'),
          api.get('/cash-accounts')
        ]);
        setSales(salesData);
        setTransactions(txData);
        setProducts(prodData);
        setCashTxs(cxData);
        setCashAccounts(caData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  // --- FINANSAL ANALIZ (Financial Analysis) ---
  const financialMonthly = useMemo(() => {
    const groups: Record<string, { month: string, income: number, expense: number }> = {};
    sales.forEach(s => {
      const date = new Date(s.created_at);
      const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      if (!groups[key]) groups[key] = { month: key, income: 0, expense: 0 };
      groups[key].income += s.total_amount || 0;
    });

    transactions.filter(t => t.type === 'Expense').forEach(t => {
      const date = new Date(t.date);
      const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      if (!groups[key]) groups[key] = { month: key, income: 0, expense: 0 };
      groups[key].expense += t.amount || 0;
    });

    return Object.values(groups).sort((a, b) => a.month.localeCompare(b.month)).map(d => ({
      ...d,
      net: d.income - d.expense,
      margin: d.income > 0 ? ((d.income - d.expense) / d.income * 100).toFixed(1) : 0
    }));
  }, [sales, transactions]);

  // --- ÜRÜN ANALİZİ (Product Analysis) ---
  const productStats = useMemo(() => {
     // Join products with sales performance
     return products.map(p => {
        let soldQty = 0;
        let revenue = 0;
        let profit = 0;
        
        // This is a rough estimation since we don't fetch sale_items. 
        // We can just count total transactions from transactions table if products are linked.
        const productTxs = transactions.filter(t => t.product_id === p.id);
        const pRevenue = productTxs.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
        const soldCount = productTxs.filter(t => t.type === 'Income').length; // approximation
        
        let estComm = 0;
        productTxs.filter(t => t.type === 'Income').forEach(t => {
          const rate = settings?.commission_rates[t.platform] || 0;
          estComm += (t.amount * rate) / 100;
        });

        const pProfit = pRevenue - (soldCount * p.purchase_cost) - estComm;
        
        return {
           ...p,
           soldQty: soldCount,
           revenue: pRevenue,
           profit: pProfit,
           margin: pRevenue > 0 ? (pProfit / pRevenue) * 100 : 0
        };
     }).sort((a, b) => b.revenue - a.revenue);
  }, [products, transactions, settings]);

  // --- RİSK ANALİZİ (Risk Analysis) ---
  const riskStats = useMemo(() => {
     const threshold = parseInt(settings?.low_stock_threshold?.toString() || '5');
     const deadThresholdMillis = 30 * 24 * 60 * 60 * 1000; // 30 days
     const now = new Date().getTime();

     return productStats.map(p => {
        const productTxs = transactions.filter(t => t.product_id === p.id && t.type === 'Income');
        const lastSale = productTxs.length > 0 ? new Date(Math.max(...productTxs.map(t => new Date(t.date).getTime()))) : null;
        const totalStock = (p.platforms ? p.platforms.reduce((sum, s) => sum + (s.stock || 0), 0) : 0);
        
        const isCritical = totalStock < threshold && p.status === 'Active';
        const isDead = p.status === 'Active' && totalStock > 0 && (!lastSale || (now - lastSale.getTime() > deadThresholdMillis));
        const isLosingMoney = p.soldQty > 0 && p.margin < 0;
        
        return {
           ...p,
           totalStock,
           lastSale,
           isCritical,
           isDead,
           isLosingMoney
        };
     });
  }, [productStats, transactions, settings]);

  // --- NAKİT AKIŞI ANALİZİ (Cashflow Analysis) ---
  const cashFlowMonthly = useMemo(() => {
    const groups: Record<string, { month: string, in: number, out: number }> = {};
    cashTxs.forEach(ctx => {
      const date = new Date(ctx.created_at);
      const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      if (!groups[key]) groups[key] = { month: key, in: 0, out: 0 };
      if (ctx.type === 'IN') groups[key].in += ctx.amount;
      if (ctx.type === 'OUT') groups[key].out += ctx.amount;
    });

    return Object.values(groups).sort((a, b) => a.month.localeCompare(b.month)).map(d => ({
      ...d,
      net: d.in - d.out
    }));
  }, [cashTxs]);

  // --- KUR ETKİSİ ANALİZİ (FX Impact) ---
  const fxImpact = useMemo(() => {
     let originalStockCost = 0;
     let currentStockCost = 0;

     products.forEach(p => {
        const totalStock = (p.platforms ? p.platforms.reduce((sum: number, s: any) => sum + (s.stock || 0), 0) : 0);
        if (totalStock > 0 && p.purchase_price_usd > 0) {
           originalStockCost += (totalStock * p.purchase_cost);
           currentStockCost += (totalStock * (p.purchase_price_usd * activeRate));
        }
     });

     return {
        originalStockCost,
        currentStockCost,
        diff: currentStockCost - originalStockCost
     };
  }, [products, activeRate]);
  const platformStats = useMemo(() => {
      const stats: Record<string, { revenue: number, profit: number, count: number, commission: number }> = {};
      sales.forEach(s => {
         if (!stats[s.platform]) stats[s.platform] = { revenue: 0, profit: 0, count: 0, commission: 0 };
         stats[s.platform].revenue += s.total_amount;
         stats[s.platform].profit += s.net_profit;
         stats[s.platform].count += 1;
         
         const cRate = settings?.commission_rates?.[s.platform] || 0;
         stats[s.platform].commission += (s.total_amount * cRate) / 100;
      });
      return Object.entries(stats).map(([platform, data]) => ({
         platform, ...data, margin: data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0
      })).sort((a,b) => b.revenue - a.revenue);
  }, [sales, settings]);


  if (loading) return <div className="p-8 text-center text-gray-500 font-medium">Analizler hazırlanıyor...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h1 className="text-2xl font-black text-gray-900 tracking-tight">Akıllı Analizler</h1>
           <p className="text-sm font-medium text-gray-500 mt-1">Verilerinizi kazanca dönüştüren derinlemesine içgörüler</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
         {[
           { id: 'financial', label: 'Finansal Analiz', icon: TrendingUp },
           { id: 'products', label: 'Ürün Analizi', icon: Package },
           { id: 'platform', label: 'Platform Analizi', icon: Layers },
           { id: 'cashflow', label: 'Nakit Akışı', icon: Banknote },
           { id: 'risk', label: 'Risk Analizi', icon: AlertTriangle }
         ].map(tab => (
           <button
             key={tab.id}
             onClick={() => setActiveTab(tab.id as TabView)}
             className={cn(
               "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
               activeTab === tab.id 
                 ? "bg-gray-900 text-white shadow-md" 
                 : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
             )}
           >
             <tab.icon className="w-4 h-4" />
             {tab.label}
           </button>
         ))}
      </div>

      {activeTab === 'financial' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-2">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 card p-6">
                <h3 className="font-bold text-lg text-gray-900 mb-6">Aylık Gelir ve Gider Trendi</h3>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financialMonthly}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend />
                      <Bar dataKey="income" name="Ciro" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" name="Gider" fill="#EF4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="net" name="Net Kar" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="space-y-6 flex flex-col">
                  <div className="card p-6 flex-1">
                     <h3 className="font-bold text-lg text-gray-900 mb-6">Kar Marjı Trendi (%)</h3>
                     <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={financialMonthly}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                          <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                          <Line type="monotone" name="Marj (%)" dataKey="margin" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="card p-6">
                     <div className="flex items-center gap-3 mb-4">
                        <TrendingUp className={cn("w-6 h-6", fxImpact.diff >= 0 ? "text-green-500" : "text-red-500")} />
                        <h3 className="font-bold text-lg text-gray-900">Stok Kur Etkisi</h3>
                     </div>
                     <p className="text-sm text-gray-600 mb-4">Mevcut stoklarınızın alım kuru ile güncel kur arasındaki TL farkı.</p>
                     
                     <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                           <span className="text-gray-500">Orijinal Alım Maliyeti:</span>
                           <span className="font-semibold"><FormatAmount amount={fxImpact.originalStockCost} /></span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                           <span className="text-gray-500">Güncel Kur Maliyeti:</span>
                           <span className="font-semibold"><FormatAmount amount={fxImpact.currentStockCost} /></span>
                        </div>
                        <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                           <span className="font-bold text-gray-900">Net Etki:</span>
                           <span className={cn("font-black text-lg", fxImpact.diff >= 0 ? "text-green-600" : "text-red-600")}>
                             {fxImpact.diff > 0 ? "+" : ""}<FormatAmount amount={fxImpact.diff} />
                           </span>
                        </div>
                     </div>
                  </div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-2">
           <div className="card p-6 overflow-hidden">
             <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-gray-900">Ürün Performans Sıralaması</h3>
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{products.length} Ürün Listelendi</span>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="py-4 font-bold text-sm text-gray-500">Ürün</th>
                      <th className="py-4 font-bold text-sm text-gray-500 text-right">Tahmini Satış</th>
                      <th className="py-4 font-bold text-sm text-gray-500 text-right">Tahmini Ciro</th>
                      <th className="py-4 font-bold text-sm text-gray-500 text-right">T. Net Kar</th>
                      <th className="py-4 font-bold text-sm text-gray-500 text-right">Marj</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {productStats.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="py-4 font-medium text-gray-900 flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-400">
                            <Package className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-bold">{p.title}</div>
                            <div className="text-xs text-gray-500">{p.sku}</div>
                          </div>
                        </td>
                        <td className="py-4 text-right text-sm">{p.soldQty} Adet</td>
                        <td className="py-4 text-right text-sm font-semibold text-gray-900"><FormatAmount align="right" amount={p.revenue} /></td>
                        <td className="py-4 text-right text-sm font-bold text-green-600"><FormatAmount align="right" amount={p.profit} /></td>
                        <td className="py-4 text-right text-sm font-semibold">
                          <span className={cn("px-2 py-0.5 rounded-full text-xs", p.margin >= 20 ? "bg-green-100 text-green-800" : p.margin > 0 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800")}>
                            %{p.margin.toFixed(1)}
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

      {activeTab === 'platform' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-2">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-6">
                 <h3 className="font-bold text-lg text-gray-900 mb-6">Platform Ciro Dağılımı</h3>
                 <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={platformStats}
                          innerRadius={70}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="revenue"
                          nameKey="platform"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {platformStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                 </div>
              </div>
              <div className="card p-6">
                 <h3 className="font-bold text-lg text-gray-900 mb-6">Platform Karlılık Tablosu</h3>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
                       <thead>
                         <tr className="border-b border-gray-100">
                           <th className="py-3 font-bold text-sm text-gray-500">Platform</th>
                           <th className="py-3 font-bold text-sm text-gray-500 text-right">Sipariş</th>
                           <th className="py-3 font-bold text-sm text-gray-500 text-right">Ciro</th>
                           <th className="py-3 font-bold text-sm text-gray-500 text-right">Tahmini Komisyon</th>
                           <th className="py-3 font-bold text-sm text-gray-500 text-right">Kar Marjı</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-50">
                         {platformStats.map((p, i) => (
                           <tr key={p.platform} className="hover:bg-gray-50">
                              <td className="py-4 font-bold text-gray-900 flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                {p.platform}
                              </td>
                              <td className="py-4 text-right text-sm">{p.count}</td>
                              <td className="py-4 text-right text-sm font-semibold"><FormatAmount align="right" amount={p.revenue} /></td>
                              <td className="py-4 text-right text-sm text-gray-500"><FormatAmount align="right" amount={p.commission} /></td>
                              <td className="py-4 text-right text-sm">
                                <span className={cn("px-2 py-1 rounded-md font-bold text-xs", p.margin >= 15 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                                  %{p.margin.toFixed(1)}
                                </span>
                              </td>
                           </tr>
                         ))}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'cashflow' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-2">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 card p-6">
                <h3 className="font-bold text-lg text-gray-900 mb-6">Aylık Nakit Akışı Kapsamı</h3>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashFlowMonthly}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend />
                      <Bar dataKey="in" name="Nakit Giriş" fill="#4B5563" radius={[4, 4, 0, 0]} stackId="a" />
                      <Bar dataKey="out" name="Nakit Çıkış" fill="#FCA5A5" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="card p-6">
                 <h3 className="font-bold text-lg text-gray-900 mb-6">Kasa ve Bekleyen Analizi</h3>
                 <div className="space-y-6">
                    <div>
                       <h4 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Nakit ve Banka</h4>
                       <div className="space-y-3">
                          {cashAccounts.filter(c => c.type !== 'platform').map(c => {
                             const balance = c.opening_balance + c.total_in - c.total_out;
                             return (
                               <div key={c.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50 flex justify-between items-center">
                                  <span className="text-sm font-bold text-gray-700">{c.name}</span>
                                  <span className="text-base font-black text-gray-900">
                                     {c.currency === 'TRY' ? <FormatAmount amount={balance} /> : `${balance.toFixed(2)} ${c.currency}`}
                                  </span>
                               </div>
                             );
                          })}
                       </div>
                    </div>
                    <div>
                       <h4 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Platformdaki Bekleyenler</h4>
                       <div className="space-y-3">
                          {cashAccounts.filter(c => c.type === 'platform').map(c => {
                             const balance = c.opening_balance + c.total_in - c.total_out;
                             return (
                               <div key={c.id} className="p-3 rounded-xl border border-orange-100 bg-orange-50 flex justify-between items-center">
                                  <span className="text-sm font-bold text-orange-800">{c.name}</span>
                                  <span className="text-base font-black text-orange-900">
                                     {c.currency === 'TRY' ? <FormatAmount amount={balance} /> : `${balance.toFixed(2)} ${c.currency}`}
                                  </span>
                               </div>
                             );
                          })}
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'risk' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-2">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card border-l-4 border-l-orange-500 p-6">
                 <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-6 h-6 text-orange-500" />
                    <h3 className="font-bold text-lg text-gray-900">Kritik Stok Uyarısı</h3>
                 </div>
                 <p className="text-sm text-gray-600 mb-4">Stok seviyesi belirlenen kritik limitin altına düşen ürünler.</p>
                 <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {riskStats.filter(p => p.isCritical).map(p => (
                       <div key={p.id} className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                          <div>
                            <p className="text-sm font-bold text-gray-900">{p.title}</p>
                            <p className="text-xs text-orange-600 font-medium">Stok: {p.totalStock} Adet</p>
                          </div>
                       </div>
                    ))}
                    {riskStats.filter(p => p.isCritical).length === 0 && (
                      <p className="text-xs text-gray-500">Tüm ürünlerin stoku yeterli seviyede.</p>
                    )}
                 </div>
              </div>
              
              <div className="card border-l-4 border-l-red-500 p-6">
                 <div className="flex items-center gap-3 mb-4">
                    <TrendingDown className="w-6 h-6 text-red-500" />
                    <h3 className="font-bold text-lg text-gray-900">Hareketsiz Ürünler</h3>
                 </div>
                 <p className="text-sm text-gray-600 mb-4">Son 30 gündür satışı gerçekleşmeyen stoklu ürünler.</p>
                 <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {riskStats.filter(p => p.isDead).map(p => (
                       <div key={p.id} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                          <div>
                            <p className="text-sm font-bold text-gray-900">{p.title}</p>
                            <p className="text-xs text-red-600 font-medium">Son Satış: {p.lastSale ? p.lastSale.toLocaleDateString('tr-TR') : 'Hiç satılmadı'}</p>
                          </div>
                       </div>
                    ))}
                    {riskStats.filter(p => p.isDead).length === 0 && (
                      <p className="text-xs text-gray-500">Hareketsiz ürün bulunmuyor.</p>
                    )}
                 </div>
              </div>

              <div className="card border-l-4 border-l-purple-500 p-6">
                 <div className="flex items-center gap-3 mb-4">
                    <Activity className="w-6 h-6 text-purple-500" />
                    <h3 className="font-bold text-lg text-gray-900">Zararına Satışlar</h3>
                 </div>
                 <p className="text-sm text-gray-600 mb-4">Birim maliyet + komisyon yükü, satış fiyatını aşan ürünler.</p>
                 <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {riskStats.filter(p => p.isLosingMoney).map(p => (
                       <div key={p.id} className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                          <div>
                            <p className="text-sm font-bold text-gray-900">{p.title}</p>
                            <p className="text-xs text-purple-600 font-medium whitespace-nowrap">Marj: %{p.margin.toFixed(1)} <br/>(<FormatAmount amount={p.profit} />)</p>
                          </div>
                       </div>
                    ))}
                    {riskStats.filter(p => p.isLosingMoney).length === 0 && (
                      <p className="text-xs text-gray-500">Zararına satan ürün tespit edilmedi.</p>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}
