import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from "../../supabaseClient";
import { FaEdit, FaTrashAlt, FaPlus, FaBell, FaCamera } from 'react-icons/fa';
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScannerState } from 'html5-qrcode';
import DeviceDebtRepayment from './DeviceDebtRepayment';

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
      deviceIds: [""],
      deviceSizes: [""],
      qty: "",
      owed: "",
      deposited: "",
      date: new Date().toISOString().split('T')[0],
    }
  ]);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]); // Custom notification state
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderType, setReminderType] = useState('one-time');
  const [reminderTime, setReminderTime] = useState('');
  const [showDetail, setShowDetail] = useState(null);
  const [soldDeviceIds, setSoldDeviceIds] = useState([]);
  const [isLoadingSoldStatus, setIsLoadingSoldStatus] = useState(false);
  const [detailPage, setDetailPage] = useState(1);
  const detailPageSize = 20;
  const debtsRef = useRef();
  const reminderIntervalRef = useRef(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerTarget, setScannerTarget] = useState(null);
  const [scannerError, setScannerError] = useState(null);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [externalScannerMode, setExternalScannerMode] = useState(false);
  const [scannerBuffer, setScannerBuffer] = useState('');
  const [lastKeyTime, setLastKeyTime] = useState(0);
  const videoRef = useRef(null);
  const scannerDivRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const manualInputRef = useRef(null);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState(null);
const [lastScanTime, setLastScanTime] = useState(0);
const [isScanning, setIsScanning] = useState(false);

  const stopScanner = useCallback(() => {
    if (html5QrCodeRef.current &&
        [Html5QrcodeScannerState.SCANNING, Html5QrcodeScannerState.PAUSED].includes(
          html5QrCodeRef.current.getState()
        )) {
      html5QrCodeRef.current
        .stop()
        .then(() => console.log('Scanner stopped'))
        .catch(err => console.error('Error stopping scanner:', err));
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    html5QrCodeRef.current = null;
  }, []);



  // Add notification with type and auto-close
  const addNotification = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
  }, []);

  const playSuccessSound = useCallback(() => {
    const audio = new Audio('https://freesound.org/data/previews/171/171671_2437358-lq.mp3');
    audio.play().catch((err) => console.error('Audio play error:', err));
  }, []);

  // Fetch store details
  useEffect(() => {
    if (!storeId) {
      setError("Store ID is missing. Please log in or select a store.");
      addNotification("Store ID is missing.", 'error');
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
          addNotification("Failed to fetch store details.", 'error');
        } else {
          setStore(data);
        }
      });
  }, [storeId, addNotification]);

  // Fetch customers
  useEffect(() => {
    if (!storeId) return;
    supabase
      .from('customer')
      .select('id, fullname, phone_number')
      .eq('store_id', storeId)
      .then(({ data, error }) => {
        if (error) {
          setError("Failed to fetch customers: " + error.message);
          addNotification("Failed to fetch customers.", 'error');
        } else {
          setCustomers(data || []);
        }
      });
  }, [storeId, addNotification]);

  // Fetch products
  useEffect(() => {
    if (!storeId) return;
    supabase
      .from('dynamic_product')
      .select('id, name, dynamic_product_imeis, device_size')
      .eq('store_id', storeId)
      .then(({ data, error }) => {
        if (error) {
          setError("Failed to fetch products: " + error.message);
          addNotification("Failed to fetch products.", 'error');
        } else {
          setProducts(data || []);
        }
      });
  }, [storeId, addNotification]);

  const updateInventory = async (dynamic_product_id, qty) => {
    try {
      const { data: inventory, error: fetchError } = await supabase
        .from('dynamic_inventory')
        .select('available_qty, quantity_sold')
        .eq('dynamic_product_id', dynamic_product_id)
        .eq('store_id', storeId)
        .single();
  
      if (fetchError) {
        throw new Error(`Failed to fetch inventory: ${fetchError.message}`);
      }
  
      if (!inventory) {
        throw new Error('Inventory record not found for this product.');
      }
  
      const newAvailableQty = inventory.available_qty - qty;
      const newQuantitySold = (inventory.quantity_sold || 0) + qty;
  
      if (newAvailableQty < 0) {
        throw new Error('Insufficient inventory available.');
      }
  
      const { error: updateError } = await supabase
        .from('dynamic_inventory')
        .update({
          available_qty: newAvailableQty,
          quantity_sold: newQuantitySold,
        })
        .eq('dynamic_product_id', dynamic_product_id)
        .eq('store_id', storeId);
  
      if (updateError) {
        throw new Error(`Failed to update inventory: ${updateError.message}`);
      }
    } catch (err) {
      throw err;
    }
  };
