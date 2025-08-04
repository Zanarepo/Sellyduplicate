import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FaPlus,

  FaFileCsv,
  FaFilePdf,

  FaCamera,
} from 'react-icons/fa';
import { supabase } from '../../supabaseClient';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { motion } from 'framer-motion';
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScannerState } from 'html5-qrcode';

const tooltipVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function SalesTracker() {
  const storeId = localStorage.getItem('store_id');
  const itemsPerPage = 20;
  const detailPageSize = 20;


// Success sound for scan feedback
const playSuccessSound = () => {
  const audio = new Audio('https://freesound.org/data/previews/171/171671_2437358-lq.mp3');
  audio.play().catch((err) => console.error('Audio play error:', err));
};


  // State Declarations
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState('list');
  const [showAdd, setShowAdd] = useState(false);
  const [lines, setLines] = useState([
    { dynamic_product_id: '', quantity: 1, unit_price: '', deviceIds: [''], deviceSizes: [''], isQuantityManual: false },
  ]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [editing, setEditing] = useState(null);
  const [saleForm, setSaleForm] = useState({
    quantity: 1,
    unit_price: '',
    deviceIds: [''],
    deviceSizes: [''],
    payment_method: 'Cash',
    isQuantityManual: false,
  });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [totalOnboardingSteps] = useState(0);
  const [availableDeviceIds, setAvailableDeviceIds] = useState({}); // Object mapping lineIdx to { deviceIds: [], deviceSizes: [] }

  
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDeviceInfo, setSelectedDeviceInfo] = useState([]);
  const [detailPage, setDetailPage] = useState(1);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerTarget, setScannerTarget] = useState(null);
  const [scannerError, setScannerError] = useState(null);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [externalScannerMode, setExternalScannerMode] = useState(false);
  const lastScanTimeRef = useRef(0);
const lastScannedCodeRef = useRef(null);
 

  // Refs
  const isProcessingClick = useRef(false);
  const videoRef = useRef(null);
  const scannerDivRef = useRef(null);
  const html5QrCodeRef = useRef(null);



const stopScanner = useCallback(async () => {
  if (html5QrCodeRef.current) {
    const currentState = html5QrCodeRef.current.getState();
    if (
      [Html5QrcodeScannerState.SCANNING, Html5QrcodeScannerState.PAUSED].includes(currentState)
    ) {
      try {
        // Wait briefly to ensure any ongoing transitions complete
        await new Promise((resolve) => setTimeout(resolve, 100));
        await html5QrCodeRef.current.stop();
        console.log('Scanner stopped successfully');
        html5QrCodeRef.current = null;
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    } else {
      console.log('Scanner not in active state:', currentState);
      html5QrCodeRef.current = null;
    }
  }
  if (videoRef.current && videoRef.current.srcObject) {
    const tracks = videoRef.current.srcObject.getTracks();
    tracks.forEach((track) => track.stop());
    videoRef.current.srcObject = null;
    videoRef.current = null; // Reset video element
  }
  setScannerError(null);
  setScannerLoading(false);
}, []);


  
  // Computed Values
  const paginatedSales = useMemo(() => {
    if (viewMode !== 'list') return [];
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, viewMode]);

  const dailyTotals = useMemo(() => {
    const groups = {};
    sales.forEach((s) => {
      const date = new Date(s.sold_at).toISOString().split('T')[0];
      if (!groups[date]) groups[date] = { period: date, total: 0, count: 0 };
      groups[date].total += s.amount;
      groups[date].count += 1;
    });
    return Object.values(groups).sort((a, b) => b.period.localeCompare(a.period));
  }, [sales]);

  const weeklyTotals = useMemo(() => {
    const groups = {};
    sales.forEach((s) => {
      const date = new Date(s.sold_at);
      const day = date.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(date);
      monday.setDate(date.getDate() - diff);
      const key = monday.toISOString().split('T')[0];
      if (!groups[key]) groups[key] = { period: `Week of ${key}`, total: 0, count: 0 };
      groups[key].total += s.amount;
      groups[key].count += 1;
    });
    return Object.values(groups).sort((a, b) => b.period.localeCompare(a.period));
  }, [sales]);

  const totalsData = useMemo(() => {
    if (viewMode === 'daily') return dailyTotals;
    if (viewMode === 'weekly') return weeklyTotals;
    return [];
  }, [viewMode, dailyTotals, weeklyTotals]);

  const paginatedTotals = useMemo(() => {
    if (viewMode === 'list') return [];
    const start = (currentPage - 1) * itemsPerPage;
    return totalsData.slice(start, start + itemsPerPage);
  }, [viewMode, totalsData, currentPage]);

  const totalPages = useMemo(() => {
    if (viewMode === 'list') return Math.ceil(filtered.length / itemsPerPage);
    return Math.ceil(totalsData.length / itemsPerPage);
  }, [viewMode, filtered, totalsData]);

  const totalAmount = useMemo(() => lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0), [lines]);

  const paginatedDevices = useMemo(() => {
    const start = (detailPage - 1) * detailPageSize;
    const end = start + detailPageSize;
    return selectedDeviceInfo.slice(start, end);
  }, [selectedDeviceInfo, detailPage]);

  const totalDetailPages = Math.ceil(selectedDeviceInfo.length / detailPageSize);
  




  
