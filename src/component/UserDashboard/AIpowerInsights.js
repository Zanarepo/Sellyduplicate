import { supabase } from '../../supabaseClient';
import React, { useState, useEffect } from 'react';
import { FaChartLine, FaBell, FaBoxOpen, FaLightbulb, FaShieldAlt, FaArrowLeft } from "react-icons/fa";
import SalesTrends from '../DynamicSales/SalesTrends';
import AnomalyAlert from '../DynamicSales/AnomalyAlert';
import RestockAlerts from '../DynamicSales/RestockAlerts';
import Recommendation from '../DynamicSales/Recommendation';
import TheftBatchDetect from './TheftBatchDetect';

const tools = [
  {
    key: "sales",
    label: "Sales Insights",
    icon: <FaChartLine className="text-2xl sm:text-5xl sm:text-6xl text-indigo-600" />,
    desc: "Analyze sales trends and forecasts to optimize your store",
    component: <SalesTrends />,
  },
  {
    key: "anomaly",
    label: "Anomaly Alerts",
    icon: <FaBell className="text-2xl sm:text-5xl sm:text-6xl text-indigo-600" />,
    desc: "Detect unusual activities to protect your business",
    component: <AnomalyAlert />,
  },
  {
    key: "restock",
    label: "Restock Alerts",
    icon: <FaBoxOpen className="text-2xl sm:text-5xl sm:text-6xl text-indigo-600" />,
    desc: "Monitor low stock items to ensure availability",
    component: <RestockAlerts />,
  },
  {
    key: "recommendation",
    label: "Restock Recommendations",
    icon: <FaLightbulb className="text-2xl sm:text-5xl sm:text-6xl text-indigo-600" />,
    desc: "Get AI-driven recommendations for restocking items",
    component: <Recommendation />,
  },
  {
    key: "theft",
    label: "Theft/Audit Checks",
    icon: <FaShieldAlt className="text-2xl sm:text-5xl sm:text-6xl text-indigo-600" />,
    desc: "Detect/Audit incidents in your store",
    component: <TheftBatchDetect />,
  },
];

export default function Insights() {
  const [shopName, setShopName] = useState('Store Owner');
  const [activeTool, setActiveTool] = useState('');

  useEffect(() => {
    const storeId = localStorage.getItem('store_id');
    supabase
      .from('stores')
      .select('shop_name')
      .eq('id', storeId)
      .single()
      .then(({ data, error }) => {
        if (!error && data?.shop_name) {
          setShopName(data.shop_name);
        }
      });
  }, []);

  const tool = tools.find(t => t.key === activeTool);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 w-full">
      <header className="text-center mb-4 sm:mb-6">
        <h1 className="text-lg sm:text-3xl font-bold text-indigo-800 dark:text-white">
          Insights for {shopName}
        </h1>
        {!activeTool && (
          <p className="text-gray-600 dark:text-gray-400 mt-2 text-xs sm:text-sm">
            Explore AI-driven insights to optimize your store.
          </p>
        )}
      </header>

      {/* Tool Info and Content */}
      {activeTool ? (
        <div className="mb-4 sm:mb-6">
          <button
            onClick={() => setActiveTool(null)}
            className="flex items-center text-indigo-600 hover:text-indigo-800 mb-4 text-xs sm:text-base"
          >
            <FaArrowLeft className="mr-2" /> Back to Insights
          </button>
          <h2 className="text-lg sm:text-2xl font-semibold text-indigo-800 dark:text-indigo-200">
            {tool.label}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">{tool.desc}</p>
          <div className="w-full mt-4">
            {React.cloneElement(tool.component, { setActiveTool })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
          {tools.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTool(t.key)}
              className="flex flex-col items-center justify-center bg-white dark:bg-gray-800 p-3 sm:p-6 rounded-xl shadow hover:shadow-lg transition h-36 sm:h-48"
            >
              {t.icon}
              <span className="mt-2 text-xs sm:text-base font-medium text-indigo-800 dark:text-white">
                {t.label}
              </span>
              <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm text-center mt-1">
                {t.desc}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}