const checkDeviceInProduct = useCallback(
  async (deviceId, modal, entryIndex, deviceIndex) => {
    if (!deviceId || typeof deviceId !== 'string' || deviceId.trim() === '') {
      addNotification('Invalid Device ID: Empty or undefined value', 'error');
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('dynamic_product')
        .select('id, name, dynamic_product_imeis, device_size')
        .eq('store_id', storeId)
        .ilike('dynamic_product_imeis', `%${deviceId}%`);

      if (error) {
        throw new Error(`Error checking device ID: ${error.message}`);
      }

      let entries = [...debtEntries];

      if (data && data.length > 0) {
        const product = data[0];
        const deviceIds = product.dynamic_product_imeis ? product.dynamic_product_imeis.split(',').map(id => id.trim()) : [];
        const deviceSizes = product.device_size ? product.device_size.split(',').map(size => size.trim()) : [];
        const deviceIndexInProduct = deviceIds.indexOf(deviceId.trim());

        if (deviceIndexInProduct !== -1) {
          const deviceSize = deviceSizes[deviceIndexInProduct] || '';

          if (modal === 'add') {
            const existingEntryIndex = entries.findIndex(
              entry => entry.dynamic_product_id === product.id.toString()
            );

            entries[entryIndex].deviceIds[deviceIndex] = '';
            entries[entryIndex].deviceSizes[deviceIndex] = '';
            if (!entries[entryIndex].isQuantityManual) {
              entries[entryIndex].qty = entries[entryIndex].deviceIds.filter(id => id.trim()).length || 1;
            }

            if (existingEntryIndex !== -1 && existingEntryIndex !== entryIndex) {
              entries[existingEntryIndex].deviceIds = [
                ...entries[existingEntryIndex].deviceIds.filter(id => id.trim()),
                deviceId,
                ''
              ];
              entries[existingEntryIndex].deviceSizes = [
                ...entries[existingEntryIndex].deviceSizes.filter((_, i) => entries[existingEntryIndex].deviceIds[i].trim()),
                deviceSize,
                ''
              ];
              if (!entries[existingEntryIndex].isQuantityManual) {
                entries[existingEntryIndex].qty = entries[existingEntryIndex].deviceIds.filter(id => id.trim()).length || 1;
              }
              if (
                !entries[entryIndex].customer_id &&
                !entries[entryIndex].dynamic_product_id &&
                entries[entryIndex].deviceIds.every(id => !id.trim())
              ) {
                entries.splice(entryIndex, 1);
                setDebtEntries([...entries]);
                setScannerTarget({
                  modal,
                  entryIndex: existingEntryIndex,
                  deviceIndex: entries[existingEntryIndex].deviceIds.length - 1
                });
              } else {
                setDebtEntries([...entries]);
                setScannerTarget({
                  modal,
                  entryIndex: existingEntryIndex,
                  deviceIndex: entries[existingEntryIndex].deviceIds.length - 1
                });
              }
            } else {
              const newEntry = {
                customer_id: entries[entryIndex].customer_id || '',
                customer_name: entries[entryIndex].customer_name || '',
                phone_number: entries[entryIndex].phone_number || '',
                dynamic_product_id: product.id.toString(),
                product_name: product.name,
                supplier: entries[entryIndex].supplier || '',
                deviceIds: [deviceId, ''],
                deviceSizes: [deviceSize, ''],
                qty: 1,
                owed: entries[entryIndex].owed || '',
                deposited: entries[entryIndex].deposited || '',
                date: entries[entryIndex].date || new Date().toISOString().split('T')[0],
                isQuantityManual: false
              };
              entries.push(newEntry);
              if (
                !entries[entryIndex].customer_id &&
                !entries[entryIndex].dynamic_product_id &&
                entries[entryIndex].deviceIds.every(id => !id.trim())
              ) {
                entries.splice(entryIndex, 1);
                setDebtEntries([...entries]);
                setScannerTarget({
                  modal,
                  entryIndex: entries.length - 1,
                  deviceIndex: 1
                });
              } else {
                setDebtEntries([...entries]);
                setScannerTarget({
                  modal,
                  entryIndex: entries.length - 1,
                  deviceIndex: 1
                });
              }
            }
            return true;
          } else if (modal === 'edit') {
            setEditing(prev => ({
              ...prev,
              dynamic_product_id: product.id.toString(),
              product_name: product.name,
              deviceIds: prev.deviceIds.map((id, idx) => idx === deviceIndex ? deviceId : id).concat(['']),
              deviceSizes: prev.deviceSizes.map((size, idx) => idx === deviceIndex ? deviceSize : size).concat(['']),
              qty: prev.isQuantityManual ? prev.qty : (prev.deviceIds.filter(id => id.trim()).length + 1 || 1),
              date: prev.date || new Date().toISOString().split('T')[0],
              isQuantityManual: false
            }));
            setScannerTarget({
              modal,
              entryIndex,
              deviceIndex: editing.deviceIds.length
            });
            return true;
          }
        }
      }

      if (modal === 'add') {
        entries[entryIndex].deviceIds[deviceIndex] = deviceId;
        entries[entryIndex].deviceSizes[deviceIndex] = '';
        if (!entries[entryIndex].isQuantityManual) {
          entries[entryIndex].qty = entries[entryIndex].deviceIds.filter(id => id.trim()).length || 1;
        }
        entries[entryIndex].deviceIds = [...entries[entryIndex].deviceIds, ''];
        entries[entryIndex].deviceSizes = [...entries[entryIndex].deviceSizes, ''];
        setDebtEntries([...entries]);
        setScannerTarget({
          modal,
          entryIndex,
          deviceIndex: entries[entryIndex].deviceIds.length - 1
        });
      } else if (modal === 'edit') {
        const newDeviceIds = [...editing.deviceIds];
        const newDeviceSizes = [...editing.deviceSizes];
        newDeviceIds[deviceIndex] = deviceId;
        newDeviceSizes[deviceIndex] = '';
        newDeviceIds.push('');
        newDeviceSizes.push('');
        setEditing(prev => ({
          ...prev,
          deviceIds: newDeviceIds,
          deviceSizes: newDeviceSizes,
          qty: prev.isQuantityManual ? prev.qty : (newDeviceIds.filter(id => id.trim()).length || 1),
          date: prev.date || new Date().toISOString().split('T')[0],
          isQuantityManual: false
        }));
        setScannerTarget({
          modal,
          entryIndex,
          deviceIndex: newDeviceIds.length - 1
        });
      }
      return false;
    } catch (err) {
      console.error(err);
      addNotification('Failed to verify device ID.', 'error');
      return false;
    }
  },
  [storeId, debtEntries, setDebtEntries, setScannerTarget, editing, setEditing, addNotification]
);





  const fetchDebts = useCallback(async () => {
    if (!storeId) return;
    const { data, error } = await supabase
      .from('debts')
      .select('*')
      .eq('store_id', storeId);
    if (error) {
      setError("Failed to fetch debts: " + error.message);
      addNotification("Failed to fetch debts.", 'error');
    } else {
      const debtsWithIds = data.map(debt => ({
        ...debt,
        deviceIds: debt.device_id ? debt.device_id.split(',').filter(Boolean) : [],
        deviceSizes: debt.device_sizes ? debt.device_sizes.split(',').filter(Boolean) : [],
      }));
      setDebts(debtsWithIds);
      setFilteredDebts(debtsWithIds);
    }
  }, [storeId, addNotification]);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    setFilteredDebts(
      debts.filter(d => {
        const fields = [
          d.customer_name,
          d.product_name,
          d.phone_number,
          d.supplier,
          ...d.deviceIds,
          ...d.deviceSizes,
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

  useEffect(() => {
    if (debtsRef.current) {
      debtsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [debts]);

  const checkSoldDevices = useCallback(async (deviceIds) => {
    if (!deviceIds || deviceIds.length === 0) return [];
    setIsLoadingSoldStatus(true);
    try {
      const normalizedIds = deviceIds.map(id => id.trim());
      const { data, error } = await supabase
        .from('dynamic_sales')
        .select('device_id')
        .in('device_id', normalizedIds);
      if (error) throw error;
      const soldIds = data.map(item => item.device_id.trim());
      setSoldDeviceIds(soldIds);
      return soldIds;
    } catch (error) {
      console.error('Error fetching sold devices:', error);
      return [];
    } finally {
      setIsLoadingSoldStatus(false);
    }
  }, []);

  useEffect(() => {
    if (showDetail && showDetail.deviceIds.length > 0) {
      checkSoldDevices(showDetail.deviceIds);
    } else {
      setSoldDeviceIds([]);
    }
  }, [showDetail, checkSoldDevices]);

  const filteredDevices = useMemo(() => {
    if (!showDetail) return [];
    return showDetail.deviceIds.map((id, i) => ({
      id,
      size: showDetail.deviceSizes[i] || '-'
    }));
  }, [showDetail]);

  const totalDetailPages = Math.ceil(filteredDevices.length / detailPageSize);

  const paginatedDevices = useMemo(() => {
    const start = (detailPage - 1) * detailPageSize;
    const end = start + detailPageSize;
    return filteredDevices.slice(start, end);
  }, [filteredDevices, detailPage]);

const processScannedBarcode = useCallback(
  async (scannedCode) => {
    const trimmedCode = scannedCode.trim();
    if (!trimmedCode) {
      setScannerError('Invalid barcode: Empty value');
      addNotification('Invalid barcode: Empty value', 'error');
      return false;
    }

    // Prevent duplicate scans of the same barcode within 1 second
    const currentTime = Date.now();
    if (lastScannedCode === trimmedCode && currentTime - lastScanTime < 1000) {
      return false;
    }
    setLastScannedCode(trimmedCode);
    setLastScanTime(currentTime);

    // Set scan lock to prevent concurrent scans
    if (isScanning) {
      return false;
    }
    setIsScanning(true);

    try {
      if (scannerTarget) {
        const { modal, entryIndex, deviceIndex } = scannerTarget;
        let entries = [...debtEntries];

        // Check for duplicate barcode in current entry
        if (entries[entryIndex].deviceIds.some((id, idx) => idx !== deviceIndex && id.trim().toLowerCase() === trimmedCode.toLowerCase())) {
          setScannerError(`Barcode "${trimmedCode}" already exists in this debt entry`);
          addNotification(`Barcode "${trimmedCode}" already exists in this debt entry`, 'error');
          return false;
        }

        // Check for duplicate barcode in other entries
        const existingEntryIndex = entries.findIndex(
          entry => entry.deviceIds.some(id => id.trim().toLowerCase() === trimmedCode.toLowerCase())
        );
        if (existingEntryIndex !== -1 && existingEntryIndex !== entryIndex) {
          setScannerError(`Barcode "${trimmedCode}" already exists`);
          addNotification(`Barcode "${trimmedCode}" already exists in debt entry ${existingEntryIndex + 1}`, 'error');
          return false;
        }

        // Query product by barcode
        const { data, error } = await supabase
          .from('dynamic_product')
          .select('id, name, dynamic_product_imeis, device_size')
          .eq('store_id', storeId)
          .ilike('dynamic_product_imeis', `%${trimmedCode}%`);

        if (error) {
          setScannerError(`Error checking device ID: ${error.message}`);
          addNotification(`Error checking device ID: ${error.message}`, 'error');
          return false;
        }

        let newScannerTarget = { modal, entryIndex, deviceIndex };

        if (data && data.length > 0) {
          const product = data[0];
          const deviceIds = product.dynamic_product_imeis ? product.dynamic_product_imeis.split(',').map(id => id.trim()) : [];
          const deviceSizes = product.device_size ? product.device_size.split(',').map(size => size.trim()) : [];
          const deviceIndexInProduct = deviceIds.indexOf(trimmedCode);

          if (deviceIndexInProduct !== -1) {
            const deviceSize = deviceSizes[deviceIndexInProduct] || '';
            const currentProductId = modal === 'add' ? entries[entryIndex].dynamic_product_id : editing.dynamic_product_id;

            if (currentProductId && currentProductId !== product.id.toString()) {
              const deviceFound = await checkDeviceInProduct(trimmedCode, modal, entryIndex, deviceIndex);
              if (deviceFound) {
                setScannerError(null);
                setScanSuccess(true);
                setTimeout(() => setScanSuccess(false), 1000);
                addNotification(`Scanned barcode: ${trimmedCode} (moved to correct product line)`, 'success');
                playSuccessSound();
                return true;
              }
              return false;
            }

            // Populate product details
            if (modal === 'add') {
              entries[entryIndex].dynamic_product_id = product.id.toString();
              entries[entryIndex].product_name = product.name;
              entries[entryIndex].deviceIds[deviceIndex] = trimmedCode;
              entries[entryIndex].deviceSizes[deviceIndex] = deviceSize;
              if (!entries[entryIndex].isQuantityManual) {
                entries[entryIndex].qty = entries[entryIndex].deviceIds.filter(id => id.trim()).length || 1;
              }
              entries[entryIndex].deviceIds = [...entries[entryIndex].deviceIds, ''];
              entries[entryIndex].deviceSizes = [...entries[entryIndex].deviceSizes, ''];
              setDebtEntries([...entries]);
              newScannerTarget = {
                modal,
                entryIndex,
                deviceIndex: entries[entryIndex].deviceIds.length - 1,
              };
            } else if (modal === 'edit') {
              const newDeviceIds = [...editing.deviceIds];
              const newDeviceSizes = [...editing.deviceSizes];
              newDeviceIds[deviceIndex] = trimmedCode;
              newDeviceSizes[deviceIndex] = deviceSize;
              newDeviceIds.push('');
              newDeviceSizes.push('');
              setEditing(prev => ({
                ...prev,
                dynamic_product_id: product.id.toString(),
                product_name: product.name,
                deviceIds: newDeviceIds,
                deviceSizes: newDeviceSizes,
                qty: prev.isQuantityManual ? prev.qty : (newDeviceIds.filter(id => id.trim()).length || 1),
                date: prev.date || new Date().toISOString().split('T')[0],
                isQuantityManual: false,
              }));
              newScannerTarget = {
                modal,
                entryIndex,
                deviceIndex: newDeviceIds.length - 1,
              };
            }

            setScannerTarget(newScannerTarget);
            setScannerError(null);
            setScanSuccess(true);
            setTimeout(() => setScanSuccess(false), 1000);
            addNotification(`Scanned barcode: ${trimmedCode} (Product: ${product.name})`, 'success');
            playSuccessSound();
            return true;
          }
        }

        // If no product found, add barcode without product details
        if (modal === 'add') {
          entries[entryIndex].deviceIds[deviceIndex] = trimmedCode;
          entries[entryIndex].deviceSizes[deviceIndex] = '';
          if (!entries[entryIndex].isQuantityManual) {
            entries[entryIndex].qty = entries[entryIndex].deviceIds.filter(id => id.trim()).length || 1;
          }
          entries[entryIndex].deviceIds = [...entries[entryIndex].deviceIds, ''];
          entries[entryIndex].deviceSizes = [...entries[entryIndex].deviceSizes, ''];
          setDebtEntries([...entries]);
          newScannerTarget = {
            modal,
            entryIndex,
            deviceIndex: entries[entryIndex].deviceIds.length - 1,
          };
        } else if (modal === 'edit') {
          const newDeviceIds = [...editing.deviceIds];
          const newDeviceSizes = [...editing.deviceSizes];
          newDeviceIds[deviceIndex] = trimmedCode;
          newDeviceSizes[deviceIndex] = '';
          newDeviceIds.push('');
          newDeviceSizes.push('');
          setEditing(prev => ({
            ...prev,
            deviceIds: newDeviceIds,
            deviceSizes: newDeviceSizes,
            qty: prev.isQuantityManual ? prev.qty : (newDeviceIds.filter(id => id.trim()).length || 1),
            date: prev.date || new Date().toISOString().split('T')[0],
            isQuantityManual: false,
          }));
          newScannerTarget = {
            modal,
            entryIndex,
            deviceIndex: newDeviceIds.length - 1,
          };
        }

        setScannerTarget(newScannerTarget);
        setScannerError(null);
        setScanSuccess(true);
        setTimeout(() => setScanSuccess(false), 1000);
        addNotification(`Scanned barcode: ${trimmedCode}`, 'success');
        playSuccessSound();
        return true;
      }
      return false;
    } finally {
      setIsScanning(false); // Release scan lock
    }
  },
  [scannerTarget, debtEntries, editing, checkDeviceInProduct, setDebtEntries, setEditing, setScannerTarget, setScannerError, playSuccessSound, storeId, addNotification, lastScannedCode, lastScanTime, isScanning]
);






const handleManualInput = useCallback(
  async () => {
    const trimmedInput = manualInput.trim();
    if (!trimmedInput) {
      setScannerError('Invalid barcode: Empty value');
      addNotification('Invalid barcode: Empty value', 'error');
      return;
    }

    if (isScanning) {
      return;
    }
    setIsScanning(true);

    try {
      if (scannerTarget) {
        const { modal, entryIndex, deviceIndex } = scannerTarget;
        let entries = [...debtEntries];

        if (entries[entryIndex].deviceIds.some((id, idx) => idx !== deviceIndex && id.trim().toLowerCase() === trimmedInput.toLowerCase())) {
          setScannerError(`Barcode "${trimmedInput}" already exists in this debt entry`);
          addNotification(`Barcode "${trimmedInput}" already exists in this debt entry`, 'error');
          return;
        }

        const existingEntryIndex = entries.findIndex(
          entry => entry.deviceIds.some(id => id.trim().toLowerCase() === trimmedInput.toLowerCase())
        );
        if (existingEntryIndex !== -1 && existingEntryIndex !== entryIndex) {
          setScannerError(`Barcode "${trimmedInput}" already exists`);
          addNotification(`Barcode "${trimmedInput}" already exists in debt entry ${existingEntryIndex + 1}`, 'error');
          return;
        }

        const { data, error } = await supabase
          .from('dynamic_product')
          .select('id, name, dynamic_product_imeis, device_size')
          .eq('store_id', storeId)
          .ilike('dynamic_product_imeis', `%${trimmedInput}%`);

        if (error) {
          setScannerError(`Error checking device ID: ${error.message}`);
          addNotification(`Error checking device ID: ${error.message}`, 'error');
          return;
        }

        let newScannerTarget = { modal, entryIndex, deviceIndex };

        if (data && data.length > 0) {
          const product = data[0];
          const deviceIds = product.dynamic_product_imeis ? product.dynamic_product_imeis.split(',').map(id => id.trim()) : [];
          const deviceSizes = product.device_size ? product.device_size.split(',').map(size => size.trim()) : [];
          const deviceIndexInProduct = deviceIds.indexOf(trimmedInput);

          if (deviceIndexInProduct !== -1) {
            const deviceSize = deviceSizes[deviceIndexInProduct] || '';
            const currentProductId = modal === 'add' ? entries[entryIndex].dynamic_product_id : editing.dynamic_product_id;

            if (currentProductId && currentProductId !== product.id.toString()) {
              const deviceFound = await checkDeviceInProduct(trimmedInput, modal, entryIndex, deviceIndex);
              if (deviceFound) {
                setManualInput('');
                setScannerError(null);
                setScanSuccess(true);
                setTimeout(() => setScanSuccess(false), 1000);
                addNotification(`Added barcode: ${trimmedInput} (moved to correct product line)`, 'success');
                playSuccessSound();
                if (manualInputRef.current) {
                  manualInputRef.current.focus();
                }
                return;
              }
              return;
            }

            if (modal === 'add') {
              entries[entryIndex].dynamic_product_id = product.id.toString();
              entries[entryIndex].product_name = product.name;
              entries[entryIndex].deviceIds[deviceIndex] = trimmedInput;
              entries[entryIndex].deviceSizes[deviceIndex] = deviceSize;
              if (!entries[entryIndex].isQuantityManual) {
                entries[entryIndex].qty = entries[entryIndex].deviceIds.filter(id => id.trim()).length || 1;
              }
              entries[entryIndex].deviceIds = [...entries[entryIndex].deviceIds, ''];
              entries[entryIndex].deviceSizes = [...entries[entryIndex].deviceSizes, ''];
              setDebtEntries([...entries]);
              newScannerTarget = {
                modal,
                entryIndex,
                deviceIndex: entries[entryIndex].deviceIds.length - 1,
              };
            } else if (modal === 'edit') {
              const newDeviceIds = [...editing.deviceIds];
              const newDeviceSizes = [...editing.deviceSizes];
              newDeviceIds[deviceIndex] = trimmedInput;
              newDeviceSizes[deviceIndex] = deviceSize;
              newDeviceIds.push('');
              newDeviceSizes.push('');
              setEditing(prev => ({
                ...prev,
                dynamic_product_id: product.id.toString(),
                product_name: product.name,
                deviceIds: newDeviceIds,
                deviceSizes: newDeviceSizes,
                qty: prev.isQuantityManual ? prev.qty : (newDeviceIds.filter(id => id.trim()).length || 1),
                date: prev.date || new Date().toISOString().split('T')[0],
                isQuantityManual: false,
              }));
              newScannerTarget = {
                modal,
                entryIndex,
                deviceIndex: newDeviceIds.length - 1,
              };
            }

            setScannerTarget(newScannerTarget);
            setManualInput('');
            setScannerError(null);
            setScanSuccess(true);
            setTimeout(() => setScanSuccess(false), 1000);
            addNotification(`Added barcode: ${trimmedInput} (Product: ${product.name})`, 'success');
            playSuccessSound();
            if (manualInputRef.current) {
              manualInputRef.current.focus();
            }
            return;
          }
        }

        if (modal === 'add') {
          entries[entryIndex].deviceIds[deviceIndex] = trimmedInput;
          entries[entryIndex].deviceSizes[deviceIndex] = '';
          if (!entries[entryIndex].isQuantityManual) {
            entries[entryIndex].qty = entries[entryIndex].deviceIds.filter(id => id.trim()).length || 1;
          }
          entries[entryIndex].deviceIds = [...entries[entryIndex].deviceIds, ''];
          entries[entryIndex].deviceSizes = [...entries[entryIndex].deviceSizes, ''];
          setDebtEntries([...entries]);
          newScannerTarget = {
            modal,
            entryIndex,
            deviceIndex: entries[entryIndex].deviceIds.length - 1,
          };
        } else if (modal === 'edit') {
          const newDeviceIds = [...editing.deviceIds];
          const newDeviceSizes = [...editing.deviceSizes];
          newDeviceIds[deviceIndex] = trimmedInput;
          newDeviceSizes[deviceIndex] = '';
          newDeviceIds.push('');
          newDeviceSizes.push('');
          setEditing(prev => ({
            ...prev,
            deviceIds: newDeviceIds,
            deviceSizes: newDeviceSizes,
            qty: prev.isQuantityManual ? prev.qty : (newDeviceIds.filter(id => id.trim()).length || 1),
            date: prev.date || new Date().toISOString().split('T')[0],
            isQuantityManual: false,
          }));
          newScannerTarget = {
            modal,
            entryIndex,
            deviceIndex: newDeviceIds.length - 1,
          };
        }

        setScannerTarget(newScannerTarget);
        setManualInput('');
        setScannerError(null);
        setScanSuccess(true);
        setTimeout(() => setScanSuccess(false), 1000);
        addNotification(`Added barcode: ${trimmedInput}`, 'success');
        playSuccessSound();
        if (manualInputRef.current) {
          manualInputRef.current.focus();
        }
      }
    } finally {
      setIsScanning(false); // Release scan lock
    }
  },
  [manualInput, scannerTarget, debtEntries, editing, checkDeviceInProduct, setDebtEntries, setEditing, setScannerTarget, setScannerError, playSuccessSound, manualInputRef, storeId, addNotification, isScanning]
);



  
  const handleManualInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleManualInput();
    }
  };

  useEffect(() => {
  if (!externalScannerMode || !scannerTarget || !showScanner) return;

  const handleKeypress = (e) => {
    const currentTime = Date.now();
    const timeDiff = currentTime - lastKeyTime;

    if (timeDiff > 50 && scannerBuffer) {
      setScannerBuffer('');
    }

    if (e.key === 'Enter' && scannerBuffer) {
      if (!isScanning) {
        processScannedBarcode(scannerBuffer).then((success) => {
          if (success) {
            setScannerBuffer('');
            setManualInput('');
            if (manualInputRef.current) {
              manualInputRef.current.focus();
            }
          }
        });
      }
    } else if (e.key !== 'Enter') {
      setScannerBuffer(prev => prev + e.key);
    }

    setLastKeyTime(currentTime);
  };

  document.addEventListener('keypress', handleKeypress);

  return () => {
    document.removeEventListener('keypress', handleKeypress);
  };
}, [externalScannerMode, scannerTarget, scannerBuffer, lastKeyTime, showScanner, processScannedBarcode, isScanning]);




useEffect(() => {
  if (!showScanner || !scannerDivRef.current || !videoRef.current || externalScannerMode) return;

  setScannerLoading(true);
  const videoElement = videoRef.current;

  try {
    if (!document.getElementById('scanner')) {
      setScannerLoading(false);
      return;
    }

    html5QrCodeRef.current = new Html5Qrcode('scanner');
  } catch (err) {
    setScannerLoading(false);
    return;
  }

  const config = {
    fps: 30,
    qrbox: { width: 250, height: 125 },
    formatsToSupport: [
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.QR_CODE,
    ],
    aspectRatio: 1.0,
    disableFlip: true,
    videoConstraints: { width: 1280, height: 720, facingMode: 'environment' },
  };

  const onScanSuccess = (decodedText) => {
    if (!isScanning) {
      processScannedBarcode(decodedText).then((success) => {
        if (success) {
          setManualInput('');
          if (manualInputRef.current) {
            manualInputRef.current.focus();
          }
        }
      });
    }
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
    if (!videoElement || !scannerDivRef.current) {
      setScannerLoading(false);
      return;
    }
    if (attempt > maxAttempts) {
      setScannerLoading(false);
      return;
    }
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: config.videoConstraints,
        });
      } catch (err) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
        });
      }
      videoElement.srcObject = stream;
      await new Promise(resolve => {
        videoElement.onloadedmetadata = () => resolve();
      });
      await html5QrCodeRef.current.start(
        config.videoConstraints,
        config,
        onScanSuccess,
        onScanFailure
      );
      setScannerLoading(false);
    } catch (err) {
      setTimeout(() => startScanner(attempt + 1, maxAttempts), 200);
    }
  };

  Html5Qrcode.getCameras()
    .then(cameras => {
      if (cameras.length === 0) {
        setScannerLoading(false);
        return;
      }
      startScanner();
    })
    .catch(err => {
      setScannerLoading(false);
    });

  return () => {
    if (html5QrCodeRef.current &&
        [Html5QrcodeScannerState.SCANNING, Html5QrcodeScannerState.PAUSED].includes(
          html5QrCodeRef.current.getState()
        )) {
      html5QrCodeRef.current
        .stop()
        .then(() => console.log('Webcam scanner stopped'))
        .catch(err => console.error('Error stopping scanner:', err));
    }
    if (videoElement && videoElement.srcObject) {
      videoElement.srcObject.getTracks().forEach(track => track.stop());
      videoElement.srcObject = null;
    }
    html5QrCodeRef.current = null;
  };
}, [showScanner, scannerTarget, externalScannerMode, processScannedBarcode, isScanning]);


  useEffect(() => {
    if (showScanner && manualInputRef.current) {
      manualInputRef.current.focus();
    }
  }, [showScanner, scannerTarget]);

  const openScanner = (modal, entryIndex, deviceIndex) => {
    setScannerTarget({ modal, entryIndex, deviceIndex });
    setShowScanner(true);
    setScannerError(null);
    setScannerLoading(true);
    setManualInput('');
    setExternalScannerMode(false);
    setScannerBuffer('');
  };

  const showDebtReminders = () => {
    const unpaidDebts = debts.filter(d => (d.remaining_balance || 0) > 0);
    if (unpaidDebts.length === 0) {
      addNotification("No unpaid debts found.", 'info', 5000);
      return;
    }

    unpaidDebts.forEach(d => {
      addNotification(
        `Debtor: ${d.customer_name}, Outstanding: ₦${(d.remaining_balance || 0).toFixed(2)}, Product: ${d.product_name}, Date: ${d.date}`,
        'warning',
        5000
      );
    });
  };

  const scheduleReminders = () => {
    if (!reminderTime) {
      addNotification("Please select a reminder time.", 'error');
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
      addNotification(`Reminder set for ${nextReminder.toLocaleString()}`, 'success');
    } else {
      setTimeout(() => {
        showDebtReminders();
        reminderIntervalRef.current = setInterval(
          showDebtReminders,
          reminderType === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
        );
      }, msUntilReminder);
      addNotification(`Recurring ${reminderType} reminders set starting ${nextReminder.toLocaleString()}`, 'success');
    }

    setShowReminderForm(false);
  };

  const handleDebtChange = (index, e) => {
    const { name, value } = e.target;
    const updatedEntries = [...debtEntries];
    updatedEntries[index] = { ...updatedEntries[index], [name]: value };

    if (name === 'customer_id' && value) {
      const selectedCustomer = customers.find(c => c.id === parseInt(value));
      if (selectedCustomer) {
        updatedEntries[index] = {
          ...updatedEntries[index],
          customer_id: value,
          customer_name: selectedCustomer.fullname,
          phone_number: selectedCustomer.phone_number || "",
          date: updatedEntries[index].date || new Date().toISOString().split('T')[0],
        };
      }
    }

    if (name === 'dynamic_product_id' && value) {
      const selectedProduct = products.find(p => p.id === parseInt(value));
      if (selectedProduct) {
        updatedEntries[index] = {
          ...updatedEntries[index],
          dynamic_product_id: value,
          product_name: selectedProduct.name,
          date: updatedEntries[index].date || new Date().toISOString().split('T')[0],
        };
      }
    }

    setDebtEntries(updatedEntries);
  };

  const handleDeviceIdChange = (entryIndex, deviceIndex, value) => {
    const updatedEntries = [...debtEntries];
    updatedEntries[entryIndex].deviceIds[deviceIndex] = value.trim();
    updatedEntries[entryIndex].deviceSizes[deviceIndex] = '';
    setDebtEntries(updatedEntries);
  };

  const handleDeviceIdConfirm = async (entryIndex, deviceIndex, value) => {
    const trimmedValue = value?.trim();
    if (!trimmedValue || typeof trimmedValue !== 'string') {
      addNotification('Invalid Device ID: Empty or undefined value', 'error');
      return;
    }

    let entries = [...debtEntries];

    if (entries[entryIndex].deviceIds.some((id, idx) => idx !== deviceIndex && id.trim().toLowerCase() === trimmedValue.toLowerCase())) {
      addNotification(`Device ID "${trimmedValue}" already exists in this debt entry`, 'error');
      return;
    }

    const existingEntryIndex = entries.findIndex(
      (entry, idx) => idx !== entryIndex && entry.deviceIds.some(id => id.trim().toLowerCase() === trimmedValue.toLowerCase())
    );
    if (existingEntryIndex !== -1) {
      addNotification(`Device ID "${trimmedValue}" already exists in debt entry ${existingEntryIndex + 1}`, 'error');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('dynamic_product')
        .select('id, name, dynamic_product_imeis, device_size')
        .eq('store_id', storeId)
        .ilike('dynamic_product_imeis', `%${trimmedValue}%`);

      if (error) {
        addNotification(`Error checking device ID: ${error.message}`, 'error');
        return;
      }

      entries = [...debtEntries];
      if (data && data.length > 0) {
        const product = data[0];
        const deviceIds = product.dynamic_product_imeis ? product.dynamic_product_imeis.split(',').map(id => id.trim()) : [];
        const deviceSizes = product.device_size ? product.device_size.split(',').map(size => size.trim()) : [];
        const deviceIndexInProduct = deviceIds.indexOf(trimmedValue);

        if (deviceIndexInProduct !== -1) {
          const deviceSize = deviceSizes[deviceIndexInProduct] || '';
          const currentProductId = entries[entryIndex].dynamic_product_id;

          if (currentProductId && currentProductId !== product.id.toString()) {
            const deviceFound = await checkDeviceInProduct(trimmedValue, 'add', entryIndex, deviceIndex);
            if (deviceFound) {
              addNotification(`Device ID ${trimmedValue} moved to correct product line`, 'success');
            }
            return;
          }

          entries[entryIndex].dynamic_product_id = product.id.toString();
          entries[entryIndex].product_name = product.name;
          entries[entryIndex].deviceSizes[deviceIndex] = deviceSize;
          entries[entryIndex].deviceIds = [...entries[entryIndex].deviceIds, ''];
          entries[entryIndex].deviceSizes = [...entries[entryIndex].deviceSizes, ''];
          if (!entries[entryIndex].isQuantityManual) {
            entries[entryIndex].qty = entries[entryIndex].deviceIds.filter(id => id.trim()).length || 1;
          }
          setDebtEntries([...entries]);
          addNotification(`Product ${product.name} loaded for Device ID: ${trimmedValue}`, 'success');
        } else {
          entries[entryIndex].deviceIds = [...entries[entryIndex].deviceIds, ''];
          entries[entryIndex].deviceSizes = [...entries[entryIndex].deviceSizes, ''];
          if (!entries[entryIndex].isQuantityManual) {
            entries[entryIndex].qty = entries[entryIndex].deviceIds.filter(id => id.trim()).length || 1;
          }
          setDebtEntries([...entries]);
        }
      } else {
        entries[entryIndex].deviceIds = [...entries[entryIndex].deviceIds, ''];
        entries[entryIndex].deviceSizes = [...entries[entryIndex].deviceSizes, ''];
        if (!entries[entryIndex].isQuantityManual) {
          entries[entryIndex].qty = entries[entryIndex].deviceIds.filter(id => id.trim()).length || 1;
        }
        setDebtEntries([...entries]);
      }
    } catch (err) {
      console.error(err);
      addNotification('Failed to verify device ID.', 'error');
    }
  };

  const handleDeviceSizeChange = (index, deviceIndex, value) => {
    const updatedEntries = [...debtEntries];
    updatedEntries[index].deviceSizes[deviceIndex] = value;
    setDebtEntries(updatedEntries);
  };

  const handleEditDeviceIdChange = (deviceIndex, value) => {
    setEditing(prev => ({
      ...prev,
      deviceIds: prev.deviceIds.map((id, i) => i === deviceIndex ? value : id)
    }));
  };

  const handleEditDeviceSizeChange = (deviceIndex, value) => {
    setEditing(prev => ({
      ...prev,
      deviceSizes: prev.deviceSizes.map((size, i) => i === deviceIndex ? value : size)
    }));
  };

  const addDeviceIdField = index => {
    const updatedEntries = [...debtEntries];
    updatedEntries[index].deviceIds.push('');
    updatedEntries[index].deviceSizes.push('');
    setDebtEntries(updatedEntries);
  };

  const addEditDeviceIdField = () => {
    setEditing(prev => ({
      ...prev,
      deviceIds: [...prev.deviceIds, ''],
      deviceSizes: [...prev.deviceSizes, '']
    }));
  };

  const removeDeviceIdField = (index, deviceIndex) => {
    const updatedEntries = [...debtEntries];
    updatedEntries[index].deviceIds.splice(deviceIndex, 1);
    updatedEntries[index].deviceSizes.splice(deviceIndex, 1);
    if (updatedEntries[index].deviceIds.length === 0) {
      updatedEntries[index].deviceIds = [''];
      updatedEntries[index].deviceSizes = [''];
    } else {
      updatedEntries[index].qty = updatedEntries[index].deviceIds.filter(id => id.trim()).length.toString();
    }
    setDebtEntries(updatedEntries);
  };

  const removeEditDeviceIdField = (deviceIndex) => {
    setEditing(prev => {
      const newDeviceIds = [...prev.deviceIds];
      const newDeviceSizes = [...prev.deviceSizes];
      newDeviceIds.splice(deviceIndex, 1);
      newDeviceSizes.splice(deviceIndex, 1);
      if (newDeviceIds.length === 0) {
        newDeviceIds.push('');
        newDeviceSizes.push('');
      } else {
        newDeviceIds.qty = newDeviceIds.filter(id => id.trim()).length.toString();
      }
      return { ...prev, deviceIds: newDeviceIds, deviceSizes: newDeviceSizes };
    });
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
        deviceIds: [""],
        deviceSizes: [""],
        qty: "",
        owed: "",
        deposited: "",
        date: new Date().toISOString().split('T')[0],
      }
    ]);
  };

  const removeDebtEntry = index => {
    if (debtEntries.length === 1) return;
    setDebtEntries(debtEntries.filter((_, i) => i !== index));
  };

  const saveDebts = async () => {
    let hasError = false;

    if (editing && editing.id) {
      const entry = editing;
      if (
        !entry.customer_id ||
        isNaN(parseInt(entry.customer_id)) ||
        !entry.dynamic_product_id ||
        isNaN(parseInt(entry.dynamic_product_id)) ||
        !entry.qty ||
        isNaN(parseInt(entry.qty)) ||
        !entry.owed ||
        isNaN(parseFloat(entry.owed)) ||
        !entry.date ||
        entry.deviceIds.filter(id => id.trim()).length === 0
      ) {
        hasError = true;
      } else {
        const debtData = {
          store_id: parseInt(storeId),
          customer_id: parseInt(entry.customer_id),
          dynamic_product_id: parseInt(entry.dynamic_product_id),
          customer_name: entry.customer_name || null,
          product_name: entry.product_name || null,
          phone_number: entry.phone_number || null,
          supplier: entry.supplier || null,
          device_id: entry.deviceIds.filter(id => id.trim()).join(','),
          device_sizes: entry.deviceSizes
            .filter((_, i) => entry.deviceIds[i].trim())
            .join(','),
          qty: parseInt(entry.qty),
          owed: parseFloat(entry.owed),
          deposited: entry.deposited ? parseFloat(entry.deposited) : 0.00,
          remaining_balance:
            parseFloat(entry.owed) -
            (entry.deposited ? parseFloat(entry.deposited) : 0.00),
          date: entry.date,
        };

        try {
          const { data: originalDebt, error: fetchError } = await supabase
            .from('debts')
            .select('qty')
            .eq('id', editing.id)
            .single();

          if (fetchError) throw fetchError;

          const qtyDifference = parseInt(entry.qty) - (originalDebt.qty || 0);
          if (qtyDifference !== 0) {
            await updateInventory(entry.dynamic_product_id, qtyDifference);
          }

          await supabase.from('debts').update(debtData).eq('id', editing.id);
          setEditing(null);
          setDebtEntries([
            {
              customer_id: '',
              customer_name: '',
              phone_number: '',
              dynamic_product_id: '',
              product_name: '',
              supplier: '',
              deviceIds: [''],
              deviceSizes: [''],
              qty: '',
              owed: '',
              deposited: '',
              date: '',
            },
          ]);
          setError(null);
          addNotification('Debt updated successfully!', 'success');
          fetchDebts();
        } catch (err) {
          setError('Failed to update debt or inventory: ' + err.message);
          addNotification('Failed to update debt or inventory.', 'error');
        }
        return;
      }
    } else {
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
          !entry.date ||
          entry.deviceIds.filter(id => id.trim()).length === 0
        ) {
          hasError = true;
          return false;
        }
        return true;
      });

      if (hasError || validEntries.length === 0) {
        setError(
          'Please fill all required fields (Customer, Product, Device ID, Qty, Owed, Date) correctly.'
        );
        addNotification('Please fill all required fields correctly.', 'error');
        return;
      }

      const debtData = validEntries.map(entry => ({
        store_id: parseInt(storeId),
        customer_id: parseInt(entry.customer_id),
        dynamic_product_id: parseInt(entry.dynamic_product_id),
        customer_name: entry.customer_name || null,
        product_name: entry.product_name || null,
        phone_number: entry.phone_number || null,
        supplier: entry.supplier || null,
        device_id: entry.deviceIds.filter(id => id.trim()).join(','),
        device_sizes: entry.deviceSizes
          .filter((_, i) => entry.deviceIds[i].trim())
          .join(','),
        qty: parseInt(entry.qty),
        owed: parseFloat(entry.owed),
        deposited: entry.deposited ? parseFloat(entry.deposited) : 0.00,
        remaining_balance:
          parseFloat(entry.owed) -
          (entry.deposited ? parseFloat(entry.deposited) : 0.00),
        date: entry.date,
      }));

      try {
        for (const entry of debtData) {
          await updateInventory(entry.dynamic_product_id, entry.qty);
        }

        await supabase.from('debts').insert(debtData);
        setEditing(null);
        setDebtEntries([
          {
            customer_id: '',
            customer_name: '',
            phone_number: '',
            dynamic_product_id: '',
            product_name: '',
            supplier: '',
            deviceIds: [''],
            deviceSizes: [''],
            qty: '',
            owed: '',
            deposited: '',
            date: '',
          },
        ]);
        setError(null);
        addNotification(`${debtData.length} debt(s) saved successfully!`, 'success');
        fetchDebts();
      } catch (err) {
        setError('Failed to save debts or update inventory: ' + err.message);
        addNotification('Failed to save debts or update inventory.', 'error');
      }
    }

    if (hasError) {
      setError(
        'Please fill all required fields (Customer, Product, Device ID, Qty, Owed, Date) correctly.'
      );
      addNotification('Please fill all required fields correctly.', 'error');
    }
  };

  const deleteDebt = async id => {
    try {
      await supabase.from("debts").delete().eq("id", id);
      addNotification("Debt deleted successfully!", 'success');
      fetchDebts();
    } catch (err) {
      setError("Failed to delete debt: " + err.message);
      addNotification("Failed to delete debt.", 'error');
    }
  };

  const openEdit = (debt) => {
    setEditing({
      id: debt.id,
      customer_id: debt.customer_id,
      customer_name: debt.customer_name,
      phone_number: debt.phone_number,
      dynamic_product_id: debt.dynamic_product_id,
      product_name: debt.product_name,
      supplier: debt.supplier,
      deviceIds: [...debt.deviceIds, ''],
      deviceSizes: [...debt.deviceSizes, ''],
      qty: debt.qty,
      owed: debt.owed,
      deposited: debt.deposited,
      date: debt.date || new Date().toISOString().split('T')[0],
    });
  };

  if (!storeId) {
    return <div className="p-4 text-center text-red-500">Store ID is missing. Please log in or select a store.</div>;
  }

  return (
    <div className="p-0 space-y-6 dark:bg-gray-900 dark:text-white">
      <DeviceDebtRepayment/>

      {error && (
        <div className="p-4 mb-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4">Debts</h2>

        <div className="w-full mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search debts..."
            className="flex-1 border px-4 py-2 rounded dark:bg-gray-900 dark:text-white w-full"
          />
        </div>

        <div className="mb-4 flex gap-2 sm:gap-3">
        <button
          onClick={() => setEditing({})}
          className="p-3 sm:p-4 bg-indigo-600 text-white rounded-full shadow-md hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors duration-200 flex items-center justify-center"
          aria-label="Add new debt"
        >
          <FaPlus className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
        <button
          onClick={() => setShowReminderForm(true)}
          className="p-3 sm:p-4 bg-yellow-600 text-white rounded-full shadow-md hover:bg-yellow-700 dark:bg-yellow-500 dark:hover:bg-yellow-600 transition-colors duration-200 flex items-center justify-center"
          aria-label="Set debt reminders"
        >
          <FaBell className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>

        <div ref={debtsRef} className="overflow-x-auto">
          <table className="min-w-full text-sm border rounded-lg">
            <thead className="bg-gray-100 dark:bg-gray-900 dark:text-indigo-600">
              <tr>
                <th className="text-left px-4 py-2 border-b">Customer</th>
                <th className="text-left px-4 py-2 border-b">Product</th>
                <th className="text-left px-4 py-2 border-b">Supplier</th>
                <th className="text-left px-4 py-2 border-b">Device IDs</th>
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
                  <td className="px-4 py-2 border-b truncate">
                    <button
                      onClick={() => setShowDetail(d)}
                      className="text-indigo-600 hover:underline focus:outline-none"
                    >
                      View {d.deviceIds.length} ID{d.deviceIds.length !== 1 ? 's' : ''}
                    </button>
                  </td>
                  <td className="px-4 py-2 border-b">{d.qty}</td>
                  <td className="px-4 py-2 border-b">₦{(d.owed || 0).toFixed(2)}</td>
                  <td className="px-4 py-2 border-b">₦{(d.deposited || 0).toFixed(2)}</td>
                  <td className="px-4 py-2 border-b">₦{(d.remaining_balance || 0).toFixed(2)}</td>
                  <td className="px-4 py-2 border-b">{d.date}</td>
                  <td className="px-4 py-2 border-b">
                    <div className="flex gap-3">
                      <button
                        onClick={() => openEdit(d)}
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => deleteDebt(d.id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <FaTrashAlt />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredDebts.length === 0 && (
                <tr className="dark:bg-gray-900 dark:text-white">
                  <td colSpan="10" className="text-center text-gray-500 py-4">
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

    <div className="fixed top-0 right-0 space-y-2 z-[1000] p-4">
    {notifications.map(notification => (
      <div
        key={notification.id}
        className={`p-4 rounded shadow-lg text-white ${
          notification.type === 'success' ? 'bg-green-600' :
          notification.type === 'error' ? 'bg-red-600' :
          notification.type === 'warning' ? 'bg-yellow-600' :
          'bg-blue-600'
        }`}
      >
        {notification.message}
      </div>
    ))}
  </div>
<div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg w-full max-w-3xl max-h-[85vh] overflow-y-auto space-y-4">
  <h2 className="text-lg sm:text-xl font-bold text-center text-gray-900 dark:text-gray-200">
    {editing.id ? 'Edit Debt' : 'Add Debt'}
  </h2>

  {debtEntries.map((entry, index) => (
    <div key={index} className="border border-gray-200 dark:border-gray-700 p-3 sm:p-4 rounded-lg space-y-3 dark:bg-gray-800">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-200">
          Debt Entry {index + 1}
        </h3>
        {debtEntries.length > 1 && (
          <button
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
        <label className="block">
          <span className="font-semibold block mb-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
            Customer
          </span>
          <select
            name="customer_id"
            value={editing.id ? editing.customer_id : entry.customer_id}
            onChange={(e) =>
              editing.id
                ? setEditing((prev) => ({ ...prev, customer_id: e.target.value }))
                : handleDebtChange(index, e)
            }
            className="border p-2 sm:p-3 w-full rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm"
            required
          >
            <option value="">Select Customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullname}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="font-semibold block mb-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
            Product
          </span>
          <select
            name="dynamic_product_id"
            value={editing.id ? editing.dynamic_product_id : entry.dynamic_product_id}
            onChange={(e) =>
              editing.id
                ? setEditing((prev) => ({ ...prev, dynamic_product_id: e.target.value }))
                : handleDebtChange(index, e)
            }
            className="border p-2 sm:p-3 w-full rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm"
            required
          >
            <option value="">Select Product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="font-semibold block mb-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
            Supplier
          </span>
          <input
            name="supplier"
            value={editing.id ? editing.supplier : entry.supplier}
            onChange={(e) =>
              editing.id
                ? setEditing((prev) => ({ ...prev, supplier: e.target.value }))
                : handleDebtChange(index, e)
            }
            className="border p-2 sm:p-3 w-full rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </label>

        <label className="block">
          <span className="font-semibold block mb-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
            Quantity
          </span>
          <input
            type="number"
            name="qty"
            value={editing.id ? editing.qty : entry.qty}
            onChange={(e) =>
              editing.id
                ? setEditing((prev) => ({ ...prev, qty: e.target.value }))
                : handleDebtChange(index, e)
            }
            className="border p-2 sm:p-3 w-full rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm"
            required
            min="1"
          />
        </label>

        <label className="block">
          <span className="font-semibold block mb-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
            Owed
          </span>
          <input
            type="number"
            name="owed"
            value={editing.id ? editing.owed : entry.owed}
            onChange={(e) =>
              editing.id
                ? setEditing((prev) => ({ ...prev, owed: e.target.value }))
                : handleDebtChange(index, e)
            }
            className="border p-2 sm:p-3 w-full rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm"
            required
            min="0"
            step="0.01"
          />
        </label>

        <label className="block">
          <span className="font-semibold block mb-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
            Deposited
          </span>
          <input
            type="number"
            name="deposited"
            value={editing.id ? editing.deposited : entry.deposited}
            onChange={(e) =>
              editing.id
                ? setEditing((prev) => ({ ...prev, deposited: e.target.value }))
                : handleDebtChange(index, e)
            }
            className="border p-2 sm:p-3 w-full rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm"
            min="0"
            step="0.01"
          />
        </label>

        <label className="block">
          <span className="font-semibold block mb-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
            Date
          </span>
          <input
            type="date"
            name="date"
            value={editing.id ? editing.date : entry.date}
            onChange={(e) =>
              editing.id
                ? setEditing((prev) => ({ ...prev, date: e.target.value }))
                : handleDebtChange(index, e)
            }
            className="border p-2 sm:p-3 w-full rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm"
            required
          />
        </label>

        <div className="block">
          <span className="font-semibold block mb-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
            Device IDs and Sizes
          </span>
          {(editing.id ? editing.deviceIds : entry.deviceIds).map((id, deviceIdx) => (
            <div key={deviceIdx} className="flex flex-wrap gap-2 sm:gap-3 mt-2 items-center">
              <input
                value={id}
                onChange={(e) =>
                  editing.id
                    ? handleEditDeviceIdChange(deviceIdx, e.target.value)
                    : handleDeviceIdChange(index, deviceIdx, e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !editing.id) {
                    e.preventDefault();
                    handleDeviceIdConfirm(index, deviceIdx, e.target.value);
                  }
                }}
                onBlur={(e) => !editing.id && handleDeviceIdConfirm(index, deviceIdx, e.target.value)}
                placeholder="Device ID"
                className="flex-1 p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px] sm:min-w-[120px]"
              />
              <input
                value={editing.id ? editing.deviceSizes[deviceIdx] || '' : entry.deviceSizes[deviceIdx] || ''}
                onChange={(e) =>
                  editing.id
                    ? handleEditDeviceSizeChange(deviceIdx, e.target.value)
                    : handleDeviceSizeChange(index, deviceIdx, e.target.value)
                }
                placeholder="Device Size"
                className="flex-1 p-2 sm:p-3 border rounded-lg dark:bg-gray-900 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm min-w-[100px] sm:min-w-[120px]"
              />
              <button
                type="button"
                onClick={() => openScanner(editing.id ? 'edit' : 'add', index, deviceIdx)}
                className="p-2 sm:p-2.5 bg-indigo-600 text-white rounded-full shadow-sm hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors duration-200"
                aria-label="Scan barcode for device ID"
              >
                <FaCamera className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
              <button
                type="button"
                onClick={() => editing.id ? removeEditDeviceIdField(deviceIdx) : removeDeviceIdField(index, deviceIdx)}
                className="p-1.5 bg-red-600 text-white rounded-full shadow-sm hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 transition-colors duration-200"
                aria-label="Remove device ID"
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
          ))}
          <button
            type="button"
            onClick={() => editing.id ? addEditDeviceIdField() : addDeviceIdField(index)}
            className="mt-2 p-2 sm:p-2.5 bg-gray-600 text-white rounded-full shadow-sm hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors duration-200"
            aria-label="Add new device ID"
          >
            <svg
              className="w-4 h-4 sm:w-4.5 sm:h-4.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  ))}

  {!editing.id && (
    <button
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
      onClick={() => {
        stopScanner();
        setEditing(null);
      }}
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
      onClick={saveDebts}
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
</div>
        </div>
      )}

      {showDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 mt-24">
          <div className="bg-white p-6 rounded max-w-lg w-full max-h-[90vh] overflow-y-auto dark:bg-gray-900 dark:text-white">
            <h2 className="text-xl font-bold mb-4">{showDetail.product_name} Device IDs</h2>

            {isLoadingSoldStatus ? (
              <div className="flex justify-center py-4">
                <p>Loading device status...</p>
              </div>
            ) : (
              <div>
                <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedDevices.map((device, i) => {
                    const q = searchTerm.trim().toLowerCase();
                    const match = device.id.toLowerCase().includes(q) || device.size.toLowerCase().includes(q);
                    const isSold = soldDeviceIds.includes(device.id);
                    const displayText = `ID: ${device.id} (size: ${device.size})`;

                    return (
                      <li
                        key={i}
                        className={['py-2 px-1 flex items-center justify-between', match ? 'bg-yellow-50 dark:bg-yellow-800' : ''].filter(Boolean).join(' ')}
                      >
                        <div className="flex items-center">
                          <span className={match ? 'font-semibold' : ''}>{displayText}</span>
                          {isSold && (
                            <span className="ml-2 px-2 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded-full dark:bg-red-900 dark:text-red-300">
                              SOLD
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {totalDetailPages > 1 && (
                  <div className="flex justify-between items-center mt-4 text-sm text-gray-700 dark:text-gray-300">
                    <button
                      onClick={() => setDetailPage(p => Math.max(p - 1, 1))}
                      disabled={detailPage === 1}
                      className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
                    >
                      Prev
                    </button>
                    <span>
                      Page {detailPage} of {totalDetailPages}
                    </span>
                    <button
                      onClick={() => setDetailPage(p => Math.min(p + 1, totalDetailPages))}
                      disabled={detailPage === totalDetailPages}
                      className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowDetail(null)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
          <span>Use External Barcode Scanner</span>
        </label>
      </div>
      {!externalScannerMode && (
        <>
          {scannerLoading && (
            <div className="text-gray-600 dark:text-gray-400 mb-4 text-center text-sm">
              Initializing webcam scanner...
            </div>
          )}
          {scannerError && (
            <div className="text-red-600 dark:text-red-400 mb-4 text-center text-sm" aria-live="polite">
              {scannerError}
            </div>
          )}
          <div
            id="scanner"
            ref={scannerDivRef}
            className={`relative w-full h-[250px] mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden ${
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
              <div className="w-[300px] h-[150px] border-2 border-red-500 bg-transparent opacity-50"></div>
            </div>
          </div>
        </>
      )}
      {externalScannerMode && (
        <div className="mb-4">
          <div className="text-gray-600 dark:text-gray-400 mb-4 text-center">
            Waiting for external scanner input... Scan a barcode to proceed.
          </div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Or Enter Product ID Manually
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              ref={manualInputRef}
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={handleManualInputKeyDown}
              placeholder="Enter Product ID"
              className="w-full sm:flex-1 p-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
      )}
      <div className="flex justify-end">
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
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
        >
          Done
        </button>
      </div>
    </div>
  </div>
)}
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
                  className="border p-2 w-full rounded dark:bg-gray-800 dark:text-white"
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
                  className="border p-2 w-full rounded dark:bg-gray-800 dark:text-white"
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