const API_URL = "";

export const api = {
  get: async (endpoint: string) => {
    const res = await fetch(`${API_URL}/api${endpoint}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  post: async (endpoint: string, data: any) => {
    const res = await fetch(`${API_URL}/api${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  put: async (endpoint: string, data: any) => {
    const res = await fetch(`${API_URL}/api${endpoint}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  delete: async (endpoint: string) => {
    const res = await fetch(`${API_URL}/api${endpoint}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  upload: async (endpoint: string, formData: FormData) => {
    const res = await fetch(`${API_URL}/api${endpoint}`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};

export const formatCurrency = (value: number, symbol = "₺") => {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    currencyDisplay: "narrowSymbol"
  }).format(value).replace("TL", symbol);
};

export const PLATFORMS = ["Trendyol", "Hepsiburada", "Amazon", "N11", "Website", "Instagram"];
export const MATERIALS = ["Aliminyum", "PPR", "Dokum Demir", "Karbon Celik"];
export const CATEGORIES = ["Aliminyum", "PPR", "Dokum Demir", "Karbon Celik"];
