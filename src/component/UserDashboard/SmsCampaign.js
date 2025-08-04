import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { FaPaperPlane, FaSpinner } from 'react-icons/fa';
import axios from 'axios';

const SMSCampaigns = () => {
  const [customers, setCustomers] = useState([]);
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const storeId = localStorage.getItem('store_id');

  // Fetch customers with SMS opt-in
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('id, phone_number, full_name, customer_segment')
          .eq('store_id', storeId)
          .eq('opt_in_status', true);

        if (error) {
          setError('Failed to load customers.');
          return;
        }
        setCustomers(data);
      } catch (err) {
        setError('An error occurred while fetching customers.');
      }
    };
    fetchCustomers();
  }, [storeId]);

  // Send bulk SMS via Textedly API
  const sendBulkSMS = async () => {
    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('sms_phone_number, sms_provider_config')
        .eq('id', storeId)
        .single();

      if (storeError || !storeData.sms_phone_number || !storeData.sms_provider_config) {
        setError('SMS provider not configured. Contact admin.');
        return;
      }

      const { api_key } = storeData.sms_provider_config; // Textedly API key
      const phoneNumbers = selectedSegment === 'all'
        ? customers.map((c) => c.phone_number)
        : customers.filter((c) => c.customer_segment === selectedSegment).map((c) => c.phone_number);

      if (phoneNumbers.length === 0) {
        setError('No customers in selected segment with SMS opt-in.');
        return;
      }

      // Textedly API call (example endpoint, adjust per provider documentation)
      const response = await axios.post(
        'https://api.textedly.com/v1/messages',
        {
          api_key,
          from: storeData.sms_phone_number,
          to: phoneNumbers.join(','),
          message,
        },
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (response.data.success) {
        setSuccess(`Successfully sent SMS to ${phoneNumbers.length} customers!`);
      } else {
        setError('Failed to send SMS. Check API configuration.');
      }
    } catch (err) {
      setError(`Error sending SMS: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-indigo-700 dark:text-indigo-200 mb-4">
        Create SMS Campaign
      </h3>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {success && <p className="text-green-500 mb-4">{success}</p>}
      <div className="mb-4">
        <label className="block text-gray-700 dark:text-gray-300 mb-2">
          Select Customer Segment
        </label>
        <select
          value={selectedSegment}
          onChange={(e) => setSelectedSegment(e.target.value)}
          className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
        >
          <option value="all">All Customers</option>
          <option value="VIP">VIP Customers</option>
          <option value="frequent">Frequent Buyers</option>
          <option value="new">New Customers</option>
        </select>
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 dark:text-gray-300 mb-2">
          Message (160 characters max)
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 160))}
          placeholder="Enter your promotional message, e.g., 'Flash Sale! 30% off all items today only!'"
          className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          rows="4"
        />
        <p className="text-gray-500 text-sm">{message.length}/160</p>
      </div>
      <button
        onClick={sendBulkSMS}
        disabled={isLoading || !message || message.length > 160}
        className={`flex items-center px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 ${
          isLoading || !message || message.length > 160 ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {isLoading ? <FaSpinner className="animate-spin mr-2" /> : <FaPaperPlane className="mr-2" />}
        Send SMS Campaign
      </button>
    </div>
  );
};

export default SMSCampaigns;