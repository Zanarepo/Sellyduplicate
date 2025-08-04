import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { FaPlus, FaTrashAlt, FaEdit } from 'react-icons/fa';

const ITEMS_PER_PAGE = 5;

// Utility to format currency
const formatCurrency = (value) =>
  (value ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const ExpenseManager = () => {
  const [form, setForm] = useState({
    expense_date: '',
    expense_type: '',
    amount: '',
    description: '',
  });
  const [expenses, setExpenses] = useState([]);
  const [filteredExpenses, setFilteredExpenses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const storeId = Number(localStorage.getItem('store_id'));

  // Fetch expenses
  const fetchExpenses = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('expense_tracker')
      .select('*')
      .eq('store_id', storeId)
      .order('expense_date', { ascending: false });

    if (error) {
      console.error('Fetch expenses error:', error);
      toast.error('Failed to fetch expenses: ' + error.message);
    } else {
      setExpenses(data || []);
    }
    setIsLoading(false);
  }, [storeId]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Filter expenses based on search
  useEffect(() => {
    const filtered = expenses.filter(
      (expense) =>
        expense.expense_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (expense.description && expense.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredExpenses(filtered);
    setCurrentPage(1);
  }, [searchTerm, expenses]);

  // Calculate total expenses
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  // Find top expense
  const topExpense = expenses.length > 0
    ? expenses.reduce((max, expense) => (expense.amount > max.amount ? expense : max), expenses[0])
    : null;

  const handleInputChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const resetForm = () => {
    setForm({
      expense_date: '',
      expense_type: '',
      amount: '',
      description: '',
    });
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const trimmedForm = {
      expense_date: form.expense_date,
      expense_type: form.expense_type.trim(),
      amount: Number(form.amount),
      description: form.description.trim() || null,
    };

    if (!trimmedForm.expense_date || !trimmedForm.expense_type || !trimmedForm.amount) {
      toast.error('Please fill in all required fields');
      setIsLoading(false);
      return;
    }

    if (trimmedForm.amount <= 0) {
      toast.error('Amount must be greater than zero');
      setIsLoading(false);
      return;
    }

    const payload = {
      store_id: storeId,
      ...trimmedForm,
    };

    let response;
    if (editingId) {
      response = await supabase.from('expense_tracker').update(payload).eq('id', editingId);
    } else {
      response = await supabase.from('expense_tracker').insert(payload);
    }

    const { error } = response;
    if (error) {
      console.error('Expense save error:', error);
      toast.error(error.message || 'Error saving expense');
    } else {
      toast.success(`Expense ${editingId ? 'updated' : 'added'} successfully`);
      resetForm();
      setShowForm(false);
      await fetchExpenses();
    }
    setIsLoading(false);
  };

  const handleEdit = (expense) => {
    setForm({
      expense_date: format(new Date(expense.expense_date), 'yyyy-MM-dd'),
      expense_type: expense.expense_type,
      amount: expense.amount,
      description: expense.description || '',
    });
    setEditingId(expense.id);
    setShowForm(true);
  };

  const handleDelete = async (id, expenseType) => {
    console.log(`handleDelete called: id=${id}, expenseType=${expenseType}, isLoading=${isLoading}`);
    if (!id || !expenseType) {
      console.error('Invalid expense data: id or expenseType missing');
      toast.error('Cannot delete: Invalid expense data');
      return;
    }

    const confirmDelete = window.confirm(`Are you sure you want to delete the "${expenseType}" expense?`) ||
      prompt(`Type "yes" to delete "${expenseType}"`) === 'yes';
    if (!confirmDelete) {
      console.log('Deletion cancelled by user');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from('expense_tracker').delete().eq('id', id);
      if (error) {
        throw error;
      }
      console.log(`Expense ID ${id} deleted successfully`);
      toast.success('Expense deleted successfully');
      await fetchExpenses();
    } catch (error) {
      console.error('Expense deletion error:', {
        message: error.message,
        code: error.code,
        hint: error.hint,
        details: error.details,
      });
      toast.error(error.message || 'Failed to delete expense');
    } finally {
      setIsLoading(false);
    }
  };

  // Pagination
  const totalPages = Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE);
  const paginatedExpenses = filteredExpenses.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="p-4 bg-white dark:bg-gray-900 text-gray-800 dark:text-white">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-indigo-700 dark:text-white">Expense Dashboard</h1>
      </div>

      {/* Total Expenses and Top Expense */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 shadow">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Total Expenses</h2>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            ₦{formatCurrency(totalExpenses)}
          </p>
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 shadow">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Top Expense</h2>
          {topExpense ? (
            <div>
              <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                ₦{formatCurrency(topExpense.amount)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {topExpense.expense_type} ({format(new Date(topExpense.expense_date), 'PPP')})
              </p>
              {topExpense.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{topExpense.description}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No expenses recorded</p>
          )}
        </div>
      </div>

      {/* Search and Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3">
        <input
          type="text"
          placeholder="Search by type or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={isLoading}
          className="w-full sm:flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-600 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-200 dark:disabled:bg-gray-600"
          aria-label="Search expenses"
        />
        <button
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-500 transition disabled:bg-gray-400 disabled:opacity-50"
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          disabled={isLoading}
          aria-label={showForm ? 'Close expense form' : 'Add new expense'}
        >
          <FaPlus className="w-4 h-4" />
          {showForm ? 'Close Form' : 'Add Expense'}
        </button>
      </div>

      {/* Expense Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-gray-100 dark:bg-gray-800 p-0 rounded-lg shadow mb-6 space-y-4"
        >
          <div>
            <label htmlFor="expense_date" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Date
            </label>
            <input
              id="expense_date"
              type="date"
              name="expense_date"
              value={form.expense_date}
              onChange={handleInputChange}
              className="mt-1 w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-200"
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <label htmlFor="expense_type" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Expense Type
            </label>
            <input
              id="expense_type"
              type="text"
              name="expense_type"
              placeholder="e.g., Rent, Utilities"
              value={form.expense_type}
              onChange={handleInputChange}
              className="mt-1 w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-200"
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Amount
            </label>
            <input
              id="amount"
              type="number"
              name="amount"
              placeholder="0.00"
              value={form.amount}
              onChange={handleInputChange}
              min="0.01"
              step="0.01"
              className="mt-1 w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-200"
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              placeholder="Optional description"
              value={form.description}
              onChange={handleInputChange}
              className="mt-1 w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-200"
              rows="3"
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-500 disabled:bg-gray-400 disabled:opacity-50 transition"
            disabled={isLoading}
            aria-label={editingId ? 'Update expense' : 'Add expense'}
          >
            {isLoading ? 'Processing...' : editingId ? 'Update Expense' : 'Add Expense'}
          </button>
        </form>
      )}

      {/* Expenses Table */}
      <div className="overflow-x-auto rounded-lg shadow-lg">
        {isLoading ? (
          <div className="text-center py-6">
            <p className="text-gray-500 dark:text-gray-400">Loading...</p>
          </div>
        ) : (
          <table className="min-w-full bg-white dark:bg-gray-800">
            <thead>
              <tr className="bg-gray-200 dark:bg-gray-700 text-indigo-600 dark:text-indigo-300">
                <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Description</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedExpenses.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-4 text-center text-gray-500 dark:text-gray-400">
                    No expenses found.
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition"
                  >
                    <td className="px-4 py-3 text-sm">
                      {format(new Date(expense.expense_date), 'PPP')}
                    </td>
                    <td className="px-4 py-3 text-sm">{expense.expense_type}</td>
                    <td className="px-4 py-3 text-sm">₦{formatCurrency(expense.amount)}</td>
                    <td className="px-4 py-3 text-sm">
                      {expense.description || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(expense)}
                          className="text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-600/20 p-4 rounded-full transition disabled:opacity-50 cursor-pointer"
                          disabled={isLoading}
                          title="Edit Expense"
                          aria-label={`Edit ${expense.expense_type} expense`}
                        >
                          <FaEdit/>
                        </button>
                        <button
                          onClick={() => {
                            console.log(`Delete button clicked: id=${expense.id}, type=${expense.expense_type}, isLoading=${isLoading}`);
                            handleDelete(expense.id, expense.expense_type);
                          }}
                          className="text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-600/20 p-4 rounded-full transition disabled:opacity-50 cursor-pointer"
                          disabled={isLoading}
                          title="Delete Expense"
                          aria-label={`Delete ${expense.expense_type} expense`}
                          style={{ pointerEvents: 'auto', zIndex: 1000 }}
                        >
                          <FaTrashAlt />
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

      {/* Pagination */}
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 rounded-lg p-4 mt-6">
        <button
          type="button"
          disabled={currentPage === 1 || isLoading}
          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
          className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-300 dark:disabled:bg-gray-500 disabled:opacity-50 transition cursor-pointer font-medium"
          aria-label="Previous page"
        >
          Previous
        </button>
        <span className="text-base text-gray-700 dark:text-white font-medium">
          Page {currentPage} of {totalPages || 1}
        </span>
        <button
          type="button"
          disabled={currentPage === totalPages || isLoading}
          onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
          className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:opacity-50 transition cursor-pointer font-medium"
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default ExpenseManager;