// Utility Function (add above the component)
const formatCurrency = (value) =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const checkSoldDevices = useCallback(async (deviceIds, productId, lineIdx) => {
  if (!deviceIds || deviceIds.length === 0) {
    setAvailableDeviceIds(prev => ({ ...prev, [lineIdx]: { deviceIds: [], deviceSizes: [] } }));
    return;
  }
  try {
    const normalizedIds = deviceIds.map(id => id.trim());
    const { data, error } = await supabase
      .from('dynamic_sales')
      .select('device_id')
      .in('device_id', normalizedIds);
    if (error) throw error;
    const soldIds = data.map(item => item.device_id.trim());
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const available = product.deviceIds
      .map((id, idx) => ({ id, size: product.deviceSizes[idx] || '' }))
      .filter(item => !soldIds.includes(item.id));
    setAvailableDeviceIds(prev => ({
      ...prev,
      [lineIdx]: {
        deviceIds: available.map(item => item.id),
        deviceSizes: available.map(item => item.size),
      },
    }));
  } catch (error) {
    console.error('Error fetching sold devices:', error);
    toast.error('Failed to check sold devices');
    setAvailableDeviceIds(prev => ({ ...prev, [lineIdx]: { deviceIds: [], deviceSizes: [] } }));
  }
}, [products]);

  // Onboarding steps
  const onboardingSteps = [
    { target: '.new-sale-button', content: 'Click to record a new sale.' },
    { target: '.search-input', content: 'Search by product, payment method, or product ID.' },
    { target: '.view-mode-selector', content: 'Switch to Daily or Weekly Totals for summaries.' },
  ];

  // Scanner: External Scanner Input
 useEffect(() => {
  if (!externalScannerMode || !scannerTarget || !showScanner) return;

  let buffer = '';
  let lastKeyTime = 0;

  const handleKeypress = async (e) => {
    const currentTime = Date.now();
    const timeDiff = currentTime - lastKeyTime;

    if (timeDiff > 50 && buffer) {
      buffer = '';
    }

    if (e.key === 'Enter' && buffer) {
      const scannedDeviceId = buffer.trim();
      if (!scannedDeviceId) {
        toast.error('Scanned Product ID cannot be empty');
        setScannerError('Scanned Product ID cannot be empty');
        return;
      }

      // Check if device ID is already sold
      const { data: soldData, error: soldError } = await supabase
        .from('dynamic_sales')
        .select('device_id')
        .eq('device_id', scannedDeviceId)
        .eq('store_id', storeId)
        .single();
      if (soldError && soldError.code !== 'PGRST116') {
        console.error('Error checking sold status:', soldError);
        toast.error('Failed to validate Product ID');
        setScannerError('Failed to validate Product ID');
        return;
      }
      if (soldData) {
        console.log('Device ID is sold:', scannedDeviceId);
        toast.error(`Product ID "${scannedDeviceId}" has already been sold`);
        setScannerError(`Product ID "${scannedDeviceId}" has already been sold`);
        return;
      }

      // Query product details
      const { data: productData, error } = await supabase
        .from('dynamic_product')
        .select('id, name, selling_price, dynamic_product_imeis, device_size')
        .eq('store_id', storeId)
        .ilike('dynamic_product_imeis', `%${scannedDeviceId}%`)
        .single();

      if (error || !productData) {
        console.error('Supabase Query Error:', error);
        toast.error(`Product ID "${scannedDeviceId}" not found`);
        setScannerError(`Product ID "${scannedDeviceId}" not found`);
        return;
      }

      console.log('Found Product:', productData);

      const deviceIds = productData.dynamic_product_imeis ? productData.dynamic_product_imeis.split(',').map(id => id.trim()).filter(id => id) : [];
      const deviceSizes = productData.device_size ? productData.device_size.split(',').map(size => size.trim()).filter(size => size) : [];
      const idIndex = deviceIds.indexOf(scannedDeviceId);

      const { modal, lineIdx, deviceIdx } = scannerTarget;
      let newDeviceIdx;

      if (modal === 'add') {
        const ls = [...lines];
        const existingLineIdx = ls.findIndex(line => {
          const product = products.find(p => p.id === line.dynamic_product_id);
          return product && product.name === productData.name;
        });

        if (existingLineIdx !== -1) {
          if (ls[existingLineIdx].deviceIds.some(id => id.trim().toLowerCase() === scannedDeviceId.toLowerCase())) {
            toast.error(`Product ID "${scannedDeviceId}" already exists in this product`);
            setScannerError(`Product ID "${scannedDeviceId}" already exists`);
            return;
          }
          ls[existingLineIdx].deviceIds.push(scannedDeviceId);
          ls[existingLineIdx].deviceSizes.push(idIndex !== -1 ? deviceSizes[idIndex] || '' : '');
          if (!ls[existingLineIdx].isQuantityManual) {
            ls[existingLineIdx].quantity = ls[existingLineIdx].deviceIds.filter(id => id.trim()).length || 1;
          }
          const mergedLines = ls.filter((line, idx) => {
            if (idx === existingLineIdx) return true;
            const product = products.find(p => p.id === line.dynamic_product_id);
            if (product && product.name === productData.name) {
              ls[existingLineIdx].deviceIds.push(...line.deviceIds.filter(id => id.trim()));
              ls[existingLineIdx].deviceSizes.push(...line.deviceSizes);
              if (!ls[existingLineIdx].isQuantityManual) {
                ls[existingLineIdx].quantity = ls[existingLineIdx].deviceIds.filter(id => id.trim()).length || 1;
              }
              return false;
            }
            return true;
          });
          console.log('Updated Lines (Existing Product):', mergedLines);
          setLines(mergedLines);
          newDeviceIdx = ls[existingLineIdx].deviceIds.length - 1;
          checkSoldDevices(deviceIds, productData.id, existingLineIdx);
          setScannerTarget({ modal, lineIdx: existingLineIdx, deviceIdx: newDeviceIdx });
        } else {
          if (!ls[lineIdx].dynamic_product_id || ls[lineIdx].deviceIds.every(id => !id.trim())) {
            if (ls[lineIdx].deviceIds.some(id => id.trim().toLowerCase() === scannedDeviceId.toLowerCase())) {
              toast.error(`Product ID "${scannedDeviceId}" already exists in this line`);
              setScannerError(`Product ID "${scannedDeviceId}" already exists`);
              return;
            }
            ls[lineIdx] = {
              ...ls[lineIdx],
              dynamic_product_id: Number(productData.id),
              unit_price: Number(productData.selling_price),
              deviceIds: [scannedDeviceId],
              deviceSizes: [idIndex !== -1 ? deviceSizes[idIndex] || '' : ''],
              quantity: ls[lineIdx].isQuantityManual ? ls[lineIdx].quantity : 1,
            };
            console.log('Updated Lines (Current Line):', ls);
            setLines(ls);
            newDeviceIdx = 0;
            checkSoldDevices(deviceIds, productData.id, lineIdx);
            setScannerTarget({ modal, lineIdx, deviceIdx: newDeviceIdx });
          } else {
            if (ls.some(line => line.deviceIds.some(id => id.trim().toLowerCase() === scannedDeviceId.toLowerCase()))) {
              toast.error(`Product ID "${scannedDeviceId}" already exists in another product`);
              setScannerError(`Product ID "${scannedDeviceId}" already exists`);
              return;
            }
            const newLine = {
              dynamic_product_id: Number(productData.id),
              quantity: 1,
              unit_price: Number(productData.selling_price),
              deviceIds: [scannedDeviceId],
              deviceSizes: [idIndex !== -1 ? deviceSizes[idIndex] || '' : ''],
              isQuantityManual: false,
            };
            ls.push(newLine);
            console.log('Added New Line:', ls);
            setLines(ls);
            newDeviceIdx = 0;
            checkSoldDevices(deviceIds, productData.id, ls.length - 1);
            setScannerTarget({ modal, lineIdx: ls.length - 1, deviceIdx: newDeviceIdx });
          }
        }
      } else if (modal === 'edit') {
        if (saleForm.deviceIds.some((id, i) => i !== deviceIdx && id.trim().toLowerCase() === scannedDeviceId.toLowerCase())) {
          toast.error(`Product ID "${scannedDeviceId}" already exists in this sale`);
          setScannerError(`Product ID "${scannedDeviceId}" already exists`);
          return;
        }
        const updatedForm = {
          ...saleForm,
          dynamic_product_id: Number(productData.id),
          unit_price: Number(productData.selling_price),
          deviceIds: [...saleForm.deviceIds.slice(0, deviceIdx), scannedDeviceId, ...saleForm.deviceIds.slice(deviceIdx + 1)],
          deviceSizes: [...saleForm.deviceSizes.slice(0, deviceIdx), (idIndex !== -1 ? deviceSizes[idIndex] || '' : ''), ...saleForm.deviceSizes.slice(deviceIdx + 1)],
          quantity: saleForm.isQuantityManual ? saleForm.quantity : (saleForm.deviceIds.filter(id => id.trim()).length || 1),
        };
        console.log('Updated Sale Form:', updatedForm);
        setSaleForm(updatedForm);
        newDeviceIdx = deviceIdx;
        checkSoldDevices(deviceIds, productData.id, 0);
        setScannerTarget({ modal, lineIdx, deviceIdx: newDeviceIdx });
      }

      setScannerError(null);
      setScannerLoading(false);
      setManualInput('');
      toast.success(`Scanned Product ID: ${scannedDeviceId}`);
      buffer = '';
    } else if (e.key !== 'Enter') {
      buffer += e.key;
    }

    lastKeyTime = currentTime;
  };

  document.addEventListener('keypress', handleKeypress);

  return () => {
    document.removeEventListener('keypress', handleKeypress);
  };
}, [externalScannerMode, scannerTarget, showScanner, lines, saleForm, products, inventory, storeId, checkSoldDevices]);



  // Scanner: Webcam Scanner

  
  useEffect(() => {
    if (!showScanner || !scannerDivRef.current || !videoRef.current || externalScannerMode) return;

    setScannerLoading(true);
    const currentVideo = videoRef.current;

    try {
      if (!document.getElementById('scanner')) {
        setScannerError('Scanner container not found');
        setScannerLoading(false);
        toast.error('Scanner container not found. Please use manual input.');
        return;
      }

      html5QrCodeRef.current = new Html5Qrcode('scanner');
    } catch (err) {
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


const onScanSuccess = async (scannedDeviceId) => {
  const currentTime = Date.now();
  // Debounce: Ignore scans within 500ms or of the same barcode
  if (currentTime - lastScanTimeRef.current < 500 || lastScannedCodeRef.current === scannedDeviceId) {
    return false;
  }
  lastScanTimeRef.current = currentTime;
  lastScannedCodeRef.current = scannedDeviceId;

  playSuccessSound();
  if (!scannedDeviceId) {
    toast.error('Scanned Product ID cannot be empty');
    setScannerError('Scanned Product ID cannot be empty');
    return false;
  }

  console.log('Scanned Device ID:', scannedDeviceId);

  // Check for duplicate in current sale
  if (scannerTarget) {
    const { modal, deviceIdx } = scannerTarget;
    if (modal === 'add') {
      const ls = [...lines];
      if (ls.some(line => line.deviceIds.some(id => id.trim().toLowerCase() === scannedDeviceId.toLowerCase()))) {
        toast.error(`Product ID "${scannedDeviceId}" already exists in this sale`);
        setScannerError(`Product ID "${scannedDeviceId}" already exists`);
        return false;
      }
    } else if (modal === 'edit') {
      if (saleForm.deviceIds.some((id, i) => i !== deviceIdx && id.trim().toLowerCase() === scannedDeviceId.toLowerCase())) {
        toast.error(`Product ID "${scannedDeviceId}" already exists in this sale`);
        setScannerError(`Product ID "${scannedDeviceId}" already exists`);
        return false;
      }
    }
  }

  // Check if device ID is already sold
  const { data: soldData, error: soldError } = await supabase
    .from('dynamic_sales')
    .select('device_id')
    .eq('device_id', scannedDeviceId)
    .eq('store_id', storeId)
    .single();
  if (soldError && soldError.code !== 'PGRST116') {
    console.error('Error checking sold status:', soldError);
    toast.error('Failed to validate Product ID');
    setScannerError('Failed to validate Product ID');
    return false;
  }
  if (soldData) {
    console.log('Device ID is sold:', scannedDeviceId);
    toast.error(`Product ID "${scannedDeviceId}" has already been sold`);
    setScannerError(`Product ID "${scannedDeviceId}" has already been sold`);
    return false;
  }

  // Query product details
  const { data: productData, error } = await supabase
    .from('dynamic_product')
    .select('id, name, selling_price, dynamic_product_imeis, device_size')
    .eq('store_id', storeId)
    .ilike('dynamic_product_imeis', `%${scannedDeviceId}%`)
    .single();

  if (error || !productData) {
    console.error('Supabase Query Error:', error);
    toast.error(`Product ID "${scannedDeviceId}" not found`);
    setScannerError(`Product ID "${scannedDeviceId}" not found`);
    return false;
  }

  console.log('Found Product:', productData);

  const deviceIds = productData.dynamic_product_imeis ? productData.dynamic_product_imeis.split(',').map(id => id.trim()).filter(id => id) : [];
  const deviceSizes = productData.device_size ? productData.device_size.split(',').map(size => size.trim()).filter(size => size) : [];
  const idIndex = deviceIds.indexOf(scannedDeviceId);

  if (scannerTarget) {
    const { modal, lineIdx, deviceIdx } = scannerTarget;
    let newDeviceIdx;

    if (modal === 'add') {
      const ls = [...lines];
      const existingLineIdx = ls.findIndex(line => {
        const product = products.find(p => p.id === line.dynamic_product_id);
        return product && product.name === productData.name;
      });

      if (existingLineIdx !== -1) {
        ls[existingLineIdx].deviceIds.push(scannedDeviceId);
        ls[existingLineIdx].deviceSizes.push(idIndex !== -1 ? deviceSizes[idIndex] || '' : '');
        if (!ls[existingLineIdx].isQuantityManual) {
          ls[existingLineIdx].quantity = ls[existingLineIdx].deviceIds.filter(id => id.trim()).length || 1;
        }
        const mergedLines = ls.filter((line, idx) => {
          if (idx === existingLineIdx) return true;
          const product = products.find(p => p.id === line.dynamic_product_id);
          if (product && product.name === productData.name) {
            ls[existingLineIdx].deviceIds.push(...line.deviceIds.filter(id => id.trim()));
            ls[existingLineIdx].deviceSizes.push(...line.deviceSizes);
            if (!ls[existingLineIdx].isQuantityManual) {
              ls[existingLineIdx].quantity = ls[existingLineIdx].deviceIds.filter(id => id.trim()).length || 1;
            }
            return false;
          }
          return true;
        });
        console.log('Updated Lines (Existing Product):', mergedLines);
        setLines(mergedLines);
        newDeviceIdx = ls[existingLineIdx].deviceIds.length - 1;
        checkSoldDevices(deviceIds, productData.id, existingLineIdx);
        setScannerTarget({ modal, lineIdx: existingLineIdx, deviceIdx: newDeviceIdx });
      } else {
        if (!ls[lineIdx].dynamic_product_id || ls[lineIdx].deviceIds.every(id => !id.trim())) {
          ls[lineIdx] = {
            ...ls[lineIdx],
            dynamic_product_id: Number(productData.id),
            unit_price: Number(productData.selling_price),
            deviceIds: [scannedDeviceId],
            deviceSizes: [idIndex !== -1 ? deviceSizes[idIndex] || '' : ''],
            quantity: ls[lineIdx].isQuantityManual ? ls[lineIdx].quantity : 1,
          };
          console.log('Updated Lines (Current Line):', ls);
          setLines(ls);
          newDeviceIdx = 0;
          checkSoldDevices(deviceIds, productData.id, lineIdx);
          setScannerTarget({ modal, lineIdx, deviceIdx: newDeviceIdx });
        } else {
          const newLine = {
            dynamic_product_id: Number(productData.id),
            quantity: 1,
            unit_price: Number(productData.selling_price),
            deviceIds: [scannedDeviceId],
            deviceSizes: [idIndex !== -1 ? deviceSizes[idIndex] || '' : ''],
            isQuantityManual: false,
          };
          ls.push(newLine);
          console.log('Added New Line:', ls);
          setLines(ls);
          newDeviceIdx = 0;
          checkSoldDevices(deviceIds, productData.id, ls.length - 1);
          setScannerTarget({ modal, lineIdx: ls.length - 1, deviceIdx: newDeviceIdx });
        }
      }
    } else if (modal === 'edit') {
      const updatedForm = {
        ...saleForm,
        dynamic_product_id: Number(productData.id),
        unit_price: Number(productData.selling_price),
        deviceIds: [...saleForm.deviceIds.slice(0, deviceIdx), scannedDeviceId, ...saleForm.deviceIds.slice(deviceIdx + 1)],
        deviceSizes: [...saleForm.deviceSizes.slice(0, deviceIdx), (idIndex !== -1 ? deviceSizes[idIndex] || '' : ''), ...saleForm.deviceSizes.slice(deviceIdx + 1)],
        quantity: saleForm.isQuantityManual ? saleForm.quantity : (saleForm.deviceIds.filter(id => id.trim()).length || 1),
      };
      console.log('Updated Sale Form:', updatedForm);
      setSaleForm(updatedForm);
      newDeviceIdx = deviceIdx;
      checkSoldDevices(deviceIds, productData.id, 0);
      setScannerTarget({ modal, lineIdx, deviceIdx: newDeviceIdx });
    }

    setScannerError(null);
    toast.success(`Scanned Product ID: ${scannedDeviceId}`);
    return true;
  }
  console.error('No scanner target set');
  toast.error('No scanner target set');
  setScannerError('No scanner target set');
  return false;
};




    const onScanFailure = (error) => {
      if (error.includes('No MultiFormat Readers were able to detect the code') ||
          error.includes('No QR code found') ||
          error.includes('IndexSizeError')) {
        console.debug('No barcode detected');
      } else {
        setScannerError(`Scan error: ${error}`);
      }
    };

    const startScanner = async (attempt = 1, maxAttempts = 5) => {
      if (!currentVideo || !scannerDivRef.current) {
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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: config.videoConstraints,
        });
        currentVideo.srcObject = stream;
        await new Promise((resolve) => {
          currentVideo.onloadedmetadata = () => resolve();
        });

        await html5QrCodeRef.current.start(
          { facingMode: 'environment' },
          config,
          onScanSuccess,
          onScanFailure
        );

        setScannerLoading(false);
      } catch (err) {
        setScannerError(`Failed to initialize scanner: ${err.message}`);
        setScannerLoading(false);
        if (err.name === 'NotAllowedError') {
          toast.error('Camera access denied. Please allow camera permissions.');
        } else if (err.name === 'NotFoundError') {
          toast.error('No camera found. Please use manual input.');
        } else {
          setTimeout(() => startScanner(attempt + 1, maxAttempts), 200);
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
        setScannerError(`Failed to access cameras: ${err.message}`);
        setScannerLoading(false);
        toast.error('Failed to access cameras. Please use manual input.');
      });
return () => {
    if (html5QrCodeRef.current &&
        [Html5QrcodeScannerState.SCANNING, Html5QrcodeScannerState.PAUSED].includes(
          html5QrCodeRef.current.getState()
        )) {
      html5QrCodeRef.current
        .stop()
        .then(() => console.log('Webcam scanner stopped'))
        .catch((err) => console.error('Error stopping scanner:', err));
    }
    if (currentVideo && currentVideo.srcObject) {
      currentVideo.srcObject.getTracks().forEach((track) => track.stop());
      currentVideo.srcObject = null;
    }
    html5QrCodeRef.current = null;
  };
 }, [showScanner, scannerTarget, lines, saleForm, externalScannerMode, checkSoldDevices,stopScanner, storeId, products]);





  
  const openScanner = (modal, lineIdx, deviceIdx) => {
    setScannerTarget({ modal, lineIdx, deviceIdx });
    setShowScanner(true);
    setScannerError(null);
    setScannerLoading(true);
    setManualInput('');
    setExternalScannerMode(false);
  };
