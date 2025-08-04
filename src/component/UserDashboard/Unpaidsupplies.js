import React, { useState, useEffect, useRef } from 'react';
import { supabase } from "../../supabaseClient";
import { FaTrashAlt } from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import DynamicDebtRepayment from './DynamicDebtRepayment'

export default function DebtsManager() {
  const storeId = localStorage.getItem("store_id");
  const [, setStore] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [debts, setDebts] = useState([]);
  const [filteredDebts, setFilteredDebts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editing, setEditing] = useState(null);
  const [debtEntries, setDebtEntries] = useState([
    {
      customer_id: "",
      customer_name: "",
      phone_number: "",
      dynamic_product_id: "",
      product_name: "",
      supplier: "",
      device_id: "",
      qty: "",
      owed: "",
      deposited: "",
      date: ""
    }
  ]);
  const [error, setError] = useState(null);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderType, setReminderType] = useState('one-time');
  const [reminderTime, setReminderTime] = useState('');
  const debtsRef = useRef();
  const reminderIntervalRef = useRef(null);

  // Fetch store details
  useEffect(() => {
    if (!storeId) {
      setError("Store ID is missing. Please log in or select a store.");
      toast.error("Store ID is missing.");
      return;
    }
    supabase
      .from("stores")
      .select("shop_name,business_address,phone_number")
      .eq("id", storeId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setError("Failed to fetch store details: " + error.message);
          toast.error("Failed to fetch store details.");
        } else {
          setStore(data);
        }
      });
  }, [storeId]);

  // Fetch customers for the current store
  useEffect(() => {
    if (!storeId) return;
    supabase
      .from('customer')
      .select('id, fullname, phone_number')
      .eq('store_id', storeId) // Restrict customers to the current store
      .then(({ data, error }) => {
        if (error) {
          setError("Failed to fetch customers: " + error.message);
          toast.error("Failed to fetch customers.");
        } else {
          setCustomers(data || []);
        }
      });
  }, [storeId]);

  // Fetch products
  useEffect(() => {
    if (!storeId) return;
    supabase
      .from('dynamic_product')
      .select('id, name')
      .eq('store_id', storeId)
      .then(({ data, error }) => {
        if (error) {
          setError("Failed to fetch products: " + error.message);
          toast.error("Failed to fetch products.");
        } else {
          setProducts(data || []);
        }
      });
  }, [storeId]);

  // Fetch debts
  useEffect(() => {
    if (!storeId) return;
    supabase
      .from('debts')
      .select('*')
      .eq('store_id', storeId)
      .then(({ data, error }) => {
        if (error) {
          setError("Failed to fetch debts: " + error.message);
          toast.error("Failed to fetch debts.");
        } else {
          setDebts(data || []);
          setFilteredDebts(data || []);
        }
      });
  }, [storeId]);

  // Filter debts on searchTerm
  useEffect(() => {
    const term = searchTerm.toLowerCase();
    setFilteredDebts(
      debts.filter(d => {
        const fields = [
          d.customer_name,
          d.product_name,
          d.phone_number,
          d.supplier,
          d.device_id,
          String(d.qty),
          d.owed != null ? `₦${d.owed.toFixed(2)}` : '',
          d.deposited != null ? `₦${d.deposited.toFixed(2)}` : '',
          d.remaining_balance != null ? `₦${d.remaining_balance.toFixed(2)}` : '',
          d.date
        ];
        return fields.some(f => f?.toString().toLowerCase().includes(term));
      })
    );
  }, [searchTerm, debts]);

  // Scroll debts into view
  useEffect(() => {
    if (debtsRef.current) {
      debtsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [debts]);

  // Handle reminder notifications
  const showDebtReminders = () => {
    const unpaidDebts = debts.filter(d => (d.remaining_balance || 0) > 0);
    if (unpaidDebts.length === 0) {
      toast.info("No unpaid debts found.");
      return;
    }

    unpaidDebts.forEach(d => {
      toast.warn(
        <div>
          <p><strong>Debtor:</strong> {d.customer_name}</p>
          <p><strong>Outstanding:</strong> ₦{(d.remaining_balance || 0).toFixed(2)}</p>
          <p><strong>Product:</strong> {d.product_name}</p>
          <p><strong>Date:</strong> {d.date}</p>
        </div>,
        { autoClose: 5000 }
      );
    });
  };

  const scheduleReminders = () => {
    if (!reminderTime) {
      toast.error("Please select a reminder time.");
      return;
    }

    const now = new Date();
    const [hours, minutes] = reminderTime.split(':').map(Number);
    let nextReminder = new Date(now);
    nextReminder.setHours(hours, minutes, 0, 0);

    if (nextReminder <= now) {
      nextReminder.setDate(nextReminder.getDate() + 1);
    }

    const msUntilReminder = nextReminder - now;

    if (reminderIntervalRef.current) {
      clearInterval(reminderIntervalRef.current);
    }

    if (reminderType === 'one-time') {
      setTimeout(showDebtReminders, msUntilReminder);
      toast.success(`Reminder set for ${nextReminder.toLocaleString()}`);
    } else {
      setTimeout(() => {
        showDebtReminders();
        reminderIntervalRef.current = setInterval(
          showDebtReminders,
          reminderType === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
        );
      }, msUntilReminder);
      toast.success(`Recurring ${reminderType} reminders set starting ${nextReminder.toLocaleString()}`);
    }

    setShowReminderForm(false);
  };

  const handleDebtChange = (index, e) => {
    const { name, value } = e.target;
    const updatedEntries = [...debtEntries];
    updatedEntries[index] = { ...updatedEntries[index], [name]: value };

    // Auto-populate customer fields
    if (name === 'customer_id' && value) {
      const selectedCustomer = customers.find(c => c.id === parseInt(value));
      if (selectedCustomer) {
        updatedEntries[index] = {
          ...updatedEntries[index],
          customer_id: value,
          customer_name: selectedCustomer.fullname,
          phone_number: selectedCustomer.phone_number || ""
        };
      }
    }

    // Auto-populate product field
    if (name === 'dynamic_product_id' && value) {
      const selectedProduct = products.find(p => p.id === parseInt(value));
      if (selectedProduct) {
        updatedEntries[index] = {
          ...updatedEntries[index],
          dynamic_product_id: value,
          product_name: selectedProduct.name
        };
      }
    }

    setDebtEntries(updatedEntries);
  };

  const addDebtEntry = () => {
    setDebtEntries([
      ...debtEntries,
      {
        customer_id: "",
        customer_name: "",
        phone_number: "",
        dynamic_product_id: "",
        product_name: "",
        supplier: "",
        device_id: "",
        qty: "",
        owed: "",
        deposited: "",
        date: ""
      }
    ]);
  };

  const removeDebtEntry = index => {
    if (debtEntries.length === 1) return;
    setDebtEntries(debtEntries.filter((_, i) => i !== index));
  };

  const saveDebts = async () => {
    let hasError = false;
    const validEntries = debtEntries.filter(entry => {
      if (
        !entry.customer_id ||
        isNaN(parseInt(entry.customer_id)) ||
        !entry.dynamic_product_id ||
        isNaN(parseInt(entry.dynamic_product_id)) ||
        !entry.qty ||
        isNaN(parseInt(entry.qty)) ||
        !entry.owed ||
        isNaN(parseFloat(entry.owed)) ||
        !entry.date
      ) {
        hasError = true;
        return false;
      }
      return true;
    });

    if (hasError) {
      setError("Please fill all required fields (Customer, Product, Qty, Owed, Date) correctly.");
      toast.error("Please fill all required fields correctly.");
      return;
    }

    const debtData = validEntries.map(entry => ({
      store_id: parseInt(storeId),
      customer_id: parseInt(entry.customer_id),
      dynamic_product_id: parseInt(entry.dynamic_product_id),
      customer_name: entry.customer_name,
      product_name: entry.product_name,
      phone_number: entry.phone_number || null,
      supplier: entry.supplier || null,
      device_id: entry.device_id || null,
      qty: parseInt(entry.qty),
      owed: parseFloat(entry.owed),
      deposited: entry.deposited ? parseFloat(entry.deposited) : 0.00,
      remaining_balance: parseFloat(entry.owed) - (entry.deposited ? parseFloat(entry.deposited) : 0.00),
      date: entry.date
    }));

    try {
      if (editing && editing.id) {
        await supabase.from("debts").update(debtData[0]).eq("id", editing.id);
      } else {
        await supabase.from("debts").insert(debtData);
      }

      setEditing(null);
      setDebtEntries([{
        customer_id: "",
        customer_name: "",
        phone_number: "",
        dynamic_product_id: "",
        product_name: "",
        supplier: "",
        device_id: "",
        qty: "",
        owed: "",
        deposited: "",
        date: ""
      }]);
      setError(null);
      toast.success(`${debtData.length} debt(s) saved successfully!`);

      const { data, error } = await supabase.from("debts").select("*").eq('store_id', storeId);
      if (error) {
        setError("Failed to fetch updated debts: " + error.message);
        toast.error("Failed to fetch updated debts.");
      } else {
        setDebts(data);
      }
    } catch (err) {
      setError("Failed to save debts: " + err.message);
      toast.error("Failed to save debts.");
    }
  };

  const deleteDebt = async id => {
    try {
      await supabase.from("debts").delete().eq("id", id);
      const { data, error } = await supabase.from("debts").select("*").eq('store_id', storeId);
      if (error) {
        setError("Failed to fetch updated debts: " + error.message);
        toast.error("Failed to fetch updated debts.");
      } else {
        setDebts(data);
        toast.success("Debt deleted successfully!");
      }
    } catch (err) {
      setError("Failed to delete debt: " + err.message);
      toast.error("Failed to delete debt.");
    }
  };

  if (!storeId) {
    return <div className="p-4 text-center text-red-500">Store ID is missing. Please log in or select a store.</div>;
  }

  return (
    <div className="p-0 space-y-6 dark:bg-gray-900 dark:text-white">
      <DynamicDebtRepayment/>
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Error Message */}
      {error && (
        <div className="p-4 mb-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Debts Management UI */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Debts</h2>

        {/* Search */}
        <div className="w-full mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search debts..."
            className="flex-1 border px-4 py-2 rounded dark:bg-gray-900 dark:text-white w-full"
          />
        </div>

        {/* Add Debt and Reminder Buttons */}
        <div className="mb-4 flex gap-2 sm:gap-3">
  <button
    type="button"
    onClick={() => setEditing({})}
    className="p-2 sm:p-3 bg-indigo-600 text-white rounded-full shadow-sm hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors duration-200 flex items-center justify-center gap-2"
    aria-label="Add new debt"
  >
    <svg
      className="w-4 h-4 sm:w-5 sm:h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
    </svg>
    <span className="text-sm sm:text-base">Debt</span>
  </button>
  <button
    type="button"
    onClick={() => setShowReminderForm(true)}
    className="p-2 sm:p-3 bg-yellow-600 text-white rounded-full shadow-sm hover:bg-yellow-700 dark:bg-yellow-500 dark:hover:bg-yellow-600 transition-colors duration-200 flex items-center justify-center gap-2"
    aria-label="Set debt reminders"
  >
    <svg
      className="w-4 h-4 sm:w-5 sm:h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-5-5.917V3a2 2 0 10-4 0v2.083A6 6 0 004 11v3.159c0 .538-.214 1.055-.595 1.436L2 17h5m4 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
    <span className="text-sm sm:text-base">Set Debt Reminders</span>
  </button>
</div>

        {/* Debts Table */}
        <div ref={debtsRef} className="overflow-x-auto">
          <table className="min-w-full text-sm border rounded-lg">
            <thead className="bg-gray-100 dark:bg-gray-900 dark:text-indigo-600">
              <tr>
                <th className="text-left px-4 py-2 border-b">Customer</th>
                <th className="text-left px-4 py-2 border-b">Product</th>
                <th className="text-left px-4 py-2 border-b">Supplier</th>
              
                <th className="text-left px-4 py-2 border-b">Qty</th>
                <th className="text-left px-4 py-2 border-b">Owed</th>
                <th className="text-left px-4 py-2 border-b">Deposited</th>
                <th className="text-left px-4 py-2 border-b">Remaining Balance</th>
                <th className="text-left px-4 py-2 border-b">Date</th>
                <th className="text-left px-4 py-2 border-b">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDebts.map(d => (
                <tr key={d.id} className="hover:bg-gray-100 dark:bg-gray-900 dark:text-white">
                  <td className="px-4 py-2 border-b truncate">{d.customer_name}</td>
                  <td className="px-4 py-2 border-b truncate">{d.product_name}</td>
                  <td className="px-4 py-2 border-b truncate">{d.supplier || '-'}</td>
                
                  <td className="px-4 py-2 border-b">{d.qty}</td>
                  <td className="px-4 py-2 border-b">₦{(d.owed || 0).toFixed(2)}</td>
                  <td className="px-4 py-2 border-b">₦{(d.deposited || 0).toFixed(2)}</td>
                  <td className="px-4 py-2 border-b">₦{(d.remaining_balance || 0).toFixed(2)}</td>
                  <td className="px-4 py-2 border-b">{d.date}</td>
                  <td className="px-4 py-2 border-b">
                    <div className="flex gap-3">
                      <button
                        onClick={() => deleteDebt(d.id)}
                        className="text-red-400 hover:text-red-600 dark:bg-gray-900 dark:text-white"
                      >
                        <FaTrashAlt />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredDebts.length === 0 && (
                <tr>
                  <td colSpan="10" className="text-center text-gray-500 py-4 dark:bg-gray-900 dark:text-white">
                    No debts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>



{editing && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-auto mt-16">
    <div className="bg-white rounded-lg shadow-lg w-full max-w-full sm:max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6 space-y-4 dark:bg-gray-900 dark:text-white">
      <h2 className="text-lg sm:text-xl font-bold text-center text-gray-900 dark:text-gray-200">
        {editing.id ? 'Edit Debt' : 'Add Debt'}
      </h2>
      <form onSubmit={saveDebts} className="space-y-4">
        {debtEntries.map((entry, index) => (
          <div key={index} className="border border-gray-200 dark:border-gray-700 p-3 sm:p-4 rounded-lg space-y-3 dark:bg-gray-800">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-200">
                Debt Entry {index + 1}
              </h3>
              {debtEntries.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeDebtEntry(index)}
                  className="p-1.5 bg-red-600 text-white rounded-full shadow-sm hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 transition-colors duration-200"
                  aria-label="Remove debt entry"
                >
                  <svg
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              {[
                { name: 'customer_id', label: 'Customer', type: 'select' },
                { name: 'dynamic_product_id', label: 'Product', type: 'select' },
                { name: 'supplier', label: 'Supplier', type: 'text' },
                { name: 'qty', label: 'Quantity', type: 'number', min: 1 },
                { name: 'owed', label: 'Owed', type: 'number', step: '0.01', min: 0 },
                { name: 'deposited', label: 'Deposited', type: 'number', step: '0.01', min: 0 },
                { name: 'date', label: 'Date', type: 'date' },
              ].map(field => (
                <label key={field.name} className="block">
                  <span className="font-semibold block mb-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                    {field.label}
                  </span>
                  {field.type === 'select' ? (
                    <select
                      name={field.name}
                      value={entry[field.name]}
                      onChange={e => handleDebtChange(index, e)}
                      className="w-full p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm"
                      required={['customer_id', 'dynamic_product_id', 'qty', 'owed', 'date'].includes(field.name)}
                    >
                      <option value="">Select {field.label}</option>
                      {field.name === 'customer_id'
                        ? customers.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.fullname}
                            </option>
                          ))
                        : products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      name={field.name}
                      value={entry[field.name]}
                      onChange={e => handleDebtChange(index, e)}
                      min={field.min}
                      step={field.step}
                      className="w-full p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm"
                      required={['customer_id', 'dynamic_product_id', 'qty', 'owed', 'date'].includes(field.name)}
                    />
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
        {!editing.id && (
          <button
            type="button"
            onClick={addDebtEntry}
            className="p-2 sm:p-3 bg-green-600 text-white rounded-full shadow-sm hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-colors duration-200 w-full sm:w-auto flex items-center justify-center gap-2"
            aria-label="Add another debt entry"
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm sm:text-base">Add Another Debt</span>
          </button>
        )}
        <div className="flex justify-end gap-2 sm:gap-3 mt-4">
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="p-2 sm:p-3 bg-gray-500 text-white rounded-full shadow-sm hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500 transition-colors duration-200"
            aria-label="Cancel debt form"
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            type="submit"
            className="p-2 sm:p-3 bg-indigo-600 text-white rounded-full shadow-sm hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors duration-200"
            aria-label={editing.id ? 'Save debt' : 'Create debt'}
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  </div>
)}
      {/* Reminder Form Modal */}
      {showReminderForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 space-y-4 dark:bg-gray-900 dark:text-white">
            <h2 className="text-xl font-bold text-center">Set Debt Reminders</h2>
            <div className="space-y-4">
              <label className="block">
                <span className="font-semibold block mb-1">Reminder Type</span>
                <select
                  value={reminderType}
                  onChange={e => setReminderType(e.target.value)}
                  className="border p-2 w-full rounded dark:bg-gray-900 dark:text-white"
                >
                  <option value="one-time">One-Time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>
              <label className="block">
                <span className="font-semibold block mb-1">Reminder Time</span>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={e => setReminderTime(e.target.value)}
                  className="border p-2 w-full rounded dark:bg-gray-900 dark:text-white"
                  required
                />
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowReminderForm(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded"
              >
                Cancel
              </button>
              <button
                onClick={scheduleReminders}
                className="px-4 py-2 bg-indigo-600 text-white rounded"
              >
                Set Reminder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}