import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { toast } from 'react-toastify';
import { FaPlus, FaCheckCircle, FaHistory, FaTrash, FaEdit } from 'react-icons/fa';

// Utility to format currency
const formatCurrency = (value) =>
  (value ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function DebtPaymentManager() {
  const storeId = localStorage.getItem('store_id');

  // State
  const [debts, setDebts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [filteredDebts, setFilteredDebts] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const pageSize = 20;
  const [totalCount, setTotalCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [editForm, setEditForm] = useState({
    amount_paid: '',
    payment_date: '',
    payment_method: '',
  });

  // Payment method options
  const paymentMethods = ['Cash', 'Card', 'Transfer'];

  // Fetch debts with customer.fullname
  const fetchDebts = useCallback(async () => {
    if (!storeId) {
      toast.error('Store ID not found');
      return;
    }
    setIsLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count, error } = await supabase
      .from('debt_tracker')
      .select('id, customer_id, amount_owed, customer(fullname)', { count: 'exact' })
      .eq('store_id', storeId)
      .range(from, to);
    if (error) toast.error('Failed to load debts');
    else {
      setDebts(data || []);
      setTotalCount(count || 0);
    }
    setIsLoading(false);
  }, [page, storeId]);

  // Fetch payments history
  const fetchPayments = useCallback(async () => {
    if (!storeId) {
      toast.error('Store ID not found');
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('debt_payment_history')
      .select('id, debt_tracker_id, customer_id, amount_paid, payment_date, payment_method')
      .eq('store_id', storeId);
    if (error) toast.error('Failed to load payment history');
    else setPayments(data || []);
    setIsLoading(false);
  }, [storeId]);

  useEffect(() => {
    fetchDebts();
    fetchPayments();
  }, [fetchDebts, fetchPayments]);

  // Merge debts + payments, compute status, and sort owing first
  useEffect(() => {
    const merged = debts.map((d) => {
      const history = payments.filter((p) => p.debt_tracker_id === d.id);
      const paidTotal = history.reduce((sum, h) => sum + parseFloat(h.amount_paid || 0), 0);
      const owed = parseFloat(d.amount_owed || 0);
      const remaining = owed - paidTotal;
      const lastDate = history
        .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))[0]
        ?.payment_date;
      let status = 'none';
      if (remaining <= 0) status = 'paid';
      else if (paidTotal > 0) status = 'partial';
      return {
        ...d,
        customer_name: d.customer?.fullname || 'Unknown',
        owed,
        paid: paidTotal,
        remaining,
        lastDate,
        status,
        payment_history: history,
      };
    });

    const q = search.toLowerCase();
    const filtered = merged
      .filter((d) => d.customer_name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.remaining > 0 && b.remaining <= 0) return -1;
        if (a.remaining <= 0 && b.remaining > 0) return 1;
        return 0;
      });

    setFilteredDebts(filtered);
  }, [debts, payments, search]);

  // Open payment modal
  const openModal = (debt) => {
    setSelectedDebt(debt);
    setPayAmount('');
    setPaymentMethod('');
    setShowModal(true);
  };

  // Record payment
  const submitPayment = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const paymentAmount = parseFloat(payAmount);
    if (paymentAmount > selectedDebt.remaining) {
      toast.error('Payment amount cannot exceed remaining balance');
      setIsLoading(false);
      return;
    }
    if (!paymentMethod) {
      toast.error('Please select a payment method');
      setIsLoading(false);
      return;
    }
    const { error } = await supabase.from('debt_payment_history').insert([
      {
        debt_tracker_id: selectedDebt.id,
        customer_id: selectedDebt.customer_id,
        amount_paid: paymentAmount,
        store_id: storeId,
        payment_date: new Date().toISOString(),
        payment_method: paymentMethod,
      },
    ]);
    if (error) {
      console.error('Payment insertion error:', error);
      toast.error(error.message || 'Failed to record payment');
    } else {
      toast.success('Payment recorded');
      setShowModal(false);
      await Promise.all([fetchPayments(), fetchDebts()]);
    }
    setIsLoading(false);
  };

  // Open history modal
  const openHistoryModal = (debt) => {
    setSelectedHistory(debt);
    setShowHistoryModal(true);
  };

  // Close history modal
  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setSelectedHistory(null);
  };

  // Open edit modal
  const openEditModal = (payment) => {
    setSelectedPayment(payment);
    setEditForm({
      amount_paid: payment.amount_paid || 0,
      payment_date: payment.payment_date
        ? new Date(payment.payment_date).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16),
      payment_method: payment.payment_method || '',
    });
    setShowEditModal(true);
  };

  // Close edit modal
  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedPayment(null);
    setEditForm({ amount_paid: '', payment_date: '', payment_method: '' });
  };

  // Delete payment
  const deletePayment = async (paymentId) => {
    if (!window.confirm('Are you sure you want to delete this payment?')) return;
    setIsLoading(true);
    const { error } = await supabase.from('debt_payment_history').delete().eq('id', paymentId);
    if (error) {
      console.error('Payment deletion error:', error);
      toast.error(error.message || 'Failed to delete payment');
    } else {
      toast.success('Payment deleted');
      await Promise.all([fetchPayments(), fetchDebts()]);
      openHistoryModal(selectedHistory);
    }
    setIsLoading(false);
  };

  // Delete debt
  const deleteDebt = async (debtId, customerName) => {
    if (!window.confirm(`Are you sure you want to delete the debt for ${customerName}?`)) return;
    console.log(`Attempting to delete debt ID: ${debtId} for ${customerName}`);
    setIsLoading(true);
    // Delete related payments
    const { error: paymentError } = await supabase
      .from('debt_payment_history')
      .delete()
      .eq('debt_tracker_id', debtId);
    if (paymentError) {
      console.error('Payment history deletion error:', paymentError);
      toast.error(paymentError.message || 'Failed to delete payment history');
      setIsLoading(false);
      return;
    }
    // Delete debt
    const { error } = await supabase.from('debt_tracker').delete().eq('id', debtId);
    if (error) {
      console.error('Debt deletion error:', error);
      toast.error(error.message || 'Failed to delete debt');
    } else {
      toast.success('Debt deleted');
      await Promise.all([fetchPayments(), fetchDebts()]);
    }
    setIsLoading(false);
  };

  // Update payment
  const updatePayment = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const paymentAmount = parseFloat(editForm.amount_paid);
    if (paymentAmount > selectedHistory.remaining + parseFloat(selectedPayment.amount_paid || 0)) {
      toast.error('Updated payment cannot exceed remaining balance plus original payment');
      setIsLoading(false);
      return;
    }
    if (!editForm.payment_method) {
      toast.error('Please select a payment method');
      setIsLoading(false);
      return;
    }
    const { error } = await supabase
      .from('debt_payment_history')
      .update({
        amount_paid: paymentAmount,
        payment_date: new Date(editForm.payment_date).toISOString(),
        payment_method: editForm.payment_method,
      })
      .eq('id', selectedPayment.id);
    if (error) {
      console.error('Payment update error:', error);
      toast.error(error.message || 'Failed to update payment');
    } else {
      toast.success('Payment updated');
      setShowEditModal(false);
      await Promise.all([fetchPayments(), fetchDebts()]);
      openHistoryModal(selectedHistory);
    }
    setIsLoading(false);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="p-0 bg-white dark:bg-gray-900 text-gray-800 dark:text-white">
      <h1 className="text-3xl font-bold text-center text-indigo-700 dark:text-white mb-6">Debt Payments</h1>

      {/* Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full mb-6">
        <input
          id="search-input"
          type="text"
          placeholder="Search by customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={isLoading}
          className="w-full sm:flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-600 dark:bg-gray-600 dark:border-gray-600 dark:text-white disabled:bg-gray-200 dark:disabled:bg-gray-700"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg shadow-lg">
        {isLoading ? (
          <div className="text-center py-6">
            <p className="text-gray-500 dark:text-gray-400">Loading...</p>
          </div>
        ) : (
          <table className="min-w-full bg-white dark:bg-gray-800">
            <thead>
              <tr className="bg-gray-700 dark:bg-gray-900 text-indigo-600 dark:text-indigo-300">
                {['Customer', 'Owed', 'Amount Paid', 'Balance', 'Last Payment', 'Actions'].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-sm font-semibold text-indigo-50 dark:text-gray-200">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredDebts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-4 text-center text-gray-500 dark:text-gray-400">
                    No debts found
                  </td>
                </tr>
              ) : (
                filteredDebts.map((debt) => (
                  <tr
                    key={debt.id}
                    className={
                      debt.status === 'paid'
                        ? 'bg-green-50 dark:bg-green-900/20 dark:text-green-400'
                        : debt.status === 'partial'
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 dark:text-white'
                        : 'bg-red-100 dark:bg-red-900/20 dark:text-white'
                    }
                  >
                    <td className="px-4 py-3 text-sm">{debt.customer_name}</td>
                    <td className="px-4 py-3 text-sm">₦{formatCurrency(debt.owed)}</td>
                    <td className="px-4 py-3 text-sm">₦{formatCurrency(debt.paid)}</td>
                    <td className="px-4 py-3 text-sm">₦{formatCurrency(debt.remaining)}</td>
                    <td className="px-4 py-3 text-center text-sm">
                      {debt.lastDate ? new Date(debt.lastDate).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        {debt.status === 'paid' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-green-100 text-green-700 dark:text-white dark:bg-green-600/30 transition">
                            <FaCheckCircle className="w-5 h-5" /> paid
                          </span>
                        ) : (
                          <button
                            onClick={() => openModal(debt)}
                            disabled={isLoading}
                            className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:opacity-50 transition cursor-pointer"
                            title="Record Payment"
                            aria-label="Record payment"
                          >
                            <FaPlus className="w-5 h-5 mr-2" /> Pay
                          </button>
                        )}
                        <button
                          onClick={() => openHistoryModal(debt)}
                          disabled={isLoading}
                          className="p-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 rounded-full transition disabled:opacity-50 cursor-pointer"
                          title="View Payment History"
                          aria-label="View payment history"
                        >
                          <FaHistory className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => deleteDebt(debt.id, debt.customer_name)}
                          disabled={isLoading}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-600/20 rounded-full transition disabled:opacity-50 cursor-pointer"
                          title="Delete Debt"
                          aria-label="Delete debt"
                        >
                          <FaTrash className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <br />

      {/* Pagination */}
     <div className="flex justify-between items-center bg-white dark:bg-gray-800 rounded-lg p-4">
  <button
    type="button"
    disabled={page === 1 || isLoading}
    onClick={() => setPage((p) => Math.max(p - 1, 1))}
    className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-300 dark:disabled:bg-gray-500 disabled:opacity-50 transition cursor-pointer font-medium"
    aria-label="Previous page"
  >
    Previous
  </button>
  <span className="text-base text-gray-700 dark:text-white font-medium">
    Page {page} of {totalPages || 1}
  </span>
  <button
    type="button"
    disabled={page === totalPages || isLoading}
    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
    className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:opacity-50 transition cursor-pointer font-medium"
    aria-label="Next page"
  >
    Next
  </button>
