import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function AccountsPayable() {
  const storeId = localStorage.getItem('store_id');
  const [apEntries, setApEntries] = useState([]);
  const [filteredAp, setFilteredAp] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (!storeId) {
      toast.error('Store ID is missing.');
      return;
    }
    fetchApEntries();
  }, [storeId]);

  useEffect(() => {
    const filtered = apEntries.filter(entry => {
      const matchesSearch = searchTerm
        ? entry.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const matchesStatus = statusFilter
        ? entry.status === statusFilter
        : true;
      return matchesSearch && matchesStatus;
    });
    setFilteredAp(filtered);
  }, [searchTerm, statusFilter, apEntries]);

  async function fetchApEntries() {
    const { data, error } = await supabase
      .from('accounts_payable')
      .select(`
        id,
        supplier_name,
        amount,
        status,
        transaction_date,
        dynamic_product (name)
      `)
      .eq('store_id', storeId)
      .order('transaction_date', { ascending: false });
    if (error) {
      toast.error('Failed to fetch A/P: ' + error.message);
    } else {
      setApEntries(data || []);
      setFilteredAp(data || []);
    }
  }

  async function updatePaymentStatus(id, status) {
    const { error } = await supabase
      .from('accounts_payable')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast.error('Failed to update payment status: ' + error.message);
    } else {
      toast.success('Payment status updated.');
      fetchApEntries();
    }
  }

  return (
    <div className="p-4 space-y-6 dark:bg-gray-900 dark:text-white">
      <ToastContainer />
      <h2 className="text-2xl font-bold text-center">Accounts Payable</h2>
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search by supplier..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full sm:w-1/2 p-2 border rounded dark:bg-gray-900 dark:border-gray-600 dark:text-white"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="w-full sm:w-1/4 p-2 border rounded dark:bg-gray-900 dark:border-gray-600 dark:text-white"
        >
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Paid">Paid</option>
          <option value="Partial">Partial</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border rounded-lg">
          <thead className="bg-gray-100 dark:bg-gray-700 dark:text-indigo-400">
            <tr>
              <th className="text-left px-4 py-2 border-b">Date</th>
              <th className="text-left px-4 py-2 border-b">Supplier</th>
              <th className="text-left px-4 py-2 border-b">Product</th>
              <th className="text-right px-4 py-2 border-b">Amount</th>
              <th className="text-left px-4 py-2 border-b">Status</th>
              <th className="text-left px-4 py-2 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAp.map(entry => (
              <tr key={entry.id} className="hover:bg-gray-100 dark:hover:bg-gray-600">
                <td className="px-4 py-2 border-b">{new Date(entry.transaction_date).toLocaleDateString()}</td>
                <td className="px-4 py-2 border-b">{entry.supplier_name}</td>
                <td className="px-4 py-2 border-b">{entry.dynamic_product?.name || 'N/A'}</td>
                <td className="px-4 py-2 border-b text-right">₦{entry.amount.toFixed(2)}</td>
                <td className="px-4 py-2 border-b">{entry.status}</td>
                <td className="px-4 py-2 border-b">
                  <select
                    value={entry.status}
                    onChange={e => updatePaymentStatus(entry.id, e.target.value)}
                    className="p-1 border rounded dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                    <option value="Partial">Partial</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}