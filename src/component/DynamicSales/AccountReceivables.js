import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function AccountsReceivable() {
  const storeId = localStorage.getItem('store_id');
  const [arEntries, setArEntries] = useState([]);
  const [filteredAr, setFilteredAr] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [agingFilter, setAgingFilter] = useState('');

  useEffect(() => {
    if (!storeId) {
      toast.error('Store ID is missing.');
      return;
    }
    fetchArEntries();
  }, [storeId]);

  useEffect(() => {
    const filtered = arEntries.filter(entry => {
      const matchesSearch = searchTerm
        ? entry.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const daysOverdue = Math.floor(
        (new Date() - new Date(entry.date)) / (1000 * 60 * 60 * 24)
      );
      const matchesAging = agingFilter
        ? (agingFilter === '0-30' && daysOverdue <= 30) ||
          (agingFilter === '31-60' && daysOverdue > 30 && daysOverdue <= 60) ||
          (agingFilter === '61-90' && daysOverdue > 60 && daysOverdue <= 90) ||
          (agingFilter === '90+' && daysOverdue > 90)
        : true;
      return matchesSearch && matchesAging;
    });
    setFilteredAr(filtered);
  }, [searchTerm, agingFilter, arEntries]);

  async function fetchArEntries() {
    const { data, error } = await supabase
      .from('debts')
      .select('*')
      .eq('store_id', storeId)
      .gt('remaining_balance', 0)
      .order('date', { ascending: false });
    if (error) {
      toast.error('Failed to fetch A/R: ' + error.message);
    } else {
      setArEntries(data || []);
      setFilteredAr(data || []);
    }
  }

  return (
    <div className="p-4 space-y-6 dark:bg-gray-900 dark:text-white">
      <ToastContainer />
      <h2 className="text-2xl font-bold text-center">Accounts Receivable</h2>
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search by customer..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full sm:w-1/2 p-2 border rounded dark:bg-gray-900 dark:border-gray-600 dark:text-white"
        />
        <select
          value={agingFilter}
          onChange={e => setAgingFilter(e.target.value)}
          className="w-full sm:w-1/4 p-2 border rounded dark:bg-gray-900 dark:border-gray-600 dark:text-white"
        >
          <option value="">All Aging</option>
          <option value="0-30">0-30 Days</option>
          <option value="31-60">31-60 Days</option>
          <option value="61-90">61-90 Days</option>
          <option value="90+">90+ Days</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border rounded-lg">
          <thead className="bg-gray-100 dark:bg-gray-700 dark:text-indigo-400">
            <tr>
              <th className="text-left px-4 py-2 border-b">Date</th>
              <th className="text-left px-4 py-2 border-b">Customer</th>
              <th className="text-left px-4 py-2 border-b">Product</th>
              <th className="text-right px-4 py-2 border-b">Amount Owed</th>
              <th className="text-right px-4 py-2 border-b">Remaining</th>
            </tr>
          </thead>
          <tbody>
            {filteredAr.map(entry => (
              <tr key={entry.id} className="hover:bg-gray-100 dark:hover:bg-gray-600">
                <td className="px-4 py-2 border-b">{new Date(entry.date).toLocaleDateString()}</td>
                <td className="px-4 py-2 border-b">{entry.customer_name}</td>
                <td className="px-4 py-2 border-b">{entry.product_name}</td>
                <td className="px-4 py-2 border-b text-right">₦{entry.owed.toFixed(2)}</td>
                <td className="px-4 py-2 border-b text-right">₦{entry.remaining_balance.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}