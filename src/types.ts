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
  exchange_rate_at_transaction?: number;
  product_id?: string;
  product_title?: string;
  note: string;
  reference_number: string;
  recurring_id?: string;
  title?: string;
  description?: string;
  payment_method?: string;
  supplier?: string;
  invoice_number?: string;
  attachment_count?: number;
  created_at?: string;
}

export interface ExpenseAttachment {
  id: string;
  expense_id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
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
  totalStockSalesValue: number;
  totalStockCostValue: number;
  totalBufferedCostValue: number;
  cashTotal?: number;
  pendingPlatform?: number;
  monthlyCashIn?: number;
  monthlyCashOut?: number;
  totalActivities?: number;
  totalChangedValues?: number;
}

export interface DashboardWidget {
  id: string;
  widget_type: string;
  position: number;
  is_visible: boolean;
  size: number;
  settings: any;
}

export interface ApiKey {
  id: string;
  service_name: string;
  display_name: string;
  key_name?: string;
  merchant_id?: string;
  seller_id?: string;
  status: 'active' | 'passive';
  last4: string;
  maskedKey?: string;
  notes?: string;
  last_test_status?: 'success' | 'failed';
  last_tested_at?: string;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PanelApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last4: string;
  status: 'active' | 'passive' | 'revoked';
  environment: 'live' | 'test';
  permissions: string;
  allowed_ips?: string;
  expires_at?: string;
  last_used_at?: string;
  last_used_ip?: string;
  created_at: string;
  updated_at: string;
  revoked_at?: string;
  maskedKey: string;
}

export interface Settings {
  company_name: string;
  low_stock_threshold: number;
  currency_symbol: string;
  language: string;
  usd_exchange_rate: number;
  default_buffer_percentage: number;
  default_profit_percentage?: string | number;
  api_key?: string;
  commission_rates: Record<string, number>;
  product_categories: string[];
  income_categories: string[];
  expense_categories: string[];
}
