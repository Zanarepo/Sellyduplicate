import React, { useState, useEffect, useCallback } from 'react';
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

const FeatureAssignment = () => {
  const [stores, setStores] = useState([]);
  const [filteredStores, setFilteredStores] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [selectedStores, setSelectedStores] = useState([]);
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const featureOptions = [
    { value: 'sales', label: 'Sales Tracker' },
    { value: 'Products Tracker', label: 'Products & Pricing Tracker'},
    { value: 'inventory', label: 'Manage Inventory (Goods)' },
    { value: 'receipts', label: 'Sales Receipts' },
    { value: 'returns', label: 'Returned Items Tracker' },
    { value: 'expenses', label: 'Expenses Tracker' },
    { value: 'unpaid supplies', label: 'Unpaid Supplies' },
    { value: 'debts', label: 'Debtors' },
    { value: 'Suppliers', label: 'Suppliers' },
    { value: 'customers', label: 'Customer Manager' },
    { value: 'sales_summary', label: 'Sales Summary' },
    


  ];

  const normalizeFeatures = useCallback((features) => {
    try {
      if (Array.isArray(features)) return features;
      if (typeof features === 'string') return JSON.parse(features) || [];
      return [];
    } catch (e) {
      console.warn(`Failed to normalize features: ${features}`, e);
      return [];
    }
  }, []);

  const fetchStores = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('stores')
        .select('id, shop_name, allowed_features')
        .order('id', { ascending: true });
      if (error) throw error;

      console.log('Raw fetched stores:', data);
      const normalizedData = data.map((store) => ({
        ...store,
        allowed_features: normalizeFeatures(store.allowed_features),
      }));
      console.log('Normalized stores:', normalizedData);

      setStores(normalizedData);
      setFilteredStores(normalizedData);
      setError('');
    } catch (err) {
      console.error('Error fetching stores:', err);
      setError('Failed to fetch stores: ' + err.message);
      toast.error('Failed to fetch stores: ' + err.message);
      setStores([]);
      setFilteredStores([]);
    } finally {
      setIsLoading(false);
    }
  }, [setStores, setFilteredStores, setError, setIsLoading, normalizeFeatures]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const handleSearch = async () => {
    if (!searchValue) {
      setFilteredStores(stores);
      console.log('Search cleared, showing all stores:', stores);
      return;
    }
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('stores')
        .select('id, shop_name, allowed_features')
        .ilike('shop_name', `%${searchValue}%`)
        .order('id', { ascending: true });
      if (error) throw error;

      const normalizedData = data.map((store) => ({
        ...store,
        allowed_features: normalizeFeatures(store.allowed_features),
      }));
      console.log('Search results for query:', searchValue, 'Results:', normalizedData);
      setFilteredStores(normalizedData);
      setError('');
    } catch (err) {
      console.error('Error searching stores:', err);
      setError('Failed to search stores: ' + err.message);
      toast.error('Failed to search stores: ' + err.message);
      setFilteredStores(
        stores.filter((store) =>
          store.shop_name.toLowerCase().includes(searchValue.toLowerCase())
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleStoreSelect = (storeId) => {
    setSelectedStores((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    );
  };

  const handleSelectAllStores = () => {
    setSelectedStores(
      selectedStores.length === filteredStores.length
        ? []
        : filteredStores.map((store) => store.id)
    );
  };

  const handleFeatureChange = (value) => {
    setSelectedFeatures((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const handleAssignFeatures = async () => {
    if (selectedStores.length === 0 || selectedFeatures.length === 0) {
      toast.warn('Please select at least one store and one feature.');
      return;
    }

    try {
      setIsLoading(true);
      for (const storeId of selectedStores) {
        const store = stores.find((s) => s.id === storeId);
        const currentFeatures = normalizeFeatures(store.allowed_features);
        const updatedFeatures = [...new Set([...currentFeatures, ...selectedFeatures])];

        console.log(`Assigning features to store ${store.shop_name}:`, updatedFeatures);
        const { error } = await supabase
          .from('stores')
          .update({ allowed_features: updatedFeatures })
          .eq('id', storeId);

        if (error) throw new Error(`Failed to assign features to store ${store.shop_name}`);
      }
      setSuccess('Features assigned successfully!');
      toast.success('Features assigned successfully!');
      setError('');
      setSelectedStores([]);
      setSelectedFeatures([]);
      localStorage.removeItem(`features_${selectedStores.join('_')}`);
      await fetchStores();
    } catch (err) {
      console.error('Error assigning features:', err);
      setError('Failed to assign features: ' + err.message);
      toast.error('Failed to assign features: ' + err.message);
      setSuccess('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnassignFeatures = async () => {
    if (selectedStores.length === 0 || selectedFeatures.length === 0) {
      toast.warn('Please select at least one store and one feature.');
      return;
    }

    try {
      setIsLoading(true);
      for (const storeId of selectedStores) {
        const store = stores.find((s) => s.id === storeId);
        const currentFeatures = normalizeFeatures(store.allowed_features);
        const updatedFeatures = currentFeatures.filter((f) => !selectedFeatures.includes(f));

        console.log(`Unassigning features from store ${store.shop_name}:`, updatedFeatures);
        const { error } = await supabase
          .from('stores')
          .update({ allowed_features: updatedFeatures })
          .eq('id', storeId);

        if (error) throw new Error(`Failed to unassign features from store ${store.shop_name}`);
      }
      setSuccess('Features unassigned successfully!');
      toast.success('Features unassigned successfully!');
      setError('');
      setSelectedStores([]);
      setSelectedFeatures([]);
      localStorage.removeItem(`features_${selectedStores.join('_')}`);
      await fetchStores();
    } catch (err) {
      console.error('Error unassigning features:', err);
      setError('Failed to unassign features: ' + err.message);
      toast.error('Failed to unassign features: ' + err.message);
      setSuccess('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveSingleFeature = async (storeId, feature) => {
    try {
      setIsLoading(true);
      const store = stores.find((s) => s.id === storeId);
      const currentFeatures = normalizeFeatures(store.allowed_features);
      const updatedFeatures = currentFeatures.filter((f) => f !== feature);

      console.log(`Removing feature ${feature} from store ${store.shop_name}:`, updatedFeatures);
      const { error } = await supabase
        .from('stores')
        .update({ allowed_features: updatedFeatures })
        .eq('id', storeId);

      if (error) throw new Error(`Failed to remove ${featureOptions.find((opt) => opt.value === feature)?.label || feature} from store ${store.shop_name}`);
      toast.success(`Removed ${featureOptions.find((opt) => opt.value === feature)?.label || feature} from store ${store.shop_name}`);
      setSuccess(`Removed ${featureOptions.find((opt) => opt.value === feature)?.label || feature} from store ${store.shop_name}`);
      setError('');
      localStorage.removeItem(`features_${storeId}`);
      await fetchStores();
    } catch (err) {
      console.error('Error removing feature:', err);
      setError('Failed to remove feature: ' + err.message);
      toast.error('Failed to remove feature: ' + err.message);
      setSuccess('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignAllToAll = async () => {
    try {
      setIsLoading(true);
      const allFeatures = featureOptions.map((f) => f.value);
      for (const store of stores) {
        console.log(`Assigning all features to store ${store.shop_name}:`, allFeatures);
        const { error } = await supabase
          .from('stores')
          .update({ allowed_features: allFeatures })
          .eq('id', store.id);

        if (error) throw new Error(`Failed to assign all features to store ${store.shop_name}`);
      }
      setSuccess('All features assigned to all stores successfully!');
      toast.success('All features assigned to all stores successfully!');
      setError('');
      setSelectedStores([]);
      setSelectedFeatures([]);
      localStorage.removeItem(`features_${stores.map((s) => s.id).join('_')}`);
      await fetchStores();
    } catch (err) {
      console.error('Error assigning all features:', err);
      setError('Failed to assign all features: ' + err.message);
      toast.error('Failed to assign all features: ' + err.message);
      setSuccess('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnassignAllFromAll = async () => {
    try {
      setIsLoading(true);
      for (const store of stores) {
        console.log(`Unassigning all features from store ${store.shop_name}`);
        const { error } = await supabase
          .from('stores')
          .update({ allowed_features: [] })
          .eq('id', store.id);

        if (error) throw new Error(`Failed to unassign all features from store ${store.shop_name}`);
      }
      setSuccess('All features unassigned from all stores successfully!');
      toast.success('All features unassigned from all stores successfully!');
      setError('');
      setSelectedStores([]);
      setSelectedFeatures([]);
      localStorage.removeItem(`features_${stores.map((s) => s.id).join('_')}`);
      await fetchStores();
    } catch (err) {
      console.error('Error unassigning all features:', err);
      setError('Failed to unassign all features: ' + err.message);
      toast.error('Failed to unassign all features: ' + err.message);
      setSuccess('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.section
      className="py-8 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900 min-h-screen"
      initial="hidden"
      animate="visible"
      variants={sectionVariants}
    >
      <ToastContainer />
      <div className="container mx-auto max-w-7xl">
        <motion.h2
          className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mb-8 font-sans"
          variants={cardVariants}
        >
          Feature Access Management
        </motion.h2>
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700"
          variants={cardVariants}
        >
          {isLoading && (
            <div className="flex justify-center items-center mb-4">
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
                  onKeyPress={handleKeyPress}
                  placeholder="Search by store name"
                  className="w-full pl-10 p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <motion.button
                onClick={handleSearch}
                className="bg-indigo-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-indigo-700"
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
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Stores</h3>
                  <motion.button
                    onClick={handleSelectAllStores}
                    className="bg-blue-600 text-white py-1 px-3 rounded-lg font-medium hover:bg-blue-700 flex items-center"
                    variants={buttonVariants}
                    initial="rest"
                    whileHover="hover"
                  >
                    <FaCheckSquare className="mr-2" />
                    {selectedStores.length === filteredStores.length ? 'Deselect All' : 'Select All'}
                  </motion.button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredStores.map((store) => (
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
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Features</h3>
                <div className="space-y-2">
                  {featureOptions.map((option) => (
                    <label key={option.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedFeatures.includes(option.value)}
                        onChange={() => handleFeatureChange(option.value)}
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
                onClick={handleAssignFeatures}
                className="bg-indigo-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-indigo-700 flex items-center"
                variants={buttonVariants}
                initial="rest"
                whileHover="hover"
                disabled={isLoading}
              >
                <FaCheck className="mr-2" /> Assign
              </motion.button>
              <motion.button
                onClick={handleUnassignFeatures}
                className="bg-red-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-red-700 flex items-center"
                variants={buttonVariants}
                initial="rest"
                whileHover="hover"
                disabled={isLoading}
              >
                <FaTimes className="mr-2" /> Unassign
              </motion.button>
              <motion.button
                onClick={handleAssignAllToAll}
                className="bg-green-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-green-700 flex items-center"
                variants={buttonVariants}
                initial="rest"
                whileHover="hover"
                disabled={isLoading}
              >
                <FaCheck className="mr-2" /> Assign All
              </motion.button>
              <motion.button
                onClick={handleUnassignAllFromAll}
                className="bg-gray-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-gray-700 flex items-center"
                variants={buttonVariants}
                initial="rest"
                whileHover="hover"
                disabled={isLoading}
              >
                <FaTimes className="mr-2" /> Unassign All
              </motion.button>
            </div>
            {error && <p className="text-red-500 dark:text-red-400 mt-4">{error}</p>}
            {success && <p className="text-green-500 dark:text-green-400 mt-4">{success}</p>}
            <div className="mt-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Store Features</h3>
              <ul className="space-y-3">
                {filteredStores.map((store) => (
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
                      <span className="text-gray-900 dark:text-gray-300">{store.shop_name}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-gray-600 dark:text-gray-400">
                        Assigned Features:{' '}
                        {store.allowed_features?.length > 0 ? (
                          store.allowed_features.map((feature) => (
                            <span
                              key={feature}
                              className="inline-flex items-center px-2 py-1 mr-1 text-sm font-medium text-indigo-800 bg-indigo-100 rounded-full dark:text-indigo-200 dark:bg-indigo-900"
                            >
                              {featureOptions.find((opt) => opt.value === feature)?.label || feature}
                              <button
                                onClick={() => handleRemoveSingleFeature(store.id, feature)}
                                className="ml-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                              >
                                <FaTrash className="h-3 w-3" />
                              </button>
                            </span>
                          ))
                        ) : (
                          'None'
                        )}
                      </span>
                      <motion.button
                        onClick={handleAssignFeatures}
                        className="bg-indigo-600 text-white py-1 px-3 rounded-lg font-medium hover:bg-indigo-700"
                        variants={buttonVariants}
                        initial="rest"
                        whileHover="hover"
                        disabled={isLoading || !selectedStores.includes(store.id) || selectedFeatures.length === 0}
                      >
                        Assign
                      </motion.button>
                      <motion.button
                        onClick={handleUnassignFeatures}
                        className="bg-red-600 text-white py-1 px-3 rounded-lg font-medium hover:bg-red-700"
                        variants={buttonVariants}
                        initial="rest"
                        whileHover="hover"
                        disabled={isLoading || !selectedStores.includes(store.id) || selectedFeatures.length === 0}
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

export default FeatureAssignment;