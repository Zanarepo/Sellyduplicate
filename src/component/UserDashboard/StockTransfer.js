import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FaExchangeAlt, FaEye, FaEyeSlash } from "react-icons/fa";

export default function StoreInventoryTransfer() {
  // State management
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(localStorage.getItem("store_id") || "");
  const [inventory, setInventory] = useState([]);
  const [fullInventory, setFullInventory] = useState([]);
  const [transferHistory, setTransferHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [destinationStore, setDestinationStore] = useState("");
  const [transferQty, setTransferQty] = useState("");
  const [, setUserEmail] = useState(null);
  const [isStoreOwner, setIsStoreOwner] = useState(false);
  const [userId, setUserId] = useState(localStorage.getItem("user_id") || null);
  const [storeIdState, setStoreIdState] = useState(localStorage.getItem("store_id") || null);
  const [ownerIdState, setOwnerIdState] = useState(localStorage.getItem("owner_id") || null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showInventoryTable, setShowInventoryTable] = useState(false);
  const [showHistoryTable, setShowHistoryTable] = useState(false);
  const entriesPerPage = 10;

  // Pagination calculations
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = transferHistory.slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = Math.ceil(transferHistory.length / entriesPerPage);

  const paginate = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // Fetch user and ownership info
  useEffect(() => {
    async function fetchUserData() {
      setLoadingUser(true);
      try {
        let email = localStorage.getItem("user_email");
        if (!email) {
          const { data: authData, error: authError } = await supabase.auth.getUser();
          if (authError) throw authError;
          email = authData?.user?.email || null;
        }
        if (!email) throw new Error("Please log in (missing user email).");
        setUserEmail(email);

        const { data: storeData, error: storeErr } = await supabase
          .from("stores")
          .select("id, owner_user_id")
          .eq("email_address", email)
          .limit(1)
          .maybeSingle();

        if (storeErr) throw storeErr;

        if (storeData) {
          setIsStoreOwner(true);
          const storeIdVal = String(storeData.id);
          setStoreIdState(storeIdVal);
          localStorage.setItem("store_id", storeIdVal);

          const ownerIdVal = storeData.owner_user_id ? String(storeData.owner_user_id) : (localStorage.getItem("owner_id") || "");
          setOwnerIdState(ownerIdVal);
          if (ownerIdVal) localStorage.setItem("owner_id", ownerIdVal);

          const { data: existingUser, error: userErr } = await supabase
            .from("store_users")
            .select("id")
            .eq("email_address", email)
            .eq("store_id", storeData.id)
            .limit(1)
            .maybeSingle();
          if (userErr) throw userErr;
          if (existingUser) {
            setUserId(String(existingUser.id));
            localStorage.setItem("user_id", String(existingUser.id));
          }
        } else {
          const { data: userData, error: userErr } = await supabase
            .from("store_users")
            .select("id, store_id, owner_id")
            .eq("email_address", email)
            .limit(1)
            .maybeSingle();
          if (userErr) throw userErr;
          if (!userData) throw new Error("User not found in store_users. Please ensure you are registered.");

          setUserId(String(userData.id));
          setStoreIdState(String(userData.store_id));
          setOwnerIdState(userData.owner_id ? String(userData.owner_id) : (localStorage.getItem("owner_id") || ""));
          localStorage.setItem("user_id", String(userData.id));
          localStorage.setItem("store_id", String(userData.store_id));
          if (userData.owner_id) localStorage.setItem("owner_id", String(userData.owner_id));
        }
      } catch (err) {
        console.error("fetchUserData error:", err.message);
        toast.error(err.message || "Failed to determine user");
      } finally {
        setLoadingUser(false);
      }
    }
    fetchUserData();
  }, []);

  // Fetch inventory
  const fetchInventory = useCallback(async (storeIdToFetch) => {
    if (!storeIdToFetch) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("dynamic_inventory")
        .select(`
          id,
          dynamic_product_id,
          quantity,
          available_qty,
          quantity_sold,
          reorder_level,
          last_updated,
          dynamic_product:dynamic_product_id (
            id,
            name
          )
        `)
        .eq("store_id", storeIdToFetch);
      if (error) throw error;
      console.log("Fetched inventory:", data);
      setFullInventory(data || []);
      setInventory(data || []);
    } catch (error) {
      console.error("fetchInventory error:", error.message);
      toast.error(`Failed to load inventory: ${error.message}`);
      setInventory([]);
      setFullInventory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch stores
  const fetchStores = useCallback(async (ownerId) => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("id, shop_name")
        .eq("owner_user_id", ownerId)
        .order("shop_name", { ascending: true });
      if (error) throw error;
      console.log("Fetched stores:", data);
      setStores(data || []);
      if (!selectedStore && data?.length) {
        const storeIdVal = String(data[0].id);
        setSelectedStore(storeIdVal);
        localStorage.setItem("store_id", storeIdVal);
        await fetchInventory(storeIdVal);
      }
    } catch (error) {
      console.error("fetchStores error:", error.message);
      toast.error(`Error fetching stores: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedStore, fetchInventory]);

  // Fetch transfer history
  const fetchTransferHistory = useCallback(async (ownerId) => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("stock_transfer_requests")
        .select(`
          id,
          quantity,
          status,
          requested_at,
          source_store: source_store_id (shop_name),
          destination_store: destination_store_id (shop_name),
          product: dynamic_product_id (name, selling_price)
        `)
        .eq("store_owner_id", ownerId)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      console.log("Fetched transfer history:", data);
      const enrichedData = data.map((item) => ({
        ...item,
        worth: (item.product?.selling_price || 0) * item.quantity,
      }));
      setTransferHistory(enrichedData || []);
    } catch (error) {
      console.error("fetchTransferHistory error:", error.message);
      toast.error(`Failed to load transfer history: ${error.message}`);
      setTransferHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch stores, inventory, and transfer history
  useEffect(() => {
    if (!loadingUser) {
      if (ownerIdState && isStoreOwner) {
        fetchStores(ownerIdState);
        fetchTransferHistory(ownerIdState);
      }
      if (selectedStore) {
        fetchInventory(selectedStore);
      } else if (!selectedStore && storeIdState) {
        setSelectedStore(String(storeIdState));
        localStorage.setItem("store_id", String(storeIdState));
        fetchInventory(String(storeIdState));
      }
    }
  }, [loadingUser, ownerIdState, storeIdState, isStoreOwner, fetchStores, fetchTransferHistory, selectedStore, fetchInventory]);

  // Handle inventory search
  useEffect(() => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      setInventory(
        fullInventory.filter((r) =>
          (r.dynamic_product?.name ?? `Product #${r.dynamic_product_id}`).toLowerCase().includes(q)
        )
      );
    } else {
      setInventory(fullInventory);
    }
  }, [searchQuery, fullInventory]);

  // Modal handlers
  const openModal = useCallback((productRow) => {
    if (!isStoreOwner) {
      toast.error("Only store owners can transfer stock");
      return;
    }
    setSelectedProduct(productRow);
    setDestinationStore("");
    setTransferQty("");
    setModalOpen(true);
  }, [isStoreOwner]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSelectedProduct(null);
    setDestinationStore("");
    setTransferQty("");
  }, []);

  const openHistoryModal = useCallback((transfer) => {
    setSelectedTransfer(transfer);
    setHistoryModalOpen(true);
  }, []);

  const closeHistoryModal = useCallback(() => {
    setHistoryModalOpen(false);
    setSelectedTransfer(null);
  }, []);

  // Submit transfer request
  const submitTransferRequest = useCallback(async () => {
    if (!isStoreOwner) {
      toast.error("Only store owners can transfer stock");
      return;
    }
    if (!selectedStore) {
      toast.error("Select a source store first");
      return;
    }
    if (!destinationStore) {
      toast.error("Select a destination store");
      return;
    }
    const qtyNum = Number(transferQty);
    if (!qtyNum || qtyNum <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    const src = parseInt(selectedStore, 10);
    const dest = parseInt(destinationStore, 10);
    const qty = parseInt(qtyNum, 10);
    if (src === dest) {
      toast.error("Source and destination must be different");
      return;
    }
    const avail = Number(selectedProduct?.available_qty || 0);
    if (qty > avail) {
      toast.error("Insufficient available quantity in source store");
      return;
    }
    setLoading(true);
    try {
      const dynamicProductId = selectedProduct.dynamic_product_id;
      const actorUserId = userId ? parseInt(userId, 10) : null;

      const { data, error } = await supabase.rpc("create_stock_transfer_request", {
        p_actor_user_id: actorUserId,
        p_source_store_id: src,
        p_destination_store_id: dest,
        p_dynamic_product_id: dynamicProductId,
        p_quantity: qty,
        p_request_as_owner: true,
      });

      if (error) throw error;

      const returned = Array.isArray(data) && data.length ? data[0] : null;
      const requestId = returned?.request_id;

      toast.success(`Transfer executed (id ${requestId})`);

      await fetchInventory(String(src));
      if (String(dest) === String(storeIdState)) {
        await fetchInventory(String(dest));
      }
      fetchTransferHistory(ownerIdState);
      closeModal();
    } catch (error) {
      console.error("Transfer error:", error.message);
      toast.error(error.message || "Transfer failed");
    } finally {
      setLoading(false);
    }
  }, [isStoreOwner, selectedStore, destinationStore, transferQty, selectedProduct, userId, storeIdState, ownerIdState, fetchInventory, fetchTransferHistory, closeModal]);

  // Handle store selection
  const handleStoreChange = useCallback((e) => {
    const value = e.target.value;
    setSelectedStore(value);
    localStorage.setItem("store_id", value);
    fetchInventory(value);
    setSearchQuery("");
  }, [fetchInventory]);

  return (
    <div className="p-4 sm:p-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen transition-all duration-300">
      <ToastContainer />
      <h2 className="text-2xl sm:text-3xl font-bold text-center text-white bg-gradient-to-r from-indigo-500 to-indigo-700 py-4 rounded-lg">
        Stock Transfer
      </h2>

      {!isStoreOwner && !loadingUser && (
        <div className="mt-6 text-center text-red-600">
          Only store owners can access this page.
        </div>
      )}

      {isStoreOwner && stores.length === 0 && !loading && !loadingUser && (
        <div className="mt-6 text-center text-gray-600">
          No stores found. Please create a store to proceed.
        </div>
      )}

      {/* Filters */}
      {isStoreOwner && (
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-white p-6 rounded-xl shadow-lg">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="source-store">
              Source Store
            </label>
            <select
              id="source-store"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
              value={selectedStore}
              onChange={handleStoreChange}
              aria-label="Select Source Store"
              disabled={loading || loadingUser}
            >
              <option value="">Select a store</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.shop_name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="search-inventory">
              Search Inventory
            </label>
            <input
              id="search-inventory"
              type="text"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search Products"
              disabled={loading || loadingUser || !selectedStore}
            />
          </div>
        </div>
      )}

      {/* Inventory Table */}
      {isStoreOwner && selectedStore && !loadingUser && (
        <div className="mb-8 bg-white p-6 rounded-xl shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Inventory for Selected Store</h3>
            <button
              onClick={() => setShowInventoryTable(!showInventoryTable)}
              className="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 flex items-center gap-2 focus:ring-2 focus:ring-indigo-500 transition transform hover:scale-105"
              aria-label={showInventoryTable ? "Hide Inventory Table" : "Show Inventory Table"}
            >
              {showInventoryTable ? <FaEyeSlash /> : <FaEye />}
              {showInventoryTable ? "Hide" : "Show"}
            </button>
          </div>
          {showInventoryTable && (
            loading ? (
              <div className="p-6 text-center text-gray-500">Loading inventory…</div>
            ) : inventory.length === 0 ? (
              <p className="text-gray-500 text-center">No products found for this store or search query.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-3 text-left text-gray-700 font-semibold">Product</th>
                      <th className="p-3 text-right text-gray-700 font-semibold">Available</th>
                      <th className="p-3 text-center text-gray-700 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((row) => (
                      <tr key={row.id} className="border-t hover:bg-gray-50 transition">
                        <td className="p-3 text-gray-800">
                          {row.dynamic_product?.name ?? `Product #${row.dynamic_product_id}`}
                        </td>
                        <td className="p-3 text-right text-gray-800">{row.available_qty}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => openModal(row)}
                            className="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 flex items-center gap-2 mx-auto focus:ring-2 focus:ring-indigo-500 transition transform hover:scale-105"
                            aria-label={`Transfer ${row.dynamic_product?.name ?? `Product #${row.dynamic_product_id}`}`}
                            disabled={loading}
                          >
                            <FaExchangeAlt /> Transfer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

      {/* Transfer History Table */}
      {isStoreOwner && !loadingUser && (
        <div className="bg-white p-6 rounded-xl shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Transfer History</h3>
            <button
              onClick={() => setShowHistoryTable(!showHistoryTable)}
              className="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 flex items-center gap-2 focus:ring-2 focus:ring-indigo-500 transition transform hover:scale-105"
              aria-label={showHistoryTable ? "Hide History Table" : "Show History Table"}
            >
              {showHistoryTable ? <FaEyeSlash /> : <FaEye />}
              {showHistoryTable ? "Hide" : "Show"}
            </button>
          </div>
          {showHistoryTable && (
            loading ? (
              <div className="p-6 text-center text-gray-500">Loading transfer history…</div>
            ) : transferHistory.length === 0 ? (
              <p className="text-gray-500 text-center">No transfer history found.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-3 text-left text-gray-700 font-semibold">Source</th>
                        <th className="p-3 text-left text-gray-700 font-semibold">Destination</th>
                        <th className="p-3 text-left text-gray-700 font-semibold">Product</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentEntries.map((transfer) => (
                        <tr key={transfer.id} className="border-t hover:bg-gray-50 transition">
                          <td className="p-3 text-gray-800">{transfer.source_store?.shop_name}</td>
                          <td className="p-3 text-gray-800">{transfer.destination_store?.shop_name}</td>
                          <td className="p-3 text-gray-800">
                            <button
                              onClick={() => openHistoryModal(transfer)}
                              className="text-indigo-600 hover:text-indigo-800 hover:underline focus:outline-none"
                              aria-label={`View details for ${transfer.product?.name}`}
                            >
                              {transfer.product?.name}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-row flex-wrap justify-between items-center mt-4 px-4 gap-4">
                  <div className="text-xs text-gray-600">
                    Showing {indexOfFirstEntry + 1} to {Math.min(indexOfLastEntry, transferHistory.length)} of {transferHistory.length} transactions
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => paginate(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`px-3 py-1 rounded-lg text-xs font-medium ${
                        currentPage === 1
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                      aria-label="Previous page"
                    >
                      Previous
                    </button>
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i + 1}
                        onClick={() => paginate(i + 1)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium ${
                          currentPage === i + 1
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                        aria-label={`Page ${i + 1}`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => paginate(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`px-3 py-1 rounded-lg text-xs font-medium ${
                        currentPage === totalPages
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                      aria-label="Next page"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )
          )}
        </div>
      )}

      {/* Transfer Modal */}
      {modalOpen && selectedProduct && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Transfer Stock (Immediate)</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Product</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded-lg bg-gray-100"
                  value={selectedProduct.dynamic_product?.name ?? `Product #${selectedProduct.dynamic_product_id}`}
                  disabled
                  aria-label="Product Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">From Store</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded-lg bg-gray-100"
                  value={stores.find((s) => String(s.id) === String(selectedStore))?.shop_name || ""}
                  disabled
                  aria-label="Source Store"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Destination Store</label>
                <select
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  value={destinationStore}
                  onChange={(e) => setDestinationStore(e.target.value)}
                  aria-label="Select Destination Store"
                >
                  <option value="">Select destination</option>
                  {stores
                    .filter((s) => String(s.id) !== String(selectedStore))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.shop_name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Quantity</label>
                <input
                  type="number"
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  min="1"
                  max={selectedProduct.available_qty}
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                  placeholder="Enter quantity"
                  aria-label="Transfer Quantity"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <button
                className="bg-gray-500 text-white p-2 rounded-lg hover:bg-gray-600 focus:ring-2 focus:ring-gray-500 transition transform hover:scale-105"
                onClick={closeModal}
                aria-label="Cancel"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 transition transform hover:scale-105"
                onClick={submitTransferRequest}
                aria-label="Transfer"
                disabled={loading}
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Details Modal */}
      {historyModalOpen && selectedTransfer && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Transfer Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Quantity</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded-lg bg-gray-100"
                  value={selectedTransfer.quantity}
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Worth</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded-lg bg-gray-100"
                  value={selectedTransfer.worth.toFixed(2)}
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded-lg bg-gray-100"
                  value={selectedTransfer.status}
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Requested At</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded-lg bg-gray-100"
                  value={new Date(selectedTransfer.requested_at).toLocaleString()}
                  disabled
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                className="bg-gray-500 text-white p-2 rounded-lg hover:bg-gray-600 focus:ring-2 focus:ring-gray-500 transition transform hover:scale-105"
                onClick={closeHistoryModal}
                aria-label="Close"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {(loading || loadingUser) && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-500"></div>
        </div>
      )}
    </div>
  );
}