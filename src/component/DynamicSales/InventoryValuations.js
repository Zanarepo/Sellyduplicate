import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function InventoryValuation() {
  const storeId = localStorage.getItem('store_id');
  const [inventoryData, setInventoryData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!storeId) {
      toast.error('Store ID is missing.');
      return;
    }
    fetchInventoryValuation();
  }, [storeId]);

  useEffect(() => {
    const filtered = inventoryData.filter(item =>
      searchTerm
        ? item.dynamic_product?.name.toLowerCase().includes(searchTerm.toLowerCase())
        : true
    );
    setFilteredData(filtered);
  }, [searchTerm, inventoryData]);

  async function fetchInventoryValuation() {
    const { data, error } = await supabase
      .from('dynamic_inventory')
      .select(`
        id,
        available_qty,
        dynamic_product (id, name, purchase_price)
      `)
      .eq('store_id', storeId);
    if (error) {
      toast.error('Failed to fetch inventory: ' + error.message);
    } else {
      setInventoryData(data || []);
      setFilteredData(data || []);
    }
  }

  const totalValue = filteredData.reduce(
    (sum, item) => sum + (item.available_qty * (item.dynamic_product?.purchase_price || 0)),
    0
  );

  return (
    <div className="p-4 space-y-6 dark:bg-gray-900 dark:text-white">
      <ToastContainer />
      <h2 className="text-2xl font-bold text-center">Inventory Valuation</h2>
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search by product..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full sm:w-1/2 p-2 border rounded dark:bg-gray-900 dark:border-gray-600 dark:text-white"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border rounded-lg">
          <thead className="bg-gray-100 dark:bg-gray-700 dark:text-indigo-400">
            <tr>
              <th className="text-left px-4 py-2 border-b">Product</th>
              <th className="text-right px-4 py-2 border-b">Available Qty</th>
              <th className="text-right px-4 py-2 border-b">Purchase Price</th>
              <th className="text-right px-4 py-2 border-b">Value</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map(item => (
              <tr key={item.id} className="hover:bg-gray-100 dark:hover:bg-gray-600">
                <td className="px-4 py-2 border-b">{item.dynamic_product?.name || 'N/A'}</td>
                <td className="px-4 py-2 border-b text-right">{item.available_qty}</td>
                <td className="px-4 py-2 border-b text-right">
                  ₦{(item.dynamic_product?.purchase_price || 0).toFixed(2)}
                </td>
                <td className="px-4 py-2 border-b text-right">
                  ₦{(item.available_qty * (item.dynamic_product?.purchase_price || 0)).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-lg font-semibold text-right">Total Inventory Value: ₦{totalValue.toFixed(2)}</p>
    </div>
  );
}