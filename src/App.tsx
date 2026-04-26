import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ArrowLeftRight, 
  TrendingUp, 
  TrendingDown,
  Settings as SettingsIcon,
  BarChart3,
  Repeat,
  Search,
  Bell,
  ChevronRight,
  Menu,
  X,
  LogOut
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import ProductList from './components/ProductList';
import ProductDetail from './components/ProductDetail';
import ProductWizard from './components/ProductWizard';
import Transactions from './components/Transactions';
import Analytics from './components/Analytics';
import RecurringPayments from './components/RecurringPayments';
import SettingsView from './components/SettingsView';
import LoginPage from './components/LoginPage';
import { api } from './lib/api';
import { Settings } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type View = 'dashboard' | 'products' | 'product-detail' | 'product-wizard' | 'stock' | 'income' | 'expense' | 'recurring' | 'analytics' | 'settings';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('isSidebarOpen');
    if (saved !== null) return saved === 'true';
    return window.innerWidth > 768;
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('isSidebarOpen', String(isSidebarOpen));
  }, [isSidebarOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Check initial auth state
    const auth = localStorage.getItem('isAuthenticated') === 'true';
    setIsAuthenticated(auth);
    
    if (auth) {
      loadSettings();
    }
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.get('/settings');
      setSettings(data);
    } catch (err) {
      console.error("Settings load error:", err);
    }
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    loadSettings();
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    setIsAuthenticated(false);
  };

  const navigateToProduct = (id: string) => {
    setSelectedProductId(id);
    setCurrentView('product-detail');
  };

  const navItems = [
    { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
    { id: 'products', label: 'Ürünler', icon: Package },
    { id: 'income', label: 'Gelirler', icon: TrendingUp },
    { id: 'expense', label: 'Giderler', icon: TrendingDown },
    { id: 'recurring', label: 'Periyodikler', icon: Repeat },
    { id: 'analytics', label: 'Analizler', icon: BarChart3 },
    { id: 'settings', label: 'Ayarlar', icon: SettingsIcon },
  ];

  // While checking initial auth, don't show anything to prevent flicker
  if (isAuthenticated === null) return null;

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-bg-main text-text-main font-sans selection:bg-primary/10">
      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full border-r border-border-color bg-sidebar-bg text-white transition-all duration-300 z-50",
        isSidebarOpen ? "w-64" : "w-20",
        "md:translate-x-0",
        isMobileMenuOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="flex h-16 items-center px-6 border-b border-white/10 shrink-0">
          {(isSidebarOpen || isMobileMenuOpen) ? (
            <div className="flex items-center justify-between w-full">
              <h1 className="text-xl font-extrabold tracking-wider text-[#38bdf8] truncate">
                {settings?.company_name || 'DSDST Panel'}
              </h1>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="md:hidden p-1 text-white/50 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-white text-xs font-bold">DP</div>
          )}
        </div>

        <nav className="mt-4 px-0 space-y-0.5 overflow-y-auto max-h-[calc(100vh-160px)]">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentView(item.id as View);
                setIsMobileMenuOpen(false);
              }}
              className={cn(
                "w-full flex items-center px-6 py-3.5 transition-all text-sm font-medium group relative",
                currentView === item.id || (item.id === 'products' && (currentView === 'product-detail' || currentView === 'product-wizard'))
                  ? "bg-primary/10 text-white border-l-4 border-primary" 
                  : "text-[#94a3b8] hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon className={cn("w-5 h-5", (isSidebarOpen || isMobileMenuOpen) ? "mr-3" : "mx-auto")} />
              {(isSidebarOpen || isMobileMenuOpen) && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {(isSidebarOpen || isMobileMenuOpen) && (
          <div className="absolute bottom-16 left-0 w-full px-4">
             <button 
               onClick={handleLogout}
               className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl bg-white/5 text-red-400 hover:bg-red-500 hover:text-white transition-all text-sm font-bold"
             >
                <LogOut className="w-5 h-5" />
                <span>Çıkış Yap</span>
             </button>
          </div>
        )}

        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="hidden md:flex absolute bottom-4 right-[-12px] w-6 h-6 bg-white border border-border-color text-sidebar-bg rounded-full items-center justify-center hover:bg-bg-main shadow-md cursor-pointer transition-transform"
        >
          <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", isSidebarOpen && "rotate-180")} />
        </button>
      </aside>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className={cn(
        "transition-all duration-300 min-h-screen flex flex-col w-full",
        isSidebarOpen ? "md:pl-64" : "md:pl-20"
      )}>
        {/* Header */}
        <header className="h-16 bg-white border-b border-border-color flex items-center justify-between px-4 md:px-8 sticky top-0 z-40">
          <div className="flex items-center space-x-4 md:space-x-6">
             <button 
               onClick={() => setIsMobileMenuOpen(true)}
               className="md:hidden p-2 text-text-muted hover:text-primary transition-colors"
             >
                <Menu className="w-6 h-6" />
             </button>
             <h2 className="text-base md:text-lg font-semibold text-text-main truncate">
                {navItems.find(i => i.id === currentView)?.label || 'Ürün Detayı'}
             </h2>
          </div>

          <div className="flex items-center space-x-2 md:space-x-6">
             <div className="relative hidden md:block">
               <input 
                 type="text" 
                 placeholder="Ürün Ara..." 
                 className="pl-9 pr-4 py-1.5 bg-bg-main border border-border-color rounded-lg text-sm w-40 md:w-60 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
               />
               <Search className="w-4 h-4 text-text-muted absolute left-3 top-2" />
             </div>
             <button className="p-2 text-text-muted hover:text-primary transition-colors">
               <Bell className="w-5 h-5" />
             </button>
             <div className="flex items-center space-x-2 md:space-x-3 border-l border-border-color pl-2 md:pl-6">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold shrink-0">AL</div>
              <span className="text-sm font-semibold text-text-main hidden sm:inline">Yönetici</span>
            </div>
          </div>
        </header>

        {/* View Container */}
        <div className="p-4 md:p-6 flex-1 max-w-[1600px] w-full mx-auto">
          {currentView === 'dashboard' && <Dashboard onNavigate={setCurrentView} onProductClick={navigateToProduct} />}
          {currentView === 'products' && (
            <ProductList 
              onAddProduct={() => setCurrentView('product-wizard')} 
              onProductClick={navigateToProduct}
            />
          )}
          {currentView === 'product-detail' && selectedProductId && (
             <ProductDetail 
                productId={selectedProductId} 
                onBack={() => setCurrentView('products')} 
                onEdit={() => setCurrentView('product-wizard')}
             />
          )}
          {currentView === 'product-wizard' && (
            <ProductWizard 
              productId={selectedProductId}
              settings={settings}
              onClose={() => {
                setCurrentView('products');
                setSelectedProductId(null);
              }} 
            />
          )}
          {currentView === 'income' && <Transactions initialType="Income" settings={settings} />}
          {currentView === 'expense' && <Transactions initialType="Expense" settings={settings} />}
          {currentView === 'recurring' && <RecurringPayments settings={settings} />}
          {currentView === 'analytics' && <Analytics settings={settings} />}
          {currentView === 'settings' && <SettingsView onUpdate={loadSettings} />}
        </div>
      </main>
    </div>
  );
}
