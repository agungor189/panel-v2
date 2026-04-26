import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertTriangle,
  ArrowUpRight,
  Package,
} from 'lucide-react';
import { api, formatCurrency } from '../lib/api';
import { DashboardMetrics, Product } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DashboardProps {
  onNavigate: (view: any) => void;
  onProductClick: (id: string) => void;
}

export default function Dashboard({ onNavigate, onProductClick }: DashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [chartData, setChartData] = useState<any>(null);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [showLowStockModal, setShowLowStockModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const metricsData = await api.get('/dashboard/metrics');
      const chartsData = await api.get('/dashboard/charts');
      const allProducts = await api.get('/products');
      const settings = await api.get('/settings');
      const transactions = await api.get('/transactions');

      setMetrics(metricsData);
      setChartData(chartsData);
      
      const threshold = parseInt(settings.low_stock_threshold);
      // This is a simplified check for the dashboard
      const low = allProducts.filter((p: any) => p.total_stock <= threshold && p.status === 'Active');
      setLowStockProducts(low);
      setRecentTransactions(transactions.slice(0, 10));
    } catch (err) {
      console.error("Dashboard load error", err);
    }
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { grid: { display: false } },
      x: { grid: { display: false } }
    }
  };

  const lineChartData = {
    labels: chartData?.monthlyData?.map((d: any) => d.month) || [],
    datasets: [
      {
        label: 'Gelir',
        data: chartData?.monthlyData?.map((d: any) => d.income) || [],
        borderColor: '#10B981',
        backgroundColor: '#10B981',
        tension: 0.4,
      },
      {
        label: 'Gider',
        data: chartData?.monthlyData?.map((d: any) => d.expense) || [],
        borderColor: '#EF4444',
        backgroundColor: '#EF4444',
        tension: 0.4,
      }
    ]
  };

  const platformChartData = {
    labels: chartData?.platformRevenue?.map((d: any) => d.platform) || [],
    datasets: [
      {
        data: chartData?.platformRevenue?.map((d: any) => d.total) || [],
        backgroundColor: ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EC4899', '#64748B'],
        borderRadius: 8,
      }
    ]
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard 
          title="Bu Ay Toplam Ciro" 
          value={formatCurrency(metrics?.totalRevenue || 0)} 
          icon={TrendingUp} 
          trend="↑ 12% Geçen aya göre" 
          positive 
          color="text-success"
          bg="bg-green-50"
        />
        <MetricCard 
          title="Toplam Giderler" 
          value={formatCurrency(metrics?.totalExpenses || 0)} 
          icon={TrendingDown} 
          trend="↑ 5% Lojistik artışı" 
          positive={false}
          color="text-danger"
          bg="bg-red-50"
        />
        <MetricCard 
          title="Tahmini Net Kar" 
          value={formatCurrency(metrics?.netProfit || 0)} 
          icon={DollarSign} 
          trend={`Marj: %${metrics?.totalRevenue ? ((metrics.netProfit / metrics.totalRevenue) * 100).toFixed(1) : '0'}`} 
          positive
          color="text-primary"
          bg="bg-blue-50"
        />
        <MetricCard 
          title="Kritik Stok" 
          value={`${metrics?.lowStockCount || 0} Ürün`} 
          icon={AlertTriangle} 
          trend="Acil sipariş gerekli"
          positive={false}
          color="text-danger"
          bg="bg-orange-50"
          onClick={() => setShowLowStockModal(true)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-border-color">
            <h3 className="text-base font-semibold text-text-main">Finansal Gelişim (Son 6 Ay)</h3>
            <div className="flex items-center space-x-4 text-[11px] font-bold uppercase tracking-wider text-text-muted">
              <span className="flex items-center"><span className="w-2.5 h-2.5 bg-success rounded-full mr-2"></span> Gelir</span>
              <span className="flex items-center"><span className="w-2.5 h-2.5 bg-danger rounded-full mr-2"></span> Gider</span>
            </div>
          </div>
          <div className="h-[280px]">
             <Line data={lineChartData} options={barChartOptions} />
          </div>
        </div>

        {/* Platform Revenue */}
        <div className="card p-6">
          <h3 className="text-base font-semibold text-text-main mb-8 pb-4 border-b border-border-color">Platform Bazlı Satış</h3>
          <div className="h-[280px]">
             <Bar data={platformChartData} options={barChartOptions} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="card">
          <div className="px-6 py-4 border-b border-border-color flex items-center justify-between bg-white">
            <h3 className="font-semibold text-text-main">Son İşlemler</h3>
            <button 
              onClick={() => onNavigate('income-expense')}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Hepsini Gör
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-bg-main text-[11px] uppercase tracking-wider text-text-muted font-bold">
                  <th className="px-4 lg:px-6 py-3">Tarih</th>
                  <th className="px-4 lg:px-6 py-3">Kategori</th>
                  <th className="px-4 lg:px-6 py-3">Tutar</th>
                  <th className="px-4 lg:px-6 py-3 hidden sm:table-cell">Platform</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color">
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-bg-main transition-colors text-sm">
                    <td className="px-4 lg:px-6 py-4 text-text-muted">{new Date(tx.date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}</td>
                    <td className="px-4 lg:px-6 py-4 font-medium">{tx.category}</td>
                    <td className={cn("px-4 lg:px-6 py-4 font-bold", tx.type === 'Income' ? 'text-success' : 'text-danger')}>
                      {tx.type === 'Income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </td>
                    <td className="px-4 lg:px-6 py-4 hidden sm:table-cell">
                      <span className="px-2 py-0.5 rounded bg-bg-main border border-border-color text-text-main text-[10px] font-bold uppercase tracking-tight">
                        {tx.platform}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="card">
          <div className="px-6 py-4 border-b border-border-color">
            <h3 className="font-semibold text-text-main">Kritik Stok Uyarıları</h3>
          </div>
          <div className="p-2 space-y-1">
             {lowStockProducts.slice(0, 5).map((p) => (
               <div 
                 key={p.id} 
                 onClick={() => onProductClick(p.id)}
                 className="flex items-center justify-between p-4 hover:bg-bg-main rounded-lg border border-transparent cursor-pointer transition-all group"
               >
                 <div className="flex items-center space-x-4">
                   <div className="w-10 h-10 bg-bg-main rounded-lg flex items-center justify-center overflow-hidden border border-border-color">
                      {p.cover_image ? (
                        <img src={p.cover_image} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-5 h-5 text-text-muted" />
                      )}
                   </div>
                   <div>
                     <p className="text-sm font-semibold text-text-main group-hover:text-primary">{p.title}</p>
                     <p className="text-[10px] text-text-muted font-mono">{p.sku}</p>
                   </div>
                 </div>
                 <div className="text-right">
                    <p className="text-sm font-bold text-danger">{p.total_stock} Adet</p>
                    <p className="text-[9px] text-text-muted uppercase font-bold tracking-tight">Acil Sipariş</p>
                 </div>
               </div>
             ))}
             {lowStockProducts.length > 5 && (
               <button 
                 onClick={() => setShowLowStockModal(true)}
                 className="w-full text-center py-3 text-xs font-bold text-primary hover:bg-bg-main rounded-lg transition-colors border border-dashed border-border-color mt-2"
               >
                 Tüm {lowStockProducts.length} Ürünü Gör
               </button>
             )}
             {lowStockProducts.length === 0 && (
               <div className="py-12 text-center">
                 <Package className="w-10 h-10 text-border-color mx-auto mb-3" />
                 <p className="text-text-muted text-xs">Tüm stoklar güvenli seviyede.</p>
               </div>
             )}
          </div>
        </div>
      </div>

      {showLowStockModal && (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-border-color bg-gray-50 flex items-center justify-between shrink-0">
               <div>
                  <h3 className="text-xl font-black text-[#0F172A] tracking-tight">Kritik Stoktaki Ürünler</h3>
                  <p className="text-sm text-text-muted mt-1">Stok seviyesi kritik olan tüm ürünler ({lowStockProducts.length} adet)</p>
               </div>
               <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-border-color shadow-sm text-danger">
                  <AlertTriangle className="w-6 h-6" />
               </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2">
              {lowStockProducts.map((p) => (
                <div 
                  key={p.id} 
                  onClick={() => {
                    setShowLowStockModal(false);
                    onProductClick(p.id);
                  }}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-bg-main rounded-xl border border-border-color cursor-pointer transition-all group gap-4"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-border-color shrink-0">
                       {p.cover_image ? (
                         <img src={p.cover_image} className="w-full h-full object-cover" />
                       ) : (
                         <Package className="w-6 h-6 text-text-muted" />
                       )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-main group-hover:text-primary transition-colors">{p.title}</p>
                      <p className="text-[11px] text-text-muted font-mono mt-0.5">{p.sku}</p>
                    </div>
                  </div>
                  <div className="flex items-center sm:block sm:text-right w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t border-border-color sm:border-0 justify-between">
                     <p className="text-sm font-black text-danger">{p.total_stock} Adet</p>
                     <p className="text-[10px] text-text-muted uppercase font-bold tracking-tight bg-orange-100 text-orange-700 px-2 py-0.5 rounded ml-2 sm:ml-0 sm:mt-1 inline-block">Acil Sipariş</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 bg-gray-50 border-t border-border-color shrink-0 text-right">
               <button 
                 onClick={() => setShowLowStockModal(false)}
                 className="px-8 h-12 bg-[#0F172A] text-white rounded-xl font-bold text-sm shadow-xl hover:scale-105 transition-all"
               >
                 Kapat
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, trend, positive, color, bg, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "p-5 rounded-xl bg-white border border-border-color shadow-sm hover:shadow-md transition-all",
        onClick && "cursor-pointer"
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-2.5 rounded-lg", bg)}>
          <Icon className={cn("w-4 h-4", color)} />
        </div>
      </div>
      <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">{title}</p>
      <h2 className={cn("text-2xl font-bold tracking-tight", title === 'Kritik Stok' && parseInt(value) > 0 ? 'text-danger' : 'text-text-main')}>{value}</h2>
      <div className={cn(
        "mt-2 text-[11px] font-semibold",
        positive ? "text-success" : (title === 'Kritik Stok' ? 'text-text-muted' : 'text-danger')
      )}>
         {trend}
      </div>
    </div>
  );
}

