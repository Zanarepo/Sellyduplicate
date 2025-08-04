import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { motion } from 'framer-motion';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaCheck, FaTimes, FaTrash, FaSearch, FaCheckSquare } from 'react-icons/fa';

const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, staggerChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, type: 'spring', stiffness: 100 } },
};

const buttonVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.05, transition: { type: 'spring', stiffness: 300 } },
};

const StoreAccess = () => {
  const [stores, setStores] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [selectedStores, setSelectedStores] = useState([]);
  const [selectedDashboards, setSelectedDashboards] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const dashboardOptions = [
    { value: 'fix_scan', label: 'Fix Scan' },
    { value: 'flex_scan', label: 'Flex Scan' },
    { value: 'ai_insights', label: 'AI Insights' },
    { value: 'admin_ops', label: 'Admin Ops' },
  ];

  const fetchStores = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('stores')
      .select('id, shop_name, allowed_dashboard')
      .order('id', { ascending: true });
    if (!error) {
      setStores(data);
      setFiltered(data);
    } else {
      console.error('Error fetching stores:', error);
      setError('Failed to fetch stores');
      toast.error('Failed to fetch stores');
      setStores([]);
      setFiltered([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const handleSearch = async () => {
    if (!searchValue) {
      setFiltered(stores);
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('stores')
      .select('id, shop_name, allowed_dashboard')
      .ilike('shop_name', `%${searchValue}%`)
      .order('id', { ascending: true });
    if (!error) {
      setFiltered(data);
      setError('');
    } else {
      console.error('Error searching stores:', error);
      setError('Failed to fetch stores');
      toast.error('Failed to fetch stores');
      setFiltered([]);
    }
    setIsLoading(false);
  };

  const handleStoreSelect = (storeId) => {
    setSelectedStores((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    );
  };

  const handleSelectAllStores = () => {
    if (selectedStores.length === filtered.length) {
      setSelectedStores([]);
    } else {
      setSelectedStores(filtered.map((store) => store.id));
    }
  };

  const handleDashboardChange = (value) => {
    setSelectedDashboards((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const handleAssignDashboards = async () => {
    if (selectedStores.length === 0 || selectedDashboards.length === 0) {
      toast.warn('Please select at least one store and one dashboard.');
      return;
    }

    try {
      setIsLoading(true);
      for (const storeId of selectedStores) {
        const store = stores.find((s) => s.id === storeId);
        const currentDashboards = store.allowed_dashboard
          ? store.allowed_dashboard.split(',').filter(Boolean)
          : [];
        const updatedDashboards = [...new Set([...currentDashboards, ...selectedDashboards])];
        const dashboardString = updatedDashboards.join(',');

        const { error } = await supabase
          .from('stores')
          .update({ allowed_dashboard: dashboardString })
          .eq('id', storeId);

        if (error) {
          toast.error(`Failed to assign dashboards to store ${store.shop_name}`);
        }
      }
      setSuccess('Dashboards assigned successfully!');
      toast.success('Dashboards assigned successfully!');
      setError('');
      setSelectedStores([]);
      setSelectedDashboards([]);
      localStorage.removeItem(`dashboard_${selectedStores.join('_')}`);
      fetchStores();
    } catch (err) {
      console.error('Error assigning dashboards:', err);
      setError('Failed to assign dashboards');
      toast.error('Failed to assign dashboards: ' + err.message);
      setSuccess('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnassignDashboards = async () => {
    if (selectedStores.length === 0 || selectedDashboards.length === 0) {
      toast.warn('Please select at least one store and one dashboard.');
      return;
    }

    try {
      setIsLoading(true);
      for (const storeId of selectedStores) {
        const store = stores.find((s) => s.id === storeId);
        const currentDashboards = store.allowed_dashboard
          ? store.allowed_dashboard.split(',').filter(Boolean)
          : [];
        const updatedDashboards = currentDashboards.filter((d) => !selectedDashboards.includes(d));
        const dashboardString = updatedDashboards.join(',');

        const { error } = await supabase
          .from('stores')
          .update({ allowed_dashboard: dashboardString })
          .eq('id', storeId);

        if (error) {
          toast.error(`Failed to unassign dashboards from store ${store.shop_name}`);
        }
      }
      setSuccess('Dashboards unassigned successfully!');
      toast.success('Dashboards unassigned successfully!');
      setError('');
      setSelectedStores([]);
      setSelectedDashboards([]);
      localStorage.removeItem(`dashboard_${selectedStores.join('_')}`);
      fetchStores();
    } catch (err) {
      console.error('Error unassigning dashboards:', err);
      setError('Failed to unassign dashboards');
      toast.error('Failed to unassign dashboards: ' + err.message);
      setSuccess('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveSingleDashboard = async (storeId, dashboard) => {
    try {
      setIsLoading(true);
      const store = stores.find((s) => s.id === storeId);
      const currentDashboards = store.allowed_dashboard
        ? store.allowed_dashboard.split(',').filter(Boolean)
        : [];
      const updatedDashboards = currentDashboards.filter((d) => d !== dashboard);
      const dashboardString = updatedDashboards.join(',');

      const { error } = await supabase
        .from('stores')
        .update({ allowed_dashboard: dashboardString })
        .eq('id', storeId);

      if (error) {
        toast.error(`Failed to remove ${dashboard} from store ${store.shop_name}`);
      } else {
        toast.success(`Removed ${dashboard} from store ${store.shop_name}`);
        setSuccess(`Removed ${dashboard} from store ${store.shop_name}`);
        setError('');
        localStorage.removeItem(`dashboard_${storeId}`);
        fetchStores();
      }
    } catch (err) {
      console.error('Error removing dashboard:', err);
      setError('Failed to remove dashboard');
      toast.error('Failed to remove dashboard: ' + err.message);
      setSuccess('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignAllToAll = async () => {
    try {
      setIsLoading(true);
      const allDashboards = dashboardOptions.map((d) => d.value);
      for (const store of stores) {
        const dashboardString = allDashboards.join(',');

        const { error } = await supabase
          .from('stores')
          .update({ allowed_dashboard: dashboardString })
          .eq('id', store.id);

        if (error) {
          toast.error(`Failed to assign all dashboards to store ${store.shop_name}`);
        }
      }
      setSuccess('All dashboards assigned to all stores successfully!');
      toast.success('All dashboards assigned to all stores successfully!');
      setError('');
      setSelectedStores([]);
      setSelectedDashboards([]);
      localStorage.removeItem(`dashboard_${stores.map((s) => s.id).join('_')}`);
      fetchStores();
    } catch (err) {
      console.error('Error assigning all dashboards:', err);
      setError('Failed to assign all dashboards');
      toast.error('Failed to assign all dashboards: ' + err.message);
      setSuccess('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnassignAllFromAll = async () => {
    try {
      setIsLoading(true);
      for (const store of stores) {
        const { error } = await supabase
          .from('stores')
          .update({ allowed_dashboard: '' })
          .eq('id', store.id);

        if (error) {
          toast.error(`Failed to unassign all dashboards from store ${store.shop_name}`);
        }
      }
      setSuccess('All dashboards unassigned from all stores successfully!');
      toast.success('All dashboards unassigned from all stores successfully!');
      setError('');
      setSelectedStores([]);
      setSelectedDashboards([]);
      localStorage.removeItem(`dashboard_${stores.map((s) => s.id).join('_')}`);
      fetchStores();
    } catch (err) {
      console.error('Error unassigning all dashboards:', err);
      setError('Failed to unassign all dashboards');
      toast.error('Failed to unassign all dashboards: ' + err.message);
      setSuccess('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.section
      className="py-12 sm:py-8 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900 min-h-screen"
      initial="hidden"
      animate="visible"
      variants={sectionVariants}
    >
      <ToastContainer />
      <div className="container mx-auto max-w-7xl">
        <motion.h2
          className="text-2xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-4 sm:mb-12 font-sans"
          variants={cardVariants}
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          Manage Sidebar Access
        </motion.h2>
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200 dark:border-gray-700"
          variants={cardVariants}
        >
          {isLoading && (
            <div className="flex justify-center items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
            </div>
          )}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="relative flex-1">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Search by store name"
                  className="w-full pl-10 p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <motion.button
                onClick={handleSearch}
                className="bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 text-white py-2 px-6 rounded-lg font-medium hover:shadow-lg"
                variants={buttonVariants}
                initial="rest"
                whileHover="hover"
              >
                Search
              </motion.button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Select Stores</h3>
                  <motion.button
                    onClick={handleSelectAllStores}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white py-1 px-3 rounded-lg font-medium hover:shadow-lg flex items-center"
                    variants={buttonVariants}
                    initial="rest"
                    whileHover="hover"
                  >
                    <FaCheckSquare className="mr-2" />
                    {selectedStores.length === filtered.length ? 'Deselect All' : 'Select All'}
                  </motion.button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filtered.map((store) => (
                    <label key={store.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedStores.includes(store.id)}
                        onChange={() => handleStoreSelect(store.id)}
                        className="mr-2 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-gray-900 dark:text-gray-300">{store.shop_name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Select Dashboards</h3>
                <div className="space-y-2">
                  {dashboardOptions.map((option) => (
                    <label key={option.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedDashboards.includes(option.value)}
                        onChange={() => handleDashboardChange(option.value)}
                        className="mr-2 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-gray-900 dark:text-gray-300">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <motion.button
                onClick={handleAssignDashboards}
                className="bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 text-white py-2 px-6 rounded-lg font-medium hover:shadow-lg flex items-center"
                variants={buttonVariants}
                initial="rest"
                whileHover="hover"
                disabled={isLoading}
              >
                <FaCheck className="mr-2" /> Assign Selected
              </motion.button>
              <motion.button
                onClick={handleUnassignDashboards}
                className="bg-gradient-to-r from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 text-white py-2 px-6 rounded-lg font-medium hover:shadow-lg flex items-center"
                variants={buttonVariants}
                initial="rest"
                whileHover="hover"
                disabled={isLoading}
              >
                <FaTimes className="mr-2" /> Unassign Selected
              </motion.button>
              <motion.button
                onClick={handleAssignAllToAll}
                className="bg-gradient-to-r from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 text-white py-2 px-6 rounded-lg font-medium hover:shadow-lg flex items-center"
                variants={buttonVariants}
                initial="rest"
                whileHover="hover"
                disabled={isLoading}
              >
                <FaCheck className="mr-2" /> Assign All to All
              </motion.button>
              <motion.button
                onClick={handleUnassignAllFromAll}
                className="bg-gradient-to-r from-gray-500 to-gray-600 dark:from-gray-600 dark:to-gray-700 text-white py-2 px-6 rounded-lg font-medium hover:shadow-lg flex items-center"
                variants={buttonVariants}
                initial="rest"
                whileHover="hover"
                disabled={isLoading}
              >
                <FaTimes className="mr-2" /> Unassign All from All
              </motion.button>
            </div>
            {error && <p className="text-red-500 dark:text-red-400 mt-4">{error}</p>}
            {success && <p className="text-green-500 dark:text-green-400 mt-4">{success}</p>}
            <div className="mt-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Stores</h3>
              <ul className="mt-2 space-y-3">
                {filtered.map((store) => (
                  <li
                    key={store.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-100 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center mb-2 sm:mb-0">
                      <input
                        type="checkbox"
                        checked={selectedStores.includes(store.id)}
                        onChange={() => handleStoreSelect(store.id)}
                        className="mr-3 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-gray-900 dark:text-gray-300">
                        {store.shop_name}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-gray-600 dark:text-gray-400 mr-2">
                        Current: {store.allowed_dashboard ? store.allowed_dashboard.split(',').filter(Boolean).map((d) => (
                          <span key={d} className="inline-flex items-center px-2 py-1 mr-1 text-sm font-medium text-indigo-800 bg-indigo-100 rounded-full">
                            {dashboardOptions.find((opt) => opt.value === d)?.label || d}
                            <button
                              onClick={() => handleRemoveSingleDashboard(store.id, d)}
                              className="ml-1 text-red-600 hover:text-red-800"
                            >
                              <FaTrash className="h-3 w-3" />
                            </button>
                          </span>
                        )) : 'None'}
                      </span>
                      <motion.button
                        onClick={() => handleAssignDashboards()}
                        className="bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 text-white py-1 px-3 rounded-lg font-medium hover:shadow-lg"
                        variants={buttonVariants}
                        initial="rest"
                        whileHover="hover"
                        disabled={isLoading || !selectedStores.includes(store.id) || selectedDashboards.length === 0}
                      >
                        Assign
                      </motion.button>
                      <motion.button
                        onClick={() => handleUnassignDashboards()}
                        className="bg-gradient-to-r from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 text-white py-1 px-3 rounded-lg font-medium hover:shadow-lg"
                        variants={buttonVariants}
                        initial="rest"
                        whileHover="hover"
                        disabled={isLoading || !selectedStores.includes(store.id) || selectedDashboards.length === 0}
                      >
                        Unassign
                      </motion.button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default StoreAccess;