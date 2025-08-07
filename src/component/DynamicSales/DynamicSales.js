import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FaPlus,
  FaTrashAlt,
  FaFileCsv,
  FaFilePdf,
  FaEdit,
  FaCamera,
} from 'react-icons/fa';
import { supabase } from '../../supabaseClient';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { motion } from 'framer-motion';
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScannerState } from 'html5-qrcode';
import CustomerSelector from '../DynamicSales/CustomerSelector';

const tooltipVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function SalesTracker() {
  const storeId = localStorage.getItem('store_id');
  const itemsPerPage = 20;

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
    { dynamic_product_id: '', quantity: 1, unit_price: '', deviceIds: [''], isQuantityManual: false },
  ]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [editing, setEditing] = useState(null);
  const [saleForm, setSaleForm] = useState({
    quantity: 1,
    unit_price: '',
    deviceIds: [''],
    payment_method: 'Cash',
    isQuantityManual: false,
  });


  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerTarget, setScannerTarget] = useState(null);
  const [scannerError, setScannerError] = useState(null);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [externalScannerMode, setExternalScannerMode] = useState(false);
  const [, setAvailableDeviceIds] = useState({});
   const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  // Refs
  const videoRef = useRef(null);
  const scannerDivRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  const debouncedToast = useMemo(() => ({
    success: debounce((message) => {
      toast.dismiss(); // Clear all existing toasts
      toast.success(message);
    }, 300),
    error: debounce((message) => {
      toast.dismiss(); // Clear all existing toasts
      toast.error(message);
    }, 300),
  }), []);

  const checkSoldDevices = useCallback(
    async (deviceIds, productId, lineIdx) => {
      if (!deviceIds || deviceIds.length === 0) {
        setAvailableDeviceIds((prev) => ({ ...prev, [lineIdx]: { deviceIds: [] } }));
        return;
      }
      try {
        const normalizedIds = deviceIds.map((id) => id.trim());
        const { data, error } = await supabase
          .from('dynamic_sales')
          .select('device_id')
          .in('device_id', normalizedIds);
        if (error) throw error;

        const product = products.find((p) => p.id === productId);
        if (!product) {
          setAvailableDeviceIds((prev) => ({ ...prev, [lineIdx]: { deviceIds: [] } }));
          return;
        }

        const deviceIdsFromProduct = product.device_id
          ? product.device_id.split(',').map((id) => id.trim()).filter((id) => id)
          : [];
        const soldDeviceIds = data.map((item) => item.device_id.trim());
        const availableDeviceIds = deviceIdsFromProduct.filter((id) => !soldDeviceIds.includes(id));

        setAvailableDeviceIds((prev) => ({
          ...prev,
          [lineIdx]: { deviceIds: availableDeviceIds },
        }));
      } catch (error) {
        console.error('Error fetching sold devices:', error);
        toast.error('Failed to check sold devices');
        setAvailableDeviceIds((prev) => ({ ...prev, [lineIdx]: { deviceIds: [] } }));
      }
    },
    [products]
  );

  // Utility Function
  const formatCurrency = (value) =>
    value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const successSoundRef = useRef(null);
  const duplicateSoundRef = useRef(null);
  const notFoundSoundRef = useRef(null);

  useEffect(() => {
    successSoundRef.current = new Audio('https://freesound.org/data/previews/171/171671_2437358-lq.mp3');
    duplicateSoundRef.current = new Audio('https://soundjay.com/buttons/sounds/button-5.mp3');
    notFoundSoundRef.current = new Audio('https://www.soundjay.com/buttons/sounds/button-10.mp3');

    // Preload audio
    const preload = (audio) => {
      audio.preload = 'auto';
      audio.load();
    };
    preload(successSoundRef.current);
    preload(duplicateSoundRef.current);
    preload(notFoundSoundRef.current);

    return () => {
      successSoundRef.current = null;
      duplicateSoundRef.current = null;
      notFoundSoundRef.current = null;
    };
  }, []);

  const playSuccessSound = () => {
    if (successSoundRef.current) {
      successSoundRef.current.currentTime = 0;
      successSoundRef.current.play().catch((err) => console.error('Audio play error:', err));
    }
  };

  const playDuplicateSound = () => {
    if (duplicateSoundRef.current) {
      duplicateSoundRef.current.currentTime = 0;
      duplicateSoundRef.current.play().catch((err) => console.error('Audio play error:', err));
    }
  };

  const playNotFoundSound = () => {
    if (notFoundSoundRef.current) {
      notFoundSoundRef.current.currentTime = 0;
      notFoundSoundRef.current.play().catch((err) => console.error('Audio play error:', err));
    }
  };

  // Computed Values
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
  const data = viewMode === 'list' ? filtered : totalsData;
  return Math.ceil(data.length / itemsPerPage);
}, [viewMode, filtered, totalsData, itemsPerPage]);

  const totalAmount = useMemo(() => lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0), [lines]);

  // Onboarding steps
  const onboardingSteps = [
    { target: '.new-sale-button', content: 'Click to record a new sale.' },
    { target: '.search-input', content: 'Search by product name, payment method to filter sales.' },
    { target: '.view-mode-selector', content: 'Switch to Daily or Weekly Totals to view sales summaries.' },
  ];

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
          playNotFoundSound();
          debouncedToast.error('Scanned Product ID cannot be empty');
          setScannerError('Scanned Product ID cannot be empty');
          return;
        }

        const { modal, lineIdx, deviceIdx } = scannerTarget;
        let newDeviceIdx;

        // Check if device ID is already sold
        const { data: soldData, error: soldError } = await supabase
          .from('dynamic_sales')
          .select('device_id')
          .eq('device_id', scannedDeviceId)
          .eq('store_id', storeId)
          .single();
        if (soldError && soldError.code !== 'PGRST116') {
          console.error('Error checking sold status:', soldError);
          playNotFoundSound();
          debouncedToast.error('Failed to validate Product ID');
          setScannerError('Failed to validate Product ID');
          return;
        }
        if (soldData) {
          console.log('Device ID is sold:', scannedDeviceId);
          playDuplicateSound();
          debouncedToast.error(`Product ID "${scannedDeviceId}" has already been sold`);
          setScannerError(`Product ID "${scannedDeviceId}" has already been sold`);
          return;
        }

        // Query product details
        const { data: productData, error } = await supabase
          .from('dynamic_product')
          .select('id, name, selling_price, device_id')
          .eq('store_id', storeId)
          .ilike('device_id', `%${scannedDeviceId}%`)
          .single();

        if (error || !productData) {
          console.error('Supabase Query Error:', error);
          playNotFoundSound();
          debouncedToast.error(`Product ID "${scannedDeviceId}" not found`);
          setScannerError(`Product ID "${scannedDeviceId}" not found`);
          return;
        }

        console.log('Found Product:', productData);

        const deviceIds = productData.device_id ? productData.device_id.split(',').map(id => id.trim()).filter(id => id) : [];

        if (modal === 'add') {
          const ls = [...lines];
          const existingLineIdx = ls.findIndex(line => {
            const product = products.find(p => p.id === line.dynamic_product_id);
            return product && product.name === productData.name;
          });

          if (existingLineIdx !== -1) {
            if (ls[existingLineIdx].deviceIds.some(id => id.trim().toLowerCase() === scannedDeviceId.toLowerCase())) {
              playDuplicateSound();
              debouncedToast.error(`Product ID "${scannedDeviceId}" already exists in this product`);
              setScannerError(`Product ID "${scannedDeviceId}" already exists`);
              return;
            }
            ls[existingLineIdx].deviceIds.push(scannedDeviceId);
            ls[existingLineIdx].deviceIds = [...ls[existingLineIdx].deviceIds, ''];
            if (!ls[existingLineIdx].isQuantityManual) {
              ls[existingLineIdx].quantity = ls[existingLineIdx].deviceIds.filter(id => id.trim()).length || 1;
            }
            setLines(ls);
            newDeviceIdx = ls[existingLineIdx].deviceIds.length - 1;
            checkSoldDevices(deviceIds, productData.id, existingLineIdx);
            setScannerTarget({ modal, lineIdx: existingLineIdx, deviceIdx: newDeviceIdx });
          } else {
            if (!ls[lineIdx].dynamic_product_id || ls[lineIdx].deviceIds.every(id => !id.trim())) {
              if (ls[lineIdx].deviceIds.some(id => id.trim().toLowerCase() === scannedDeviceId.toLowerCase())) {
                playDuplicateSound();
                debouncedToast.error(`Product ID "${scannedDeviceId}" already exists in this line`);
                setScannerError(`Product ID "${scannedDeviceId}" already exists`);
                return;
              }
              ls[lineIdx] = {
                ...ls[lineIdx],
                dynamic_product_id: Number(productData.id),
                unit_price: Number(productData.selling_price),
                deviceIds: [scannedDeviceId, ''],
                quantity: ls[lineIdx].isQuantityManual ? ls[lineIdx].quantity : 1,
              };
              setLines(ls);
              newDeviceIdx = ls[lineIdx].deviceIds.length - 1;
              checkSoldDevices(deviceIds, productData.id, lineIdx);
              setScannerTarget({ modal, lineIdx, deviceIdx: newDeviceIdx });
            } else {
              const currentProduct = products.find(p => p.id === ls[lineIdx].dynamic_product_id);
              if (currentProduct && currentProduct.name !== productData.name) {
                const newLine = {
                  dynamic_product_id: Number(productData.id),
                  quantity: 1,
                  unit_price: Number(productData.selling_price),
                  deviceIds: [scannedDeviceId, ''],
                  isQuantityManual: false,
                };
                ls.push(newLine);
                setLines(ls);
                newDeviceIdx = 1;
                checkSoldDevices(deviceIds, productData.id, ls.length - 1);
                setScannerTarget({ modal, lineIdx: ls.length - 1, deviceIdx: newDeviceIdx });
              } else {
                ls[lineIdx].deviceIds[deviceIdx] = scannedDeviceId;
                ls[lineIdx].deviceIds = [...ls[lineIdx].deviceIds, ''];
                ls[lineIdx].dynamic_product_id = Number(productData.id);
                ls[lineIdx].unit_price = Number(productData.selling_price);
                if (!ls[lineIdx].isQuantityManual) {
                  ls[lineIdx].quantity = ls[lineIdx].deviceIds.filter(id => id.trim()).length || 1;
                }
                setLines(ls);
                newDeviceIdx = ls[lineIdx].deviceIds.length - 1;
                checkSoldDevices(deviceIds, productData.id, lineIdx);
                setScannerTarget({ modal, lineIdx, deviceIdx: newDeviceIdx });
              }
            }
          }
        } else if (modal === 'edit') {
          if (saleForm.deviceIds.some((id, i) => i !== deviceIdx && id.trim().toLowerCase() === scannedDeviceId.toLowerCase())) {
            playDuplicateSound();
            debouncedToast.error(`Product ID "${scannedDeviceId}" already exists in this sale`);
            setScannerError(`Product ID "${scannedDeviceId}" already exists`);
            return;
          }
          const newDeviceIds = [...saleForm.deviceIds];
          newDeviceIds[deviceIdx] = scannedDeviceId;
          newDeviceIds.push('');
          setSaleForm({
            ...saleForm,
            dynamic_product_id: Number(productData.id),
            unit_price: Number(productData.selling_price),
            deviceIds: newDeviceIds,
            quantity: saleForm.isQuantityManual ? saleForm.quantity : (newDeviceIds.filter(id => id.trim()).length || 1),
          });
          newDeviceIdx = newDeviceIds.length - 1;
          await checkSoldDevices(deviceIds, productData.id, 0);
          setScannerTarget({ modal, lineIdx, deviceIdx: newDeviceIdx });
        }

        setScannerError(null);
        playSuccessSound();
        debouncedToast.success(`Scanned Product ID: ${scannedDeviceId}`);

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
  }, [externalScannerMode, scannerTarget, lines, saleForm, showScanner, products, storeId, checkSoldDevices, debouncedToast]);

  // Scanner: Webcam Scanner
  useEffect(() => {
    if (!showScanner || !scannerDivRef.current || !videoRef.current || externalScannerMode) return;

    setScannerLoading(true);
    const currentVideo = videoRef.current;

    try {
      if (!document.getElementById('scanner')) {
        setScannerError('Scanner container not found');
        setScannerLoading(false);
        debouncedToast.error('Scanner container not found. Please use manual input.');
        return;
      }

      html5QrCodeRef.current = new Html5Qrcode('scanner');
    } catch (err) {
      setScannerError(`Failed to initialize scanner: ${err.message}`);
      setScannerLoading(false);
      debouncedToast.error('Failed to initialize scanner. Please use manual input.');
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
      if (!scannedDeviceId) {
        playNotFoundSound();
        debouncedToast.error('Scanned Product ID cannot be empty');
        setScannerError('Scanned Product ID cannot be empty');
        return false;
      }

      console.log('Scanned Device ID:', scannedDeviceId);

      // Check if device ID is already sold
      const { data: soldData, error: soldError } = await supabase
        .from('dynamic_sales')
        .select('device_id')
        .eq('device_id', scannedDeviceId)
        .eq('store_id', storeId)
        .single();
      if (soldError && soldError.code !== 'PGRST116') {
        console.error('Error checking sold status:', soldError);
        playNotFoundSound();
        debouncedToast.error('Failed to validate Product ID');
        setScannerError('Failed to validate Product ID');
        return false;
      }
      if (soldData) {
        console.log('Device ID is sold:', scannedDeviceId);
        playDuplicateSound();
        debouncedToast.error(`Product ID "${scannedDeviceId}" has already been sold`);
        setScannerError(`Product ID "${scannedDeviceId}" has already been sold`);
        return false;
      }

      // Query product details
      const { data: productData, error } = await supabase
        .from('dynamic_product')
        .select('id, name, selling_price, device_id')
        .eq('store_id', storeId)
        .ilike('device_id', `%${scannedDeviceId}%`)
        .single();

      if (error || !productData) {
        console.error('Supabase Query Error:', error);
        playNotFoundSound();
        debouncedToast.error(`Product ID "${scannedDeviceId}" not found`);
        setScannerError(`Product ID "${scannedDeviceId}" not found`);
        return false;
      }

      console.log('Found Product:', productData);

      const deviceIds = productData.device_id ? productData.device_id.split(',').map(id => id.trim()).filter(id => id) : [];

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
            if (ls[existingLineIdx].deviceIds.some(id => id.trim().toLowerCase() === scannedDeviceId.toLowerCase())) {
              playDuplicateSound();
              debouncedToast.error(`Product ID "${scannedDeviceId}" already exists in this product`);
              setScannerError(`Product ID "${scannedDeviceId}" already exists`);
              return false;
            }
            ls[existingLineIdx].deviceIds.push(scannedDeviceId);
            ls[existingLineIdx].deviceIds = [...ls[existingLineIdx].deviceIds, ''];
            if (!ls[existingLineIdx].isQuantityManual) {
              ls[existingLineIdx].quantity = ls[existingLineIdx].deviceIds.filter(id => id.trim()).length || 1;
            }
            setLines(ls);
            newDeviceIdx = ls[existingLineIdx].deviceIds.length - 1;
            checkSoldDevices(deviceIds, productData.id, existingLineIdx);
            setScannerTarget({ modal, lineIdx: existingLineIdx, deviceIdx: newDeviceIdx });
          } else {
            if (!ls[lineIdx].dynamic_product_id || ls[lineIdx].deviceIds.every(id => !id.trim())) {
              if (ls[lineIdx].deviceIds.some(id => id.trim().toLowerCase() === scannedDeviceId.toLowerCase())) {
                playDuplicateSound();
                debouncedToast.error(`Product ID "${scannedDeviceId}" already exists in this line`);
                setScannerError(`Product ID "${scannedDeviceId}" already exists`);
                return false;
              }
              ls[lineIdx] = {
                ...ls[lineIdx],
                dynamic_product_id: Number(productData.id),
                unit_price: Number(productData.selling_price),
                deviceIds: [scannedDeviceId, ''],
                quantity: ls[lineIdx].isQuantityManual ? ls[lineIdx].quantity : 1,
              };
              setLines(ls);
              newDeviceIdx = ls[lineIdx].deviceIds.length - 1;
              checkSoldDevices(deviceIds, productData.id, lineIdx);
              setScannerTarget({ modal, lineIdx, deviceIdx: newDeviceIdx });
            } else {
              const currentProduct = products.find(p => p.id === ls[lineIdx].dynamic_product_id);
              if (currentProduct && currentProduct.name !== productData.name) {
                const newLine = {
                  dynamic_product_id: Number(productData.id),
                  quantity: 1,
                  unit_price: Number(productData.selling_price),
                  deviceIds: [scannedDeviceId, ''],
                  isQuantityManual: false,
                };
                ls.push(newLine);
                setLines(ls);
                newDeviceIdx = 1;
                checkSoldDevices(deviceIds, productData.id, ls.length - 1);
                setScannerTarget({ modal, lineIdx: ls.length - 1, deviceIdx: newDeviceIdx });
              } else {
                ls[lineIdx].deviceIds[deviceIdx] = scannedDeviceId;
                ls[lineIdx].deviceIds = [...ls[lineIdx].deviceIds, ''];
                ls[lineIdx].dynamic_product_id = Number(productData.id);
                ls[lineIdx].unit_price = Number(productData.selling_price);
                if (!ls[lineIdx].isQuantityManual) {
                  ls[lineIdx].quantity = ls[lineIdx].deviceIds.filter(id => id.trim()).length || 1;
                }
                setLines(ls);
                newDeviceIdx = ls[lineIdx].deviceIds.length - 1;
                checkSoldDevices(deviceIds, productData.id, lineIdx);
                setScannerTarget({ modal, lineIdx, deviceIdx: newDeviceIdx });
              }
            }
          }
        } else if (modal === 'edit') {
          if (saleForm.deviceIds.some((id, i) => i !== deviceIdx && id.trim().toLowerCase() === scannedDeviceId.toLowerCase())) {
            playDuplicateSound();
            debouncedToast.error(`Product ID "${scannedDeviceId}" already exists in this sale`);
            setScannerError(`Product ID "${scannedDeviceId}" already exists`);
            return false;
          }
          const newDeviceIds = [...saleForm.deviceIds];
          newDeviceIds[deviceIdx] = scannedDeviceId;
          newDeviceIds.push('');
          setSaleForm({
            ...saleForm,
            dynamic_product_id: Number(productData.id),
            unit_price: Number(productData.selling_price),
            deviceIds: newDeviceIds,
            quantity: saleForm.isQuantityManual ? saleForm.quantity : (newDeviceIds.filter(id => id.trim()).length || 1),
          });
          newDeviceIdx = newDeviceIds.length - 1;
          await checkSoldDevices(deviceIds, productData.id, 0);
          setScannerTarget({ modal, lineIdx, deviceIdx: newDeviceIdx });
        }

        setScannerError(null);
        playSuccessSound();
        debouncedToast.success(`Scanned Product ID: ${scannedDeviceId}`);
        return true;
      }
      console.error('No scanner target set');
      playNotFoundSound();
      debouncedToast.error('No scanner target set');
      return false;
    };

    const onScanFailure = (error) => {
      if (
        error.includes('No MultiFormat Readers were able to detect the code') ||
        error.includes('No QR code found') ||
        error.includes('IndexSizeError')
      ) {
        console.debug('No barcode detected');
      } else {
        setScannerError(`Scan error: ${error}`);
      }
    };

    const startScanner = async (attempt = 1, maxAttempts = 5) => {
      if (!currentVideo || !scannerDivRef.current) {
        setScannerError('Scanner elements not found');
        setScannerLoading(false);
        debouncedToast.error('Scanner elements not found. Please use manual input.');
        return;
      }

      if (attempt > maxAttempts) {
        setScannerError('Failed to initialize scanner after multiple attempts');
        setScannerLoading(false);
        debouncedToast.error('Failed to initialize scanner. Please use manual input.');
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
          debouncedToast.error('Camera access denied. Please allow camera permissions.');
        } else if (err.name === 'NotFoundError') {
          debouncedToast.error('No camera found. Please use manual input.');
        } else {
          setTimeout(() => startScanner(attempt + 1, maxAttempts), 200);
        }
      }
    };

    Html5Qrcode.getCameras()
      .then((cameras) => {
        if (cameras.length === 0) {
          setScannerError('No camera detected. Please use manual input.');
          setScannerLoading(false);
          debouncedToast.error('No camera detected. Please use manual input.');
          return;
        }
        startScanner();
      })
      .catch((err) => {
        setScannerError(`Failed to access cameras: ${err.message}`);
        setScannerLoading(false);
        debouncedToast.error('Failed to access camera. Please use manual input.');
      });

    return () => {
      if (
        html5QrCodeRef.current &&
        [Html5QrcodeScannerState.SCANNING, Html5QrcodeScannerState.PAUSED].includes(
          html5QrCodeRef.current.getState()
        )
      ) {
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
  }, [showScanner, scannerTarget, lines, saleForm, externalScannerMode, debouncedToast, products, storeId, checkSoldDevices]);

  const stopScanner = useCallback(() => {
    if (
      html5QrCodeRef.current &&
      [Html5QrcodeScannerState.SCANNING, Html5QrcodeScannerState.PAUSED].includes(
        html5QrCodeRef.current.getState()
      )
    ) {
      html5QrCodeRef.current
        .stop()
        .then(() => console.log('Scanner stopped'))
        .catch((err) => console.error('Error stopping scanner:', err));
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    html5QrCodeRef.current = null;
  }, []);

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
      playNotFoundSound();
      debouncedToast.error('Product ID cannot be empty');
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
      playNotFoundSound();
      debouncedToast.error('Failed to validate Product ID');
      setScannerError('Failed to validate Product ID');
      return;
    }
    if (soldData) {
      console.log('Device ID is sold:', trimmedInput);
      playDuplicateSound();
      debouncedToast.error(`Product ID "${trimmedInput}" has already been sold`);
      setScannerError(`Product ID "${trimmedInput}" has already been sold`);
      setManualInput('');
      return;
    }

    // Check if Device ID exists in dynamic_product
    const { data: productData, error } = await supabase
      .from('dynamic_product')
      .select('id, name, selling_price, device_id')
      .eq('store_id', storeId)
      .ilike('device_id', `%${trimmedInput}%`)
      .single();

    if (error || !productData) {
      console.error('Supabase Query Error:', error);
      playNotFoundSound();
      debouncedToast.error(`Product ID "${trimmedInput}" not found`);
      setScannerError(`Product ID "${trimmedInput}" not found`);
      setManualInput('');
      return;
    }

    console.log('Found Product:', productData);

    const deviceIds = productData.device_id ? productData.device_id.split(',').map(id => id.trim()).filter(id => id) : [];

    if (scannerTarget) {
      const { modal, lineIdx, deviceIdx } = scannerTarget;
      let newDeviceIdx;

      if (modal === 'add') {
        setLines((ls) => {
          const next = [...ls];
          const existingLineIdx = next.findIndex(line => {
            const product = products.find(p => p.id === line.dynamic_product_id);
            return product && product.name === productData.name;
          });

          if (existingLineIdx !== -1) {
            if (next[existingLineIdx].deviceIds.some(id => id.trim().toLowerCase() === trimmedInput.toLowerCase())) {
              playDuplicateSound();
              debouncedToast.error(`Product ID "${trimmedInput}" already exists in this product`);
              setScannerError(`Product ID "${trimmedInput}" already exists`);
              setManualInput('');
              return next;
            }
            next[existingLineIdx].deviceIds.push(trimmedInput);
            next[existingLineIdx].deviceIds = [...next[existingLineIdx].deviceIds, ''];
            if (!next[existingLineIdx].isQuantityManual) {
              next[existingLineIdx].quantity = next[existingLineIdx].deviceIds.filter(id => id.trim()).length || 1;
            }
            newDeviceIdx = next[existingLineIdx].deviceIds.length - 1;
            checkSoldDevices(deviceIds, productData.id, existingLineIdx);
            setScannerTarget({ modal, lineIdx: existingLineIdx, deviceIdx: newDeviceIdx });
            return next;
          } else {
            if (!next[lineIdx].dynamic_product_id || next[lineIdx].deviceIds.every(id => !id.trim())) {
              if (next[lineIdx].deviceIds.some(id => id.trim().toLowerCase() === trimmedInput.toLowerCase())) {
                playDuplicateSound();
                debouncedToast.error(`Product ID "${trimmedInput}" already exists in this line`);
                setScannerError(`Product ID "${trimmedInput}" already exists`);
                setManualInput('');
                return next;
              }
              next[lineIdx] = {
                ...next[lineIdx],
                dynamic_product_id: Number(productData.id),
                unit_price: next[lineIdx].isPriceManual ? next[lineIdx].unit_price : Number(productData.selling_price),
                deviceIds: [trimmedInput, ''],
                quantity: next[lineIdx].isQuantityManual ? next[lineIdx].quantity : 1,
              };
              newDeviceIdx = next[lineIdx].deviceIds.length - 1;
              checkSoldDevices(deviceIds, productData.id, lineIdx);
              setScannerTarget({ modal, lineIdx, deviceIdx: newDeviceIdx });
              return next;
            } else {
              const currentProduct = products.find(p => p.id === next[lineIdx].dynamic_product_id);
              if (currentProduct && currentProduct.name !== productData.name) {
                const newLine = {
                  dynamic_product_id: Number(productData.id),
                  quantity: 1,
                  unit_price: Number(productData.selling_price),
                  deviceIds: [trimmedInput, ''],
                  isQuantityManual: false,
                  isPriceManual: false,
                };
                next.push(newLine);
                newDeviceIdx = 1;
                checkSoldDevices(deviceIds, productData.id, next.length - 1);
                setScannerTarget({ modal, lineIdx: next.length - 1, deviceIdx: newDeviceIdx });
                return next;
              } else {
                next[lineIdx].deviceIds[deviceIdx] = trimmedInput;
                next[lineIdx].deviceIds = [...next[lineIdx].deviceIds, ''];
                next[lineIdx].dynamic_product_id = Number(productData.id);
                if (!next[lineIdx].isPriceManual) {
                  next[lineIdx].unit_price = Number(productData.selling_price);
                }
                if (!next[lineIdx].isQuantityManual) {
                  next[lineIdx].quantity = next[lineIdx].deviceIds.filter(id => id.trim()).length || 1;
                }
                newDeviceIdx = next[lineIdx].deviceIds.length - 1;
                checkSoldDevices(deviceIds, productData.id, lineIdx);
                setScannerTarget({ modal, lineIdx, deviceIdx: newDeviceIdx });
                return next;
              }
            }
          }
        });
      } else if (modal === 'edit') {
        if (saleForm.deviceIds.some((id, i) => i !== deviceIdx && id.trim().toLowerCase() === trimmedInput.toLowerCase())) {
          playDuplicateSound();
          debouncedToast.error(`Product ID "${trimmedInput}" already exists in this sale`);
          setScannerError(`Product ID "${trimmedInput}" already exists`);
          setManualInput('');
          return;
        }
        setSaleForm((prev) => {
          const newDeviceIds = [...prev.deviceIds];
          newDeviceIds[deviceIdx] = trimmedInput;
          newDeviceIds.push('');
          const updatedForm = {
            ...prev,
            dynamic_product_id: Number(productData.id),
            unit_price: prev.isPriceManual ? prev.unit_price : Number(productData.selling_price),
            deviceIds: newDeviceIds,
            quantity: prev.isQuantityManual ? prev.quantity : (newDeviceIds.filter(id => id.trim()).length || 1),
          };
          newDeviceIdx = newDeviceIds.length - 1;
          checkSoldDevices(deviceIds, productData.id, 0);
          setScannerTarget({ modal, lineIdx, deviceIdx: newDeviceIdx });
          return updatedForm;
        });
      }

      setScannerError(null);
      setScannerLoading(false);
      setManualInput('');
      playSuccessSound();
      debouncedToast.success(`Added Product ID: ${trimmedInput}`);
    } else {
      console.error('No scanner target set');
      playNotFoundSound();
      debouncedToast.error('No scanner target set');
      setManualInput('');
    }
  };

  // Check if onboarding has been completed
  useEffect(() => {
    if (!localStorage.getItem('salesTrackerOnboardingCompleted')) {
      const timer = setTimeout(() => {
        setShowOnboarding(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Data Fetching
  const fetchProducts = useCallback(async () => {
    if (!storeId) return;
    const { data, error } = await supabase
      .from('dynamic_product')
      .select('id, name, selling_price, device_id')
      .eq('store_id', storeId)
      .order('name');
    if (error) {
      toast.error(`Failed to fetch products: ${error.message}`);
      setProducts([]);
    } else {
      const processedProducts = (data || []).map((p) => ({
        ...p,
        deviceIds: p.device_id ? p.device_id.split(',').filter((id) => id.trim()) : [],
      }));
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
      sold_at,
      customer_id,
      customer_name,
      dynamic_product(name),
      customer:customer_id(fullname)
    `)
    .eq('store_id', storeId)
    .order('sold_at', { ascending: false });
  if (error) {
    toast.error(`Failed to fetch sales: ${error.message}`);
    setSales([]);
    setFiltered([]);
  } else {
    const processedSales = (data || []).map((sale) => ({
      ...sale,
      deviceIds: sale.device_id ? sale.device_id.split(',').filter((id) => id.trim()) : [],
      customer_name: sale.customer_name || sale.customer?.fullname || 'Unknown',
    }));
    setSales(processedSales);
    setFiltered(processedSales);
  }
}, [storeId]);








  useEffect(() => {
    fetchSales();
  }, [fetchSales]);


  useEffect(() => {
    fetchProducts();
    fetchInventory();
    fetchSales();
  }, [fetchProducts, fetchInventory, fetchSales]);



  // Search Filter
useEffect(() => {
  if (!search) {
    setFiltered(sales);
    setCurrentPage(1);
    return;
  }
  const q = search.toLowerCase();
  setFiltered(
    sales.filter(
      (s) =>
        s.dynamic_product.name.toLowerCase().includes(q) ||
        s.payment_method.toLowerCase().includes(q) ||
        s.deviceIds.some((id) => id.toLowerCase().includes(q)) ||
        (s.customer_name || '').toLowerCase().includes(q)
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
        return next;
      });

      // Perform validation only onBlur or Enter
      if (isBlur && value.trim()) {
        const trimmedInput = value.trim();
        console.log('Validating Barcode:', trimmedInput, 'Line:', lineIdx, 'DeviceIdx:', deviceIdx);

        // Query product for matching barcode
        const { data: productData, error } = await supabase
          .from('dynamic_product')
          .select('id, name, selling_price, device_id')
          .eq('store_id', storeId)
          .eq('device_id', trimmedInput) // Exact match for single barcode
          .limit(1)
          .single();

        setLines((ls) => {
          const next = [...ls];
          if (error || !productData) {
            console.error('Supabase error:', error, 'Input:', trimmedInput);
            toast.error(`Barcode "${trimmedInput}" not found`);
            next[lineIdx].deviceIds[deviceIdx] = '';
            return next;
          }

          console.log('Found Product for Barcode:', productData);

          const existingLineIdx = next.findIndex((line) => line.dynamic_product_id === Number(productData.id));

          if (existingLineIdx !== -1 && existingLineIdx !== lineIdx) {
            // Merge with existing line for same product
            next[existingLineIdx].quantity += 1;
            next[lineIdx].deviceIds[deviceIdx] = '';
            if (next[lineIdx].deviceIds.every((id) => !id.trim()) && next.length > 1) {
              next.splice(lineIdx, 1);
            }
          } else {
            // Update current line or create new if empty
            next[lineIdx].dynamic_product_id = Number(productData.id);
            if (!next[lineIdx].isPriceManual) {
              next[lineIdx].unit_price = Number(productData.selling_price);
            }
            next[lineIdx].deviceIds[deviceIdx] = trimmedInput;
            if (!next[lineIdx].isQuantityManual) {
              next[lineIdx].quantity = 1;
            }
          }

          return next;
        });
      }
    } else {
      setLines((ls) => {
        const next = [...ls];
        if (field === 'quantity') {
          next[lineIdx].quantity = +value;
          next[lineIdx].isQuantityManual = true;
        } else if (field === 'unit_price') {
          next[lineIdx].unit_price = +value;
          next[lineIdx].isPriceManual = true;
        } else if (field === 'dynamic_product_id') {
          next[lineIdx].dynamic_product_id = +value;
          const prod = products.find((p) => p.id === +value);
          if (prod) {
            if (!next[lineIdx].isPriceManual) {
              next[lineIdx].unit_price = prod.selling_price;
            }
            next[lineIdx].deviceIds = [prod.device_id || ''];
            next[lineIdx].quantity = next[lineIdx].isQuantityManual ? next[lineIdx].quantity : 1;
          }
          const inv = inventory.find((i) => i.dynamic_product_id === +value);
          if (inv && inv.available_qty < 6) {
            const prodName = prod?.name || 'this product';
            toast.warning(`Low stock: only ${inv.available_qty} left for ${prodName}`);
          }
        }
        return next;
      });
    }
  };

  const removeDeviceId = (lineIdx, deviceIdx) => {
    setLines((ls) => {
      const next = [...ls];
      next[lineIdx].deviceIds = next[lineIdx].deviceIds.filter((_, i) => i !== deviceIdx);
      if (next[lineIdx].deviceIds.length === 0) {
        next[lineIdx].deviceIds = [''];
      }
      if (!next[lineIdx].isQuantityManual) {
        const nonEmptyCount = next[lineIdx].deviceIds.filter((id) => id.trim()).length;
        next[lineIdx].quantity = nonEmptyCount || 1;
      }
      next[lineIdx].isQuantityManual = false;
      return next;
    });
  };

  const addLine = () => setLines((ls) => [
    ...ls,
    { dynamic_product_id: '', quantity: 1, unit_price: '', deviceIds: [''], isQuantityManual: false },
  ]);

  const removeLine = (idx) => setLines((ls) => ls.filter((_, i) => i !== idx));

  const handleEditChange = (field, value, deviceIdx = null) => {
    setSaleForm((f) => {
      const next = { ...f };
      if (field === 'deviceIds' && deviceIdx !== null) {
        next.deviceIds[deviceIdx] = value;
        if (!next.isQuantityManual) {
          const nonEmptyCount = next.deviceIds.filter((id) => id.trim()).length;
          next.quantity = nonEmptyCount || 1;
        }
        next.isQuantityManual = false;
      } else if (field === 'quantity') {
        next.quantity = +value;
        next.isQuantityManual = true;
      } else {
        next[field] = ['unit_price'].includes(field) ? +value : value;
      }
      return next;
    });
  };

  const removeEditDeviceId = (deviceIdx) => {
    setSaleForm((f) => {
      const newDeviceIds = f.deviceIds.filter((_, i) => i !== deviceIdx);
      const nonEmptyCount = newDeviceIds.filter((id) => id.trim()).length;
      return {
        ...f,
        deviceIds: newDeviceIds.length === 0 ? [''] : newDeviceIds,
        quantity: f.isQuantityManual ? f.quantity : (nonEmptyCount || 1),
        isQuantityManual: false,
      };
    });
  };
  
const createSale = async (e) => {
  e.preventDefault();
  try {
    const totalAmount = lines.reduce((sum, l) => sum + (l.quantity * l.unit_price || 0), 0);
    if (totalAmount <= 0) throw new Error('Total amount must be greater than zero');

    let customer_name = 'Unknown';
    if (selectedCustomerId) {
      const { data: customer, error } = await supabase
        .from('customer')
        .select('fullname')
        .eq('id', selectedCustomerId)
        .single();
      if (error) {
        console.warn(`Failed to fetch customer name for ID ${selectedCustomerId}: ${error.message || 'No customer found'}`);
        // Suppress toast since customer name is optional
      } else {
        customer_name = customer.fullname || 'Unknown';
      }
    }

    const { data: grp, error: grpErr } = await supabase
      .from('sale_groups')
      .insert([{ 
        store_id: storeId, 
        total_amount: totalAmount, 
        payment_method: paymentMethod, 
        customer_id: selectedCustomerId,
        customer_name, // Include customer_name in sale_groups
      }])
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
  device_id: l.deviceIds.filter((id) => id.trim()).join(',') || null,
  payment_method: paymentMethod,
  customer_id: selectedCustomerId,
  customer_name: customer_name, // Add this line
}));

    const { error: insErr } = await supabase.from('dynamic_sales').insert(inserts);
    if (insErr) throw new Error(`Sales insertion failed: ${insErr.message}`);

    toast.success('Sale added successfully!');
    setShowAdd(false);
    setLines([{ dynamic_product_id: '', quantity: 1, unit_price: '', deviceIds: [''], isQuantityManual: false }]);
    setPaymentMethod('Cash');
    setSelectedCustomerId(null);
    fetchSales();
  } catch (err) {
    toast.error(err.message);
  }
};

const saveEdit = async () => {
  try {
    const originalSale = sales.find((s) => s.id === editing);
    if (!originalSale) throw new Error('Sale not found');

    let customer_name = 'Unknown';
    if (saleForm.customer_id) {
      const { data: customer, error } = await supabase
        .from('customer')
        .select('fullname')
        .eq('id', saleForm.customer_id)
        .single();
      if (error) {
        console.warn(`Failed to fetch customer name for ID ${saleForm.customer_id}: ${error.message || 'No customer found'}`);
        // Suppress toast since customer name is optional
      } else {
        customer_name = customer.fullname || 'Unknown';
      }
    }

   const { error } = await supabase
  .from('dynamic_sales')
  .update({
    dynamic_product_id: saleForm.dynamic_product_id || originalSale.dynamic_product_id,
    quantity: saleForm.quantity,
    unit_price: saleForm.unit_price,
    device_id: saleForm.deviceIds.filter((id) => id.trim()).join(',') || null,
    payment_method: saleForm.payment_method || originalSale.payment_method,
    customer_id: saleForm.customer_id,
    customer_name: customer_name, // Add this line
  })
  .eq('id', editing);
    if (error) throw new Error(`Update failed: ${error.message}`);

    await supabase
      .from('sale_groups')
      .update({
        customer_id: saleForm.customer_id,
        customer_name,
      })
      .eq('id', originalSale.sale_group_id);

    toast.success('Sale updated successfully!');
    setEditing(null);
    fetchSales();
  } catch (err) {
    toast.error(err.message);
  }
};





  const deleteSale = async (s) => {
    if (!window.confirm(`Delete sale #${s.id}`)) return;
    try {
      const { error } = await supabase.from('dynamic_sales').delete().eq('id', s.id);
      if (error) throw new Error(`Deletion failed: ${error.message}`);

      const inv = inventory.find((i) => i.dynamic_product_id === s.dynamic_product_id);
      if (inv) {
        const newQty = inv.available_qty + s.quantity;
        await supabase
          .from('dynamic_inventory')
          .update({ available_qty: newQty })
          .eq('dynamic_product_id', s.dynamic_product_id)
          .eq('store_id', storeId);
        setInventory((prev) =>
          prev.map((i) =>
            i.dynamic_product_id === s.dynamic_product_id ? { ...i, available_qty: newQty } : i
          )
        );
      }

      toast.success('Sale deleted successfully!');
      fetchSales();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Export Functions
  const exportCSV = () => {
    let csv = '';
    if (viewMode === 'list') {
      csv = 'Product,Device IDs,Quantity,Unit Price,Amount,Payment,Sold At\n';
      filtered.forEach((s) => {
        csv += [
          `"${s.dynamic_product.name.replace(/"/g, '""')}"`,
          s.deviceIds.join(';') || '-',
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
            `Product: ${s.dynamic_product.name}, Devices: ${s.deviceIds.join(', ') || '-'}, Qty: ${s.quantity}, Unit: ${s.unit_price.toFixed(2)}, Amt: ${s.amount.toFixed(2)}, Pay: ${s.payment_method}, At: ${new Date(s.sold_at).toLocaleString()}`,
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
    <div className="p-0 max-w-7xl mx-auto dark:bg-gray-900 dark:text-white">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-4 px-4 sm:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-sm font-medium shrink-0">View:</label>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                className="w-full sm:w-40 p-2 border rounded dark:bg-gray-800 text-gray-900 dark:text-white bg-white dark:hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600 view-mode-selector text-sm transition-colors duration-200"
              >
                <option value="list">Individual Sales</option>
                <option value="daily">Daily Totals</option>
                <option value="weekly">Weekly Totals</option>
              </select>
            </div>
            {viewMode === 'list' && (
              <input
                type="text"
                placeholder="Search sales by product, payment"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-64 p-2 border rounded dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm"
              />
            )}
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg transition-colors duration-200 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-full sm:w-auto whitespace-nowrap new-sale-button"
          >
            <FaPlus className="text-base" />
            New Sale
          </button>
        </div>
      </div>
{/* Record Sale Modal */}


{showAdd && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-auto mt-16">
    <form
      onSubmit={createSale}
       className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg w-full max-w-3xl max-h-[85vh] overflow-y-auto space-y-4"
    >
      <h2 className="text-lg sm:text-xl font-bold text-center text-gray-900 dark:text-gray-200">Record Sale</h2>
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
                className="p-1.5 bg-red-600 text-white rounded-full shadow-sm hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 transition-colors duration-200"
                aria-label={`Remove sale item ${lineIdx + 1}`}
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
            <label className="block">
              <span className="font-semibold block mb-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                Product
              </span>
              <select
                name="dynamic_product_id"
                value={line.dynamic_product_id}
                onChange={(e) => handleLineChange(lineIdx, 'dynamic_product_id', e.target.value)}
                required
                className="w-full p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px]"
              >
                <option value="">Select product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="font-semibold block mb-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                Quantity
              </span>
              <input
                type="number"
                min="1"
                name="quantity"
                value={line.quantity}
                onChange={(e) => handleLineChange(lineIdx, 'quantity', e.target.value)}
                className="w-full p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px]"
                required
              />
            </label>
            <label className="block">
              <span className="font-semibold block mb-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                Unit Price
              </span>
              <input
                type="number"
                step="0.01"
                name="unit_price"
                value={line.unit_price}
                onChange={(e) => handleLineChange(lineIdx, 'unit_price', e.target.value)}
                className="w-full p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px]"
                required
              />
            </label>
          </div>
          <div className="mt-2">
            <span className="font-semibold block mb-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
              Scan or Add Product ID Manually (Optional)
            </span>
            {line.deviceIds.map((id, deviceIdx) => (
              <div key={deviceIdx} className="mb-3 sm:mb-2">
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
                    placeholder="Enter Barcode ID"
                    className="flex-1 p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px]"
                  />
                  <div className="flex gap-2 sm:gap-3 mt-1 sm:mt-0">
                    <button
                      type="button"
                      onClick={() => openScanner('add', lineIdx, deviceIdx)}
                      className="p-2 sm:p-2.5 bg-indigo-600 text-white rounded-full shadow-sm hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors duration-200"
                      aria-label={`Scan barcode for device ID ${deviceIdx + 1} of sale item ${lineIdx + 1}`}
                    >
                      <FaCamera className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeDeviceId(lineIdx, deviceIdx)}
                      className="p-2 sm:p-2.5 bg-red-600 text-white rounded-full shadow-sm hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 transition-colors duration-200"
                      aria-label={`Remove device ID ${deviceIdx + 1} from sale item ${lineIdx + 1}`}
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
              </div>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addLine}
        className="p-2 sm:p-3 bg-green-600 text-white rounded-full shadow-sm hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-colors duration-200 w-full sm:w-auto flex items-center justify-center gap-2 mt-4"
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
        <span className="text-sm sm:text-base">Add Another Item</span>
      </button>
      <div className="mt-4">
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

         <CustomerSelector
                storeId={storeId}
                selectedCustomerId={selectedCustomerId}
                onCustomerChange={setSelectedCustomerId}
              />
      </div>
      <div className="mt-4 text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-200">
        Total: ₦{formatCurrency(totalAmount)}
      </div>
      <div className="flex justify-end gap-2 sm:gap-3 mt-4">
        <button
          type="button"
          onClick={() => {
            stopScanner();
            setShowAdd(false);
          }}
          className="p-2 sm:p-3 bg-gray-500 text-white rounded-full shadow-sm hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500 transition-colors duration-200 flex items-center gap-2"
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
          <span className="text-sm sm:text-base"></span>
        </button>
        <button
          type="submit"
          className="p-2 sm:p-3 bg-indigo-600 text-white rounded-full shadow-sm hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors duration-200 flex items-center gap-2"
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
          <span className="text-sm sm:text-base"></span>
        </button>
      </div>
    </form>
  </div>
)}
     {/* Edit Sale Modal */}
{editing && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-auto mt-16">
    <form
      onSubmit={(e) => {
        e.preventDefault();
        saveEdit();
      }}
      className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg w-full max-w-3xl max-h-[85vh] overflow-y-auto space-y-4"
    >
      <h2 className="text-lg sm:text-xl font-bold text-center text-gray-900 dark:text-gray-200">
        Edit Sale #{editing}
      </h2>
      <div className="border border-gray-200 dark:border-gray-700 p-3 sm:p-4 rounded-lg space-y-3 dark:bg-gray-800">
        <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-200">
          Sale Details
        </h3>
        <div className="flex flex-col gap-3 sm:gap-4">
          {[
            { name: 'dynamic_product_id', label: 'Product', type: 'select' },
            { name: 'quantity', label: 'Quantity', type: 'number', min: '1' },
            { name: 'unit_price', label: 'Unit Price', type: 'number', step: '0.01' },
            { name: 'deviceIds', label: 'Device IDs', type: 'deviceIds' },
            { name: 'payment_method', label: 'Payment Method', type: 'select' },
          ].map((field) => (
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
                  required
                >
                  {field.name === 'payment_method' ? (
                    <>
                      <option value="">Select payment method…</option>
                      <option>Cash</option>
                      <option>Bank Transfer</option>
                      <option>Card</option>
                      <option>Wallet</option>
                    </>
                  ) : (
                    <>
                      <option value="">Select product…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </>
                  )}
                   <CustomerSelector
                storeId={storeId}
                selectedCustomerId={saleForm.customer_id}
                onCustomerChange={(id) => setSaleForm({ ...saleForm, customer_id: id })}
              />
                </select>
                
              ) : field.type === 'deviceIds' ? (
                <div className="space-y-2">
                  {saleForm.deviceIds.map((id, deviceIdx) => (
                    <div key={deviceIdx} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      <input
                        type="text"
                        value={id}
                        onChange={(e) => handleEditChange('deviceIds', e.target.value, deviceIdx)}
                        placeholder="Enter Barcode ID"
                        className="flex-1 p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px]"
                      />
                      <div className="flex gap-2 sm:gap-3 mt-1 sm:mt-0">
                        <button
                          type="button"
                          onClick={() => openScanner('edit', 0, deviceIdx)}
                          className="p-2 sm:p-2.5 bg-indigo-600 text-white rounded-full shadow-sm hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors duration-200"
                          aria-label={`Scan barcode for device ID ${deviceIdx + 1}`}
                        >
                          <FaCamera className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeEditDeviceId(deviceIdx)}
                          className="p-2 sm:p-2.5 bg-red-600 text-white rounded-full shadow-sm hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 transition-colors duration-200"
                          aria-label={`Remove device ID ${deviceIdx + 1}`}
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
                  ))}
                </div>
              ) : (
                <input
                  type="number"
                  step={field.step}
                  min={field.min}
                  name={field.name}
                  value={saleForm[field.name] || ''}
                  onChange={(e) => handleEditChange(field.name, e.target.value)}
                  className="w-full p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px]"
                  required
                />
              )}
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 sm:gap-3 mt-4">
        <button
          type="button"
          onClick={() => {
            stopScanner();
            setEditing(null);
          }}
          className="p-2 sm:p-3 bg-gray-500 text-white rounded-full shadow-sm hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500 transition-colors duration-200 flex items-center gap-2"
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
          <span className="text-sm sm:text-base"></span>
        </button>
        <button
          type="submit"
          className="p-2 sm:p-3 bg-indigo-600 text-white rounded-full shadow-sm hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors duration-200 flex items-center gap-2"
          aria-label="Save edited sale"
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
          <span className="text-sm sm:text-base"></span>
        </button>
      </div>
    </form>
  </div>
)}
      
{/* Scanner Modal */}
{showScanner && (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-auto mt-16">
    <div className="bg-white rounded-lg shadow-lg w-full max-w-full sm:max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6 space-y-4 dark:bg-gray-900 dark:text-white">
      <h2 className="text-lg sm:text-xl font-bold text-center text-gray-900 dark:text-gray-200">
        Scan Product ID
      </h2>
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={externalScannerMode}
            onChange={() => setExternalScannerMode((prev) => !prev)}
            className="h-5 w-5 text-indigo-600 border-gray-300 dark:bg-gray-900 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
            aria-label="Toggle external scanner mode"
          />
          <span>Use External Scanner</span>
        </label>

        {!externalScannerMode && (
          <>
            {scannerLoading && (
              <div className="text-gray-600 dark:text-gray-300 text-center text-sm sm:text-base">
                Initializing webcam scanner...
              </div>
            )}
            {scannerError && (
              <div className="text-red-600 dark:text-red-400 text-center text-sm sm:text-base">
                {scannerError}
              </div>
            )}
            <div
              id="scanner"
              ref={scannerDivRef}
              className="relative w-full h-[250px] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden"
            >
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[300px] h-[150px] border-2 border-indigo-500 bg-transparent opacity-60"></div>
              </div>
            </div>
          </>
        )}

        {externalScannerMode && (
          <div className="text-gray-600 dark:text-gray-300 text-center text-sm sm:text-base">
            Waiting for external scanner input...
          </div>
        )}

        <label className="block">
          <span className="font-semibold block mb-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
            Or Enter Product ID Manually
          </span>
          <div className="flex flex-col gap-3 sm:gap-4">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Enter Product ID"
              className="w-full p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px] transition-all duration-200"
              aria-label="Enter product ID manually"
            />
            <div className="flex gap-2 sm:gap-3 justify-center">
              <button
                type="button"
                onClick={handleManualInput}
                className="p-2 sm:p-3 bg-indigo-600 text-white rounded-full shadow-sm hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors duration-200 flex items-center gap-2 flex-1 justify-center"
                aria-label="Submit manual product ID"
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
                <span className="text-sm sm:text-base">Submit</span>
              </button>
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
                className="p-2 sm:p-3 bg-gray-500 text-white rounded-full shadow-sm hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500 transition-colors duration-200 flex items-center gap-2 flex-1 justify-center"
                aria-label="Cancel scanner"
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
                <span className="text-sm sm:text-base"></span>
              </button>
            </div>
          </div>
        </label>
      </div>
    </div>
  </div>
)}


    {/* Sales Table */}
    <div className="overflow-x-auto rounded-lg shadow p-4">
      {viewMode === 'list' ? (
        <table className="min-w-full bg-white dark:bg-gray-900 divide-y divide-gray-200">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr>
              {['Product', 'Customer', 'Quantity', 'Unit Price', 'Amount', 'Payment', 'Date Sold', 'Actions'].map((h) => (
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
            {paginatedSales.map((s, index) => (
              <tr key={s.id}>
                <td className="px-4 py-2 text-sm">{s.dynamic_product.name}</td>
                 <td className="px-4 py-2 text-sm">{s.customer_name}</td>
                <td className="px-4 py-2 text-sm">{s.quantity}</td>
                <td className="px-4 py-2 text-sm">{s.unit_price.toFixed(2)}</td>
                <td className="px-4 py-2 text-sm">{s.amount.toFixed(2)}</td>
                <td className="px-4 py-2 text-sm">{s.payment_method}</td>
                <td className="px-4 py-2 text-sm">{new Date(s.sold_at).toLocaleString()}</td>
                <td className="px-4 py-2 text-sm flex gap-2">
                  <button
                    onClick={() => {
                      setEditing(s.id);
                      setSaleForm({
                        quantity: s.quantity,
                        unit_price: s.unit_price,
                        deviceIds: s.deviceIds.length > 0 ? s.deviceIds : [''],
                        payment_method: s.payment_method,
                        isQuantityManual: false,
                        isPriceManual: true,
                        dynamic_product_id: s.dynamic_product_id,
                         customer_id: s.customer_id,
                      });
                    }}
                    className={`p-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 edit-button-${index}`}
                    title="Edit sale"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => deleteSale(s)}
                    className="p-2 bg-red-500 text-white rounded hover:bg-red-600"
                    title="Delete sale"
                  >
                    <FaTrashAlt />
                  </button>
                </td>
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
            {paginatedTotals.map((t, index) => (
              <tr key={index}>
                <td className="px-4 py-2 text-sm">{t.period}</td>
                <td className="px-4 py-2 text-sm">{t.total.toFixed(2)}</td>
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
        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
        disabled={currentPage === 1}
        className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600 transition"
      >
        Prev
      </button>
      {[...Array(totalPages).keys()].map((i) => (
        <button
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
        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
        disabled={currentPage === totalPages}
        className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600 transition"
      >
        Next
      </button>
    </div>

    {/* Export Buttons */}
    <div className="flex flex-wrap justify-center items-center gap-3 mt-4">
      <button
        onClick={exportCSV}
        className="flex items-center justify-center gap-1 w-full sm:w-32 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition export-csv-button"
        title="Export to CSV"
      >
        <FaFileCsv className="w-4 h-4" />
        <span>CSV</span>
      </button>
      <button
        onClick={exportPDF}
        className="flex items-center justify-center gap-1 w-full sm:w-32 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition export-pdf-button"
        title="Export to PDF"
      >
        <FaFilePdf className="w-4 h-4" />
        <span>PDF</span>
      </button>
    </div>

    {/* Onboarding Tooltip */}
    {showOnboarding && onboardingStep < onboardingSteps.length && (
      <motion.div
        className="fixed z-50 bg-indigo-600 dark:bg-gray-800 border border-indigo-300 dark:border-gray-600 rounded-lg shadow-lg p-2 sm:p-4 max-w-[260px] sm:max-w-xs"
        style={getTooltipPosition(onboardingSteps[onboardingStep].target)}
        variants={tooltipVariants}
        initial="hidden"
        animate="visible"
      >
        <p className="text-xs sm:text-sm text-white dark:text-gray-200 mb-1 sm:mb-2">
          {onboardingSteps[onboardingStep].content}
        </p>
        <div className="flex justify-between items-center">
          <span className="text-xs sm:text-sm text-gray-200 dark:text-gray-400">
            Step {onboardingStep + 1} of {onboardingSteps.length}
          </span>
          <div className="space-x-1 sm:space-x-3">
            <button
              onClick={handleSkipOnboarding}
              className="text-xs sm:text-sm text-white hover:text-gray-800 dark:text-gray-300 dark:hover:text-white px-1 sm:px-2 py-0.5 sm:py-1"
            >
              Skip
            </button>
            <button
              onClick={handleNextStep}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm px-1 sm:px-3 py-0.5 sm:py-1 rounded"
            >
              {onboardingStep + 1 === onboardingSteps.length ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </motion.div>
    )}

    {/* Single ToastContainer */}
  <ToastContainer
  position="top-right"
  autoClose={2000}
  hideProgressBar={false}
  newestOnTop={false}
  closeOnClickF
  rtl={false}
  pauseOnFocusLoss
  draggable
  pauseOnHover
  theme="colored"
  limit={1}
/>
  </div>
  );
}