const handleManualInput = async () => {
  const trimmedInput = manualInput.trim();
  if (!trimmedInput) {
    toast.error('Product ID cannot be empty');
    setScannerError('Product ID cannot be empty');
    return;
  }

  console.log('Manual Input Device ID:', trimmedInput);

  // Check if device ID is already sold
  const { data: soldData, error: soldError } = await supabase
    .from('dynamic_sales')
    .select('device_id')
    .eq('device_id', trimmedInput)
    .eq('store_id', storeId)
    .single();
  if (soldError && soldError.code !== 'PGRST116') {
    console.error('Error checking sold status:', soldError);
    toast.error('Failed to validate Product ID');
    setScannerError('Failed to validate Product ID');
    return;
  }
  if (soldData) {
    console.log('Device ID is sold:', trimmedInput);
    toast.error(`Product ID "${trimmedInput}" has already been sold`);
    setScannerError(`Product ID "${trimmedInput}" has already been sold`);
    setManualInput('');
    return;
  }

  // Check if Device ID exists in dynamic_product
  const { data: productData, error } = await supabase
    .from('dynamic_product')
    .select('id, name, selling_price, dynamic_product_imeis, device_size')
    .eq('store_id', storeId)
    .ilike('dynamic_product_imeis', `%${trimmedInput}%`)
    .single();

  if (error || !productData) {
    console.error('Supabase Query Error:', error);
    toast.error(`Product ID "${trimmedInput}" not found`);
    setScannerError(`Product ID "${trimmedInput}" not found`);
    setManualInput('');
    return;
  }

  console.log('Found Product:', productData);

  const deviceIds = productData.dynamic_product_imeis ? productData.dynamic_product_imeis.split(',').map(id => id.trim()).filter(id => id) : [];
  const deviceSizes = productData.device_size ? productData.device_size.split(',').map(size => size.trim()).filter(size => size) : [];
  const idIndex = deviceIds.indexOf(trimmedInput);

  if (scannerTarget) {
    const { modal, lineIdx, deviceIdx } = scannerTarget;
    let newDeviceIdx;

    if (modal === 'add') {
      const ls = [...lines];
      const existingLineIdx = ls.findIndex(line => {
        const product = products.find(p => p.id === line.dynamic_product_id);
        return product && product.name === productData.name;
      });

      if (existingLineIdx !== -1) {
        if (ls[existingLineIdx].deviceIds.some(id => id.trim().toLowerCase() === trimmedInput.toLowerCase())) {
          toast.error(`Product ID "${trimmedInput}" already exists in this product`);
          setScannerError(`Product ID "${trimmedInput}" already exists`);
          setManualInput('');
          return;
        }
        ls[existingLineIdx].deviceIds.push(trimmedInput);
        ls[existingLineIdx].deviceSizes.push(idIndex !== -1 ? deviceSizes[idIndex] || '' : '');
        if (!ls[existingLineIdx].isQuantityManual) {
          ls[existingLineIdx].quantity = ls[existingLineIdx].deviceIds.filter(id => id.trim()).length || 1;
        }
        const mergedLines = ls.filter((line, idx) => {
          if (idx === existingLineIdx) return true;
          const product = products.find(p => p.id === line.dynamic_product_id);
          if (product && product.name === productData.name) {
            ls[existingLineIdx].deviceIds.push(...line.deviceIds.filter(id => id.trim()));
            ls[existingLineIdx].deviceSizes.push(...line.deviceSizes);
            if (!ls[existingLineIdx].isQuantityManual) {
              ls[existingLineIdx].quantity = ls[existingLineIdx].deviceIds.filter(id => id.trim()).length || 1;
            }
            return false;
          }
          return true;
        });
        console.log('Updated Lines (Existing Product):', mergedLines);
        setLines(mergedLines);
        newDeviceIdx = ls[existingLineIdx].deviceIds.length - 1;
        checkSoldDevices(deviceIds, productData.id, existingLineIdx);
        setScannerTarget({ modal, lineIdx: existingLineIdx, deviceIdx: newDeviceIdx });
      } else {
        if (!ls[lineIdx].dynamic_product_id || ls[lineIdx].deviceIds.every(id => !id.trim())) {
          if (ls[lineIdx].deviceIds.some(id => id.trim().toLowerCase() === trimmedInput.toLowerCase())) {
            toast.error(`Product ID "${trimmedInput}" already exists in this line`);
            setScannerError(`Product ID "${trimmedInput}" already exists`);
            setManualInput('');
            return;
          }
          ls[lineIdx] = {
            ...ls[lineIdx],
            dynamic_product_id: Number(productData.id),
            unit_price: Number(productData.selling_price),
            deviceIds: [trimmedInput],
            deviceSizes: [idIndex !== -1 ? deviceSizes[idIndex] || '' : ''],
            quantity: ls[lineIdx].isQuantityManual ? ls[lineIdx].quantity : 1,
          };
          console.log('Updated Lines (Current Line):', ls);
          setLines(ls);
          newDeviceIdx = 0;
          checkSoldDevices(deviceIds, productData.id, lineIdx);
          setScannerTarget({ modal, lineIdx, deviceIdx: newDeviceIdx });
        } else {
          if (ls.some(line => line.deviceIds.some(id => id.trim().toLowerCase() === trimmedInput.toLowerCase()))) {
            toast.error(`Product ID "${trimmedInput}" already exists in another product`);
            setScannerError(`Product ID "${trimmedInput}" already exists`);
            setManualInput('');
            return;
          }
          const newLine = {
            dynamic_product_id: Number(productData.id),
            quantity: 1,
            unit_price: Number(productData.selling_price),
            deviceIds: [trimmedInput],
            deviceSizes: [idIndex !== -1 ? deviceSizes[idIndex] || '' : ''],
            isQuantityManual: false,
          };
          ls.push(newLine);
          console.log('Added New Line:', ls);
          setLines(ls);
          newDeviceIdx = 0;
          checkSoldDevices(deviceIds, productData.id, ls.length - 1);
          setScannerTarget({ modal, lineIdx: ls.length - 1, deviceIdx: newDeviceIdx });
        }
      }
    } else if (modal === 'edit') {
      if (saleForm.deviceIds.some((id, i) => i !== deviceIdx && id.trim().toLowerCase() === trimmedInput.toLowerCase())) {
        toast.error(`Product ID "${trimmedInput}" already exists in this sale`);
        setScannerError(`Product ID "${trimmedInput}" already exists`);
        setManualInput('');
        return;
      }
      const updatedForm = {
        ...saleForm,
        dynamic_product_id: Number(productData.id),
        unit_price: Number(productData.selling_price),
        deviceIds: [...saleForm.deviceIds.slice(0, deviceIdx), trimmedInput, ...saleForm.deviceIds.slice(deviceIdx + 1)],
        deviceSizes: [...saleForm.deviceSizes.slice(0, deviceIdx), (idIndex !== -1 ? deviceSizes[idIndex] || '' : ''), ...saleForm.deviceSizes.slice(deviceIdx + 1)],
        quantity: saleForm.isQuantityManual ? saleForm.quantity : (saleForm.deviceIds.filter(id => id.trim()).length || 1),
      };
      console.log('Updated Sale Form:', updatedForm);
      setSaleForm(updatedForm);
      newDeviceIdx = deviceIdx;
      checkSoldDevices(deviceIds, productData.id, 0);
      setScannerTarget({ modal, lineIdx, deviceIdx: newDeviceIdx });
    }

    setScannerError(null);
    setScannerLoading(false);
    setManualInput('');
    toast.success(`Added Product ID: ${trimmedInput}`);
  } else {
    console.error('No scanner target set');
    toast.error('No scanner target set');
    setManualInput('');
  }
};



  // Data Fetching
 const fetchProducts = useCallback(async () => {
  if (!storeId) return;
  const { data, error } = await supabase
    .from('dynamic_product')
    .select('id, name, selling_price, dynamic_product_imeis, device_size')
    .eq('store_id', storeId)
    .order('name');
  if (error) {
    toast.error(`Failed to fetch products: ${error.message}`);
    setProducts([]);
  } else {
    const processedProducts = (data || []).map(p => ({
      ...p,
      deviceIds: p.dynamic_product_imeis ? p.dynamic_product_imeis.split(',').filter(id => id.trim()) : [],
      deviceSizes: p.device_size ? p.device_size.split(',').filter(size => size.trim()) : [],
    }));
    console.log('Fetched Products:', processedProducts);
    setProducts(processedProducts);
  }
}, [storeId]);


  const fetchInventory = useCallback(async () => {
    if (!storeId) return;
    const { data, error } = await supabase
      .from('dynamic_inventory')
      .select('dynamic_product_id, available_qty')
      .eq('store_id', storeId);
    if (error) {
      toast.error(`Failed to fetch inventory: ${error.message}`);
      setInventory([]);
    } else {
      setInventory(data || []);
    }
  }, [storeId]);

  const fetchSales = useCallback(async () => {
    if (!storeId) return;
    const { data, error } = await supabase
      .from('dynamic_sales')
      .select(`
        id,
        sale_group_id,
        dynamic_product_id,
        quantity,
        unit_price,
        amount,
        payment_method,
        paid_to,
        device_id,
        device_size,
        sold_at,
        dynamic_product(name)
      `)
      .eq('store_id', storeId)
      .order('sold_at', { ascending: false });
    if (error) {
      toast.error(`Failed to fetch sales: ${error.message}`);
      setSales([]);
      setFiltered([]);
    } else {
      const processedSales = (data || []).map(sale => ({
        ...sale,
        deviceIds: sale.device_id ? sale.device_id.split(',').filter(id => id.trim()) : [],
        deviceSizes: sale.device_size ? sale.device_size.split(',').filter(size => size.trim()) : [],
      }));
      setSales(processedSales);
      setFiltered(processedSales);
    }
  }, [storeId]);

  useEffect(() => {
    fetchProducts();
    fetchInventory();
    fetchSales();
  }, [fetchProducts, fetchInventory, fetchSales]);

  // Search Filter
  useEffect(() => {
    if (!search) return setFiltered(sales);
    const q = search.toLowerCase();
    setFiltered(
      sales.filter(
        (s) =>
          s.dynamic_product.name.toLowerCase().includes(q) ||
          s.payment_method.toLowerCase().includes(q) ||
          s.deviceIds.some(id => id.toLowerCase().includes(q)) ||
          s.deviceSizes.some(size => size.toLowerCase().includes(q))
      )
    );
    setCurrentPage(1);
  }, [search, sales]);

  // Reset Pagination on View Mode Change
  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode]);


  
  // Form Handlers
