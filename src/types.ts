export interface Product {
  id: string;
  name: string;
  title: string;
  warehouse_location: string;
  sku: string;
  barcode: string;
  category: string;
  model: string;
  description: string;
  purchase_price_usd: number;
  purchase_cost: number;
  sale_price: number;
  buffer_percentage: number;
  exchange_rate_used: number;
  weight: number;
  status: 'Active' | 'Passive' | 'Out of stock';
  notes: string;
  created_at: string;
  updated_at: string;
  cover_image?: string;
  total_stock?: number;
  images?: ProductImage[];
  platforms?: ProductPlatform[];
}

export interface ProductImage {
  id: string;
  product_id: string;
  path: string;
  sort_order: number;
}

export interface ProductPlatform {
  id: string;
  product_id: string;
  platform_name: string;
  stock: number;
  price: number;
  is_listed: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'Income' | 'Expense';
  category: string;
  platform: string;
  amount: number;
  product_id?: string;
  product_title?: string;
  note: string;
  reference_number: string;
  recurring_id?: string;
}

export interface RecurringPayment {
  id: string;
  title: string;
  day_of_month: number;
  amount: number;
  category: string;
  note: string;
  status: 'Active' | 'Paused';
}

export interface DashboardMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  lowStockCount: number;
}

export interface Settings {
  company_name: string;
  low_stock_threshold: number;
  currency_symbol: string;
  language: string;
  usd_exchange_rate: number;
  default_buffer_percentage: number;
  commission_rates: Record<string, number>;
  product_categories: string[];
  income_categories: string[];
  expense_categories: string[];
}
