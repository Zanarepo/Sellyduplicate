import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
  FaRegMoneyBillAlt,
  FaMoneyCheckAlt,
  FaBoxes,
  FaChartLine,
  FaUsers,
  FaTasks,
  FaArrowLeft,
  FaReceipt,
  FaUndoAlt,
  FaBoxOpen,
  FaSearch,
  FaLock,
} from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import DynamicInventory from '../DynamicSales/DynamicInventory';
import ExpenseTracker from './ExpenseTracker';
import Customers from './Customers';
import DebtTracker from './DebtTracker';
import DeviceDynamicSales from '../DynamicSales/DeviceDynamicSales';
import DynamicReturnedItems from '../VariexContents/DynamicReturnedItems';
import GadgetsUnpaidSupplies from '../UserDashboard/GadgetsUnpaidSupplies';
import DynamicSuppliersTracker from '../Ops/DynamicSuppliersTracker';
import LatestReceipts from '../VariexContents/LatestReceipts';
import DashboardAccess from '../Ops/DashboardAccess';
import GadgetsDynamicProducts from './GadgetsDynamicProducts';

const tools = [
  {
    key: 'sales',
    label: 'Sales Tracker',
    icon: <FaChartLine className="text-2xl sm:text-5xl sm:text-6xl text-indigo-600" />,
    desc: 'Add your sales and see how your business is doing',
    component: <DeviceDynamicSales />,
  },
  {
    key: 'Products Tracker',
    label: 'Products & Pricing Tracker',
    icon: <FaBoxes className="text-2xl sm:text-5xl sm:text-6xl text-indigo-600" />,
    desc: 'Add and manage your store’s products, prices, and stock here',
    component: <GadgetsDynamicProducts />,
  },
  {
    key: 'inventory',
    label: 'Manage Inventory (Goods)',
    icon: <FaTasks className="text-2xl sm:text-5xl sm:text-6xl text-indigo-600" />,
    desc: 'Keep an eye on how much goods you have sold and what is left in your store.',
    component: <DynamicInventory />,
  },
  {
    key: 'receipts',
    label: 'Sales Receipts',
    icon: <FaReceipt className="text-2xl sm:text-5xl sm:text-6xl text-indigo-600" />,
    desc: 'Monitor and track sales.',
    component: <LatestReceipts />,
  },
  {
    key: 'returns',
    label: 'Returned Items Tracker',
    icon: <FaUndoAlt className="text-2xl sm:text-5xl sm:text-6xl text-indigo-600" />,
    desc: 'Track returned items from customers.',
    component: <DynamicReturnedItems />,
  },
  {
    key: 'expenses',
    label: 'Expenses Tracker',
    icon: <FaRegMoneyBillAlt className="text-2xl sm:text-5xl sm:text-6xl text-indigo-600" />,
    desc: 'Keep track of your stores spending.',
    component: <ExpenseTracker />,
  },
  {
    key: 'unpaid supplies',
    label: 'Unpaid Supplies',
    icon: <FaBoxOpen className="text-2xl sm:text-5xl sm:text-6xl text-indigo-600" />,
    desc: 'See who took goods on credit and hasn’t paid yet',
    component: <GadgetsUnpaidSupplies />,
  },
  {
    key: 'debts',
    label: 'Debtors',
    icon: <FaMoneyCheckAlt className="text-2xl sm:text-5xl sm:text-6xl text-indigo-600" />,
    desc: 'Track debtors.',
    component: <DebtTracker />,
  },
  {
    key: 'Suppliers',
    label: 'Suppliers & Product Tracker',
    icon: <FaSearch className="text-2xl sm:text-5xl sm:text-6xl text-indigo-600" />,
    desc: 'Track product & suppliers.',
    component: <DynamicSuppliersTracker />,
  },
  {
    key: 'customers',
    label: 'Customer Manager',
    icon: <FaUsers className="text-2xl sm:text-5xl sm:text-6xl text-indigo-600" />,
    desc: 'Manage your customers.',
    component: <Customers />,
  },
];

// Mapping for common variations in allowed_features
const featureKeyMapping = {
  'products & pricing tracker': 'Products Tracker',
  'products': 'Products Tracker',
  'product tracker': 'Products Tracker',
  'products tracker': 'Products Tracker',
  'suppliers & product tracker': 'Suppliers',
  'suppliers': 'Suppliers',
  'supplier': 'Suppliers',
  'sales summary': 'Sales Summary',
};

