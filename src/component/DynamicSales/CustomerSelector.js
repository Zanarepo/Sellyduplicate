import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { toast } from 'react-toastify';

export default function CustomerSelector({ storeId, selectedCustomerId, onCustomerChange }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCustomers = async () => {
      if (!storeId) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('customer')
          .select('id, fullname')
          .eq('store_id', storeId)
          .order('fullname');
        if (error) {
          throw new Error(`Failed to fetch customers: ${error.message}`);
        }
        setCustomers(data || []);
      } catch (err) {
        toast.error(err.message);
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, [storeId]);

  return (
    <div className="block">
      <span className="font-semibold block mb-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
        Customer (Optional)
      </span>
      {loading ? (
        <div className="text-gray-600 dark:text-gray-400">Loading customers...</div>
      ) : (
        <select
          value={selectedCustomerId || ''}
          onChange={(e) => onCustomerChange(Number(e.target.value) || null)}
          className="w-full p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px]"
        >
          <option value="">Select a customer...</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.fullname}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}