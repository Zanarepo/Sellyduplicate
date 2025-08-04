import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { FaTrashAlt, FaFileCsv, FaFilePdf, FaFilter } from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function SuppliersInventory() {
  const storeId = localStorage.getItem('store_id');

  // State
  const [inventory, setInventory] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    supplier_name: '',
    device_name: '',
    qty_min: '',
    qty_max: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [suppliers, setSuppliers] = useState([]);
  const [showDetail, setShowDetail] = useState(null);
  const [detailPage, setDetailPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const itemsPerPage = 15;
  const detailItemsPerPage = 20;

  // Paginated inventory
  const paginatedInventory = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage]);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  // Paginated device IDs for modal
  const deviceIds = useMemo(() => {
    return showDetail?.device_id?.split(',').filter(id => id.trim()) || [];
  }, [showDetail]);

  const paginatedDeviceIds = useMemo(() => {
    const start = (detailPage - 1) * detailItemsPerPage;
    return deviceIds.slice(start, start + detailItemsPerPage);
  }, [deviceIds, detailPage]);

  const totalDetailPages = Math.ceil(deviceIds.length / detailItemsPerPage);

  // Fetch inventory
  const fetchInventory = useCallback(async () => {
    if (!storeId) {
      toast.error('No store ID found. Please log in.');
      return;
    }
    const { data, error } = await supabase
      .from('suppliers_inventory')
      .select('id, supplier_name, device_name, device_id, qty, created_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching suppliers inventory:', error);
      toast.error('Failed to fetch inventory');
    } else {
      setInventory(data);
      setFiltered(data);
    }
  }, [storeId]);

  // Fetch suppliers
  const fetchSuppliers = useCallback(async () => {
    if (!storeId) return;
    const { data: productData, error } = await supabase
      .from('dynamic_product')
      .select('suppliers_name')
      .eq('store_id', storeId);
    if (error) {
      toast.error('Failed to fetch suppliers');
      return;
    }
    const uniqueSuppliers = [...new Set(productData.map(p => p.suppliers_name).filter(name => name))]
      .map(name => ({ value: name, label: name }));
    setSuppliers([{ value: '', label: 'None' }, ...uniqueSuppliers]);
  }, [storeId]);

  useEffect(() => {
    fetchInventory();
    fetchSuppliers();
  }, [fetchInventory, fetchSuppliers]);

  // Search and filter
  useEffect(() => {
    let filteredItems = [...inventory];

    // Apply search
    if (search.trim()) {
      const query = search.toLowerCase().trim();
      filteredItems = filteredItems.filter(item =>
        item.supplier_name?.toLowerCase().includes(query) ||
        item.device_name?.toLowerCase().includes(query) ||
        item.device_id?.toLowerCase().includes(query)
      );
    }

    // Apply filters
    if (filters.supplier_name) {
      filteredItems = filteredItems.filter(item =>
        (item.supplier_name || '') === filters.supplier_name
      );
    }
    if (filters.device_name?.trim()) {
      const deviceNameFilter = filters.device_name.toLowerCase().trim();
      filteredItems = filteredItems.filter(item =>
        item.device_name?.toLowerCase().includes(deviceNameFilter)
      );
    }
    if (filters.qty_min !== '') {
      const qtyMin = parseInt(filters.qty_min);
      if (!isNaN(qtyMin)) {
        filteredItems = filteredItems.filter(item => item.qty >= qtyMin);
      }
    }
    if (filters.qty_max !== '') {
      const qtyMax = parseInt(filters.qty_max);
      if (!isNaN(qtyMax)) {
        filteredItems = filteredItems.filter(item => item.qty <= qtyMax);
      }
    }

    setFiltered(filteredItems);
    setCurrentPage(1);
  }, [search, filters, inventory]);

  // Handle filter change
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      supplier_name: '',
      device_name: '',
      qty_min: '',
      qty_max: '',
    });
    setShowFilters(false);
  };

  // Delete item
  const deleteItem = async (id, device_name) => {
    if (!window.confirm(`Delete ${device_name}?`)) return;
    try {
      const { error } = await supabase
        .from('suppliers_inventory')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Item deleted successfully');
      await fetchInventory();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item');
    }
  };

  // Export CSV
  const exportCSV = () => {
    let csv = 'data:text/csv;charset=utf-8,';
    csv += 'Supplier,DeviceName,ProductID,Qty,CreatedAt\n';
    filtered.forEach(item => {
      const row = [
        item.supplier_name || 'None',
        item.device_name,
        item.device_id,
        item.qty,
        item.created_at
      ].map(field => `"${field?.replace(/"/g, '""') || ''}"`).join(',');
      csv += row + '\n';
    });
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = 'suppliers_inventory.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export PDF
  const exportPDF = () => {
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF();
      let y = 10;
      doc.setFontSize(16);
      doc.text('Suppliers Inventory', 10, y);
      y += 10;
      doc.setFontSize(12);
      filtered.forEach(item => {
        const line = `Supplier: ${item.supplier_name || 'None'}, Device: ${item.device_name}, ID: ${item.device_id}, Qty: ${item.qty}`;
        doc.text(line, 10, y);
        y += 10;
        if (y > 280) {
          doc.addPage();
          y = 10;
        }
      });
      doc.save('suppliers_inventory.pdf');
    });
  };

  // Check if device_id matches search
  const isDeviceIdMatch = (deviceId, query) => {
    return query && deviceId?.toLowerCase().includes(query.toLowerCase().trim());
  };

  return (
    <div className="p-4 dark:bg-gray-900 dark:text-white">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Filters */}
      <div className="mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 mb-2"
        >
          <FaFilter /> {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
        {showFilters && (
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Supplier
                </label>
                <select
                  value={filters.supplier_name}
                  onChange={e => handleFilterChange('supplier_name', e.target.value)}
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                >
                  <option value="">All</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.value} value={supplier.value}>
                      {supplier.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Device Name
                </label>
                <input
                  type="text"
                  placeholder="Filter by device name..."
                  value={filters.device_name}
                  onChange={e => handleFilterChange('device_name', e.target.value)}
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Min Qty
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Min qty..."
                  value={filters.qty_min}
                  onChange={e => handleFilterChange('qty_min', e.target.value)}
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Qty
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Max qty..."
                  value={filters.qty_max}
                  onChange={e => handleFilterChange('qty_max', e.target.value)}
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row items-center gap-2 mb-4">
        <input
          type="text"
          placeholder="Search by Supplier, Device Name, or IDs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              {['Supplier', 'Device Name', 'Product ID', 'Qty', 'Created At', 'Actions'].map(h => (
                <th
                  key={h}
                  className="px-4 py-2 text-left text-sm font-semibold text-gray-600 dark:text-gray-300"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {paginatedInventory.map(item => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-2 text-sm">{item.supplier_name || 'None'}</td>
                <td className="px-4 py-2 text-sm">{item.device_name}</td>
                <td className={`px-4 py-2 text-sm ${isDeviceIdMatch(item.device_id, search) ? 'bg-yellow-100 dark:bg-yellow-900' : ''}`}>
                  <button
                    onClick={() => setShowDetail(item)}
                    className="text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    View
                  </button>
                </td>
                <td className="px-4 py-2 text-sm">{item.qty}</td>
                <td className="px-4 py-2 text-sm">
                  {new Date(item.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-sm">
                  <button
                    onClick={() => deleteItem(item.id, item.device_name)}
                    className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    title="Delete"
                  >
                    <FaTrashAlt />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap justify-center items-center gap-2 mt-4">
        <button
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50 dark:text-white"
        >
          Prev
        </button>
        {[...Array(totalPages)].map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentPage(i + 1)}
            className={`px-3 py-1 rounded ${
              currentPage === i + 1
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white'
            }`}
          >
            {i + 1}
          </button>
        ))}
        <button
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50 dark:text-white"
        >
          Next
        </button>
      </div>

      {/* Exports */}
      <div className="flex justify-center gap-4 mt-4">
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          <FaFileCsv /> CSV
        </button>
        <button
          onClick={exportPDF}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          <FaFilePdf /> PDF
        </button>
      </div>

      {/* Device IDs Modal */}
      {showDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
              {showDetail.device_name} Device IDs
            </h2>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedDeviceIds.map((id, i) => (
                <li
                  key={i}
                  className={`py-2 px-1 ${isDeviceIdMatch(id, search) ? 'bg-yellow-100 dark:bg-yellow-900' : ''}`}
                >
                  {id}
                </li>
              ))}
            </ul>
            {totalDetailPages > 1 && (
              <div className="flex justify-between items-center mt-4 text-sm">
                <button
                  onClick={() => setDetailPage(p => Math.max(p - 1, 1))}
                  disabled={detailPage === 1}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50 dark:text-white"
                >
                  Prev
                </button>
                <span>
                  Page {detailPage} of {totalDetailPages}
                </span>
                <button
                  onClick={() => setDetailPage(p => Math.min(p + 1, totalDetailPages))}
                  disabled={detailPage === totalDetailPages}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50 dark:text-white"
                >
                  Next
                </button>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setShowDetail(null);
                  setDetailPage(1);
                }}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}