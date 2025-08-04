import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import {
  FaEdit,
  FaFileCsv,
  FaFilePdf,
  FaPlus,
  FaCamera,
} from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { motion } from 'framer-motion';
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScannerState } from 'html5-qrcode';



const tooltipVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function DynamicProducts() {
  const storeId = localStorage.getItem('store_id');

  // State
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState([{
    name: '',
    description: '',
    purchase_price: '',
    purchase_qty: '',
    selling_price: '',
    suppliers_name: '',
    device_id: '',
  }]);
  const [currentPage, setCurrentPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerTarget, setScannerTarget] = useState(null); // { modal: 'add'|'edit', productIndex: number }
  const [scannerError, setScannerError] = useState(null);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [externalScannerMode, setExternalScannerMode] = useState(false);
  const [scannerBuffer, setScannerBuffer] = useState('');
  const [lastKeyTime, setLastKeyTime] = useState(0);
  const [scanSuccess, setScanSuccess] = useState(false);

  const videoRef = useRef(null);
  const scannerDivRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const manualInputRef = useRef(null);

  const itemsPerPage = 20;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage]);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  // Onboarding steps
  const onboardingSteps = [
    {
      target: '.add-product-button',
      content: 'Click to add a new product to your catalog.',
    },
    {
      target: '.search-input',
      content: 'Search by product name to filter the catalog.',
    },
    {
      target: products.length > 0 ? '.edit-button-0' : '.add-product-button',
      content: products.length > 0 ? 'Click to edit product details.' : 'Start by adding your first product!',
    },
  ];




useEffect(() => {
  const successAudio = new Audio('https://freesound.org/data/previews/171/171671_2437358-lq.mp3');
  const notFoundAudio = new Audio('https://freesound.org/data/previews/171/17167_2437358-lq.mp3');
  
  // Preload by setting volume to 0 and playing briefly
  successAudio.volume = 0;
  notFoundAudio.volume = 0;
  successAudio.play().catch(err => console.error('Preload success audio error:', err));
  notFoundAudio.play().catch(err => console.error('Preload not found audio error:', err));
  successAudio.pause();
  notFoundAudio.pause();
  successAudio.volume = 1;
  notFoundAudio.volume = 1;
}, []);

// Modified playSuccessSound function
const playSuccessSound = () => {
  const audio = new Audio('https://freesound.org/data/previews/171/171671_2437358-lq.mp3');
  audio.play().catch((err) => console.error('Audio play error:', err));
};