export default function DynamicDashboard() {
  const [shopName, setShopName] = useState('Store Owner');
  const [activeTool, setActiveTool] = useState(null);
  const [allowedFeatures, setAllowedFeatures] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAllowedFeatures = async () => {
    try {
      setIsLoading(true);
      const storeId = localStorage.getItem('store_id');
      if (!storeId) {
        toast.error('Please log in to access the dashboard.');
        return;
      }

      localStorage.removeItem(`features_${storeId}`);

      const { data, error } = await supabase
        .from('stores')
        .select('shop_name, allowed_features')
        .eq('id', storeId)
        .single();

      if (error) {
        toast.error('Failed to load feature permissions. Please try again.');
        setAllowedFeatures([]);
        return;
      }

      setShopName(data?.shop_name || 'Store Owner');

      let features = [];
      if (Array.isArray(data?.allowed_features)) {
        features = data.allowed_features
          .map((item) => {
            const normalized = item?.trim().toLowerCase();
            return featureKeyMapping[normalized] || normalized;
          })
          .filter(Boolean);
      } else if (data?.allowed_features === '' || data?.allowed_features === '""') {
        features = [];
      } else if (typeof data?.allowed_features === 'string') {
        try {
          const parsed = JSON.parse(data.allowed_features);
          if (Array.isArray(parsed)) {
            features = parsed
              .map((item) => {
                const normalized = item?.trim().toLowerCase();
                return featureKeyMapping[normalized] || normalized;
              })
              .filter(Boolean);
          } else {
            toast.error('Invalid feature data received. Contact support.');
            features = [];
          }
        } catch (e) {
          toast.error('Invalid feature data received. Contact support.');
          features = [];
        }
      } else {
        toast.error('Invalid feature data received. Contact support.');
        features = [];
      }

      setAllowedFeatures(features);
    } catch (err) {
      toast.error('An error occurred while loading permissions. Please try again.');
      setAllowedFeatures([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllowedFeatures();
  }, []);

  useEffect(() => {
    if (!isLoading && activeTool && !allowedFeatures.includes(activeTool)) {
      setActiveTool(null);
    }
  }, [allowedFeatures, isLoading, activeTool]);

  const handleToolClick = (key) => {
    if (!allowedFeatures.includes(key)) {
      toast.warn(`Access Denied: ${tools.find((t) => t.key === key).label} is not enabled for your store.`);
      return;
    }
    setActiveTool(key);
  };

  const renderContent = () => {
    if (isLoading) {
      return <div className="w-full bg-white dark:bg-gray-900 p-4">Loading...</div>;
    }

    if (activeTool) {
      const tool = tools.find((t) => t.key === activeTool);
      if (!allowedFeatures.includes(activeTool)) {
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4">
            <div className="text-red-500 dark:text-red-400">
              Access Denied: You do not have permission to view {tool.label}. Contact your admin to unlock this feature.
            </div>
          </div>
        );
      }
      return (
        <div className="w-full bg-white dark:bg-gray-900 p-4">
          <div className="mb-4 sm:mb-6">
            <button
              onClick={() => setActiveTool(null)}
              className="flex items-center text-indigo-600 hover:text-indigo-800 mb-4 text-xs sm:text-base"
            >
              <FaArrowLeft className="mr-2" /> Back
            </button>
            <h2 className="text-lg sm:text-2xl font-semibold text-indigo-700 dark:text-indigo-200">
              {tool.label}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">{tool.desc}</p>
          </div>
          {tool.component}
        </div>
      );
    }

    return (
      <div className="w-full bg-white dark:bg-gray-900 p-4">
        <div className="grid grid-cols-3 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
          {tools.map((t) => (
            <button
              key={t.key}
              onClick={() => handleToolClick(t.key)}
              className={`flex flex-col items-center justify-center bg-white dark:bg-gray-800 p-2 sm:p-6 rounded-xl shadow hover:shadow-lg transition h-32 sm:h-48 ${
                !allowedFeatures.includes(t.key) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={!allowedFeatures.includes(t.key)}
              title={
                allowedFeatures.includes(t.key)
                  ? t.desc
                  : `Locked: ${t.label} is not enabled for your store`
              }
            >
              <div className="relative">
                {t.icon}
                {!allowedFeatures.includes(t.key) && (
                  <FaLock className="absolute top-0 right-0 text-red-500 text-sm" />
                )}
              </div>
              <span className="mt-2 text-xs sm:text-base font-medium text-indigo-800 dark:text-white">
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 w-full">
      <ToastContainer />
      <DashboardAccess />
      <header className="text-center mb-4 sm:mb-6">
        <h1 className="text-lg sm:text-3xl font-bold text-indigo-800 dark:text-white">
          Welcome, {shopName}!
        </h1>
        {!activeTool && (
          <p className="text-gray-600 dark:text-gray-400 mt-2 text-xs sm:text-sm">
            Choose a tool to continue.
          </p>
        )}
      </header>
      {renderContent()}
      <div className="p-4">
        <button
          onClick={() => {
            localStorage.removeItem(`features_${localStorage.getItem('store_id')}`);
            fetchAllowedFeatures();
          }}
          className="text-indigo-600 dark:text-indigo-400 text-sm underline hover:text-indigo-800 dark:hover:text-indigo-300"
        >
          Refresh Permissions
        </button>
      </div>
    </div>
  );
}