import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from "../../supabaseClient";
import ReceiptQRCode from './ReceiptQRCode';

export default function ReceiptQRCodeWrapper() {
  const { receiptId } = useParams();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("receipts")
          .select(`
            *,
            sale_groups (
              id,
              store_id,
              total_amount,
              payment_method,
              created_at,
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
            )
          `)
          .eq("receipt_id", receiptId)
          .single();

        if (error) {
          console.error('Error fetching receipt:', error);
          setError('Failed to fetch receipt.');
          return;
        }
        setReceipt(data);
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    };
    fetchReceipt();
  }, [receiptId]);

  if (loading) return <div className="p-4 text-center text-gray-500">Loading...</div>;
  if (error) return <div className="p-4 text-center text-red-500">{error}</div>;
  if (!receipt) return <div className="p-4 text-center text-red-500">Receipt not found.</div>;

  return <ReceiptQRCode singleReceipt={receipt} />;
}