// Modified playNotFoundSound function
const playNotFoundSound = () => {
  const audio = new Audio('https://freesound.org/data/previews/171/17167_2437358-lq.mp3');
  audio.play().catch((err) => console.error('Audio play error:', err));
};


  // Check if onboarding has been completed
  useEffect(() => {
    if (!localStorage.getItem('productCatalogOnboardingCompleted')) {
      const timer = setTimeout(() => {
        setShowOnboarding(true);
      }, 3000); // 3-second delay
      return () => clearTimeout(timer);
    }
  }, []);

  // Auto-focus manual input
  useEffect(() => {
    if (showScanner && manualInputRef.current) {
      manualInputRef.current.focus();
    }
  }, [showScanner]);

  // Process scanned barcode
  const processScannedBarcode = useCallback((scannedCode) => {
    const trimmedCode = scannedCode.trim();
    console.log('Processing barcode:', { trimmedCode });

    if (!trimmedCode) {
      toast.error('Invalid barcode: Empty value');
      setScannerError('Invalid barcode: Empty value');
      return false;
    }

    if (scannerTarget) {
      const { modal, productIndex } = scannerTarget;
      let updatedForm;

      if (modal === 'add') {
        // Check for duplicates in addForm
        if (addForm.some((p, i) => i !== productIndex && p.device_id.trim().toLowerCase() === trimmedCode.toLowerCase())) {
          toast.error(`Barcode "${trimmedCode}" already exists in another product`);
          setScannerError(`Barcode "${trimmedCode}" already exists`);
          return false;
        }
        // Check for duplicates in database
        const checkDuplicate = async () => {
          const { data: existingProducts, error } = await supabase
            .from('dynamic_product')
            .select('device_id')
            .eq('store_id', storeId)
            .neq('device_id', '');
          if (error) {
            console.error('Error checking duplicates:', error);
            toast.error('Failed to check for duplicate barcodes');
            return false;
          }
          if (existingProducts.some(p => p.device_id.trim().toLowerCase() === trimmedCode.toLowerCase())) {
            toast.error(`Barcode "${trimmedCode}" already exists in the database`);
            setScannerError(`Barcode "${trimmedCode}" already exists`);
            return false;
          }
          return true;
        };

        checkDuplicate().then(isValid => {
          if (!isValid) return;
          updatedForm = [...addForm];
          updatedForm[productIndex].device_id = trimmedCode;
          setAddForm(updatedForm);
          // Add new line item
          setAddForm(prev => [...prev, {
            name: '',
            description: '',
            purchase_price: '',
            purchase_qty: '',
            selling_price: '',
            suppliers_name: '',
            device_id: '',
          }]);

          
          setScannerTarget({ modal: 'add', productIndex: updatedForm.length });
          setScannerError(null);
          setScanSuccess(true);
          playSuccessSound();
          setTimeout(() => setScanSuccess(false), 1000);
          setManualInput('');
          if (manualInputRef.current) {
            manualInputRef.current.focus();
          }
        });



      } else if (modal === 'edit') {
        // Check for duplicates in database excluding current product
        const checkDuplicate = async () => {
          const { data: existingProducts, error } = await supabase
            .from('dynamic_product')
            .select('device_id')
            .eq('store_id', storeId)
            .neq('id', editing.id)
            .neq('device_id', '');
          if (error) {
            console.error('Error checking duplicates:', error);
            toast.error('Failed to check for duplicate barcodes');
            return false;
          }
          if (existingProducts.some(p => p.device_id.trim().toLowerCase() === trimmedCode.toLowerCase())) {
            toast.error(`Barcode "${trimmedCode}" already exists in another product`);
            setScannerError(`Barcode "${trimmedCode}" already exists`);
            return false;
          }
          return true;
        };

        checkDuplicate().then(isValid => {
          if (!isValid) return;
          setForm(prev => ({ ...prev, device_id: trimmedCode }));
          setScannerError(null);
          setScanSuccess(true);
          playSuccessSound();
          setTimeout(() => setScanSuccess(false), 1000);
          setManualInput('');
          if (manualInputRef.current) {
            manualInputRef.current.focus();
          }
        });
      }
      return true;
    }
    return false;
  }, [scannerTarget, addForm, editing, storeId]);

  // External scanner input
  useEffect(() => {
    if (!externalScannerMode || !scannerTarget || !showScanner) return;

    const handleKeypress = (e) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;

      if (timeDiff > 50 && scannerBuffer) {
        setScannerBuffer('');
      }

      if (e.key === 'Enter' && scannerBuffer) {
        const success = processScannedBarcode(scannerBuffer);
        if (success) {
          setScannerBuffer('');
          setManualInput('');
          if (manualInputRef.current) {
            manualInputRef.current.focus();
          }
        }
      } else if (e.key !== 'Enter') {
        setScannerBuffer((prev) => prev + e.key);
      }

      setLastKeyTime(currentTime);
    };

    document.addEventListener('keypress', handleKeypress);

    return () => {
      document.removeEventListener('keypress', handleKeypress);
    };
  }, [externalScannerMode, scannerTarget, scannerBuffer, lastKeyTime, showScanner, processScannedBarcode]);

  // Webcam scanner
  useEffect(() => {
    if (!showScanner || !scannerDivRef.current || !videoRef.current || externalScannerMode) return;

    setScannerLoading(true);
    setScanSuccess(false);

    const videoElement = videoRef.current;
    let html5QrCodeInstance = null;

    try {
      if (!document.getElementById('scanner')) {
        console.error('Scanner div not found in DOM');
        setScannerError('Scanner container not found. Please use manual input.');
        setScannerLoading(false);
        toast.error('Scanner container not found. Please use manual input.');
        return;
      }

      html5QrCodeInstance = new Html5Qrcode('scanner');
      html5QrCodeRef.current = html5QrCodeInstance;
    } catch (err) {
      console.error('Failed to create Html5Qrcode instance:', err);
      setScannerError(`Failed to initialize scanner: ${err.message}`);
      setScannerLoading(false);
      toast.error('Failed to initialize scanner. Please use manual input.');
      return;
    }

   const config = {
     fps: 60, // High FPS for instant detection
     qrbox: { width: 250, height: 125 }, // Smaller qrbox for faster focus
     formatsToSupport: [
       Html5QrcodeSupportedFormats.CODE_128,
       Html5QrcodeSupportedFormats.CODE_39,
       Html5QrcodeSupportedFormats.EAN_13,
       Html5QrcodeSupportedFormats.UPC_A,
       Html5QrcodeSupportedFormats.QR_CODE,
     ],
     aspectRatio: 1.0, // Square for better alignment
     disableFlip: true,
     videoConstraints: { width: 1280, height: 720, facingMode: 'environment' }, // Higher resolution
   };
   
    const onScanSuccess = (decodedText) => {
      const success = processScannedBarcode(decodedText);
      if (success) {
        setScanSuccess(true);
        playSuccessSound();
        setTimeout(() => setScanSuccess(false), 1000);
        setManualInput('');
        if (manualInputRef.current) {
          manualInputRef.current.focus();
        }
      }
    };

const onScanFailure = (error) => {
  if (
    error.includes('No MultiFormat Readers were able to detect the code') ||
    error.includes('No QR code found') ||
    error.includes('IndexSizeError')
  ) {
    console.debug('No barcode detected in frame');
  } else {
    console.error('Scan error:', error);
   playNotFoundSound();
    setScannerError(`Scan error: ${error}. Adjust lighting or distance.`);
  }
};

    const startScanner = async (attempt = 1, maxAttempts = 3) => {
      if (!videoElement || !scannerDivRef.current) {
        setScannerError('Scanner elements not found');
        setScannerLoading(false);
        toast.error('Scanner elements not found. Please use manual input.');
        return;
      }
      if (attempt > maxAttempts) {
        setScannerError('Failed to initialize scanner after multiple attempts');
        setScannerLoading(false);
        toast.error('Failed to initialize scanner. Please use manual input.');
        return;
      }
      try {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              ...config.videoConstraints,
              advanced: [{ focusMode: 'continuous' }],
            },
          });
        } catch (err) {
          console.warn('Rear camera with autofocus failed, trying fallback:', err);
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          });
        }
        videoElement.srcObject = stream;
        await new Promise((resolve) => {
          videoElement.onloadedmetadata = () => resolve();
        });
        await html5QrCodeInstance.start(
          config.videoConstraints,
          config,
          onScanSuccess,
          onScanFailure
        );
        setScannerLoading(false);
      } catch (err) {
        console.error('Scanner initialization error:', err);
        setScannerError(`Failed to initialize scanner: ${err.message}`);
        setScannerLoading(false);
        if (err.name === 'NotAllowedError') {
          toast.error('Camera access denied. Please allow camera permissions.');
        } else if (err.name === 'NotFoundError') {
          toast.error('No camera found. Please use manual input.');
        } else if (err.name === 'OverconstrainedError') {
          toast.error('Camera constraints not supported. Trying fallback...');
          setTimeout(() => startScanner(attempt + 1, maxAttempts), 200);
        } else {
          toast.error('Failed to start camera. Please use manual input.');
        }
      }
    };

    Html5Qrcode.getCameras()
      .then((cameras) => {
        if (cameras.length === 0) {
          setScannerError('No cameras detected. Please use manual input.');
          setScannerLoading(false);
          toast.error('No cameras detected. Please use manual input.');
          return;
        }
        startScanner();
      })
      .catch((err) => {
        console.error('Error listing cameras:', err);
        setScannerError(`Failed to access cameras: ${err.message}`);
        setScannerLoading(false);
        toast.error('Failed to access cameras. Please use manual input.');
      });

    return () => {
      if (html5QrCodeInstance && 
          [Html5QrcodeScannerState.SCANNING, Html5QrcodeScannerState.PAUSED].includes(
            html5QrCodeInstance.getState()
          )) {
        html5QrCodeInstance
          .stop()
          .then(() => console.log('Webcam scanner stopped successfully'))
          .catch((err) => console.error('Error stopping scanner:', err));
      }
      if (videoElement && videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach((track) => {
          track.stop();
        });
        videoElement.srcObject = null;
      }
      html5QrCodeRef.current = null;
    };
  }, [showScanner, externalScannerMode, processScannedBarcode]);

  // Stop scanner
  const stopScanner = useCallback(() => {
    if (html5QrCodeRef.current && 
        [Html5QrcodeScannerState.SCANNING, Html5QrcodeScannerState.PAUSED].includes(
          html5QrCodeRef.current.getState()
        )) {
      html5QrCodeRef.current
        .stop()
        .then(() => console.log('Scanner stopped successfully'))
        .catch((err) => console.error('Error stopping scanner:', err));
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => {
        track.stop();
      });
      videoRef.current.srcObject = null;
    }
    html5QrCodeRef.current = null;
  }, []);

  // Open scanner
  const openScanner = (modal, productIndex) => {
    setScannerTarget({ modal, productIndex });
    setShowScanner(true);
    setScannerError(null);
    setScannerLoading(true);
    setManualInput('');
    setExternalScannerMode(false);
    setScannerBuffer('');
  };

  // Handle manual input
  const handleManualInput = () => {
    const trimmedInput = manualInput.trim();
    const success = processScannedBarcode(trimmedInput);
    if (success) {
      setManualInput('');
      if (manualInputRef.current) {
        manualInputRef.current.focus();
      }
    }
  };

  // Handle Enter key for manual input
  const handleManualInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleManualInput();
    }
  };

  // Fetch products
  const fetchProducts = useCallback(async () => {
    if (!storeId) {
      toast.error('No store ID found. Please log in.');
      return;
    }
    const { data, error } = await supabase
      .from('dynamic_product')
      .select('id, name, description, purchase_price, purchase_qty, selling_price, suppliers_name, device_id, created_at')
      .eq('store_id', storeId)
      .order('id', { ascending: true });
    if (error) {
      console.error('Error fetching products:', error.message);
      toast.error('Failed to fetch products');
    } else {
      setProducts(data);
      setFiltered(data);
    }
  }, [storeId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Search filter
  useEffect(() => {
    if (!search) setFiltered(products);
    else {
      const q = search.toLowerCase();
      setFiltered(products.filter(p => p.name.toLowerCase().includes(q) || p.device_id.toLowerCase().includes(q)));
    }
    setCurrentPage(1);
  }, [search, products]);

  // Add product handlers
  const handleAddChange = (e, index) => {
    const { name, value } = e.target;
    setAddForm(prev => {
      const newForm = [...prev];
      if (name === 'device_id' && value.trim()) {
        // Check for duplicates in addForm
        if (newForm.some((p, i) => i !== index && p.device_id.trim().toLowerCase() === value.trim().toLowerCase())) {
          toast.error(`Barcode "${value.trim()}" already exists in another product`);
          return newForm;
        }
      }
      newForm[index][name] = value;
      return newForm;
    });
  };

  const removeProduct = (index) => {
    setAddForm(prev => prev.filter((_, i) => i !== index));
  };

  const addAnotherProduct = () => {
    setAddForm(prev => [...prev, {
      name: '',
      description: '',
      purchase_price: '',
      purchase_qty: '',
      selling_price: '',
      suppliers_name: '',
      device_id: '',
    }]);
  };

  const createProducts = async (e) => {
    e.preventDefault();
    if (addForm.length === 0) {
      toast.error('Please add at least one product');
      return;
    }
    const isValid = addForm.every(product =>
      product.name && product.purchase_qty
    );
    if (!isValid) {
      toast.error('Please fill all required fields for each product');
      return;
    }
    // Check for duplicate device_ids
    const allDeviceIds = addForm
      .filter(p => p.device_id.trim())
      .map(p => p.device_id.trim().toLowerCase());
    const uniqueDeviceIds = new Set(allDeviceIds);
    if (uniqueDeviceIds.size < allDeviceIds.length) {
      toast.error('Duplicate barcodes detected within the new products');
      return;
    }
    // Check for duplicates in database
    const { data: existingProducts, error: fetchError } = await supabase
      .from('dynamic_product')
      .select('device_id')
      .eq('store_id', storeId)
      .neq('device_id', '');
    if (fetchError) {
      console.error('Error checking duplicates:', fetchError);
      toast.error('Failed to check for duplicate barcodes');
      return;
    }
    const duplicates = allDeviceIds.filter(id => existingProducts.some(p => p.device_id.trim().toLowerCase() === id));
    if (duplicates.length > 0) {
      toast.error(`Barcodes already exist in other products: ${duplicates.join(', ')}`);
      return;
    }

    const productsToInsert = addForm.map(product => ({
      store_id: storeId,
      name: product.name,
      description: product.description,
      purchase_price: parseFloat(product.purchase_price) || 0,
      purchase_qty: parseInt(product.purchase_qty) || 0,
      selling_price: parseFloat(product.selling_price) || 0,
      suppliers_name: product.suppliers_name,
      device_id: product.device_id
    }));
    const { data: insertedProducts, error: insertError } = await supabase
      .from('dynamic_product')
      .insert(productsToInsert)
      .select();
    if (insertError) {
      toast.error(`Failed to add products: ${insertError.message}`);
      return;
    }

    const inventoryUpdates = insertedProducts.map(product => ({
      dynamic_product_id: product.id,
      store_id: storeId,
      available_qty: parseInt(product.purchase_qty),
      quantity_sold: 0,
      last_updated: new Date().toISOString()
    }));
    const { error: inventoryError } = await supabase
      .from('dynamic_inventory')
      .upsert(inventoryUpdates, { onConflict: ['dynamic_product_id', 'store_id'] });
    if (inventoryError) {
      toast.error(`Failed to update inventory: ${inventoryError.message}`);
      return;
    }

    toast.success('Products added successfully');
    setShowAdd(false);
    setAddForm([{
      name: '',
      description: '',
      purchase_price: '',
      purchase_qty: '',
      selling_price: '',
      suppliers_name: '',
      device_id: '',
    }]);
    fetchProducts();
  };

  // Edit handlers
  const startEdit = p => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || '',
      purchase_price: p.purchase_price,
      purchase_qty: p.purchase_qty,
      selling_price: p.selling_price,
      suppliers_name: p.suppliers_name || '',
      device_id: p.device_id || '',
    });
  };

  const handleFormChange = e => {
    const { name, value } = e.target;
    if (name === 'device_id' && value.trim()) {
      // Check for duplicates in database excluding current product
      const checkDuplicate = async () => {
        const { data: existingProducts, error } = await supabase
          .from('dynamic_product')
          .select('device_id')
          .eq('store_id', storeId)
          .neq('id', editing.id)
          .neq('device_id', '');
        if (error) {
          console.error('Error checking duplicates:', error);
          toast.error('Failed to check for duplicate barcodes');
          return false;
        }
        if (existingProducts.some(p => p.device_id.trim().toLowerCase() === value.trim().toLowerCase())) {
          toast.error(`Barcode "${value.trim()}" already exists in another product`);
          return false;
        }
        return true;
      };
      checkDuplicate().then(isValid => {
        if (isValid) {
          setForm(f => ({ ...f, [name]: value }));
        }
      });
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  const saveEdit = async () => {
    if (!form.name || !form.purchase_qty) {
      toast.error('Please fill all required fields');
      return;
    }

    const restockQty = parseInt(form.purchase_qty);
    if (restockQty <= 0) {
      toast.error('Restock quantity must be greater than zero');
      return;
    }

    // Check for duplicate device_id
    if (form.device_id.trim()) {
      const { data: existingProducts, error } = await supabase
        .from('dynamic_product')
        .select('device_id')
        .eq('store_id', storeId)
        .neq('id', editing.id)
        .neq('device_id', '');
      if (error) {
        console.error('Error checking duplicates:', error);
        toast.error('Failed to check for duplicate barcodes');
        return;
      }
      if (existingProducts.some(p => p.device_id.trim().toLowerCase() === form.device_id.trim().toLowerCase())) {
        toast.error(`Barcode "${form.device_id.trim()}" already exists in another product`);
        return;
      }
    }

    const productUpdate = {
      name: form.name,
      description: form.description,
      purchase_price: parseFloat(form.purchase_price) || 0,
      purchase_qty: restockQty,
      selling_price: parseFloat(form.selling_price) || 0,
      suppliers_name: form.suppliers_name,
      device_id: form.device_id,
    };
    const { error: productError } = await supabase
      .from('dynamic_product')
      .update(productUpdate)
      .eq('id', editing.id);
    if (productError) {
      toast.error(`Failed to update product: ${productError.message}`);
      return;
    }

    const { data: inventoryData, error: fetchInventoryError } = await supabase
      .from('dynamic_inventory')
      .select('available_qty, quantity_sold')
      .eq('dynamic_product_id', editing.id)
      .eq('store_id', storeId)
      .maybeSingle();

    let newAvailableQty = restockQty;
    let existingQuantitySold = 0;
    if (inventoryData) {
      newAvailableQty = inventoryData.available_qty + restockQty;
      existingQuantitySold = inventoryData.quantity_sold || 0;
    } else if (fetchInventoryError) {
      toast.error(`Failed to fetch inventory: ${fetchInventoryError.message}`);
      return;
    }

    const inventoryUpdate = {
      dynamic_product_id: editing.id,
      store_id: storeId,
      available_qty: newAvailableQty,
      quantity_sold: existingQuantitySold,
      last_updated: new Date().toISOString(),
    };
    const { error: inventoryError } = await supabase
      .from('dynamic_inventory')
      .upsert([inventoryUpdate], { onConflict: ['dynamic_product_id', 'store_id'] });
    if (inventoryError) {
      toast.error(`Failed to update inventory: ${inventoryError.message}`);
      return;
    }

    toast.success('Product restocked successfully');
    setEditing(null);
    fetchProducts();
  };


  // Export CSV
  const exportCSV = () => {
    let csv = "data:text/csv;charset=utf-8,";
    csv += "Name,Description,PurchasePrice,Qty,SellingPrice,Supplier,DeviceID,CreatedAt\n";
    filtered.forEach(p => {
      const row = [
        p.name,
        (p.description || '').replace(/,/g, ' '),
        parseFloat(p.purchase_price).toFixed(2),
        p.purchase_qty,
        parseFloat(p.selling_price).toFixed(2),
        p.suppliers_name || '',
        p.device_id || '',
        p.created_at
      ].join(',');
      csv += row + '\n';
    });
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = 'dynamic_products.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export PDF
  const exportPDF = () => {
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF();
      let y = 10;
      doc.text('Dynamic Products', 10, y);
      y += 10;
      filtered.forEach(p => {
        const line = `Name: ${p.name}, Purchase: $${parseFloat(p.purchase_price).toFixed(2)}, Qty: ${p.purchase_qty}, Sell: $${parseFloat(p.selling_price).toFixed(2)}, Barcode: ${p.device_id || ''}`;
        doc.text(line, 10, y);
        y += 10;
      });
      doc.save('dynamic_products.pdf');
    });
  };

  // Onboarding handlers
  const handleNextStep = () => {
    if (onboardingStep < onboardingSteps.length - 1) {
      setOnboardingStep(onboardingStep + 1);
    } else {
      setShowOnboarding(false);
      localStorage.setItem('productCatalogOnboardingCompleted', 'true');
    }
  };

  const handleSkipOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('productCatalogOnboardingCompleted', 'true');
  };

  // Tooltip positioning
  const getTooltipPosition = (target) => {
    const element = document.querySelector(target);
    if (!element) return { top: 0, left: 0 };
    const rect = element.getBoundingClientRect();
    return {
      top: rect.bottom + window.scrollY + 10,
      left: rect.left + window.scrollX,
    };
  };

  return (
    <div className="p-0">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Search & Add */}
      <div className="flex flex-col sm:flex-row items-center gap-2 mb-4">
        <input
          type="text"
          placeholder="Search products or barcodes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full p-2 border rounded dark:bg-gray-900 dark:text-white search-input"
        />
        <button
          onClick={() => {
            setShowAdd(true);
            setScannerTarget({ modal: 'add', productIndex: 0 });
          }}
          className="w-full sm:w-auto flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 add-product-button"
        >
          <FaPlus /> Products
        </button>
      </div>
{/* Add Modal */}
{showAdd && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-auto mt-16">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg w-full max-w-3xl max-h-[85vh] overflow-y-auto space-y-4">
      <h2 className="text-lg sm:text-xl font-bold text-center text-gray-900 dark:text-gray-200">
        Add Products
      </h2>
      <form onSubmit={createProducts} className="space-y-4">
        {addForm.map((product, index) => (
          <div key={index} className="border border-gray-200 dark:border-gray-700 p-3 sm:p-4 rounded-lg space-y-3 dark:bg-gray-800">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-200">
                Product {index + 1}
              </h3>
              {addForm.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeProduct(index)}
                  className="p-1.5 bg-red-600 text-white rounded-full shadow-sm hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 transition-colors duration-200"
                  aria-label="Remove product"
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
                { name: 'name', label: 'Name' },
                { name: 'description', label: 'Description' },
                { name: 'purchase_price', label: 'Total Purchase Price' },
                { name: 'purchase_qty', label: 'Quantity Purchased' },
                { name: 'selling_price', label: 'Selling Price' },
                { name: 'suppliers_name', label: 'Supplier Name' },
                { name: 'device_id', label: 'Barcode' },
              ].map(field => (
                <label key={field.name} className="block">
                  <span className="font-semibold block mb-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                    {field.label}
                  </span>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <input
                      type={field.name.includes('price') || field.name.includes('qty') ? 'number' : 'text'}
                      step={field.name.includes('price') ? '0.01' : undefined}
                      name={field.name}
                      value={product[field.name]}
                      onChange={(e) => handleAddChange(e, index)}
                      required={['name', 'purchase_qty'].includes(field.name)}
                      className={`flex-1 p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px] ${
                        field.name === 'device_id' && product.device_id.trim() &&
                        addForm.some((p, i) => i !== index && p.device_id.trim().toLowerCase() === product.device_id.trim().toLowerCase())
                          ? 'border-red-500'
                          : ''
                      }`}
                    />
                    {field.name === 'device_id' && (
                      <button
                        type="button"
                        onClick={() => openScanner('add', index)}
                        className="p-2 sm:p-2.5 bg-indigo-600 text-white rounded-full shadow-sm hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors duration-200"
                        aria-label="Scan barcode for device ID"
                      >
                        <FaCamera className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                      </button>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addAnotherProduct}
          className="p-2 sm:p-3 bg-green-600 text-white rounded-full shadow-sm hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-colors duration-200 w-full sm:w-auto flex items-center justify-center gap-2"
          aria-label="Add another product"
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
          <span className="text-sm sm:text-base">Add Another Product</span>
        </button>
        <div className="flex justify-end gap-2 sm:gap-3 mt-4">
          <button
            type="button"
            onClick={() => {
              setShowAdd(false);
              stopScanner();
            }}
            className="p-2 sm:p-3 bg-gray-500 text-white rounded-full shadow-sm hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500 transition-colors duration-200"
            aria-label="Cancel product form"
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
            aria-label="Create products"
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

      {/* Table */}
      <div className="overflow-x-auto bg-white dark:bg-gray-900 rounded-lg shadow dark:text-white">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-200 dark:bg-gray-700">
            <tr>
              {['Name', 'Descrip', 'Purchase', 'Qty', 'Sell. Price', 'Supplier', 'Product Barcode', 'Date', 'Edit/Restock'].map(h => (
                <th key={h} className="px-4 py-2 text-left text-sm font-semibold dark:bg-gray-900 dark:text-indigo-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {paginatedProducts.map((p, index) => (
              <tr key={p.id}>
                <td className="px-4 py-2 text-sm">{p.name}</td>
                <td className="px-4 py-2 text-sm">{p.description}</td>
                <td className="px-4 py-2 text-sm">
                  {p.purchase_price != null
                    ? parseFloat(p.purchase_price).toFixed(2)
                    : ''}
                </td>
                <td className="px-4 py-2 text-sm">{p.purchase_qty}</td>
                <td className="px-4 py-2 text-sm">
                  {p.selling_price != null
                    ? parseFloat(p.selling_price).toFixed(2)
                    : ''}
                </td>
                <td className="px-4 py-2 text-sm">{p.suppliers_name}</td>
                <td className="px-4 py-2 text-sm">{p.device_id}</td>
                <td className="px-4 py-2 text-sm">
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 flex gap-2">
                  <button onClick={() => startEdit(p)} className={`text-indigo-600 hover:text-indigo-800 edit-button-${index}`}>
                    <FaEdit />
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
          className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50"
        >
          Prev
        </button>
        {[...Array(totalPages)].map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentPage(i + 1)}
            className={`px-3 py-1 rounded ${currentPage === i + 1
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 hover:bg-gray-300'}`}
          >
            {i + 1}
          </button>
        ))}
        <button
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {/* Exports */}
      <div className="flex justify-center gap-4 mt-4">
        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
          <FaFileCsv /> CSV
        </button>
        <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
          <FaFilePdf /> PDF
        </button>
      </div>
{/* Edit Modal */}
{editing && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-auto mt-16">
    <div className="bg-white rounded-lg shadow-lg w-full max-w-full sm:max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6 space-y-4 dark:bg-gray-900 dark:text-white">
      <h2 className="text-lg sm:text-xl font-bold text-center text-gray-900 dark:text-gray-200">
        Edit {editing.name}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:gap-4">
        {[
          { name: 'name', label: 'Name' },
          { name: 'description', label: 'Description' },
          { name: 'purchase_price', label: 'Total Purchase Price' },
          { name: 'purchase_qty', label: 'Qty Purchased (Restock)' },
          { name: 'selling_price', label: 'Selling Price' },
          { name: 'suppliers_name', label: 'Supplier Name' },
          { name: 'device_id', label: 'Barcode' },
        ].map(field => (
          <label key={field.name} className="block">
            <span className="font-semibold block mb-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
              {field.label}
            </span>
            <div className="flex items-center gap-2 sm:gap-3">
              <input
                type={field.name.includes('price') || field.name.includes('qty') ? 'number' : 'text'}
                step={field.name.includes('price') ? '0.01' : undefined}
                name={field.name}
                value={form[field.name]}
                onChange={handleFormChange}
                required={['name', 'purchase_qty'].includes(field.name)}
                className="flex-1 p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px]"
              />
              {field.name === 'device_id' && (
                <button
                  type="button"
                  onClick={() => openScanner('edit', 0)}
                  className="p-2 sm:p-2.5 bg-indigo-600 text-white rounded-full shadow-sm hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors duration-200"
                  aria-label="Scan barcode for device ID"
                >
                  <FaCamera className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>
              )}
            </div>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2 sm:gap-3 mt-4">
        <button
          onClick={() => {
            setEditing(null);
            stopScanner();
          }}
          className="p-2 sm:p-3 bg-gray-500 text-white rounded-full shadow-sm hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500 transition-colors duration-200"
          aria-label="Cancel edit form"
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
          onClick={saveEdit}
          className="p-2 sm:p-3 bg-indigo-600 text-white rounded-full shadow-sm hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors duration-200"
          aria-label="Save product"
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
    </div>
  </div>
)}

      {/* Scanner Modal */}
    {showScanner && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
     <div className="bg-white dark:bg-gray-900 p-6 rounded max-w-lg w-full">
      <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Scan Product ID</h2>
      <div className="mb-4">
        <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={externalScannerMode}
            onChange={() => {
              setExternalScannerMode((prev) => !prev);
              setScannerError(null);
              setScannerLoading(!externalScannerMode);
              if (manualInputRef.current) {
                manualInputRef.current.focus();
              }
            }}
            className="h-4 w-4 text-indigo-600 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
          />
          <span>Use External Scanner</span>
        </label>
      </div>
      {!externalScannerMode && (
        <>
          {scannerLoading && (
            <div className="text-gray-600 dark:text-gray-400 text-center mb-3 text-xs xs:text-sm">
              Initializing webcam scanner...
            </div>
          )}
          {scannerError && (
            <div className="text-red-600 dark:text-red-400 text-center mb-3 text-xs xs:text-sm font-medium">
              {scannerError}
            </div>
          )}
          <div className="mb-3 text-xs xs:text-sm text-gray-600 dark:text-gray-300 text-center">
            <p className="mb-1">Point camera at barcode (~10–15 cm away).</p>
            <p>Ensure good lighting and steady hands.</p>
          </div>
          <div
            id="scanner"
            ref={scannerDivRef}
            className={`relative w-full h-[60vw] max-h-[320px] min-h-[180px] mb-3 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden ${
              scanSuccess ? 'border-4 border-green-500' : ''
            }`}
          >
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[85%] max-w-[280px] h-[80px] xs:h-[90px] sm:h-[100px] border-2 border-red-500 bg-transparent rounded-lg opacity-60"></div>
            </div>
          </div>
        </>
      )}        {externalScannerMode && (
              <>
                <div className="text-gray-600 dark:text-gray-400 mb-4">
                  Waiting for external scanner to proceed... Scan a barcode to proceed.
                </div>
                <div className="mb-4 px-2 sm:px-0">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Or enter barcode manually
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      ref={manualInputRef}
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      onKeyDown={handleManualInputKeyDown}
                      placeholder="Enter barcode"
                      className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full sm:flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleManualInput}
                      className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 w-full sm:w-auto"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end px-2 sm:px-4">
              <button
                type="button"
                onClick={() => {
                  stopScanner();
                  setShowScanner(false);
                  setScannerTarget(null);
                  setScannerError(null);
                  setScannerLoading(false);
                  setManualInput('');
                  setExternalScannerMode(false);
                  setScannerBuffer('');
                  setScanSuccess(false);
                }}
                className="w-full sm:w-auto px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white text-center"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Tooltip */}
      {showOnboarding && onboardingStep < onboardingSteps.length && (
        <motion.div
          className="fixed z-50 bg-indigo-600 dark:bg-gray-900 border rounded-lg shadow-lg p-4 max-w-xs"
          style={getTooltipPosition(onboardingSteps[onboardingStep].target)}
          variants={tooltipVariants}
          initial="hidden"
          animate="visible"
        >
          <p className="text-sm text-white dark:text-gray-300 mb-2">
            {onboardingSteps[onboardingStep].content}
          </p>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-200">
              Step {onboardingStep + 1} of {onboardingSteps.length}
            </span>
            <div className="space-x-2">
              <button
                onClick={handleSkipOnboarding}
                className="text-sm text-gray-300 hover:text-gray-800 dark:text-gray-300"
              >
                Skip
              </button>
              <button
                onClick={handleNextStep}
                className="bg-indigo-600 hover:bg-indigo-700 text-white py-1 px-3 rounded"
              >
                {onboardingStep + 1 === onboardingSteps.length ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}