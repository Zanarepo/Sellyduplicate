import { useState, useEffect } from "react";
import { supabase } from '../../supabaseClient';
import Papa from 'papaparse';

function BulkTheftUpload() {
  const [inventory, setInventory] = useState([]);
  const [products, setProducts] = useState([]);
  const [theftIncidents, setTheftIncidents] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]); // Array of { productId, productName, physicalCount, availableQty }
  const [theftMessage, setTheftMessage] = useState("");
  const [storeName, setStoreName] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const incidentsPerPage = 10;
  const storeId = localStorage.getItem("store_id") || null;

  useEffect(() => {
    const fetchData = async () => {
      if (!storeId) {
        setError("No store ID found. Please log in again.");
        setLoading(false);
        return;
      }

      try {
        // Fetch store name
        const { data: storeData, error: storeError } = await supabase
          .from("stores")
          .select("shop_name")
          .eq("id", storeId)
          .single();
        if (storeError) throw new Error("Error fetching store name: " + storeError.message);
        setStoreName(storeData.shop_name);
        console.log("Store name fetched:", storeData.shop_name);

        // Fetch inventory for store
        const { data: inventoryData, error: inventoryError } = await supabase
          .from("dynamic_inventory")
          .select("dynamic_product_id, available_qty, updated_at")
          .eq("store_id", storeId)
          .order("updated_at", { ascending: false });
        if (inventoryError) throw new Error("Error fetching inventory: " + inventoryError.message);
        setInventory(inventoryData);
        console.log("Inventory fetched:", inventoryData);

        // Fetch products for this store
        const productIds = [...new Set(inventoryData.map(item => item.dynamic_product_id))];
        const { data: productData, error: productError } = await supabase
          .from("dynamic_product")
          .select("id, name")
          .in("id", productIds)
          .order("name", { ascending: true });
        if (productError) throw new Error("Error fetching products: " + productError.message);
        setProducts(productData);
        console.log("Products fetched:", productData);

        // Fetch theft incidents from Supabase
        const { data: theftData, error: theftError } = await supabase
          .from("theft_incidents")
          .select("*")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false });
        if (theftError) throw new Error("Error fetching theft incidents: " + theftError.message);
        setTheftIncidents(theftData);
        console.log("Theft incidents fetched:", theftData);

        setLoading(false);
      } catch (err) {
        setError("Unexpected error: " + err.message);
        setLoading(false);
        console.error("Fetch error:", err);
      }
    };
    fetchData();
  }, [storeId]);

  const handleDownloadTemplate = () => {
    const csvContent = "product_name,physical_count\nEgg,0\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'theft_check_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log("CSV template downloaded");
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsedProducts = [];
        const seenProductIds = new Set();

        for (const row of result.data) {
          let productId = null;
          let productName = null;
          const physicalCount = row.physical_count;

          // Validate physical count
          const physicalCountNum = parseInt(physicalCount);
          if (isNaN(physicalCountNum) || physicalCountNum < 0) {
            setTheftMessage(`Invalid physical count for row: ${JSON.stringify(row)}`);
            continue;
          }

          // Identify product by dynamic_product_id or product_name
          if (row.dynamic_product_id) {
            productId = parseInt(row.dynamic_product_id);
            const product = products.find(p => p.id === productId);
            if (product) {
              productName = product.name;
            } else {
              setTheftMessage(`Product ID ${productId} not found in store inventory.`);
              continue;
            }
          } else if (row.product_name) {
            const product = products.find(p => p.name.toLowerCase() === row.product_name.toLowerCase());
            if (product) {
              productId = product.id;
              productName = product.name;
            } else {
              setTheftMessage(`Product name ${row.product_name} not found in store inventory.`);
              continue;
            }
          } else {
            setTheftMessage(`Row missing product_name or dynamic_product_id: ${JSON.stringify(row)}`);
            continue;
          }

          // Prevent duplicate products
          if (seenProductIds.has(productId)) {
            setTheftMessage(`Duplicate product ID ${productId} in CSV.`);
            continue;
          }
          seenProductIds.add(productId);

          // Fetch available_qty
          const productInventory = inventory
            .filter((item) => item.dynamic_product_id === productId)
            .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
          const availableQty = productInventory && productInventory.available_qty !== null && productInventory.available_qty !== undefined
            ? productInventory.available_qty
            : null;

          parsedProducts.push({ productId: productId.toString(), productName, physicalCount, availableQty });
        }

        setSelectedProducts(parsedProducts);
        setTheftMessage(parsedProducts.length > 0 ? "CSV uploaded successfully." : "No valid products found in CSV.");
        console.log("Parsed CSV products:", parsedProducts);
      },
      error: (err) => {
        setTheftMessage(`Failed to parse CSV: ${err.message}`);
        console.error("CSV parse error:", err);
      }
    });
  };

  const handlePhysicalCountChange = (productId, value) => {
    setSelectedProducts(prev =>
      prev.map(p =>
        p.productId === productId ? { ...p, physicalCount: value } : p
      )
    );
  };

  const handleRemoveProduct = (productId) => {
    setSelectedProducts(prev => prev.filter(p => p.productId !== productId));
    setTheftMessage("");
  };

  const handleCheckTheft = async () => {
    if (selectedProducts.length === 0 || selectedProducts.some(p => !p.physicalCount)) {
      setTheftMessage("Please upload a CSV with at least one product and valid physical counts.");
      return;
    }

    const invalidCount = selectedProducts.some(p => {
      const count = parseInt(p.physicalCount);
      return isNaN(count) || count < 0;
    });
    if (invalidCount) {
      setTheftMessage("Please enter valid physical counts for all products.");
      return;
    }

    setIsChecking(true);
    let messages = [];

    for (const { productId, productName, physicalCount, availableQty } of selectedProducts) {
      if (availableQty === null) {
        messages.push(`No inventory data for ${productName || `Product ID: ${productId}`}.`);
        continue;
      }

      const physicalCountNum = parseInt(physicalCount);
      if (physicalCountNum < availableQty) {
        const discrepancy = availableQty - physicalCountNum;
        messages.push(`Theft detected for ${productName}: ${discrepancy} units missing`);

        const theftIncident = {
          dynamic_product_id: parseInt(productId),
          store_id: parseInt(storeId),
          inventory_change: -discrepancy,
          expected_change: 0,
          timestamp: new Date().toISOString(),
          product_name: productName,
          shop_name: storeName || `Store ID: ${storeId}`,
          created_at: new Date().toISOString(),
        };

        try {
          const { error } = await supabase
            .from("theft_incidents")
            .insert(theftIncident);
          if (error) throw new Error(`Failed to insert theft incident for ${productName}: ${error.message}`);
          console.log("Theft incident inserted:", theftIncident);
        } catch (err) {
          messages.push(`Theft detected for ${productName}: ${discrepancy} units missing, but failed to save: ${err.message}`);
          console.error("Insert error:", err);
        }
      }
    }

    setTheftMessage(messages.join(" | "));
    setIsChecking(false);
    setSelectedProducts([]); // Clear form after check
  };

  const handleDeleteIncident = async (incidentId) => {
    try {
      const { error } = await supabase
        .from("theft_incidents")
        .delete()
        .eq("id", incidentId);
      if (error) throw new Error("Failed to delete theft incident: " + error.message);
      setTheftIncidents((prev) => prev.filter(incident => incident.id !== incidentId));
      console.log("Theft incident deleted:", incidentId);
    } catch (err) {
      setTheftMessage(`Failed to delete incident: ${err.message}`);
      console.error("Delete error:", err);
    }
  };

  // Pagination logic
  const indexOfLastIncident = currentPage * incidentsPerPage;
  const indexOfFirstIncident = indexOfLastIncident - incidentsPerPage;
  const currentIncidents = theftIncidents.slice(indexOfFirstIncident, indexOfLastIncident);
  const totalPages = Math.ceil(theftIncidents.length / incidentsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  if (loading) return <div className="text-center py-4 text-gray-600">Loading...</div>;
  if (error) return <div className="text-center py-4 text-red-600">{error}</div>;

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full min-h-screen bg-gray-50">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 text-indigo-600">
        Bulk Theft Upload for {storeName || "Store"}
      </h2>

      {/* CSV Upload Form */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow-md">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">Upload CSV for Theft Check</h3>
        <div className="mb-4">
          <button
            onClick={handleDownloadTemplate}
            className="mb-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm transition-colors"
          >
            Download CSV Template
          </button>
          <label className="block text-sm font-medium text-gray-700 mb-1">Upload CSV File</label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="w-full sm:w-1/2 p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            CSV should contain headers: product_name or dynamic_product_id, physical_count
          </p>
        </div>
        {selectedProducts.length > 0 && (
          <div className="space-y-4">
            {selectedProducts.map((sp) => (
              <div key={sp.productId} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                  <input
                    type="text"
                    value={sp.productName}
                    readOnly
                    className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Available Quantity</label>
                  <input
                    type="text"
                    value={sp.availableQty !== null ? sp.availableQty : "No inventory data"}
                    readOnly
                    className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Physical Count</label>
                    <input
                      type="number"
                      value={sp.physicalCount}
                      onChange={(e) => handlePhysicalCountChange(sp.productId, e.target.value)}
                      placeholder="Enter physical count"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                  </div>
                  <button
                    onClick={() => handleRemoveProduct(sp.productId)}
                    className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4">
          <button
            onClick={handleCheckTheft}
            disabled={isChecking}
            className={`w-full sm:w-auto px-4 py-2 flex items-center justify-center rounded-lg text-sm transition-colors ${
              isChecking
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            {isChecking ? (
              <svg
                className="animate-spin h-5 w-5 mr-2 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : null}
            {isChecking ? "Checking..." : "Check All"}
          </button>
        </div>
        {theftMessage && (
          <p
            className={`mt-4 text-sm font-medium ${
              theftMessage.includes("Theft detected") ? "text-red-600" : "text-gray-600"
            }`}
          >
            {theftMessage}
          </p>
        )}
      </div>

      {/* Theft Incidents Table */}
      <div className="overflow-x-auto shadow-lg rounded-lg">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">Theft Incidents</h3>
        {theftIncidents.length ? (
          <>
            <table className="min-w-full bg-white border border-gray-200">
              <thead className="bg-indigo-600 text-white">
                <tr>
                  <th className="py-2 px-3 sm:px-4 text-left text-xs sm:text-sm font-semibold">Product</th>
                  <th className="py-2 px-3 sm:px-4 text-left text-xs sm:text-sm font-semibold">Missing Units</th>
                  <th className="py-2 px-3 sm:px-4 text-left text-xs sm:text-sm font-semibold">Expected Change</th>
                  <th className="py-2 px-3 sm:px-4 text-left text-xs sm:text-sm font-semibold">Date</th>
                  <th className="py-2 px-3 sm:px-4 text-left text-xs sm:text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentIncidents.map((t) => (
                  <tr
                    key={t.id}
                    className={`border-b ${t.id % 2 === 0 ? "bg-gray-50" : "bg-white"} hover:bg-indigo-50 transition-colors`}
                  >
                    <td className="py-2 px-3 sm:px-4 text-xs sm:text-sm text-gray-700">{t.product_name}</td>
                    <td className="py-2 px-3 sm:px-4 text-xs sm:text-sm text-gray-700">{Math.abs(t.inventory_change)} units</td>
                    <td className="py-2 px-3 sm:px-4 text-left text-xs sm:text-sm text-gray-700">{t.expected_change} units</td>
                    <td className="py-2 px-3 sm:px-4 text-xs sm:text-sm text-gray-700">
                      {new Date(t.timestamp).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-3 sm:px-4 text-xs sm:text-sm text-gray-700">
                      <button
                        onClick={() => handleDeleteIncident(t.id)}
                        className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Pagination Controls */}
            <div className="mt-4 flex justify-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-3 py-1 rounded text-sm ${
                  currentPage === 1
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-1 rounded text-sm ${
                    currentPage === page
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-200 hover:bg-gray-300"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-3 py-1 rounded text-sm ${
                  currentPage === totalPages
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <p className="text-gray-600 text-center text-sm sm:text-base">
            No theft incidents detected for {storeName || "this store"}.
          </p>
        )}
      </div>
    </div>
  );
}

export default BulkTheftUpload;