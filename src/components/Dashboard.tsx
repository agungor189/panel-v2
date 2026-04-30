import { useState, useEffect, useRef } from 'react';
// @ts-ignore
import { Responsive } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertTriangle,
  RefreshCw,
  Package,
  Settings,
  Edit,
  Check,
  Plus,
  Trash2,
  X,
  CreditCard,
  Briefcase
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
import { v4 as uuidv4 } from 'uuid';
import { api } from '../lib/api';
import { useCurrency } from '../CurrencyContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { WidgetRenderer } from './dashboard/WidgetRenderer';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DashboardProps {
  onNavigate: (view: any) => void;
  onProductClick: (id: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { FormatAmount } = useCurrency();
  const [data, setData] = useState<any>(null);
  const [widgets, setWidgets] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [editMode, setEditMode] = useState(false);
  const [showConfig, setShowConfig] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(typeof window !== 'undefined' ? Math.min(window.innerWidth, 1200) : 1200);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
       if (entries[0] && entries[0].contentRect.width > 0) {
         setWidth(entries[0].contentRect.width);
         setIsMobile(window.innerWidth < 768);
       }
    });
    observer.observe(containerRef.current);
    
    const handleResize = () => {
      if (containerRef.current) {
         setWidth(containerRef.current.clientWidth);
      }
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
       observer.disconnect();
       window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    Promise.all([loadData(), loadWidgets()]);
  }, []);

  const loadWidgets = async () => {
    try {
      const result = await api.get('/dashboard/widgets');
      setWidgets(result);
    } catch (err) {
      console.error("Widgets load error", err);
    }
  };

  const saveLayout = async (layout: any) => {
    if (!editMode) return;
    const updated = widgets.map(w => {
      const lItem = layout.find(l => l.i === w.id);
      if (lItem) {
        return { ...w, position_x: lItem.x, position_y: lItem.y, width: lItem.w, height: lItem.h };
      }
      return w;
    });
    setWidgets(updated);
  };

  const applyChanges = async () => {
    try {
      await api.put('/dashboard/widgets', widgets);
      setEditMode(false);
    } catch (err) {
      alert("Failed to save layout");
    }
  };

  const removeWidget = async (id: string) => {
    try {
      await api.delete(`/dashboard/widgets/${id}`);
      setWidgets(widgets.filter(w => w.id !== id));
    } catch(err) {
      alert("Failed to delete widget");
    }
  };

  const loadData = async () => {
    try {
      const result = await api.get('/dashboard-summary');
      setData(result);
      setError(false);
    } catch (err) {
      console.error("Dashboard load error", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const m = data?.metrics;

  const getGrossProfitEstimate = () => {
    if (!m) return 0;
    return m.totalStockSalesValue - m.totalStockCostValue;
  };

  const getAvgMarginEstimate = () => {
    const p = getGrossProfitEstimate();
    if (!m || m.totalStockSalesValue <= 0) return 0;
    return (p / m.totalStockSalesValue) * 100;
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm h-[180px] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-gray-100 animate-pulse"></div>
              </div>
              <div>
                <div className="w-32 h-4 bg-gray-100 rounded animate-pulse mb-3"></div>
                <div className="w-48 h-8 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const availableWidgets = [
    { type: 'total_revenue', title: 'Toplam Ciro', w: 4, h: 3 },
    { type: 'total_expense', title: 'Toplam Gider', w: 4, h: 3 },
    { type: 'net_profit', title: 'Net Kar', w: 4, h: 3 },
    { type: 'critical_stock', title: 'Kritik Stok', w: 4, h: 3 },
    { type: 'total_stock_value', title: 'Toplam Stok Satış Değeri', w: 4, h: 3 },
    { type: 'total_stock_cost', title: 'Toplam Stok Maliyeti', w: 4, h: 3 },
    { type: 'est_gross_profit', title: 'Tahmini Brüt Kar', w: 4, h: 3 },
    { type: 'avg_profit_margin', title: 'Ortalama Kar Marjı', w: 4, h: 3 },
    { type: 'monthly_cash', title: 'Kasa Bakiyesi', w: 4, h: 3 },
    { type: 'pending_payments', title: 'Bekleyen Ödemeler', w: 4, h: 3 },
    { type: 'financial_trend', title: 'Finansal Trend', w: 6, h: 7 },
    { type: 'platform_sales', title: 'Platform Satışları', w: 6, h: 7 },
    { type: 'recent_transactions', title: 'Son İşlemler', w: 6, h: 8 },
    { type: 'low_stock_list', title: 'Kritik Stok Listesi', w: 6, h: 8 },
  ];

  const addWidget = async (type: string, w: number, h: number) => {
    // Check if widget already exists to prevent duplication
    if (widgets.some(w => w.widget_type === type)) {
      alert("Bu metrik zaten Dashboard üzerinde bulunuyor.");
      return;
    }
    
    try {
      const newWidget = {
        id: uuidv4(),
        widget_type: type,
        position_x: 0,
        position_y: Infinity, // Add to bottom
        width: w,
        height: h,
        priority_level: 1,
        is_visible: 1,
        config: {}
      };
      
      const res = await api.post('/dashboard/widgets', newWidget);
      newWidget.id = res.id;
      setWidgets([...widgets, newWidget]);
    } catch(err) {
      alert("Failed to add widget");
    }
  };

  const applyTemplate = async (templateName: string) => {
    // Delete all current widgets
    for (const w of widgets) {
      try { await api.delete(`/dashboard/widgets/${w.id}`); } catch(e) {}
    }
    
    let newWidgets: any[] = [];
    if (templateName === 'finance') {
      newWidgets = [
        { type: 'total_revenue', x: 0, y: 0, w: 4, h: 3 },
        { type: 'total_expense', x: 4, y: 0, w: 4, h: 3 },
        { type: 'net_profit', x: 8, y: 0, w: 4, h: 3 },
        { type: 'critical_stock', x: 0, y: 3, w: 4, h: 3 },
        { type: 'total_stock_value', x: 4, y: 3, w: 4, h: 3 },
        { type: 'total_stock_cost', x: 8, y: 3, w: 4, h: 3 },
        { type: 'est_gross_profit', x: 0, y: 6, w: 4, h: 3 },
        { type: 'avg_profit_margin', x: 4, y: 6, w: 4, h: 3 },
        { type: 'financial_trend', x: 0, y: 9, w: 6, h: 7 },
        { type: 'platform_sales', x: 6, y: 9, w: 6, h: 7 },
        { type: 'recent_transactions', x: 0, y: 16, w: 6, h: 8 },
        { type: 'low_stock_list', x: 6, y: 16, w: 6, h: 8 },
      ];
    } else if (templateName === 'stock') {
      newWidgets = [
        { type: 'critical_stock', x: 0, y: 0, w: 6, h: 3 },
        { type: 'low_stock_list', x: 0, y: 3, w: 12, h: 8 },
      ];
    } else if (templateName === 'sales') {
       newWidgets = [
        { type: 'total_revenue', x: 0, y: 0, w: 4, h: 3 },
        { type: 'net_profit', x: 4, y: 0, w: 4, h: 3 },
        { type: 'platform_sales', x: 0, y: 3, w: 8, h: 7 },
      ];
    } else if (templateName === 'minimal') {
      newWidgets = [
        { type: 'total_revenue', x: 0, y: 0, w: 6, h: 3 },
        { type: 'total_expense', x: 6, y: 0, w: 6, h: 3 },
      ];
    }
    
    for (const nw of newWidgets) {
      await addWidgetRaw(nw.type, nw.w, nw.h, nw.x, nw.y);
    }
    loadWidgets();
  };

  const addWidgetRaw = async (type: string, w: number, h: number, x: number, y: number) => {
     try {
      const newWidget = {
        id: uuidv4(),
        widget_type: type,
        position_x: x,
        position_y: y,
        width: w,
        height: h,
        priority_level: 1,
        is_visible: 1,
        config: {}
      };
      await api.post('/dashboard/widgets', newWidget);
     } catch(e) {}
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <div className="flex justify-between items-center mb-6 px-2">
        <h2 className="text-2xl font-black text-gray-900">Dashboard</h2>
        <div className="flex items-center gap-3">
          {editMode ? (
            <>
              {/* Templates Dropdown */}
              <div className="relative group">
                <button className="px-4 py-2 text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors flex items-center gap-2">
                   Hazır Şablonlar
                </button>
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                   <button onClick={() => applyTemplate('finance')} className="w-full text-left px-3 py-2 text-sm font-medium text-gray-700 hover:bg-blue-50 rounded-lg transition-colors">Finans Dashboard</button>
                   <button onClick={() => applyTemplate('sales')} className="w-full text-left px-3 py-2 text-sm font-medium text-gray-700 hover:bg-blue-50 rounded-lg transition-colors">Satış Dashboard</button>
                   <button onClick={() => applyTemplate('stock')} className="w-full text-left px-3 py-2 text-sm font-medium text-gray-700 hover:bg-blue-50 rounded-lg transition-colors">Stok Dashboard</button>
                   <button onClick={() => applyTemplate('minimal')} className="w-full text-left px-3 py-2 text-sm font-medium text-gray-700 hover:bg-blue-50 rounded-lg transition-colors">Minimal</button>
                </div>
              </div>
              
              {/* Add Widget Dropdown */}
              <div className="relative group">
                <button className="px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm rounded-xl transition-colors flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Ekle
                </button>
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                     <div className="max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                       {availableWidgets.map(aw => {
                         const exists = widgets.some((w: any) => w.widget_type === aw.type);
                         return (
                           <button 
                             key={aw.type}
                             onClick={() => addWidget(aw.type, aw.w, aw.h)}
                             disabled={exists}
                             className={`w-full text-left px-3 py-2 text-sm font-medium rounded-lg transition-colors ${exists ? 'text-gray-400 cursor-not-allowed bg-gray-50' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'}`}
                           >
                             {aw.title} {exists && <span className="text-[10px] ml-1">(Eklendi)</span>}
                           </button>
                         );
                       })}
                     </div>
                </div>
              </div>
              <button 
                onClick={() => { setEditMode(false); loadWidgets(); }}
                className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
               >
                İptal
              </button>
              <button 
                onClick={applyChanges}
                className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-2"
               >
                <Check className="w-4 h-4" />
                Kaydet
              </button>
            </>
          ) : !isMobile && (
            <button 
              onClick={() => setEditMode(true)}
              className="px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm rounded-xl transition-colors flex items-center gap-2"
             >
              <Edit className="w-4 h-4" />
              Düzenle
            </button>
          )}
        </div>
      </div>

      <div className="w-full max-w-full overflow-x-hidden p-1">
        <div ref={containerRef} className="w-full min-h-[500px]">
          {isMobile ? (
            <div className="flex flex-col gap-4">
              {[...widgets]
                .sort((a,b) => a.position_y - b.position_y || a.position_x - b.position_x)
                .map((widget) => {
                  let mobileHeightClass = "h-auto min-h-[140px]";
                  if (['financial_trend', 'platform_sales'].includes(widget.widget_type)) mobileHeightClass = "h-[300px]";
                  if (['recent_transactions', 'low_stock_list'].includes(widget.widget_type)) mobileHeightClass = "h-[450px]";
                  
                  return (
                    <div 
                       key={widget.id} 
                       className={`relative flex flex-col w-full ${mobileHeightClass}`}
                    >
                      <div className="flex-1 overflow-hidden min-w-[0] min-h-[0] h-full flex flex-col">
                        <WidgetRenderer 
                          widget={widget} 
                          data={data} 
                          m={m} 
                          FormatAmount={FormatAmount} 
                          onNavigate={onNavigate}
                          getGrossProfitEstimate={getGrossProfitEstimate}
                          getAvgMarginEstimate={getAvgMarginEstimate}
                        />
                      </div>
                    </div>
                  );
              })}
            </div>
          ) : (
            <>
              {/* @ts-ignore */}
              <Responsive
                className="layout"
                width={width}
              layouts={{ lg: widgets.map(w => ({ i: w.id, x: w.position_x, y: w.position_y, w: w.width, h: w.height, static: !editMode })) }}
              breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
              cols={{ lg: 12, md: 12, sm: 6, xs: 1, xxs: 1 }}
                rowHeight={60}
                onLayoutChange={(layout) => saveLayout(layout)}
                isDraggable={editMode}
                isResizable={editMode}
                margin={[24, 24]}
              >
              {widgets.map((widget) => (
                <div 
                   key={widget.id} 
                   className="relative group flex flex-col min-w-[0] min-h-[0]"
                   data-grid={{ x: widget.position_x, y: widget.position_y, w: widget.width, h: widget.height, static: !editMode }}
                >
                  <div className="flex-1 overflow-hidden min-w-[0] min-h-[0]">
                    <WidgetRenderer 
                      widget={widget} 
                      data={data} 
                      m={m} 
                      FormatAmount={FormatAmount} 
                      onNavigate={onNavigate}
                      getGrossProfitEstimate={getGrossProfitEstimate}
                      getAvgMarginEstimate={getAvgMarginEstimate}
                    />
                  </div>
                  {editMode && (
                    <div className="absolute top-2 right-2 flex gap-1 bg-white/90 backdrop-blur shadow-sm border border-gray-200 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-20">
                       <button onClick={() => setShowConfig(widget.id)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md">
                         <Settings className="w-4 h-4" />
                       </button>
                       <button onClick={() => removeWidget(widget.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md" onMouseDown={(e) => e.stopPropagation()}>
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  )}
                  {editMode && (
                    <div className="absolute inset-0 bg-blue-500/5 border-2 border-blue-500 border-dashed rounded-2xl pointer-events-none z-10" />
                  )}
                </div>
              ))}
            </Responsive>
            </>
          )}
        </div>
      </div>

      {showConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                 <h3 className="font-bold text-gray-900">Widget Ayarları</h3>
                 <button onClick={() => setShowConfig(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                    <X className="w-5 h-5" />
                 </button>
              </div>
              <div className="p-6 space-y-5">
                 {widgets.find((w: any) => w.id === showConfig) && (
                    <div className="space-y-4">
                       <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Başlık</label>
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            value={widgets.find((w: any) => w.id === showConfig).config.title || ''}
                            onChange={(e) => {
                               const fw = widgets.find((w: any) => w.id === showConfig);
                               if (fw) {
                                  fw.config.title = e.target.value;
                                  setWidgets([...widgets]);
                               }
                            }}
                            placeholder="Otomatik Başlık"
                          />
                       </div>
                       <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Önem Derecesi (Priority)</label>
                          <select
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            value={widgets.find((w: any) => w.id === showConfig).priority_level || 1}
                            onChange={(e) => {
                               const fw = widgets.find((w: any) => w.id === showConfig);
                               if (fw) {
                                  fw.priority_level = parseInt(e.target.value);
                                  setWidgets([...widgets]);
                               }
                            }}
                          >
                             <option value={1}>1 - Düşük</option>
                             <option value={2}>2 - Normal</option>
                             <option value={3}>3 - Yüksek</option>
                             <option value={4}>4 - Çok Yüksek</option>
                             <option value={5}>5 - Kritik (Hero)</option>
                          </select>
                       </div>
                    </div>
                 )}
              </div>
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                 <button onClick={() => setShowConfig(null)} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors">
                    Tamam
                 </button>
              </div>
           </div>
        </div>
      )}

      {!widgets.length && !loading && (
        <div className="text-center py-20 text-gray-500">
           <p className="mb-4">Dashboard henüz boş.</p>
           {editMode && <p>Sağ üstten widget ekleyebilirsiniz.</p>}
        </div>
      )}
    </div>
  );
}

