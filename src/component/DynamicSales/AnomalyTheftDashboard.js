
import { useState } from "react";
import AnomalyAlert from './AnomalyAlert';
import TheftBatchDetect from '../UserDashboard/TheftBatchDetect';

function InventorySecurityDashboard() {
  const [activeTab, setActiveTab] = useState('anomaly');

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Tab Buttons */}
      <div className="flex justify-center mb-6">
        <button
          onClick={() => handleTabSwitch('anomaly')}
          className={`px-4 py-2 sm:px-6 sm:py-3 mx-2 text-sm sm:text-base font-medium transition-colors ${
            activeTab === 'anomaly'
              ? 'bg-indigo-600 text-white dark:bg-indigo-800 dark:text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Anomaly Alerts
        </button>
        <button
          onClick={() => handleTabSwitch('theft')}
          className={`px-4 py-2 sm:px-6 sm:py-3 mx-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
            activeTab === 'theft'
              ? 'bg-indigo-600 text-white dark:bg-indigo-800 dark:text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Audit Checks
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:border dark:border-gray-700">
        {activeTab === 'anomaly' ? (
          <AnomalyAlert />
        ) : (
          <TheftBatchDetect />
        )}
      </div>
    </div>
  );
}

export default InventorySecurityDashboard;