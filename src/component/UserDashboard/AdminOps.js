import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { FaClock, FaTasks, FaCalendarAlt, FaArrowLeft } from 'react-icons/fa';
import StoreClocking from './StoreClocking';
import AdminTasks from './AdminTasks';
import StaffSchedules from './StaffSchedules';

const opsTools = [
  {
    key: 'clocking',
    label: 'Time Sheet Manager',
    icon: <FaClock className="text-xl sm:text-4xl md:text-5xl text-indigo-600" />,
    desc: 'Track employee clock-in and clock-out times.',
    component: <StoreClocking />,
  },
  {
    key: 'tasks',
    label: 'Assignment Tracker',
    icon: <FaTasks className="text-xl sm:text-4xl md:text-5xl text-indigo-600" />,
    desc: 'Manage and monitor staff tasks.',
    component: <AdminTasks />,
  },
  {
    key: 'schedules',
    label: 'Schedule Manager',
    icon: <FaCalendarAlt className="text-xl sm:text-4xl md:text-5xl text-indigo-600" />,
    desc: 'Organize staff schedules efficiently.',
    component: <StaffSchedules />,
  },
];

export default function AdminOps() {
  const [shopName, setShopName] = useState('Store Admin');
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

  const tool = opsTools.find((t) => t.key === activeTool);

  return (
    <div className="w-full min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      <header className="text-center pt-4 sm:pt-6">
        <h1 className="text-base sm:text-2xl md:text-3xl font-bold text-indigo-800 dark:text-white">
          {shopName} Admin Operations
        </h1>
        {!activeTool && (
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-xs sm:text-sm md:text-base">
            Manage clocking, tasks, and staff schedules in one place.
          </p>
        )}
      </header>

      {/* Active Tool Display */}
      {activeTool ? (
        <div className="flex-1 flex flex-col w-full">
          <div className="px-4 sm:px-6">
            <button
              onClick={() => setActiveTool('')}
              className="flex items-center text-indigo-600 hover:text-indigo-800 mb-3 sm:mb-4 text-xs sm:text-sm md:text-base"
            >
              <FaArrowLeft className="mr-2" /> Back to Operations
            </button>
            <h2 className="text-base sm:text-lg md:text-xl font-semibold text-indigo-800 dark:text-indigo-200">
              {tool.label}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm md:text-base mb-4">
              {tool.desc}
            </p>
          </div>
          <div className="flex-1 w-full">
            {React.cloneElement(tool.component, { setActiveTool })}
          </div>
        </div>
      ) : (
        <div className="flex-1 px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 md:gap-6">
          {opsTools.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTool(t.key)}
              className="flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-xl shadow hover:shadow-lg transition p-4 sm:p-6 h-40 sm:h-48 md:h-56 w-full"
            >
              {t.icon}
              <span className="mt-2 text-xs sm:text-sm md:text-base font-medium text-indigo-800 dark:text-white">
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