</div>

      {/* Payment Modal */}
      {showModal && selectedDebt && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4 z-50">
          <form
            onSubmit={submitPayment}
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-md"
          >
            <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-white">
              Record Payment for {selectedDebt.customer_name}
            </h2>
            <p className="mb-4 text-gray-600 dark:text-gray-300">
              <span className="font-semibold">Balance:</span> ₦{formatCurrency(selectedDebt.remaining)}
            </p>
            <label htmlFor="pay-amount" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              Amount Paid
            </label>
            <input
              id="pay-amount"
              type="number"
              step="0.01"
              min="0"
              max={selectedDebt.remaining}
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              required
              disabled={isLoading}
              className="w-full p-2 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:opacity-50"
            />
            <label htmlFor="payment-method" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              Payment Method
            </label>
            <select
              id="payment-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              required
              disabled={isLoading}
              className="w-full p-2 mb-6 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-600"
            >
              <option value="">Select Payment Method</option>
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-300 dark:disabled:bg-gray-400 disabled:opacity-50 transition"
                aria-label="Cancel payment"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:bg-gray-400 disabled:opacity-50 transition"
                aria-label="Record payment"
              >
                {isLoading ? 'Processing...' : 'Record Payment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedHistory && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-2 z-100">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-white">
              Payment History for {selectedHistory.customer_name}
            </h2>
            {selectedHistory.payment_history.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No payments recorded for this debt.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left text-gray-600 dark:text-gray-200">
                  <thead className="bg-gray-100 dark:bg-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-tight">
                    <tr>
                      <th className="px-4 py-3 text-left">Amount Paid</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                    {selectedHistory.payment_history.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-600/30 transition">
                        <td className="px-4 py-3">₦{formatCurrency(p.amount_paid)}</td>
                        <td className="px-4 py-3">{new Date(p.payment_date).toLocaleString()}</td>
                        <td className="px-4 py-3">{p.payment_method || 'N/A'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEditModal(p)}
                              disabled={isLoading}
                              className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-600/20 rounded-full transition disabled:opacity-50 cursor-pointer"
                              title="Edit Payment"
                              aria-label="Edit payment"
                            >
                              <FaEdit className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => deletePayment(p.id)}
                              disabled={isLoading}
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-600/20 rounded-full transition disabled:opacity-50 cursor-pointer"
                              title="Delete Payment"
                              aria-label="Delete payment"
                            >
                              <FaTrash className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button
                onClick={closeHistoryModal}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-300 dark:disabled:bg-gray-400 disabled:opacity-50 transition cursor-pointer"
                aria-label="Close history modal"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      {showEditModal && selectedPayment && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4 z-50">
          <form
            onSubmit={updatePayment}
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-md"
          >
            <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-white">
              Edit Payment for {selectedHistory.customer_name}
            </h2>
            <label htmlFor="edit-amount" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              Amount Paid
            </label>
            <input
              id="edit-amount"
              type="number"
              step="0.01"
              min="0"
              value={editForm.amount_paid}
              onChange={(e) => setEditForm({ ...editForm, amount_paid: e.target.value })}
              required
              disabled={isLoading}
              className="w-full p-2 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:opacity-50"
            />
            <label htmlFor="edit-date" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              Payment Date
            </label>
            <input
              id="edit-date"
              type="datetime-local"
              value={editForm.payment_date}
              onChange={(e) => setEditForm({ ...editForm, payment_date: e.target.value })}
              required
              disabled={isLoading}
              className="w-full p-2 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:opacity-50"
            />
            <label htmlFor="edit-method" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              Payment Method
            </label>
            <select
              id="edit-method"
              value={editForm.payment_method}
              onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value })}
              required
              disabled={isLoading}
              className="w-full p-2 mb-6 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:opacity-50"
            >
              <option value="">Select Payment Method</option>
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEditModal}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-300 dark:disabled:bg-gray-400 disabled:opacity-50 transition cursor-pointer"
                aria-label="Cancel edit"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:bg-gray-400 disabled:opacity-50 transition cursor-pointer"
                aria-label="Update payment"
              >
                {isLoading ? 'Processing...' : 'Update Payment'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}