const handleLineChange = async (lineIdx, field, value, deviceIdx = null, isBlur = false) => {
  if (field === 'deviceIds' && deviceIdx !== null) {
    // Update deviceIds immediately without validation on onChange
    setLines((ls) => {
      const next = [...ls];
      next[lineIdx].deviceIds[deviceIdx] = value;
      if (!value.trim()) {
        next[lineIdx].deviceSizes[deviceIdx] = '';
      }
      return next;
    });

    // Perform validation only onBlur or Enter
    if (isBlur && value.trim()) {
      const trimmedInput = value.trim();
      console.log('Validating Device ID:', trimmedInput, 'Line:', lineIdx, 'DeviceIdx:', deviceIdx);

      // Check if device ID is already sold
      const { data: soldData, error: soldError } = await supabase
        .from('dynamic_sales')
        .select('device_id')
        .eq('device_id', trimmedInput)
        .eq('store_id', storeId)
        .single();
      if (soldError && soldError.code !== 'PGRST116') {
        console.error('Error checking sold status:', soldError);
        toast.error('Failed to validate Product ID');
        setLines((ls) => {
          const next = [...ls];
          next[lineIdx].deviceIds[deviceIdx] = '';
          next[lineIdx].deviceSizes[deviceIdx] = '';
          return next;
        });
        return;
      }
      if (soldData) {
        console.log('Device ID is sold:', trimmedInput);
        toast.error(`Product ID "${trimmedInput}" has already been sold`);
        setLines((ls) => {
          const next = [...ls];
          next[lineIdx].deviceIds[deviceIdx] = '';
          next[lineIdx].deviceSizes[deviceIdx] = '';
          return next;
        });
        return;
      }

      // Query dynamic_product for matching device ID
      const { data: productData, error } = await supabase
        .from('dynamic_product')
        .select('id, name, selling_price, dynamic_product_imeis, device_size')
        .eq('store_id', storeId)
        .ilike('dynamic_product_imeis', `%${trimmedInput}%`)
        .limit(1)
        .single();

      setLines((ls) => {
        const next = [...ls];
        if (error || !productData) {
          console.error('Supabase error for Device ID:', error, 'Input:', trimmedInput);
          toast.error(`Product ID "${trimmedInput}" not found`);
          next[lineIdx].deviceIds[deviceIdx] = trimmedInput;
          next[lineIdx].deviceSizes[deviceIdx] = '';
          return next;
        }

        console.log('Found Product for ID:', productData);

        const deviceIds = productData.dynamic_product_imeis ? productData.dynamic_product_imeis.split(',').map(id => id.trim()).filter(id => id) : [];
        const deviceSizes = productData.device_size ? productData.device_size.split(',').map(size => size.trim()).filter(size => size) : [];
        const idIndex = deviceIds.indexOf(trimmedInput);

        const existingLineIdx = next.findIndex(line => {
          const product = products.find(p => p.id === line.dynamic_product_id);
          return product && product.name === productData.name;
        });

        const currentLineProduct = next[lineIdx].dynamic_product_id ? products.find(p => p.id === next[lineIdx].dynamic_product_id) : null;
        const isCurrentLineMatching = currentLineProduct && currentLineProduct.name === productData.name;

        if (existingLineIdx !== -1 && existingLineIdx !== lineIdx) {
          if (next[existingLineIdx].deviceIds.some(id => id.trim().toLowerCase() === trimmedInput.toLowerCase())) {
            toast.error(`Product ID "${trimmedInput}" already exists in this product`);
            next[lineIdx].deviceIds[deviceIdx] = '';
            return next;
          }
          next[existingLineIdx].deviceIds.push(trimmedInput);
          next[existingLineIdx].deviceSizes.push(idIndex !== -1 ? deviceSizes[idIndex] || '' : '');
          if (!next[existingLineIdx].isQuantityManual) {
            next[existingLineIdx].quantity = next[existingLineIdx].deviceIds.filter(id => id.trim()).length || 1;
          }
          next[lineIdx].deviceIds[deviceIdx] = '';
          console.log('Appended to Existing Line:', { existingLineIdx, deviceIds: next[existingLineIdx].deviceIds });
          checkSoldDevices(deviceIds, productData.id, existingLineIdx);
        } else if (isCurrentLineMatching || !next[lineIdx].dynamic_product_id) {
          if (next[lineIdx].deviceIds.some((id, idx) => idx !== deviceIdx && id.trim().toLowerCase() === trimmedInput.toLowerCase())) {
            toast.error(`Product ID "${trimmedInput}" already exists in this line`);
            next[lineIdx].deviceIds[deviceIdx] = '';
            return next;
          }
          next[lineIdx].dynamic_product_id = Number(productData.id);
          next[lineIdx].unit_price = Number(productData.selling_price);
          next[lineIdx].deviceIds[deviceIdx] = trimmedInput;
          next[lineIdx].deviceSizes[deviceIdx] = idIndex !== -1 ? deviceSizes[idIndex] || '' : '';
          if (!next[lineIdx].isQuantityManual) {
            next[lineIdx].quantity = next[lineIdx].deviceIds.filter(id => id.trim()).length || 1;
          }
          console.log('Updated Current Line:', { lineIdx, deviceIds: next[lineIdx].deviceIds });
          checkSoldDevices(deviceIds, productData.id, lineIdx);
          return next;
        } else {
          if (next.some(line => line.deviceIds.some(id => id.trim().toLowerCase() === trimmedInput.toLowerCase()))) {
            toast.error(`Product ID "${trimmedInput}" already exists in another product`);
            next[lineIdx].deviceIds[deviceIdx] = '';
            return next;
          }
          const newLine = {
            dynamic_product_id: Number(productData.id),
            quantity: 1,
            unit_price: Number(productData.selling_price),
            deviceIds: [trimmedInput],
            deviceSizes: [idIndex !== -1 ? deviceSizes[idIndex] || '' : ''],
            isQuantityManual: false,
          };
          next.push(newLine);
          next[lineIdx].deviceIds[deviceIdx] = '';
          console.log('Added New Line:', { newLineIdx: next.length - 1, deviceIds: newLine.deviceIds });
          checkSoldDevices(deviceIds, productData.id, next.length - 1);
        }

        // Cleanup: Clear or remove original row
        console.log('Before cleanup:', { lineIdx, dynamic_product_id: next[lineIdx].dynamic_product_id, deviceIds: next[lineIdx].deviceIds });
        if (next[lineIdx].dynamic_product_id) {
          next[lineIdx].deviceIds = next[lineIdx].deviceIds.map((id, idx) => (idx === deviceIdx ? '' : id));
          next[lineIdx].deviceSizes = next[lineIdx].deviceSizes.map((size, idx) => (idx === deviceIdx ? '' : size));
          if (!next[lineIdx].isQuantityManual) {
            next[lineIdx].quantity = next[lineIdx].deviceIds.filter(id => id.trim()).length || 1;
          }
        } else if (next.length > 1 && next[lineIdx].deviceIds.every(id => !id.trim())) {
          next.splice(lineIdx, 1);
          console.log('Removed empty row:', { lineIdx });
        } else if (next.length === 1 && next[0].deviceIds.every(id => !id.trim())) {
          next[0] = {
            dynamic_product_id: null,
            quantity: 1,
            unit_price: 0,
            deviceIds: [''],
            deviceSizes: [''],
            isQuantityManual: false,
          };
          console.log('Reset only row:', { lineIdx });
        }
        console.log('After cleanup:', { lineIdx, dynamic_product_id: next[lineIdx]?.dynamic_product_id, deviceIds: next[lineIdx]?.deviceIds });

        return next;
      });
    }
  } else {
    setLines((ls) => {
      const next = [...ls];
      if (field === 'deviceSizes' && deviceIdx !== null) {
        next[lineIdx].deviceSizes[deviceIdx] = value;
      } else if (field === 'quantity') {
        next[lineIdx].quantity = +value;
        next[lineIdx].isQuantityManual = true;
      } else if (field === 'unit_price') {
        next[lineIdx].unit_price = +value;
      } else if (field === 'dynamic_product_id') {
        next[lineIdx].dynamic_product_id = +value;
        const prod = products.find((p) => p.id === +value);
        if (prod) {
          next[lineIdx].unit_price = prod.selling_price;
          checkSoldDevices(prod.deviceIds, prod.id, lineIdx);
          next[lineIdx].deviceIds = [];
          next[lineIdx].deviceSizes = [];
          next[lineIdx].quantity = next[lineIdx].isQuantityManual ? next[lineIdx].quantity : 1;
        }
        const inv = inventory.find((i) => i.dynamic_product_id === +value);
        if (inv && inv.available_qty < 6) {
          const prodName = prod?.name || 'this product';
          toast.warning(`Low stock: only ${inv.available_qty} left for ${prodName}`);
        }
      }
      console.log('Updated Lines (Other Fields):', next);
      return next;
    });
  }
};



  const addDeviceId = (e, lineIdx) => {
    e.preventDefault();
    if (isProcessingClick.current) return;
    isProcessingClick.current = true;
    setTimeout(() => { isProcessingClick.current = false; }, 100);
    setLines((ls) => {
      const next = ls.map((line, idx) => {
        if (idx === lineIdx) {
          return {
            ...line,
            deviceIds: [...line.deviceIds, ''],
            deviceSizes: [...line.deviceSizes, ''],
            quantity: line.isQuantityManual ? line.quantity : (line.deviceIds.filter(id => id.trim()).length + 1 || 1),
            isQuantityManual: false,
          };
        }
        return line;
      });
      return next;
    });
  };

  const removeDeviceId = (lineIdx, deviceIdx) => {
    setLines((ls) => {
      const next = [...ls];
      next[lineIdx].deviceIds = next[lineIdx].deviceIds.filter((_, i) => i !== deviceIdx);
      next[lineIdx].deviceSizes = next[lineIdx].deviceSizes.filter((_, i) => i !== deviceIdx);
      if (next[lineIdx].deviceIds.length === 0) {
        next[lineIdx].deviceIds = [''];
        next[lineIdx].deviceSizes = [''];
      }
      if (!next[lineIdx].isQuantityManual) {
        const nonEmptyCount = next[lineIdx].deviceIds.filter(id => id.trim()).length;
        next[lineIdx].quantity = nonEmptyCount || 1;
      }
      next[lineIdx].isQuantityManual = false;
      return next;
    });
  };

  const addLine = () => setLines((ls) => [
    ...ls,
    { dynamic_product_id: '', quantity: 1, unit_price: '', deviceIds: [''], deviceSizes: [''], isQuantityManual: false },
  ]);

  const removeLine = (idx) => setLines((ls) => ls.filter((_, i) => i !== idx));

 const handleEditChange = (field, value, deviceIdx = null) => {
  setSaleForm((f) => {
    const next = { ...f };
    if (field === 'deviceIds' && deviceIdx !== null) {
      next.deviceIds[deviceIdx] = value;
      const product = products.find(p => p.id === next.dynamic_product_id);
      if (product && value) {
        const idIndex = product.deviceIds.indexOf(value);
        if (idIndex !== -1) {
          next.deviceSizes[deviceIdx] = product.deviceSizes[idIndex] || '';
        } else {
          next.deviceSizes[deviceIdx] = '';
        }
      }
      if (!next.isQuantityManual) {
        const nonEmptyCount = next.deviceIds.filter(id => id.trim()).length;
        next.quantity = nonEmptyCount || 1;
      }
      next.isQuantityManual = false;
    } else if (field === 'deviceSizes' && deviceIdx !== null) {
      next.deviceSizes[deviceIdx] = value;
    } else if (field === 'quantity') {
      next.quantity = +value;
      next.isQuantityManual = true;
    } else if (field === 'dynamic_product_id') {
      next.dynamic_product_id = +value;
      const prod = products.find((p) => p.id === +value);
      if (prod) {
        next.unit_price = prod.selling_price;
        checkSoldDevices(prod.deviceIds, prod.id, 0);
        next.deviceIds = [''];
        next.deviceSizes = [''];
        next.quantity = next.isQuantityManual ? next.quantity : 1;
      }
    } else {
      next[field] = ['unit_price'].includes(field) ? +value : value;
    }
    return next;
  });
};

  const addEditDeviceId = (e) => {
    e.preventDefault();
    if (isProcessingClick.current) return;
    isProcessingClick.current = true;
    setTimeout(() => { isProcessingClick.current = false; }, 100);
    setSaleForm((f) => {
      const newDeviceIds = [...f.deviceIds, ''];
      const newDeviceSizes = [...f.deviceSizes, ''];
      const nonEmptyCount = newDeviceIds.filter(id => id.trim()).length;
      return {
        ...f,
        deviceIds: newDeviceIds,
        deviceSizes: newDeviceSizes,
        quantity: f.isQuantityManual ? f.quantity : (nonEmptyCount || 1),
        isQuantityManual: false,
      };
    });
  };

  const removeEditDeviceId = (deviceIdx) => {
    setSaleForm((f) => {
      const newDeviceIds = f.deviceIds.filter((_, i) => i !== deviceIdx);
      const newDeviceSizes = f.deviceSizes.filter((_, i) => i !== deviceIdx);
      const nonEmptyCount = newDeviceIds.filter(id => id.trim()).length;
      return {
        ...f,
        deviceIds: newDeviceIds.length === 0 ? [''] : newDeviceIds,
        deviceSizes: newDeviceSizes.length === 0 ? [''] : newDeviceSizes,
        quantity: f.isQuantityManual ? f.quantity : (nonEmptyCount || 1),
        isQuantityManual: false,
      };
    });
  };

  const openDetailModal = (sale) => {
    const deviceInfo = sale.deviceIds.map((id, i) => ({
      id: id || '',
      size: sale.deviceSizes[i] || '',
    }));
    setSelectedDeviceInfo(deviceInfo);
    setDetailPage(1);
    setShowDetailModal(true);
  };

  // CRUD Operations
  const createSale = async (e) => {
    e.preventDefault();
    try {
      if (!paymentMethod) {
        toast.error('Please select a payment method.');
        return;
      }
      for (const line of lines) {
        if (!line.dynamic_product_id || line.quantity <= 0 || line.unit_price <= 0) {
          toast.error('Please fill in all required fields for each sale line.');
          return;
        }
        const inv = inventory.find((i) => i.dynamic_product_id === line.dynamic_product_id);
        if (!inv || inv.available_qty < line.quantity) {
          const prod = products.find((p) => p.id === line.dynamic_product_id);
          toast.error(`Insufficient stock for ${prod.name}: only ${inv?.available_qty || 0} available`);
          return;
        }
        const deviceIds = line.deviceIds.filter(id => id.trim());
        if (deviceIds.length > 0) {
          const uniqueIds = new Set(deviceIds);
          if (uniqueIds.size < deviceIds.length) {
            toast.error('Duplicate Product IDs detected in this sale line');
            return;
          }
        }
      }

      const { data: grp, error: grpErr } = await supabase
        .from('sale_groups')
        .insert([{ store_id: storeId, total_amount: totalAmount, payment_method: paymentMethod }])
        .select('id')
        .single();
      if (grpErr) throw new Error(`Sale group creation failed: ${grpErr.message}`);
      const groupId = grp.id;

      const inserts = lines.map((l) => ({
        store_id: storeId,
        sale_group_id: groupId,
        dynamic_product_id: l.dynamic_product_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        amount: l.quantity * l.unit_price,
        device_id: l.deviceIds.filter(id => id.trim()).join(',') || null,
        device_size: l.deviceSizes.map(size => size.trim() || '').join(',') || null,
        payment_method: paymentMethod,
      }));
      const { error: insErr } = await supabase.from('dynamic_sales').insert(inserts);
      if (insErr) throw new Error(`Sales insertion failed: ${insErr.message}`);

      for (const line of lines) {
        const inv = inventory.find((i) => i.dynamic_product_id === line.dynamic_product_id);
        if (inv) {
          const newQty = inv.available_qty - line.quantity;
          const { error } = await supabase
            .from('dynamic_inventory')
            .update({ available_qty: newQty })
            .eq('dynamic_product_id', line.dynamic_product_id)
            .eq('store_id', storeId);
          if (error) toast.error(`Inventory update failed for product ${line.dynamic_product_id}`);
          setInventory((prev) =>
            prev.map((i) =>
              i.dynamic_product_id === line.dynamic_product_id ? { ...i, available_qty: newQty } : i
            )
          );
        }
      }

      toast.success('Sale added successfully!');
      stopScanner();
      setShowAdd(false);
      setLines([{ dynamic_product_id: '', quantity: 1, unit_price: '', deviceIds: [''], deviceSizes: [''], isQuantityManual: false }]);
      setPaymentMethod('Cash');
      fetchSales();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const saveEdit = async () => {
  try {
    const originalSale = sales.find((s) => s.id === editing);
    if (!originalSale) throw new Error('Sale not found');

    const quantityDiff = saleForm.quantity - originalSale.quantity;
    if (quantityDiff > 0) {
      const inv = inventory.find((i) => i.dynamic_product_id === saleForm.dynamic_product_id || originalSale.dynamic_product_id);
      if (!inv || inv.available_qty < quantityDiff) {
        throw new Error(
          `Insufficient stock to increase quantity by ${quantityDiff}. Available: ${inv?.available_qty || 0}`
        );
      }
    }

    const deviceIds = saleForm.deviceIds.filter(id => id.trim());
    if (deviceIds.length > 0) {
      const uniqueIds = new Set(deviceIds);
      if (uniqueIds.size < deviceIds.length) {
        toast.error('Duplicate Product IDs detected in this sale');
        return;
      }
    }

    const { error } = await supabase
      .from('dynamic_sales')
      .update({
        dynamic_product_id: saleForm.dynamic_product_id || originalSale.dynamic_product_id,
        quantity: saleForm.quantity,
        unit_price: saleForm.unit_price,
        device_id: deviceIds.join(',') || null,
        device_size: saleForm.deviceSizes.map(size => size.trim() || '').join(',') || null,
        payment_method: saleForm.payment_method || originalSale.payment_method,
      })
      .eq('id', editing);
    if (error) throw new Error(`Update failed: ${error.message}`);

    if (quantityDiff !== 0) {
      const inv = inventory.find((i) => i.dynamic_product_id === saleForm.dynamic_product_id || originalSale.dynamic_product_id);
      if (inv) {
        const newQty = inv.available_qty - quantityDiff;
        await supabase
          .from('dynamic_inventory')
          .update({ available_qty: newQty })
          .eq('dynamic_product_id', saleForm.dynamic_product_id || originalSale.dynamic_product_id)
          .eq('store_id', storeId);
        setInventory((prev) =>
          prev.map((i) =>
            i.dynamic_product_id === (saleForm.dynamic_product_id || originalSale.dynamic_product_id)
              ? { ...i, available_qty: newQty }
              : i
          )
        );
      }
    }

    toast.success('Sale updated successfully!');
    stopScanner();
    setEditing(null);
    fetchSales();
  } catch (err) {
    toast.error(err.message);
  }
};



  // Export Functions
  const exportCSV = () => {
    let csv = '';
    if (viewMode === 'list') {
      csv = 'Product,Product IDs,Product Sizes,Quantity,Unit Price,Amount,Payment Method,Sold At\n';
      filtered.forEach((s) => {
        csv += [
          `"${s.dynamic_product.name.replace(/"/g, '""')}"`,
          s.deviceIds.join(';') || '-',
          s.deviceSizes.join(';') || '-',
          s.quantity,
          s.unit_price.toFixed(2),
          s.amount.toFixed(2),
          s.payment_method,
          `"${new Date(s.sold_at).toLocaleString()}"`,
        ].join(',') + '\n';
      });
    } else {
      csv = 'Period,Total Sales,Number of Sales\n';
      totalsData.forEach((t) => {
        csv += [
          `"${t.period.replace(/"/g, '""')}"`,
          t.total.toFixed(2),
          t.count,
        ].join(',') + '\n';
      });
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = viewMode === 'list' ? 'sales.csv' : `${viewMode}_totals.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported successfully!');
  };

  const exportPDF = () => {
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF();
      let y = 10;
      doc.text(viewMode === 'list' ? 'Sales Report' : `${viewMode.charAt(0).toUpperCase()}${viewMode.slice(1)} Sales Totals`, 10, y);
      y += 10;
      if (viewMode === 'list') {
        filtered.forEach((s) => {
          doc.text(
            `Product: ${s.dynamic_product.name}, Devices: ${s.deviceIds.join(', ') || '-'}, Sizes: ${s.deviceSizes.join(', ') || '-'}, Qty: ${s.quantity}, Unit: ${s.unit_price.toFixed(2)}, Amt: ${s.amount.toFixed(2)}, Pay: ${s.payment_method}, At: ${new Date(s.sold_at).toLocaleString()}`,
            10,
            y
          );
          y += 10;
          if (y > 280) {
            doc.addPage();
            y = 10;
          }
        });
      } else {
        totalsData.forEach((t) => {
          doc.text(`Period: ${t.period}, Total: ${t.total.toFixed(2)}, Sales: ${t.count}`, 10, y);
          y += 10;
          if (y > 280) {
            doc.addPage();
            y = 10;
          }
        });
      }
      doc.save(viewMode === 'list' ? 'sales.pdf' : `${viewMode}_totals.pdf`);
      toast.success('PDF exported successfully!');
    });
  };

  // Onboarding Handlers
  const handleNextStep = () => {
    if (onboardingStep < onboardingSteps.length - 1) {
      setOnboardingStep(onboardingStep + 1);
    } else {
      setShowOnboarding(false);
      localStorage.setItem('salesTrackerOnboardingCompleted', 'true');
    }
  };

  const handleSkipOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('salesTrackerOnboardingCompleted', 'true');
  };

  const getTooltipPosition = (target) => {
    const element = document.querySelector(target);
    if (!element) return { top: '0px', left: '0px' };
    const rect = element.getBoundingClientRect();
    return {
      top: `${rect.bottom + window.scrollY + 10}px`,
      left: `${rect.left + window.scrollX}px`,
    };
  };

  // Render
  return (
    <div className="p-2 max-w-7xl mx-auto dark:bg-gray-900 dark:text-white">
      <ToastContainer position="top-right" autoClose={3000} />
   
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">View:</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="p-2 border rounded dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 view-mode-selector"
            >
              <option value="list">Individual Sales</option>
              <option value="daily">Daily Totals</option>
              <option value="weekly">Weekly Totals</option>
            </select>
          </div>
          {viewMode === 'list' && (
            <input
              type="text"
              placeholder="Search by product, payment, Product ID, or size…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="p-2 border rounded w-full sm:w-64 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 search-input"
            />
          )}
        </div>
        
        <button
  onClick={() => setShowAdd(true)}
  className="flex items-center justify-center gap-2 px-4 py-2 text-sm sm:text-base bg-indigo-600 text-white rounded-md hover:bg-indigo-700 w-full sm:w-auto new-sale-button"
>
  <FaPlus className="text-sm sm:text-base" /> New Sale
</button>

      </div>

   {/* Add Sale Modal */}
{showAdd && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center sm:items-start justify-center p-4 z-50 overflow-auto mt-0 sm:mt-16">
    <form
      onSubmit={createSale}
       className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg w-full max-w-3xl max-h-[85vh] overflow-y-auto space-y-4"
    >
      <h2 className="text-lg sm:text-xl font-bold text-center text-gray-900 dark:text-gray-200">
        Add Sale
      </h2>
      {lines.map((line, lineIdx) => (
        <div key={lineIdx} className="border border-gray-200 dark:border-gray-700 p-3 sm:p-4 rounded-lg space-y-3 dark:bg-gray-800">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-200">
              Sale Item {lineIdx + 1}
            </h3>
            {lines.length > 1 && (
              <button
                type="button"
                onClick={() => removeLine(lineIdx)}
                className="p-1.5 sm:p-2 bg-red-600 text-white rounded-full shadow-sm hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 transition-colors duration-200"
                aria-label={`Remove sale item ${lineIdx + 1}`}
                disabled={lines.length === 1}
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
          <div className="flex flex-col gap-3 sm:gap-4">
            {[
              { name: 'dynamic_product_id', label: 'Product', type: 'select', required: true },
              { name: 'quantity', label: 'Quantity', type: 'number', min: 1, required: true },
              { name: 'unit_price', label: 'Unit Price', type: 'number', step: '0.01', required: true },
            ].map(field => (
              <label key={field.name} className="block">
                <span className="font-semibold block mb-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                  {field.label}
                </span>
                {field.type === 'select' ? (
                  <select
                    name={field.name}
                    value={line[field.name] || ''}
                    onChange={(e) => handleLineChange(lineIdx, field.name, e.target.value)}
                    className="w-full p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px]"
                    required={field.required}
                  >
                    <option value="">Select {field.label.toLowerCase()}…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    name={field.name}
                    value={line[field.name] || ''}
                    onChange={(e) => handleLineChange(lineIdx, field.name, e.target.value)}
                    min={field.min}
                    step={field.step}
                    className="w-full p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px]"
                    required={field.required}
                  />
                )}
              </label>
            ))}
            <label className="block">
              <span className="font-semibold block mb-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                Product IDs and Sizes (Optional)
              </span>
              {line.deviceIds.map((id, deviceIdx) => (
                <div key={deviceIdx} className="flex flex-col gap-3 sm:gap-4 mt-2">
                  <select
                    value={id}
                    onChange={(e) => handleLineChange(lineIdx, 'deviceIds', e.target.value, deviceIdx)}
                    className="w-full p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px]"
                  >
                    <option value="">Select Product ID (Optional)</option>
                    {(availableDeviceIds[lineIdx]?.deviceIds || []).map((deviceId) => (
                      <option key={deviceId} value={deviceId}>{deviceId}</option>
                    ))}
                  </select>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <input
                      type="text"
                      value={id}
                      onChange={(e) => handleLineChange(lineIdx, 'deviceIds', e.target.value, deviceIdx)}
                      onBlur={(e) => handleLineChange(lineIdx, 'deviceIds', e.target.value, deviceIdx, true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleLineChange(lineIdx, 'deviceIds', e.target.value, deviceIdx, true);
                        }
                      }}
                      placeholder="Or enter product ID manually"
                      className="flex-1 p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px]"
                    />
                    <div className="flex gap-2 sm:gap-3 mt-1 sm:mt-0">
                      <button
                        type="button"
                        onClick={() => openScanner('add', lineIdx, deviceIdx)}
                        className="p-2 sm:p-2.5 bg-indigo-600 text-white rounded-full shadow-sm hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors duration-200"
                        aria-label={`Scan barcode for product ID ${deviceIdx + 1}`}
                      >
                        <FaCamera className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeDeviceId(lineIdx, deviceIdx)}
                        className="p-2 sm:p-2.5 bg-red-600 text-white rounded-full shadow-sm hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 transition-colors duration-200"
                        aria-label={`Remove product ID ${deviceIdx + 1}`}
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
                    </div>
                  </div>
                  <input
                    type="text"
                    value={line.deviceSizes[deviceIdx] || ''}
                    onChange={(e) => handleLineChange(lineIdx, 'deviceSizes', e.target.value, deviceIdx)}
                    placeholder="Enter Product/Goods/Device Size (Optional)"
                    className="w-full p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px]"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={(e) => addDeviceId(e, lineIdx)}
                className="mt-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm font-semibold"
                aria-label={`Add product ID and size for sale item ${lineIdx + 1}`}
              >
                + Add Product ID & Size
              </button>
            </label>
            <label className="block">
              <span className="font-semibold block mb-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                Payment Method
              </span>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px]"
                required
              >
                <option value="">Select payment method…</option>
                <option>Cash</option>
                <option>Bank Transfer</option>
                <option>Card</option>
                <option>Wallet</option>
              </select>
            </label>
          </div>
        </div>
      ))}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-200">
          Total: ₦{totalAmount.toFixed(2)}
        </div>
        <button
          type="button"
          onClick={addLine}
          className="p-2 sm:p-3 bg-green-600 text-white rounded-full shadow-sm hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-colors duration-200 w-full sm:w-auto flex items-center justify-center gap-2"
          aria-label="Add another sale item"
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
          <span className="text-sm sm:text-base">Add Item</span>
        </button>
       <div className="flex justify-end gap-2 sm:gap-3">
  <button
    type="button"
    onClick={() => {
      stopScanner();
      setShowAdd(false);
    }}
    className="p-2 sm:p-3 bg-gray-500 text-white rounded-full shadow-sm hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500 transition-colors duration-200"
            aria-label="Cancel sale form"
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
    className="p-2 sm:p-3 bg-indigo-600 text-white rounded-full shadow-sm hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-colors duration-200 w-full sm:w-auto flex items-center justify-center gap-2"
    aria-label="Save sale"
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
    </form>
  </div>
)}

{/* Edit Sale Modal */}
{/* Edit Sale Modal */}
{editing && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center sm:items-start justify-center p-4 z-50 overflow-auto mt-0 sm:mt-16">
    <form
      onSubmit={(e) => {
        e.preventDefault();
        saveEdit();
      }}
      className="bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-4"
    >
      <h2 className="text-lg sm:text-xl font-bold text-center text-gray-900 dark:text-gray-200">
        Edit Sale #{editing}
      </h2>
      <div className="flex flex-col gap-3 sm:gap-4">
        {[
          { name: 'dynamic_product_id', label: 'Product', type: 'select', required: true },
          { name: 'quantity', label: 'Quantity', type: 'number', min: 1, required: true },
          { name: 'unit_price', label: 'Unit Price', type: 'number', step: '0.01', required: true },
          { name: 'payment_method', label: 'Payment Method', type: 'select', required: true },
        ].map(field => (
          <label key={field.name} className="block">
            <span className="font-semibold block mb-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
              {field.label}
            </span>
            {field.type === 'select' ? (
              <select
                name={field.name}
                value={saleForm[field.name] || ''}
                onChange={(e) => handleEditChange(field.name, e.target.value)}
                className="w-full p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px]"
                required={field.required}
              >
                {field.name === 'dynamic_product_id' ? (
                  <>
                    <option value="">Select product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </>
                ) : (
                  <>
                    <option value="">Select payment method…</option>
                    <option>Cash</option>
                    <option>Bank Transfer</option>
                    <option>Card</option>
                    <option>Wallet</option>
                  </>
                )}
              </select>
            ) : (
              <input
                type={field.type}
                name={field.name}
                value={saleForm[field.name] || ''}
                onChange={(e) => handleEditChange(field.name, e.target.value)}
                min={field.min}
                step={field.step}
                className="w-full p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px]"
                required={field.required}
              />
            )}
          </label>
        ))}
        <label className="block">
          <span className="font-semibold block mb-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
            Product IDs and Sizes (Optional)
          </span>
          {saleForm.deviceIds.map((id, deviceIdx) => (
            <div key={`edit-device-${deviceIdx}`} className="flex flex-col gap-3 sm:gap-4 mt-2">
              <select
                value={id}
                onChange={(e) => handleEditChange('deviceIds', e.target.value, deviceIdx)}
                className="w-full p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px]"
              >
                <option value="">Select Product ID (Optional)</option>
                {(availableDeviceIds[0]?.deviceIds || []).map((deviceId) => (
                  <option key={deviceId} value={deviceId}>{deviceId}</option>
                ))}
              </select>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <input
                  type="text"
                  value={id}
                  onChange={(e) => handleEditChange('deviceIds', e.target.value, deviceIdx)}
                  placeholder="Or enter Product ID manually"
                  className="flex-1 p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px]"
                />
                <div className="flex gap-2 sm:gap-3 mt-1 sm:mt-0">
                  <button
                    type="button"
                    onClick={() => openScanner('edit', 0, deviceIdx)}
                    className="p-2 sm:p-2.5 bg-indigo-600 text-white rounded-full shadow-sm hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors duration-200"
                    aria-label={`Scan barcode for product ID ${deviceIdx + 1}`}
                  >
                    <FaCamera className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeEditDeviceId(deviceIdx)}
                    className="p-2 sm:p-2.5 bg-red-600 text-white rounded-full shadow-sm hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 transition-colors duration-200"
                    aria-label={`Remove product ID ${deviceIdx + 1}`}
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
                </div>
              </div>
              <input
                type="text"
                value={saleForm.deviceSizes[deviceIdx] || ''}
                onChange={(e) => handleEditChange('deviceSizes', e.target.value, deviceIdx)}
                placeholder="Enter Product size (Optional)"
                className="w-full p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px]"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={(e) => addEditDeviceId(e)}
            className="mt-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm font-semibold"
            aria-label="Add product ID and size"
          >
            + Add Product ID & Size
          </button>
        </label>
      </div>
      <div className="flex justify-end gap-2 sm:gap-3 mt-4">
        <button
          type="button"
          onClick={async () => {
            await stopScanner();
            setShowScanner(false);
            setScannerTarget(null);
            setScannerError(null);
            setScannerLoading(false);
            setManualInput('');
            setExternalScannerMode(false);
            setEditing(null);
          }}
          className="p-2 sm:p-2.5 bg-gray-500 text-white rounded-full shadow-sm hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500 transition-colors duration-200 min-w-[40px] sm:min-w-[48px] flex items-center justify-center"
          aria-label="Cancel edit sale form"
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
          className="p-2 sm:p-2.5 bg-indigo-600 text-white rounded-full shadow-sm hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors duration-200 min-w-[40px] sm:min-w-[48px] flex items-center justify-center"
          aria-label="Save edit sale"
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
)}
      {showDetailModal && (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4 z-50">
    <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
      <h2 className="text-xl font-semibold mb-6">Product IDs and Sizes</h2>
      <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
        {paginatedDevices.map((device, i) => {
          const displayText = `ID: ${device.id || '-'} (size: ${device.size || '-'})`;
          const q = search.trim().toLowerCase();
          const match = device.id.toLowerCase().includes(q) || device.size.toLowerCase().includes(q);
          return (
            <li
              key={i}
              className={['py-2 px-4', match ? 'bg-yellow-100 dark:bg-yellow-900' : ''].filter(Boolean).join(' ')}
            >
              <span className={match ? 'font-semibold' : ''}>{displayText}</span>
            </li>
          );
        })}
      </ul>
      {totalDetailPages > 1 && (
        <div className="flex justify-between items-center mt-4 text-sm text-gray-700 dark:text-gray-300">
          <button
            type="button"
            onClick={() => setDetailPage(p => Math.max(p - 1, 1))}
            disabled={detailPage === 1}
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            Previous
          </button>
          <span>
            Page {detailPage} of {totalDetailPages}
          </span>
          <button
            type="button"
            onClick={() => setDetailPage(p => Math.min(p + 1, totalDetailPages))}
            disabled={detailPage === totalDetailPages}
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            Next
          </button>
        </div>
      )}
      <div className="flex justify-end mt-4">
        <button
          type="button"
          onClick={() => setShowDetailModal(false)}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
        >
          Close
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
                  onChange={() => setExternalScannerMode((prev) => !prev)}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                />
                <span>Use External Barcode Scanner</span>
              </label>
            </div>
            {!externalScannerMode && (
              <>
                {scannerLoading && (
                  <div className="text-gray-600 dark:text-gray-400 mb-4">Initializing webcam scanner...</div>
                )}
                {scannerError && (
                  <div className="text-red-600 dark:text-red-400 mb-4">{scannerError}</div>
                )}
                <div
                  id="scanner"
                  ref={scannerDivRef}
                  className="relative w-full h-64 mb-4 bg-gray-100 dark:bg-gray-800"
                >
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    autoPlay
                    playsInline
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[250px] h-[100px] border-2 border-red-500 bg-transparent opacity-50"></div>
                  </div>
                </div>
              </>
            )}
          
            {externalScannerMode && (
              <div className="text-gray-600 dark:text-gray-400 mb-4">
                Waiting for external scanner input... Scan a barcode to proceed.
              </div>
            )}
           <div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
    Or Enter Product ID Manually
  </label>
  
  <div className="flex flex-col sm:flex-row gap-2">
    <input
      type="text"
      value={manualInput}
      onChange={(e) => setManualInput(e.target.value)}
      placeholder="Enter Product ID"
      className="w-full sm:flex-1 p-2 border rounded dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

<div className="flex justify-end">
<button
  type="button"
  onClick={() => {
    setShowScanner(false);
    setScannerTarget(null);
    setScannerError(null);
    setScannerLoading(false);
    setManualInput('');
    setExternalScannerMode(false);
    stopScanner();
  }}
  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
>
  Done
</button>
</div>

          </div>
        </div>
      )}

      {/* Sales Table */}
      <div className="overflow-x-auto rounded-lg shadow">
           
         {viewMode === 'list' ? (
           <table className="min-w-full bg-white dark:bg-gray-900 divide-y divide-gray-200">
             <thead className="bg-gray-100 dark:bg-gray-800">
               <tr>
                 {['Product', 'Quantity', 'Unit Price', 'Amount', 'Payment', 'Product IDs/Sizes', 'Date Sold'].map((h) => (
                   <th
                     key={h}
                     className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-200"
                   >
                     {h}
                   </th>
                 ))}
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
               {paginatedSales.map((s, idx) => (
                 <tr key={s.id}>
                   <td className="px-4 py-2 text-sm">{s.dynamic_product.name}</td>
                   <td className="px-4 py-2 text-sm">{s.quantity}</td>
                   <td className="px-4 py-2 text-sm">₦{formatCurrency(s.unit_price)}</td>
                   <td className="px-4 py-2 text-sm">₦{formatCurrency(s.amount)}</td>
                   <td className="px-4 py-2 text-sm">{s.payment_method}</td>
                   <td className="px-4 py-2 text-sm">
                     {s.deviceIds.length > 0 ? (
                       <button
                         type="button"
                         onClick={() => openDetailModal(s)}
                         className="text-indigo-600 hover:underline focus:outline-none"
                       >
                         View {s.deviceIds.length} ID{s.deviceIds.length !== 1 ? 's' : ''}
                       </button>
                     ) : (
                       '-'
                     )}
                   </td>
                   <td className="px-4 py-2 text-sm">{new Date(s.sold_at).toLocaleString()}</td>
                   
                 </tr>
               ))}
             </tbody>
           </table>
         ) : (
           <table className="min-w-full bg-white dark:bg-gray-900 divide-y divide-gray-200">
             <thead className="bg-gray-100 dark:bg-gray-800">
               <tr>
                 <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Period</th>
                 <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Total Sales (₦)</th>
                 <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Number of Sales</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
               {paginatedTotals.map((t, idx) => (
                 <tr key={idx}>
                   <td className="px-4 py-2 text-sm">{t.period}</td>
                   <td className="px-4 py-2 text-sm">₦{formatCurrency(t.total)}</td>
                   <td className="px-4 py-2 text-sm">{t.count}</td>
                 </tr>
               ))}
             </tbody>
           </table>
         )}
       </div>

        {/* Pagination */}
        <div className="flex flex-wrap justify-center items-center gap-2 mt-4">
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600 transition"
          >
            Prev
          </button>
          {[...Array(totalPages).keys()].map((i) => (
            <button
              type="button"
              key={i}
              onClick={() => setCurrentPage(i + 1)}
              className={`px-3 py-1 rounded transition ${
                currentPage === i + 1
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'
                }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-600 dark:hover:bg-gray-700 transition"
          >
            Next
          </button>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap justify-center items-center gap-3 mt-4">
          <button
            type="button"
            onClick={exportCSV}
            className="flex items-center justify-center gap-2 w-full sm:w-44 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition export-csv-button"
            title="Export to CSV"
          >
            <FaFileCsv className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center justify-center gap-2 w-full sm:w-44 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition export-pdf-button"
            title="Export to PDF"
          >
            <FaFilePdf className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
        </div>

        {/* Onboarding Tooltip */}
        {showOnboarding && onboardingStep < onboardingSteps.length && (
          <motion.div
            className="fixed z-50 bg-indigo-700 dark:bg-indigo-900 border border-indigo-300 dark:border-indigo-600 rounded-lg shadow-lg p-4 max-w-xs"
            style={getTooltipPosition(onboardingSteps[onboardingStep].target)}
            variants={tooltipVariants}
            initial="hidden"
            animate="visible"
          >
            <p className="text-sm text-white dark:text-gray-100 mb-2">
              {onboardingSteps[onboardingStep].content}
            </p>
            <div className="flex justify-between items-center">
              <div>
                <span className="text-sm text-gray-300 dark:text-gray-400">
                  Step ${onboardingStep + 1} of ${totalOnboardingSteps.length}
                </span>
                <div className="space-x-3">
                  <button
                    type="button"
                    onClick={handleSkipOnboarding}
                    className="text-sm text-white dark:text-gray-300 hover:text-gray-200 px-2 py-1"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1 rounded"
                  >
                    {onboardingStep + 1 === onboardingSteps.length ? 'Finish' : 'Next'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    );
}