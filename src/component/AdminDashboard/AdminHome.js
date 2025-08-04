import React, { useState, useEffect } from 'react';
import {
  FaMoneyBillWave,
  FaBars,
  FaTimes,
  FaStore,
  FaUserShield,
  FaUserTie,
  FaUsers,
  FaKey,
  FaLockOpen,
} from 'react-icons/fa';
import AdminProfile from './AdminProfile';
import Stores from './Stores';
import StoreUsers from './StoreUsers';
import Owners from './Owners';
import DashboardAccess from '../Ops/DashboardAccess';
import PriceUpdateCompo from '../Payments/PriceUpdateCompo';
import AccesDashboard from './AccesDashboard';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('Stores');
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleNavClick = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  const renderContent = () => {
    const Wrapper = ({ children }) => (
      <div className="w-full bg-white dark:bg-gray-700 rounded-lg shadow p-4">{children}</div>
    );

    switch (activeTab) {
      case 'Stores':
        return <Wrapper><Stores /></Wrapper>;
      case 'Store Users':
        return <Wrapper><StoreUsers /></Wrapper>;
      case 'Owners':
        return <Wrapper><Owners /></Wrapper>;
      case 'Admin Profile':
        return <Wrapper><AdminProfile /></Wrapper>;
      case 'Pricing':
        return <Wrapper><PriceUpdateCompo /></Wrapper>;
      case 'Store Access':
        return <Wrapper><AccesDashboard /></Wrapper>;
      case 'Access':
        return <Wrapper><DashboardAccess /></Wrapper>;
      default:
        return <Wrapper>Welcome to the Dashboard</Wrapper>;
    }
  };

  const sidebarItems = [
    { name: 'Admin Profile', icon: FaUserShield, aria: 'Admin Profile: View and edit your admin profile' },
    { name: 'Owners', icon: FaUserTie, aria: 'Owners: Manage store owners' },
    { name: 'Store Users', icon: FaUsers, aria: 'Store Users: Manage users associated with stores' },
    { name: 'Stores', icon: FaStore, aria: 'Stores: View and manage stores' },
    { name: 'Pricing', icon: FaMoneyBillWave, aria: 'Pricing: Update pricing plans' },
    { name: 'Store Access', icon: FaKey, aria: 'Store Access: Manage store access permissions' },
    { name: 'Access', icon: FaLockOpen, aria: 'Access: Manage dashboard access' },
  ];

  return (
    <>
      <style>
        {`
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .no-scrollbar {
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
          }
        `}
      </style>
      <div className="flex h-screen bg-gray-300 dark:bg-gray-700">
        {/* Sidebar */}
        <aside
          className={`fixed md:static top-0 left-0 h-full transition-all duration-300 bg-white dark:bg-gray-900 z-40 ${
            sidebarOpen ? 'w-64' : 'w-0 md:w-16'
          } ${sidebarOpen ? 'block' : 'hidden md:block'}`}
        >
          <div className="p-4 md:p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-bold text-indigo-800 dark:text-white ${sidebarOpen ? 'block' : 'hidden'}`}>
                Menu
              </h2>
              <button
                onClick={toggleSidebar}
                className="text-indigo-800 dark:text-indigo-200 md:hidden"
                aria-label="Close sidebar"
              >
                <FaTimes size={24} />
              </button>
            </div>
            <nav className="pt-4">
              <ul className="space-y-2">
                {sidebarItems.map((item) => (
                  <li
                    key={item.name}
                    data-tour={item.name.toLowerCase().replace(' ', '-')}
                    onClick={() => handleNavClick(item.name)}
                    className={`flex items-center p-2 rounded cursor-pointer transition hover:bg-indigo-200 dark:hover:bg-indigo-600 ${
                      activeTab === item.name ? 'bg-indigo-200 dark:bg-indigo-600' : ''
                    }`}
                    aria-label={item.aria}
                    title={item.aria}
                  >
                    <item.icon
                      className={`text-indigo-800 dark:text-indigo-200 ${sidebarOpen ? 'mr-3' : 'mx-auto'}`}
                      size={20}
                    />
                    <span className={`text-indigo-800 dark:text-indigo-200 ${sidebarOpen ? 'block' : 'hidden'}`}>
                      {item.name}
                    </span>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className="flex-1 flex flex-col justify-between">
            <div
              data-tour="dark-mode"
              className={`p-4 md:p-4 mt-auto flex items-center justify-between ${sidebarOpen ? 'block' : 'hidden md:flex'}`}
            >
              <span className={`text-indigo-800 dark:text-indigo-200 ${sidebarOpen ? 'block' : 'hidden'}`}>
                {darkMode ? 'Dark Mode' : 'Light Mode'}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={darkMode}
                  onChange={() => setDarkMode(!darkMode)}
                />
                <div className="w-11 h-6 bg-indigo-800 dark:bg-gray-600 rounded-full transition-colors duration-300">
                  <span
                    className={`absolute left-1 top-1 bg-white dark:bg-indigo-200 w-4 h-4 rounded-full transition-transform duration-300 ${
                      darkMode ? 'translate-x-5' : ''
                    }`}
                  ></span>
                </div>
              </label>
            </div>
          </div>
        </aside>

        {/* Floating Toggle Button (Desktop Only) */}
        <button
          onClick={toggleSidebar}
          className={`fixed top-4 md:top-4 transition-all duration-300 z-50 rounded-full p-2 bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 md:block hidden ${
            sidebarOpen ? 'left-64' : 'left-4'
          }`}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
        </button>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 no-scrollbar">
          {/* Mobile Header */}
          <header className="flex md:hidden items-center justify-between p-4 bg-white dark:bg-gray-800">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-indigo-800 dark:text-indigo-200"
              aria-label="Open sidebar"
            >
              <FaBars size={24} />
            </button>
            <h1 className="text-xl font-bold text-indigo-800 dark:text-indigo-200 truncate max-w-[200px]">
              {activeTab}
            </h1>
            <div style={{ width: 24 }}></div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 no-scrollbar">
            {renderContent()}
          </main>
        </div>
      </div>
    </>
  );
};

export default Dashboard;