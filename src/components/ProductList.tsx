import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  LayoutGrid, 
  List, 
  Package, 
  MoreVertical,
  ChevronDown,
  Download,
  Upload,
  Trash2,
  FileText,
} from 'lucide-react';
import { api, formatCurrency, PLATFORMS } from '../lib/api';
import { Product } from '../types';
import Papa from 'papaparse';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ProductListProps {
  onAddProduct: () => void;
  onProductClick: (id: string) => void;
}

export default function ProductList({ onAddProduct, onProductClick }: ProductListProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('Hepsi');
  const [filterStatus, setFilterStatus] = useState('Hepsi');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await api.get('/products');
      setProducts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredProducts = products.filter(p => {
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      (p.name?.toLowerCase().includes(searchLower)) || 
      (p.title?.toLowerCase().includes(searchLower)) || 
      (p.sku?.toLowerCase().includes(searchLower)) ||
      (p.barcode?.toLowerCase().includes(searchLower));
    const matchesCategory = filterCategory === 'Hepsi' || p.category === filterCategory;
    const matchesStatus = filterStatus === 'Hepsi' || p.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const categories = ['Hepsi', ...new Set(products.map(p => p.category))];
  const csvInputRef = useRef<HTMLInputElement>(null);

  // CSV Mapping State
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({
    sku: 'Ürün Kodu',
    name: 'Ürün Adı',
    category: 'Malzeme',
    stock: 'Toplam Stok',
    price: 'Satış Fiyatı',
    barcode: 'Barkod',
    description: 'Açıklama',
    weight: 'Ağırlık',
    location: 'Lokasyon',
    notes: 'Notlar'
  });

  const exportToCsv = () => {
    const data = filteredProducts.map((p, index) => ({
      'Sıra No': index + 1,
      'Ürün Kodu': p.sku,
      'Malzeme': p.category,
      'Ürün Adı': p.name || p.title,
      'Toplam Stok': p.total_stock || 0,
      'Satış Fiyatı': p.sale_price,
      'Barkod': p.barcode || '',
      'Açıklama': p.description || '',
      'Ağırlık': p.weight || 0,
      'Lokasyon': p.warehouse_location || '',
      'Notlar': p.notes || ''
    }));

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `urun_listesi_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const { data, meta } = results;
        if (data.length === 0) return;
        
        setCsvData(data);
        setCsvHeaders(meta.fields || []);
        
        // Try to auto-map based on headers
        const newMapping = { ...mapping };
        const headers = meta.fields || [];
        
        const findMatch = (keys: string[]) => headers.find(h => keys.some(k => h.toLowerCase().includes(k.toLowerCase())));
        
        newMapping.sku = findMatch(['sku', 'kod', 'ürün kodu']) || headers[0] || '';
        newMapping.name = findMatch(['ad', 'isim', 'başlık', 'ürün adı']) || headers[1] || '';
        newMapping.category = findMatch(['malzeme', 'kategori', 'category']) || headers[2] || '';
        newMapping.stock = findMatch(['stok', 'adet', 'stock', 'toplam stok']) || headers[3] || '';
        newMapping.price = findMatch(['fiyat', 'price', 'satış fiyatı']) || headers[4] || '';
        newMapping.barcode = findMatch(['barkod', 'barcode', 'ean']) || headers[5] || '';
        newMapping.description = findMatch(['açıklama', 'description', 'detay']) || headers[6] || '';
        newMapping.weight = findMatch(['ağırlık', 'weight', 'gram']) || headers[7] || '';
        newMapping.location = findMatch(['lokasyon', 'konum', 'location', 'raf']) || headers[8] || '';
        newMapping.notes = findMatch(['not', 'notes', 'bilgi']) || headers[9] || '';

        setMapping(newMapping);
        setShowMappingModal(true);
      }
    });
  };

  const executeImport = async () => {
    let successCount = 0;
    let errorCount = 0;

    setDeletingAll(true); // Reuse loading state

    for (const row of csvData) {
      try {
        const sku = row[mapping.sku] || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const name = row[mapping.name] || 'İsimsiz Ürün';
        const category = row[mapping.category] || 'Genel';
        const totalStock = parseInt(row[mapping.stock]) || 0;
        const salePrice = parseFloat(row[mapping.price]) || 0;
        const barcode = row[mapping.barcode] || '';
        const description = row[mapping.description] || '';
        const weight = parseInt(row[mapping.weight]) || 0;
        const location = row[mapping.location] || '';
        const notes = row[mapping.notes] || '';

        await api.post('/products', {
          name: name,
          title: name,
          sku: sku,
          barcode: barcode,
          category: category,
          description: description,
          notes: notes,
          warehouse_location: location,
          weight: weight,
          model: 'Standart',
          purchase_price_usd: 0,
          purchase_cost: 0,
          sale_price: salePrice,
          buffer_percentage: 0,
          exchange_rate_used: 0,
          status: 'Active',
          platforms: PLATFORMS.map((pName, idx) => ({
            name: pName,
            stock: idx === 0 ? totalStock : 0,
            price: salePrice,
            is_listed: true
          }))
        });
        successCount++;
      } catch (err) {
        console.error('Import error for row:', row, err);
        errorCount++;
      }
    }

    setDeletingAll(false);
    setShowMappingModal(false);
    alert(`${successCount} ürün başarıyla eklendi.${errorCount > 0 ? ` ${errorCount} üründe hata oluştu.` : ''}`);
    loadProducts();
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  const [deletingAll, setDeletingAll] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const deleteAllProducts = async () => {
    try {
      setDeletingAll(true);
      const res = await api.delete('/products');
      console.log("Delete all result:", res);
      await loadProducts();
      setShowDeleteAllConfirm(false);
    } catch (err) {
      console.error("Hepsini silme hatası:", err);
      alert("Silme işlemi sırasında bir hata oluştu.");
    } finally {
      setDeletingAll(false);
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-text-main tracking-tight">Ürün Yönetimi</h2>
          <p className="text-xs lg:text-sm text-text-muted">{products.length} toplam ürün listeleniyor.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input 
            type="file" 
            ref={csvInputRef} 
            onChange={handleFileSelect} 
            accept=".csv" 
            className="hidden" 
          />
          <button 
            onClick={() => csvInputRef.current?.click()}
            className="px-4 h-11 border border-border-color bg-white rounded-xl text-xs font-bold text-text-muted hover:text-primary hover:border-primary transition-all flex items-center shadow-sm"
          >
            <Upload className="w-4 h-4 mr-2" />
            Gelişmiş İçe Aktar
          </button>
          <button 
            onClick={exportToCsv}
            className="px-4 h-11 border border-border-color bg-white rounded-xl text-xs font-bold text-text-muted hover:text-primary hover:border-primary transition-all flex items-center"
          >
            <Download className="w-4 h-4 mr-2" />
            CSV Dışa Aktar
          </button>
          <button 
            onClick={() => {
              const data = [{
                'Ürün Kodu': 'URUN-001',
                'Ürün Adı': 'Örnek Ürün',
                'Malzeme': 'Aliminyum',
                'Toplam Stok': '100',
                'Satış Fiyatı': '250',
                'Barkod': '8690000000001',
                'Açıklama': 'Siyah kaliteli kaplama',
                'Ağırlık': '500',
                'Lokasyon': 'A-12-3',
                'Notlar': 'Acil sevkiyat ürünü'
              }];
              const csv = Papa.unparse(data);
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const link = document.createElement('a');
              const url = URL.createObjectURL(blob);
              link.setAttribute('href', url);
              link.setAttribute('download', `sablon.csv`);
              link.style.visibility = 'hidden';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="px-4 h-11 border border-dashed border-border-color bg-gray-50 rounded-xl text-[10px] font-bold text-text-muted hover:text-primary hover:border-primary transition-all flex items-center"
            title="Örnek CSV Formatını İndir"
          >
            <FileText className="w-4 h-4 mr-2" />
            Şablon İndir
          </button>
          {products.length > 0 && (
            <div className="relative">
              {!showDeleteAllConfirm ? (
                <button 
                  onClick={() => setShowDeleteAllConfirm(true)}
                  className="px-4 h-11 border border-border-color bg-white rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition-all flex items-center shadow-sm"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Tümünü Sil
                </button>
              ) : (
                <div className="flex items-center space-x-2 bg-rose-50 border border-rose-200 p-1 rounded-xl animate-in fade-in zoom-in duration-200">
                  <span className="text-[10px] font-bold text-rose-500 uppercase tracking-tight px-2">Emin misiniz?</span>
                  <button 
                    onClick={deleteAllProducts}
                    disabled={deletingAll}
                    className="px-3 h-9 bg-rose-500 text-white rounded-lg font-bold text-xs hover:bg-rose-600 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {deletingAll ? "Siliniyor..." : "Evet"}
                  </button>
                  <button 
                    onClick={() => setShowDeleteAllConfirm(false)}
                    disabled={deletingAll}
                    className="px-3 h-9 bg-white border border-border-color text-text-muted rounded-lg font-bold text-xs hover:bg-gray-50 transition-colors"
                  >
                    Vazgeç
                  </button>
                </div>
              )}
            </div>
          )}
          <button 
            onClick={onAddProduct}
            className="btn-primary px-6 py-2 leading-none flex items-center justify-center h-11 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span>Yeni Ürün Ekle</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card p-3 lg:p-4 flex flex-col lg:flex-row items-stretch lg:items-center gap-3 lg:gap-4 bg-white shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5 lg:top-3" />
          <input 
            type="text" 
            placeholder="Ürün Ara..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 lg:py-2.5 bg-bg-main rounded-xl lg:rounded-lg text-sm border border-border-color focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
          />
        </div>

        <div className="flex items-center space-x-2 lg:space-x-3">
                  <div className="flex-1 lg:flex-none flex items-center px-3 py-3 lg:py-2 bg-bg-main rounded-xl lg:rounded-lg border border-border-color">
            <Filter className="w-3.5 h-3.5 text-text-muted mr-2" />
            <select 
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-transparent text-xs lg:text-sm font-semibold outline-none cursor-pointer text-text-main w-full"
            >
              {categories.map(c => <option key={c} value={c}>{c === 'Hepsi' ? 'Tüm Malzemeler' : c}</option>)}
            </select>
          </div>

          <div className="flex bg-bg-main rounded-xl lg:rounded-lg p-1 border border-border-color">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn("p-2 lg:p-1.5 rounded-lg lg:rounded-md transition-all", viewMode === 'grid' ? "bg-white shadow-sm text-primary" : "text-text-muted")}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('table')}
              className={cn("p-2 lg:p-1.5 rounded-lg lg:rounded-md transition-all", viewMode === 'table' ? "bg-white shadow-sm text-primary" : "text-text-muted")}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
          {filteredProducts.map((p) => (
            <div 
              key={p.id}
              onClick={() => onProductClick(p.id)}
              className="group card overflow-hidden hover:shadow-md transition-all cursor-pointer relative bg-white"
            >
              <div className="aspect-square bg-bg-main relative">
                 {p.cover_image ? (
                   <img src={p.cover_image} alt="" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500 p-4" referrerPolicy="no-referrer" />
                 ) : (
                   <div className="flex items-center justify-center w-full h-full">
                     <Package className="w-8 h-8 text-border-color" />
                   </div>
                 )}
                 <div className="absolute top-2 right-2 shadow-sm">
                   <StatusBadge status={p.status} />
                 </div>
              </div>
              <div className="p-4">
                <p className="text-[9px] lg:text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">{p.category}</p>
                <h3 className="font-bold text-text-main text-sm group-hover:text-primary transition-colors line-clamp-1 h-5">{p.name || p.title}</h3>
                <p className="text-[10px] text-text-muted font-mono mt-1">{p.sku}</p>
                
                <div className="mt-3 lg:mt-4 pt-3 lg:pt-4 border-t border-border-color flex items-center justify-between">
                   <p className="font-bold text-base text-text-main">{formatCurrency(p.sale_price)}</p>
                   <div className="text-right">
                     <p className={cn(
                       "text-xs font-bold", 
                       (p.total_stock || 0) < 10 ? "text-danger" : "text-success"
                     )}>
                       {p.total_stock || 0} Adet
                     </p>
                   </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-bg-main text-[10px] uppercase tracking-widest text-text-muted font-extrabold border-b border-border-color">
                  <th className="px-4 lg:px-6 py-5">Ürün</th>
                  <th className="px-4 lg:px-6 py-5 hidden md:table-cell">Malzeme</th>
                  <th className="px-4 lg:px-6 py-5 text-center">Stok</th>
                  <th className="px-4 lg:px-6 py-5">Fiyat</th>
                  <th className="px-4 lg:px-6 py-5 hidden sm:table-cell">Durum</th>
                  <th className="px-4 lg:px-6 py-5 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color">
                {filteredProducts.map((p) => (
                  <tr key={p.id} onClick={() => onProductClick(p.id)} className="hover:bg-bg-main cursor-pointer group transition-colors">
                    <td className="px-4 lg:px-6 py-4 lg:py-5">
                      <div className="flex items-center space-x-3 lg:space-x-4">
                        <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg lg:rounded-xl bg-bg-main border border-border-color overflow-hidden p-1 flex items-center justify-center shrink-0">
                          {p.cover_image ? (
                            <img src={p.cover_image} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                          ) : (
                            <Package className="w-5 h-5 text-text-muted" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-text-main group-hover:text-primary transition-colors truncate">{p.name || p.title}</p>
                          <p className="text-[9px] lg:text-[10px] text-text-muted font-mono mt-0.5 uppercase tracking-tighter truncate">{p.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-4 lg:py-5 hidden md:table-cell">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest bg-bg-main px-2 py-1 rounded border border-border-color">
                        {p.category}
                      </span>
                    </td>
                    <td className="px-4 lg:px-6 py-4 lg:py-5 text-center">
                      <span className={cn(
                        "font-bold text-sm px-2 lg:px-3 py-1 rounded-lg",
                        (p.total_stock || 0) < 10 ? "text-danger bg-red-50" : "text-text-main bg-bg-main"
                      )}>
                        {p.total_stock}
                      </span>
                    </td>
                    <td className="px-4 lg:px-6 py-4 lg:py-5 text-sm font-extrabold text-text-main">{formatCurrency(p.sale_price)}</td>
                    <td className="px-4 lg:px-6 py-4 lg:py-5 hidden sm:table-cell"><StatusBadge status={p.status} /></td>
                    <td className="px-4 lg:px-6 py-4 lg:py-5 text-right">
                      <button className="p-2 hover:bg-white border border-transparent hover:border-border-color rounded-lg text-text-muted hover:text-primary transition-all">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredProducts.length === 0 && (
        <div className="py-24 text-center bg-white rounded-3xl border-2 border-dashed border-border-color">
          <Package className="w-16 h-16 text-border-color mx-auto mb-4" />
          <h3 className="text-xl font-bold text-text-main">Ürün bulunamadı</h3>
          <p className="text-text-muted mt-1">Arama kriterlerinizi değiştirmeyi deneyin.</p>
        </div>
      )}

      {/* CSV Mapping Modal */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
             <div className="p-8 border-b border-border-color bg-gray-50 flex items-center justify-between">
                <div>
                   <h3 className="text-xl font-black text-[#0F172A] tracking-tight">CSV Sütun Eşleştirme</h3>
                   <p className="text-sm text-text-muted mt-1">Dosyanızdaki sütunları sistem alanlarıyla eşleştirin.</p>
                </div>
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-border-color shadow-sm">
                   <Upload className="w-6 h-6 text-primary" />
                </div>
             </div>
             
             <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                   {Object.entries(mapping).map(([field, selectedHeader]) => (
                     <div key={field} className="space-y-1">
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest block ml-1">
                          {field === 'sku' && 'Ürün Kodu (Zorunlu)'}
                          {field === 'name' && 'Ürün Adı (Zorunlu)'}
                          {field === 'category' && 'Malzeme / Kategori'}
                          {field === 'stock' && 'Stok Miktarı'}
                          {field === 'price' && 'Satış Fiyatı'}
                          {field === 'barcode' && 'Barkod'}
                          {field === 'description' && 'Açıklama'}
                          {field === 'weight' && 'Ağırlık (Gram)'}
                          {field === 'location' && 'Raf Lokasyonu'}
                          {field === 'notes' && 'Dahili Notlar'}
                        </label>
                        <div className="relative">
                           <select 
                             value={selectedHeader}
                             onChange={(e) => setMapping(prev => ({ ...prev, [field]: e.target.value }))}
                             className="w-full pl-3 pr-10 py-2.5 bg-bg-main border border-border-color rounded-xl text-sm font-bold appearance-none hover:border-primary transition-colors focus:ring-2 focus:ring-primary/20 outline-none"
                           >
                             <option value="">Seçilmedi</option>
                             {csvHeaders.map(h => (
                               <option key={h} value={h}>{h}</option>
                             ))}
                           </select>
                           <ChevronDown className="w-4 h-4 text-text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                     </div>
                   ))}
                </div>

                <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl">
                   <p className="text-xs text-blue-700 leading-relaxed font-medium">
                     <strong>İpucu:</strong> Sütun başlıklarınız Ürün Kodu, Ürün Adı vb. ise otomatik eşleştirme yapılır. İlk 5 satır örnek olarak okunur.
                   </p>
                </div>
             </div>

             <div className="p-8 bg-gray-50 border-t border-border-color flex items-center justify-between">
                <button 
                  onClick={() => setShowMappingModal(false)}
                  className="px-6 h-12 text-sm font-bold text-text-muted hover:text-[#0F172A] transition-colors"
                >
                  Vazgeç
                </button>
                <button 
                  onClick={executeImport}
                  disabled={deletingAll}
                  className="px-8 h-12 bg-[#0F172A] text-white rounded-xl font-bold text-sm shadow-xl hover:scale-105 transition-all disabled:opacity-50"
                >
                  {deletingAll ? (
                    <div className="flex items-center">
                       <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                       İçe Aktarılıyor...
                    </div>
                  ) : 'İçe Aktarımı Başlat'}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    'Active': 'bg-green-50/50 text-success border-green-100',
    'Passive': 'bg-bg-main text-text-muted border-border-color',
    'Out of stock': 'bg-red-50/50 text-danger border-red-100'
  };
  const labels = {
    'Active': 'Aktif',
    'Passive': 'Pasif',
    'Out of stock': 'Tükendi'
  };
  return (
    <span className={cn(
      "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight border",
      styles[status as keyof typeof styles] || styles.Passive
    )}>
      {labels[status as keyof typeof labels] || status}
    </span>
  );
}
