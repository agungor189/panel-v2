import React, { useEffect, useState } from 'react';
import { dashboardApi } from '../dashboardApi';
import { useCurrency } from '../../../CurrencyContext';

export function UpcomingPaymentsWidget({ refreshKey }: any) {
  const { FormatAmount } = useCurrency();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.getPaymentUpcoming({ limit: 5 });
      setData(res || []);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="space-y-3 pt-2">
    {[1,2,3].map(i => <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-12 w-full"></div>)}
  </div>;

  if (data.length === 0) return <div className="text-gray-400 text-sm py-4 text-center">Yaklaşan ödeme bulunmuyor.</div>;

  return (
    <div className="flex flex-col gap-2 pt-2">
      {data.map(item => (
        <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100 px-4">
           <div>
             <div className="font-bold text-gray-900 text-sm leading-tight mb-0.5">{item.title}</div>
             <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center gap-2">
                <span>{item.due_date}</span>
                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                <span>{item.category}</span>
             </div>
           </div>
           <div className="font-black text-gray-900 text-sm">
             <FormatAmount amount={item.amount_try} />
           </div>
        </div>
      ))}
    </div>
  );
}
