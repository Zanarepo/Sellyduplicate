import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Fallback for Heroicons in case the package is not installed
let MagnifyingGlassIcon, CalendarIcon, XMarkIcon;
try {
  ({ MagnifyingGlassIcon, CalendarIcon, XMarkIcon } = require('@heroicons/react/24/outline'));
} catch (e) {
  console.warn('Heroicons not installed. Please run `npm install @heroicons/react`. Using text fallback.');
  MagnifyingGlassIcon = () => <span>🔍</span>;
  CalendarIcon = () => <span>📅</span>;
  XMarkIcon = () => <span>❌</span>;
}

export default function InventoryValuation() {
  const storeId = localStorage.getItem('store_id');
  const [inventory, setInventory] = useState([]);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [detailFilter, setDetailFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const entriesPerPage = 10;

  useEffect(() => {
    if (!storeId) {
      toast.error('No store selected. Please choose a store.');
      return;
    }
    fetchInventoryValuation();
  }, [storeId]);

  useEffect(() => {
    let filtered = inventory.filter(item =>
      searchTerm
        ? item.product_name.toLowerCase().includes(searchTerm.toLowerCase())
        : true
    );

    // Apply detail filter
    if (detailFilter === 'complete') {
      filtered = filtered.filter(item => item.purchase_price && item.purchase_price > 0);
    } else if (detailFilter === 'incomplete') {
      filtered = filtered.filter(item => !item.purchase_price || item.purchase_price === 0);
    }

    // Sort complete details first for 'all' filter
    if (detailFilter === 'all') {
      filtered.sort((a, b) => {
        const aHasPrice = a.purchase_price && a.purchase_price > 0;
        const bHasPrice = b.purchase_price && b.purchase_price > 0;
        return bHasPrice - aHasPrice; // Complete (true) comes before incomplete (false)
      });
    }

    setFilteredInventory(filtered);
    setCurrentPage(1); // Reset to page 1 when filters change
  }, [searchTerm, detailFilter, inventory]);

  async function fetchInventoryValuation() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('dynamic_inventory')
      .select(`
        id,
        available_qty,
        dynamic_product (id, name, purchase_price)
      `)
      .eq('store_id', storeId);
    if (error) {
      toast.error('Can’t load stock: ' + error.message);
    } else {
      // Flatten the data to match table structure
      const flattenedData = (data || []).map(item => ({
        id: item.id,
        product_name: item.dynamic_product?.name || 'Unknown',
        quantity: item.available_qty || 0,
        purchase_price: item.dynamic_product?.purchase_price || null,
      }));
      setInventory(flattenedData);
      setFilteredInventory(flattenedData);
    }
    setIsLoading(false);
  }

  // Calculate total stock value (only for items with purchase_price)
  const totalStockValue = filteredInventory.reduce((acc, item) => {
    return item.purchase_price && item.quantity && item.purchase_price > 0
      ? acc + item.quantity * item.purchase_price
      : acc;
  }, 0);

  const hasItemsWithPurchasePrice = filteredInventory.some(
    item => item.purchase_price && item.purchase_price > 0
  );

  // Pagination logic
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = filteredInventory.slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = Math.ceil(filteredInventory.length / entriesPerPage);

  const paginate = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDetailFilter('all');
    setCurrentPage(1);
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto dark:bg-gray-900 dark:text-white space-y-6">
      <ToastContainer />
      <h2 className="text-2xl sm:text-3xl font-bold text-center text-white bg-gradient-to-r from-indigo-400 to-indigo-600 py-4 rounded-lg">
        Stock Value
      </h2>
      <div className="bg-indigo-50 dark:bg-indigo-900 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700 text-center text-lg text-gray-900 dark:text-gray-100">
        Add purchase prices for all items to see your full stock value!
      </div>
      <div className="flex flex-col gap-4 bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative w-full sm:w-1/2">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 hover:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="Search for an item (e.g., 'Shirt')"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 text-lg"
              aria-label="Search for an item"
              title="Search for an item"
            />
          </div>
          <div className="relative w-full sm:w-1/4">
            <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 hover:text-indigo-500 transition-colors" />
            <select
              value={detailFilter}
              onChange={e => setDetailFilter(e.target.value)}
              className="w-full pl-10 p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 text-lg"
              aria-label="Filter by details"
              title="Filter by details"
            >
              <option value="all">All Items</option>
              <option value="complete">Complete Details</option>
              <option value="incomplete">Incomplete Details</option>
            </select>
          </div>
        </div>
        <button
          onClick={clearFilters}
          className="flex items-center justify-center w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-lg hover:scale-105 transition-transform"
          aria-label="Clear filters"
          title="Clear filters"
        >
          <XMarkIcon className="h-5 w-5 mr-2 hover:text-indigo-500 transition-colors" />
          Clear Filters
        </button>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6">
        <div className="bg-indigo-50 dark:bg-indigo-900 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700 mb-4" aria-live="polite">
          <div className="flex justify-center items-center">
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">
              Total Stock Value: {hasItemsWithPurchasePrice ? `₦${totalStockValue.toFixed(2)}` : 'No items with purchase prices'}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-lg">
              Loading your stock...
            </div>
          ) : filteredInventory.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-lg">
              No items found. Try a different search or filter!
            </div>
          ) : (
            <>
              <table className="min-w-full text-lg">
                <thead className="bg-indigo-100 dark:bg-indigo-900 text-gray-900 dark:text-indigo-200 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium border-b dark:border-gray-700">Item</th>
                    <th className="text-right px-4 py-3 font-medium border-b dark:border-gray-700">Quantity</th>
                    <th className="text-right px-4 py-3 font-medium border-b dark:border-gray-700">Purchase Price (₦)</th>
                    <th className="text-right px-4 py-3 font-medium border-b dark:border-gray-700">Total Value (₦)</th>
                  </tr>
                </thead>
                <tbody>
                  {currentEntries.map(item => (
                    <tr
                      key={item.id}
                      className="border-b dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-4 py-3">{item.product_name}</td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">
                        {item.purchase_price ? `₦${item.purchase_price.toFixed(2)}` : 'Not provided'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.purchase_price && item.quantity && item.purchase_price > 0
                          ? `₦${(item.quantity * item.purchase_price).toFixed(2)}`
                          : 'Not available'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex flex-row flex-wrap justify-between items-center mt-4 px-4 gap-4">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Showing {indexOfFirstEntry + 1} to {Math.min(indexOfLastEntry, filteredInventory.length)} of {filteredInventory.length} items
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      currentPage === 1
                        ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-800 dark:hover:bg-indigo-700'
                    }`}
                    aria-label="Previous page"
                  >
                    Previous
                  </button>
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => paginate(i + 1)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium ${
                        currentPage === i + 1
                          ? 'bg-indigo-600 text-white dark:bg-indigo-800 dark:text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                      aria-label={`Page ${i + 1}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => paginate(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      currentPage === totalPages
                        ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-800 dark:hover:bg-indigo-700'
                    }`}
                    aria-label="Next page"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}