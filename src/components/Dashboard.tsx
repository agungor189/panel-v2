import React from 'react';
import { DashboardWidgetGrid } from './dashboard/DashboardWidgetGrid';

interface DashboardProps {
  onNavigate: (view: any) => void;
  onProductClick: (id: string) => void;
  onNavigateAnalytics?: (tab: string) => void;
}

export default function Dashboard({ onNavigate, onProductClick, onNavigateAnalytics }: DashboardProps) {
  return (
    <div className="animate-in fade-in duration-500 pb-12 w-full">
       <DashboardWidgetGrid />
    </div>
  );
}
