import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertTriangle,
  RefreshCw,
  Package
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export function WidgetRenderer({ widget, data, m, FormatAmount, onNavigate, getGrossProfitEstimate, getAvgMarginEstimate }: any) {
  if (widget.widget_type === 'total_revenue') {
    return (
      <div className="w-full h-full p-6 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
               <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider leading-tight">{widget.config.title || 'BU AY TOPLAM CİRO'}</h3>
         </div>
         <div className="mt-auto pt-4 flex flex-col items-start gap-1.5">
            <div className="text-3xl font-black text-gray-900 leading-none"><FormatAmount amount={m?.totalRevenue || 0} /></div>
            <div className="text-[11px] font-bold text-green-600 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> 12% Geçen aya göre</div>
         </div>
      </div>
    );
  }
  
  if (widget.widget_type === 'total_expense') {
    return (
      <div className="w-full h-full p-6 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
               <TrendingDown className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider leading-tight">{widget.config.title || 'TOPLAM GİDERLER'}</h3>
         </div>
         <div className="mt-auto pt-4 flex flex-col items-start gap-1.5">
            <div className="text-3xl font-black text-gray-900 leading-none"><FormatAmount amount={m?.totalExpenses || 0} /></div>
            <div className="text-[11px] font-bold text-red-600 flex items-center gap-1"><TrendingDown className="w-3 h-3" /> 5% Lojistik artışı</div>
         </div>
      </div>
    );
  }

  if (widget.widget_type === 'net_profit') {
    return (
      <div className="w-full h-full p-6 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
               <DollarSign className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider leading-tight">{widget.config.title || 'TAHMİNİ NET KAR'}</h3>
         </div>
         <div className="mt-auto pt-4 flex flex-col items-start gap-1.5">
            <div className="text-3xl font-black text-gray-900 leading-none"><FormatAmount amount={m?.netProfit || 0} /></div>
            <div className="text-[11px] font-bold text-green-600">Marj: %{m?.totalRevenue > 0 ? ((m.netProfit / m.totalRevenue) * 100).toFixed(1) : 0}</div>
         </div>
      </div>
    );
  }

  if (widget.widget_type === 'critical_stock') {
    return (
      <div className="w-full h-full p-6 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
               <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider leading-tight">{widget.config.title || 'KRİTİK STOK'}</h3>
         </div>
         <div className="mt-auto pt-4 flex flex-col items-start gap-1.5">
            <div className="text-3xl font-black text-red-600 leading-none">{m?.lowStockCount || 0} <span className="text-lg text-red-500 font-bold ml-1">Ürün</span></div>
            <div className="text-[11px] font-bold text-gray-500">Acil sipariş gerekli</div>
         </div>
      </div>
    );
  }

  if (widget.widget_type === 'total_stock_value') {
    return (
      <div className="w-full h-full p-6 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
               <Package className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider leading-tight">{widget.config.title || 'TOPLAM STOK SATIŞ DEĞERİ'}</h3>
         </div>
         <div className="mt-auto pt-4 flex flex-col items-start gap-1.5">
            <div className="text-3xl font-black text-gray-900 leading-none"><FormatAmount amount={m?.totalStockSalesValue || 0} /></div>
            <div className="text-[11px] font-bold text-green-600">Mevcut stokların potansiyel değeri</div>
         </div>
      </div>
    );
  }

  if (widget.widget_type === 'total_stock_cost') {
    return (
      <div className="w-full h-full p-6 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
               <Package className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider leading-tight">{widget.config.title || 'TOPLAM STOK MALİYETİ'}</h3>
         </div>
         <div className="mt-auto pt-4 flex flex-col items-start gap-1.5">
            <div className="text-3xl font-black text-gray-900 leading-none"><FormatAmount amount={m?.totalBufferedCostValue || 0} /></div>
            <div className="text-[11px] font-bold text-red-600">Buffer dahil ortalama stok maliyeti</div>
         </div>
      </div>
    );
  }

  if (widget.widget_type === 'est_gross_profit') {
    return (
      <div className="w-full h-full p-6 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center shrink-0">
               <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider leading-tight">{widget.config.title || 'TAHMİNİ BRÜT KÂR'}</h3>
         </div>
         <div className="mt-auto pt-4 flex flex-col items-start gap-1.5">
            <div className="text-3xl font-black text-gray-900 leading-none"><FormatAmount amount={getGrossProfitEstimate() || 0} /></div>
            <div className="text-[11px] font-bold text-green-600">Satıştan beklenen potansiyel brüt kâr</div>
         </div>
      </div>
    );
  }

  if (widget.widget_type === 'avg_profit_margin') {
    return (
      <div className="w-full h-full p-6 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
               <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider leading-tight">{widget.config.title || 'ORTALAMA KÂR MARJI'}</h3>
         </div>
         <div className="mt-auto pt-4 flex flex-col items-start gap-1.5">
            <div className="text-3xl font-black text-gray-900 leading-none">%{getAvgMarginEstimate()?.toFixed(1) || '0.0'}</div>
            <div className="text-[11px] font-bold text-green-600">Stokların ortalama satış kâr marjı</div>
         </div>
      </div>
    );
  }

  if (widget.widget_type === 'monthly_cash') {
    return (
      <div className="w-full h-full p-6 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
               <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider leading-tight">{widget.config.title || 'KASA BAKİYESİ'}</h3>
         </div>
         <div className="mt-auto pt-4 flex flex-col items-start gap-1">
            <div className="text-3xl font-black text-gray-900 leading-none"><FormatAmount amount={m?.totalCash || 0} /></div>
         </div>
      </div>
    );
  }
  
  if (widget.widget_type === 'pending_payments') {
    return (
      <div className="w-full h-full p-6 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
               <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider leading-tight">{widget.config.title || 'BEKLEYEN ÖDEMELER'}</h3>
         </div>
         <div className="mt-auto pt-4 flex flex-col items-start gap-1">
            <div className="text-3xl font-black text-gray-900 leading-none"><FormatAmount amount={0} /></div>
         </div>
      </div>
    );
  }

  if (widget.widget_type === 'financial_trend') {
    return (
       <div className="w-full h-full p-6 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
             <h3 className="font-bold text-gray-900 text-lg">{widget.config.title || 'Finansal Gelişim'}</h3>
             <div className="flex items-center gap-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-500"></div> GELİR</span>
                <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500"></div> GİDER</span>
                <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div> NET KAR</span>
             </div>
          </div>
          <div className="flex-1 min-h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.charts?.monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => Math.abs(val) > 1000 ? `${(val/1000).toFixed(0)}k` : val} />
                <Tooltip 
                   cursor={{ stroke: '#f1f5f9', strokeWidth: 2 }}
                   contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" name="Gelir" dataKey="income" stroke="#10B981" strokeWidth={3} dot={{ strokeWidth: 2, r: 4, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0, fill: '#10B981' }} />
                <Line type="monotone" name="Gider" dataKey="expense" stroke="#EF4444" strokeWidth={3} dot={{ strokeWidth: 2, r: 4, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0, fill: '#EF4444' }} />
                <Line type="monotone" name="Net Kar" dataKey="profit" stroke="#3B82F6" strokeWidth={3} dot={{ strokeWidth: 2, r: 4, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0, fill: '#3B82F6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
       </div>
    );
  }

  if (widget.widget_type === 'platform_sales') {
    return (
       <div className="w-full h-full p-6 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col">
          <h3 className="font-bold text-gray-900 text-lg mb-6">{widget.config.title || 'Platform Satışları'}</h3>
          <div className="flex-1 min-h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.charts?.platformRevenue} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="platform" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => Math.abs(val) > 1000 ? `${(val/1000).toFixed(0)}k` : val} />
                <Tooltip 
                   cursor={{ fill: '#f8fafc' }}
                   contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="total" name="Ciro" fill="#3B82F6" radius={[6, 6, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
       </div>
    );
  }

  if (widget.widget_type === 'recent_transactions') {
    return (
       <div className="w-full h-full p-0 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 pb-4 flex justify-between items-center border-b border-gray-100 bg-white sticky top-0 z-10">
             <h3 className="font-bold text-gray-900 text-lg">{widget.config.title || 'Son İşlemler'}</h3>
             <button onClick={() => onNavigate('transactions')} className="text-xs font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wider transition-colors">Hepsini Gör</button>
          </div>
          <div className="flex-1 overflow-auto min-w-0 w-full">
             <table className="w-full text-left min-w-[500px]">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                  <tr>
                     <th className="py-2.5 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tarih</th>
                     <th className="py-2.5 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Kategori</th>
                     <th className="py-2.5 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Tutar</th>
                     <th className="py-2.5 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center">Platform / Tür</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data?.recentTransactions?.slice(0, 10).map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-6 text-sm text-gray-500 font-mono">
                        {new Date(tx.date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                      </td>
                      <td className="py-3 px-6 text-sm font-semibold text-gray-900">{tx.category}</td>
                      <td className="py-3 px-6 text-sm font-bold text-right">
                        <span className={`inline-flex items-center justify-end w-full ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.type === 'Income' ? '+' : '-'}<FormatAmount align="right" amount={tx.amount} />
                        </span>
                      </td>
                      <td className="py-3 px-6 text-center">
                        {tx.platform ? (
                          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200 rounded-md">
                            {tx.platform}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200 rounded-md">
                            Nakit
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
       </div>
    );
  }

  if (widget.widget_type === 'low_stock_list') {
    return (
       <div className="w-full h-full p-0 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 pb-4 flex justify-between items-center border-b border-gray-100 bg-white sticky top-0 z-10">
             <h3 className="font-bold text-gray-900 text-lg">{widget.config.title || 'Kritik Stok Uyarıları'}</h3>
             <button onClick={() => onNavigate('products')} className="text-xs font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wider transition-colors">Tümünü Gör</button>
          </div>
          <div className="flex-1 overflow-auto min-w-0 w-full">
            <table className="w-full text-left min-w-[500px]">
               <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10 hidden sm:table-header-group">
                  <tr>
                     <th className="py-2.5 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ürün Adı</th>
                     <th className="py-2.5 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider">SKU / Kategori</th>
                     <th className="py-2.5 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center">Kritik Sınır</th>
                     <th className="py-2.5 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Mevcut Stok</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                  {data?.metrics?.lowStockProducts?.slice(0, 10).map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors group">
                       <td className="py-3 px-6">
                         <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                               {p.cover_image ? <img src={p.cover_image} alt={p.title} className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-gray-300" />}
                            </div>
                            <span className="font-bold text-sm text-gray-900 line-clamp-1 truncate max-w-[150px]" title={p.title}>{p.title}</span>
                         </div>
                       </td>
                       <td className="py-3 px-6">
                         <div className="flex flex-col">
                           <span className="text-xs font-mono text-gray-500">{p.sku}</span>
                           <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{p.category}</span>
                         </div>
                       </td>
                       <td className="py-3 px-6 text-center">
                         <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md">{p.min_stock_level || 10}</span>
                       </td>
                       <td className="py-3 px-6 text-right">
                         <span className="text-sm font-black text-red-600">{p.total_stock} Adet</span>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
          </div>
       </div>
    );
  }

  return (
    <div className="w-full h-full p-6 flex flex-col items-center justify-center rounded-2xl bg-white border border-gray-300 shadow-sm">
      <p className="text-sm text-gray-500">Bilinmeyen Widget</p>
      <p className="text-xs text-gray-400 font-mono">{widget.widget_type}</p>
    </div>
  );
}
