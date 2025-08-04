import React, { useState, useEffect, useRef } from 'react';
import { supabase } from "../../supabaseClient";
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaDownload, FaQrcode, FaEdit } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

export default function ReceiptQRCode({ singleReceipt = null }) {
  const storeId = localStorage.getItem("store_id");
  const [store, setStore] = useState(null);
  const [saleGroupsList, setSaleGroupsList] = useState([]);
  const [selectedSaleGroup, setSelectedSaleGroup] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [filteredReceipts, setFilteredReceipts] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(singleReceipt);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ customer_name: "", customer_address: "", phone_number: "", warranty: "" });
  const [showSaleGroups, setShowSaleGroups] = useState(true);
  const [showReceipts,] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const itemsPerPage = 20;
  const saleGroupsPerPage = 20;
  const [headerBgColor] = useState('#1E3A8A');
  const [headerTextColor] = useState('#FFFFFF');
  const [headerFont] = useState('font-serif');
  const [bodyFont] = useState('font-sans');
  const [watermarkColor] = useState('rgba(30,58,138,0.1)');
  const printRef = useRef();
  const saleGroupsRef = useRef();
  const receiptsRef = useRef();

  const onboardingSteps = [
    { target: '.sales-search', content: 'Search for sale groups by ID, amount, or payment method.' },
    { target: '.sort-id', content: 'Sort sale groups by ID.' },
    { target: '.edit-receipt-0', content: 'Edit receipt details here.' },
    { target: '.generate-receipt-0', content: 'Generate or view the QR code for a receipt.' }
  ];

  const tooltipVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: { opacity: 1, y: 0 }
  };

  // Onboarding logic
  useEffect(() => {
    if (!localStorage.getItem('receiptManagerOnboardingCompleted')) {
      const timer = setTimeout(() => {
        setShowOnboarding(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Fetch store details
  useEffect(() => {
    if (!storeId) return;
    supabase
      .from("stores")
      .select("shop_name,business_address,phone_number,email_address")
      .eq("id", storeId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching store:', error);
          toast.error('Failed to fetch store details.');
        } else {
          setStore(data);
        }
      });
  }, [storeId]);

useEffect(() => {
  if (!storeId || singleReceipt) return;
  const fetchSaleGroups = async () => {
    const { data, error } = await supabase
      .from('sale_groups')
      .select(`
        id,
        store_id,
        total_amount,
        payment_method,
        created_at,
        customer_id,
        dynamic_sales (
          id,
          device_id,
          quantity,
          amount,
          sale_group_id,
          dynamic_product (
            id,
            name,
            selling_price,
            dynamic_product_imeis
          )
        )
      `)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching sale groups:', error);
      toast.error('Failed to fetch sale groups.');
      return;
    }
    setSaleGroupsList(data || []);
    // Automatically select the latest sale group if none is selected
    if (data.length > 0 && !selectedSaleGroup) {
      setSelectedSaleGroup(data[0]);
    }
  };

  fetchSaleGroups();

  // Subscribe to real-time inserts on sale_groups
  const subscription = supabase
    .channel('sale_groups_channel')
    .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'sale_groups', filter: `store_id=eq.${storeId}` },
      (payload) => {
        fetchSaleGroups();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}, [storeId, singleReceipt, selectedSaleGroup]);

useEffect(() => {
  if (!selectedSaleGroup) {
    setReceipts([]);
    return;
  }
  (async () => {
    let { data: receiptData } = await supabase
      .from("receipts")
      .select("*")
      .eq("sale_group_id", selectedSaleGroup.id)
      .order('id', { ascending: false });

    if (receiptData.length === 0 && selectedSaleGroup.dynamic_sales?.length > 0) {
      const firstSale = selectedSaleGroup.dynamic_sales[0];
      const totalQuantity = selectedSaleGroup.dynamic_sales.reduce((sum, sale) => sum + sale.quantity, 0);
      const totalAmount = selectedSaleGroup.dynamic_sales.reduce((sum, sale) => sum + sale.amount, 0);

      let customer_name = "";
      let phone_number = "";
      let customer_address = "";
      if (selectedSaleGroup.customer_id) {
        const { data: customer, error: customerError } = await supabase
          .from("customer")
          .select("fullname, phone_number, address")
          .eq("id", selectedSaleGroup.customer_id)
          .single();
        if (customerError) {
          console.error('Error fetching customer:', customerError);
          toast.error('Failed to fetch customer details.');
        } else {
          customer_name = customer.fullname || "";
          phone_number = customer.phone_number || "";
          customer_address = customer.address || "";
        }
      }

      const receiptInsert = {
        store_receipt_id: selectedSaleGroup.store_id,
        sale_group_id: selectedSaleGroup.id,
        product_id: firstSale.dynamic_product.id,
        sales_amount: totalAmount,
        sales_qty: totalQuantity,
        product_name: firstSale.dynamic_product.name,
        device_id: firstSale.device_id || null,
        customer_name,
        customer_address,
        phone_number,
        warranty: "",
        date: new Date(selectedSaleGroup.created_at).toISOString(),
        receipt_id: `RCPT-${selectedSaleGroup.id}-${Date.now()}`
      };

      const { data: newReceipt, error } = await supabase
        .from("receipts")
        .insert([receiptInsert])
        .select()
        .single();
      if (error) {
        console.error('Error creating receipt:', error);
        toast.error('Failed to create receipt.');
        return;
      }
      receiptData = [newReceipt];
    }

    if (receiptData.length > 1) {
      const [latestReceipt] = receiptData;
      await supabase
        .from("receipts")
        .delete()
        .eq("sale_group_id", selectedSaleGroup.id)
        .neq("id", latestReceipt.id);
      receiptData = [latestReceipt];
    }

    setReceipts(receiptData || []);
    setSelectedReceipt(receiptData[0] || null);
  })();
}, [selectedSaleGroup]);



  // Filter receipts based on search term
  useEffect(() => {
    const term = searchTerm.toLowerCase();
    const dateStr = selectedSaleGroup ? new Date(selectedSaleGroup.created_at).toLocaleDateString().toLowerCase() : '';
    setFilteredReceipts(
      receipts.filter(r => {
        const fields = [
          r.receipt_id,
          String(r.sale_group_id),
          r.product_name,
          String(r.sales_qty),
          r.device_id,
          r.sales_amount != null ? `₦${r.sales_amount.toFixed(2)}` : '',
          r.customer_name,
          r.customer_address,
          r.phone_number,
          r.warranty,
          dateStr
        ];
        return fields.some(f => f?.toString().toLowerCase().includes(term));
      })
    );
    setCurrentPage(1);
  }, [searchTerm, receipts, selectedSaleGroup]);

  // Smooth scrolling for sale groups and receipts
  useEffect(() => {
    if (saleGroupsRef.current && showSaleGroups) {
      saleGroupsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [saleGroupsList, showSaleGroups]);

  useEffect(() => {
    if (receiptsRef.current && showReceipts) {
      receiptsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [receipts, showReceipts]);

  const handleNextStep = () => {
    if (onboardingStep < onboardingSteps.length - 1) {
      setOnboardingStep(onboardingStep + 1);
    } else {
      setShowOnboarding(false);
      localStorage.setItem('receiptManagerOnboardingCompleted', 'true');
    }
  };

  const handleSkipOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('receiptManagerOnboardingCompleted', 'true');
  };

  const getTooltipPosition = (target) => {
    const element = document.querySelector(target);
    if (!element) return { top: 0, left: 0 };
    const rect = element.getBoundingClientRect();
    return {
      top: rect.bottom + window.scrollY + 10,
      left: rect.left + window.scrollX,
    };
  };

  const getProductGroups = () => {
    if (!selectedSaleGroup || !selectedSaleGroup.dynamic_sales) return [];

    const productMap = new Map();
    selectedSaleGroup.dynamic_sales.forEach(sale => {
      const product = sale.dynamic_product;
      const deviceIds = sale.device_id?.split(',').filter(id => id.trim()) || [];
      const quantity = sale.quantity;
      const unitPrice = sale.amount / sale.quantity;
      const totalAmount = sale.amount;

      if (!productMap.has(product.id)) {
        productMap.set(product.id, {
          productId: product.id,
          productName: product.name,
          deviceIds,
          quantity,
          unitPrice,
          totalAmount,
          sellingPrice: product.selling_price || unitPrice
        });
      } else {
        const existing = productMap.get(product.id);
        existing.deviceIds = [...new Set([...existing.deviceIds, ...deviceIds])];
        existing.quantity += quantity;
        existing.totalAmount += totalAmount;
      }
    });

    return Array.from(productMap.values());
  };

  const productGroups = getProductGroups();
  const totalQuantity = productGroups.reduce((sum, group) => sum + group.quantity, 0);
  const totalAmount = productGroups.reduce((sum, group) => sum + group.totalAmount, 0);

  const generatePDF = async () => {
    const element = printRef.current;
    if (!element) {
      toast.error('Receipt content not found.');
      return;
    }

    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      const { width, height } = canvas;

      const pdfWidth = 595;
      const pdfHeight = 842;
      const aspectRatio = width / height;
      let newWidth = pdfWidth;
      let newHeight = pdfWidth / aspectRatio;

      if (newHeight > pdfHeight) {
        newHeight = pdfHeight;
        newWidth = pdfHeight * aspectRatio;
      }

      const pdf = new jsPDF({
        orientation: newWidth > newHeight ? 'landscape' : 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, newWidth, newHeight);
      pdf.save(`receipt-${selectedReceipt?.receipt_id}.pdf`);
      toast.success('Receipt downloaded successfully!');
    } catch (error) {
      console.error('Generate PDF error:', error);
      toast.error('Failed to generate PDF.');
    }
  };

  const handleViewQRCode = (receipt) => {
    setSelectedReceipt(receipt);
    setSelectedSaleGroup(receipt.sale_groups);
  };

  const openEdit = (receipt) => {
    setEditing(receipt);
    setForm({
      customer_name: receipt.customer_name || "",
      customer_address: receipt.customer_address || "",
      phone_number: receipt.phone_number || "",
      warranty: receipt.warranty || ""
    });
  };

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

 const saveReceipt = async () => {
  try {
    if (!selectedSaleGroup.customer_id) {
      toast.error('No customer associated with this sale group.');
      return;
    }

    // Update customer table with fullname, phone_number, and address
    const { error: customerError } = await supabase
      .from("customer")
      .update({
        fullname: form.customer_name,
        phone_number: form.phone_number,
        address: form.customer_address
      })
      .eq("id", selectedSaleGroup.customer_id);
    if (customerError) {
      console.error('Error updating customer:', customerError);
      throw new Error('Failed to update customer details.');
    }

    // Update receipts table with warranty and mirrored customer details
    const { error: receiptError } = await supabase
      .from("receipts")
      .update({
        customer_name: form.customer_name,
        customer_address: form.customer_address,
        phone_number: form.phone_number,
        warranty: form.warranty
      })
      .eq("id", editing.id);
    if (receiptError) {
      console.error('Error updating receipt:', receiptError);
      throw new Error('Failed to update receipt.');
    }

    // Refresh receipts
    const { data } = await supabase
      .from("receipts")
      .select("*")
      .eq("sale_group_id", selectedSaleGroup.id)
      .order('id', { ascending: false });
    setReceipts(data);
    setEditing(null);
    setForm({ customer_name: "", customer_address: "", phone_number: "", warranty: "" });
    toast.success('Receipt updated successfully!');
  } catch (error) {
    console.error('Error updating receipt:', error);
    toast.error(error.message);
  }
};

  const qrCodeUrl = selectedReceipt ? `${window.location.origin}/receipt/${selectedReceipt.receipt_id}` : '';

  const totalPages = Math.ceil(filteredReceipts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedReceipts = filteredReceipts.slice(startIndex, endIndex);

  const filteredSaleGroups = saleGroupsList.filter(sg => {
    const term = searchTerm.toLowerCase();
    const fields = [
      `#${sg.id}`,
      `₦${sg.total_amount.toFixed(2)}`,
      sg.payment_method,
      new Date(sg.created_at).toLocaleString().toLowerCase()
    ];
    return fields.some(f => f.toLowerCase().includes(term));
  });

  const totalSaleGroupsPages = Math.ceil(filteredSaleGroups.length / saleGroupsPerPage);
  const startSaleGroupsIndex = (currentPage - 1) * saleGroupsPerPage;
  const endSaleGroupsIndex = startSaleGroupsIndex + saleGroupsPerPage;
  const paginatedSaleGroups = filteredSaleGroups.slice(startSaleGroupsIndex, endSaleGroupsIndex);

  const handleSaleGroupsPageChange = (page) => {
    if (page >= 1 && page <= totalSaleGroupsPages) {
      setCurrentPage(page);
    }
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const printStyles = `
    @media print {
      body * { visibility: hidden; }
      .printable-area, .printable-area * { visibility: visible; }
      .printable-area { position: absolute; top:0; left:0; width:100%; }
      .printable-area table { page-break-inside: auto; }
      .printable-area tr { page-break-inside: avoid; break-inside: avoid; }
      .sm\\:hidden { display: none; }
      .sm\\:table-row { display: table-row; }
      .sm\\:table-cell { display: table-cell; }
    }
  `;

  return (
    <>
      <style>{printStyles}</style>
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="p-4 sm:p-6 space-y-6 dark:bg-gray-900 dark:text-white">
        {!singleReceipt && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">Store Receipts</h2>
              <button
                onClick={() => setShowSaleGroups(!showSaleGroups)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base"
              >
                {showSaleGroups ? 'Hide Sale Groups' : 'Show Sale Groups'}
              </button>
            </div>
            <div className="mb-6">
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by Sale Group ID, Amount, Payment Method, or Receipt Details"
                className="flex-1 border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white sales-search"
              />
            </div>
            <AnimatePresence>
              {showSaleGroups && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div ref={saleGroupsRef} className="overflow-x-auto rounded-lg shadow">
                    <table className="min-w-full text-xs sm:text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <thead className="bg-gray-100 dark:bg-gray-700">
                        <tr>
                          <th className="text-left px-4 sm:px-6 py-2 sm:py-3 font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600 sort-id">Sale Group ID</th>
                          <th className="text-left px-4 sm:px-6 py-2 sm:py-3 font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600">Total Amount</th>
                          <th className="text-left px-4 sm:px-6 py-2 sm:py-3 font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600">Payment Method</th>
                          <th className="text-left px-4 sm:px-6 py-2 sm:py-3 font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedSaleGroups.map(sg => (
                          <tr
                            key={sg.id}
                            onClick={() => setSelectedSaleGroup(sg)}
                            className={`cursor-pointer transition-colors ${
                              selectedSaleGroup?.id === sg.id ? 'bg-indigo-50 dark:bg-gray-600' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                            } even:bg-gray-50 dark:even:bg-gray-800`}
                          >
                            <td className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">#{sg.id}</td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">₦{sg.total_amount.toFixed(2)}</td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">{sg.payment_method}</td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">{new Date(sg.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                        {paginatedSaleGroups.length === 0 && (
                          <tr>
                            <td colSpan="4" className="text-center text-gray-500 dark:text-gray-400 py-6">
                              No sale groups found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {filteredSaleGroups.length > saleGroupsPerPage && (
                    <div className="flex items-center justify-between mt-4">
                      <button
                        onClick={() => handleSaleGroupsPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                      >
                        Previous
                      </button>
                      <div className="flex gap-2">
                        {Array.from({ length: totalSaleGroupsPages }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => handleSaleGroupsPageChange(page)}
                            className={`px-3 py-1 rounded-lg ${
                              currentPage === page
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => handleSaleGroupsPageChange(currentPage + 1)}
                        disabled={currentPage === totalSaleGroupsPages}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            {selectedSaleGroup && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden mt-6"
              >
                <div ref={receiptsRef} className="overflow-x-auto rounded-lg shadow">
                  <table className="min-w-full text-xs sm:text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                      <tr>
                        <th className="text-left px-4 sm:px-6 py-2 sm:py-3 font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600">Receipt ID</th>
                        <th className="text-left px-4 sm:px-6 py-2 sm:py-3 font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600">Customer</th>
                        <th className="text-left px-4 sm:px-6 py-2 sm:py-3 font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600">Phone</th>
                        <th className="text-left px-4 sm:px-6 py-2 sm:py-3 font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600">Warranty</th>
                        <th className="text-left px-4 sm:px-6 py-2 sm:py-3 font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600">Date</th>
                        <th className="text-left px-4 sm:px-6 py-2 sm:py-3 font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedReceipts.map((receipt, index) => (
                        <tr
                          key={receipt.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700 even:bg-gray-50 dark:even:bg-gray-800 transition-colors"
                        >
                          <td className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 truncate">{receipt.receipt_id}</td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 truncate">{receipt.customer_name || '-'}</td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 truncate">{receipt.phone_number || '-'}</td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 truncate">{receipt.warranty || '-'}</td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">{new Date(receipt.date).toLocaleDateString()}</td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex gap-4">
                              <button
                                onClick={() => openEdit(receipt)}
                                className={`text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 edit-receipt-${index}`}
                              >
                                <FaEdit />
                              </button>
                              <button
                                onClick={() => handleViewQRCode(receipt)}
                                className={`text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 flex items-center gap-2 generate-receipt-${index}`}
                              >
                                <FaQrcode /> View QR Code
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {paginatedReceipts.length === 0 && (
                        <tr>
                          <td colSpan="6" className="text-center text-gray-500 dark:text-gray-400 py-6">
                            No receipts found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {filteredReceipts.length > itemsPerPage && (
                  <div className="flex items-center justify-between mt-4">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                    >
                      Previous
                    </button>
                    <div className="flex gap-2">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`px-3 py-1 rounded-lg ${
                            currentPage === page
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      Next
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}
        {(selectedReceipt || singleReceipt) && (
          <div className={singleReceipt ? "p-4 sm:p-6 space-y-6 dark:bg-gray-900 dark:text-white w-full" : "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6 overflow-auto"}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-[95vw] sm:max-w-3xl flex flex-col max-h-[90vh]">
              {!singleReceipt && (
                <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">Receipt QR Code</h2>
                  <button
                    onClick={() => setSelectedReceipt(null)}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm sm:text-base"
                  >
                    Close
                  </button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="flex flex-col items-center gap-4 mb-6">
                  <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base text-center">
                    Scan the QR code below to view and download the receipt.
                  </p>
                  <QRCodeCanvas value={qrCodeUrl} size={150} className="w-[120px] sm:w-[150px] h-auto" />
                  <button
                    onClick={generatePDF}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm sm:text-base"
                  >
                    <FaDownload /> Download Receipt
                  </button>
                </div>
                <div ref={printRef} className="printable-area relative bg-white p-4 sm:p-6 shadow-lg rounded-lg w-full">
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ color: watermarkColor, fontSize: '2rem sm:4rem', opacity: 0.1 }}>
                    <span className={`${bodyFont}`}>{store?.shop_name || '-'}</span>
                  </div>
                  <div className={`p-3 sm:p-4 rounded-t ${headerFont}`} style={{ backgroundColor: headerBgColor, color: headerTextColor }}>
                    <h1 className="text-lg sm:text-2xl font-bold">{store?.shop_name || '-'}</h1>
                    <p className="text-xs sm:text-sm">{store?.business_address || '-'}</p>
                    <p className="text-xs sm:text-sm">Phone: {store?.phone_number || '-'}</p>
                    <p className="text-xs sm:text-sm">Email: {store?.email_address || '-'}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className={`w-full border-none mb-4 mt-4 ${bodyFont} text-xs sm:text-sm`}>
                      <thead>
                        <tr className="hidden sm:table-row">
                          <th className="border px-2 sm:px-4 py-1 sm:py-2 text-left">Product</th>
                          <th className="border px-2 sm:px-4 py-1 sm:py-2 text-left">Device ID</th>
                          <th className="border px-2 sm:px-4 py-1 sm:py-2 text-left">Qty</th>
                          <th className="border px-2 sm:px-4 py-1 sm:py-2 text-left">Unit Price</th>
                          <th className="border px-2 sm:px-4 py-1 sm:py-2 text-left">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productGroups.map((group, index) => (
                          <React.Fragment key={group.productId}>
                            <tr className="flex flex-col sm:table-row border-b sm:border-b-0 sm:bg-indigo-50 sm:dark:bg-gray-800">
                              <td className="border-b px-2 sm:px-4 py-1 sm:py-2 font-bold sm:font-normal flex sm:table-cell sm:border-b">
                                <span className="sm:hidden font-semibold mr-2">Product:</span>
                                {group.productName}
                              </td>
                              <td className="border-b px-2 sm:px-4 py-1 sm:py-2 sm:pl-6 flex sm:table-cell sm:border-b">
                                <span className="sm:hidden font-semibold mr-2">Device ID:</span>
                                {group.deviceIds.length > 0 ? group.deviceIds.join(', ') : '-'}
                              </td>
                              <td className="border-b px-2 sm:px-4 py-1 sm:py-2 flex sm:table-cell sm:border-b">
                                <span className="sm:hidden font-semibold mr-2">Quantity:</span>
                                {group.quantity}
                              </td>
                              <td className="border-b px-2 sm:px-4 py-1 sm:py-2 flex sm:table-cell sm:border-b">
                                <span className="sm:hidden font-semibold mr-2">Unit Price:</span>
                                ₦{group.unitPrice.toFixed(2)}
                              </td>
                              <td className="border-b px-2 sm:px-4 py-1 sm:py-2 flex sm:table-cell sm:border-b">
                                <span className="sm:hidden font-semibold mr-2">Amount:</span>
                                ₦{group.totalAmount.toFixed(2)}
                              </td>
                            </tr>
                          </React.Fragment>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="flex flex-col sm:table-row">
                          <td colSpan="2" className="border px-2 sm:px-4 py-1 sm:py-2 text-right font-bold flex sm:table-cell sm:border-b">
                            <span className="sm:hidden font-semibold mr-2">Total:</span>
                          </td>
                          <td className="border px-2 sm:px-4 py-1 sm:py-2 flex sm:table-cell sm:border-b">
                            <span className="sm:hidden font-semibold mr-2">Total Quantity:</span>
                            {totalQuantity}
                          </td>
                          <td className="border px-2 sm:px-4 py-1 sm:py-2 flex sm:table-cell sm:border-b"></td>
                          <td className="border px-2 sm:px-4 py-1 sm:py-2 font-bold flex sm:table-cell sm:border-b">
                            <span className="sm:hidden font-semibold mr-2">Total Amount:</span>
                            ₦{totalAmount.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="mt-4 space-y-2 text-xs sm:text-sm">
                    <p><strong>Receipt ID:</strong> {selectedReceipt.receipt_id}</p>
                    <p><strong>Date:</strong> {new Date(selectedSaleGroup?.created_at).toLocaleString()}</p>
                    <p><strong>Payment Method:</strong> {selectedSaleGroup?.payment_method}</p>
                    <p><strong>Customer Name:</strong> {selectedReceipt.customer_name || '-'}</p>
                    <p><strong>Address:</strong> {selectedReceipt.customer_address || '-'}</p>
                    <p><strong>Phone:</strong> {selectedReceipt.phone_number || '-'}</p>
                    <p><strong>Warranty:</strong> {selectedReceipt.warranty || '-'}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 p-4 mt-4">
                    <div className="border-t text-center pt-2 text-xs sm:text-sm">Manager Signature</div>
                    <div className="border-t text-center pt-2 text-xs sm:text-sm">Customer Signature</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {editing && (
          <div className="fixed inset-0 bg-black bg-opacity_priv-0 flex items-start justify-center p-4 z-50 overflow-auto mt-10">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-8 space-y-6">
              <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-white">Edit Receipt {editing.receipt_id}</h2>
              <div className="space-y-4">
                {['customer_name', 'customer_address', 'phone_number', 'warranty'].map(field => (
                  <label key={field} className="block">
                    <span className="font-semibold text-gray-700 dark:text-gray-200 capitalize block mb-1">
                      {field.replace('_', ' ')}
                    </span>
                    <input
                      name={field}
                      value={form[field]}
                      onChange={handleChange}
                      className="border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:text-white"
                    />
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setEditing(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700">Cancel</button>
                <button onClick={saveReceipt} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-between gap-2">
                  <FaDownload /> Save Receipt
                </button>
              </div>
            </div>
          </div>
        )}
        {showOnboarding && (
          <motion.div
            className="fixed z-50 bg-indigo-600 text-white p-4 rounded-lg shadow-lg"
            style={getTooltipPosition(onboardingSteps[onboardingStep].target)}
            variants={tooltipVariants}
            initial="hidden"
            animate="visible"
          >
            <p>{onboardingSteps[onboardingStep].content}</p>
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={handleSkipOnboarding} className="text-sm underline">Skip</button>
              <button onClick={handleNextStep} className="bg-white text-indigo-600 px-3 py-1 rounded-lg">
                {onboardingStep < onboardingSteps.length - 1 ? 'Next' : 'Finish'}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </>
  );
}