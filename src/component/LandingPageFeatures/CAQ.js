import React, { useState } from 'react';
import { motion } from 'framer-motion';

const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, staggerChildren: 0.1 } },
};

const accordionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const answerVariants = {
  collapsed: { opacity: 0, height: 0, marginTop: 0 },
  expanded: { opacity: 1, height: 'auto', marginTop: '0.5rem', transition: { duration: 0.3 } },
};

const iconVariants = {
  collapsed: { rotate: 0, scale: 1 },
  expanded: { rotate: 45, scale: 1.1, transition: { type: 'spring', stiffness: 300 } },
};

const FAQItem = ({ question, answer, index }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700"
      initial="hidden"
      animate="visible"
      variants={accordionVariants}
    >
      <button
        type="button"
        className="w-full text-left flex justify-between items-center p-3 sm:p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:scale-[1.02]"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={`faq-answer-${index}`}
        aria-label={`Toggle ${question}`}
        tabIndex={0}
      >
        <span className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white font-sans">
          {question}
        </span>
        <motion.span
          className="text-lg sm:text-xl text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-300"
          variants={iconVariants}
          animate={expanded ? 'expanded' : 'collapsed'}
        >
          {expanded ? '−' : '+'}
        </motion.span>
      </button>
      <motion.div
        id={`faq-answer-${index}`}
        variants={answerVariants}
        animate={expanded ? 'expanded' : 'collapsed'}
        className="overflow-hidden"
        aria-hidden={!expanded}
        layout
      >
        <p className="p-3 sm:p-4 text-xs sm:text-base text-gray-600 dark:text-gray-400 font-medium font-sans">
          {answer}
        </p>
      </motion.div>
      <svg className="w-full h-6" viewBox="0 0 1440 24" preserveAspectRatio="none">
        <path
          d="M0,12 C240,24 480,0 720,12 C960,24 1200,0 1440,12 L1440,24 L0,24 Z"
          fill="url(#gradient)"
          className="dark:fill-gray-900"
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: '#f3f4f6', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#e0e7ff', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
      </svg>
    </motion.div>
  );
};

const FAQ = () => {
  const faqs = [
    {
      question: "How do I begin to use Sellytics?",
      answer: "As a new user, register your store with the necessary details to start using Sellytics.",
    },
    {
      question: "How do I add products and prices?",
      answer: "Go to Products & Pricing, click 'Add,' and input the product name, description, total purchase price, and quantity purchased.",
    },
    {
      question: "How can I use Sales Tracker?",
      answer: "In Sales Tracker, click on Sales to add Product Sold, Quantity, Unit Price, and Payment Method, then click Save Sale.",
    },
    {
      question: "Can I filter or search past sales?",
      answer: "Yes, use the built-in search box to find transactions by date, product name, or payment method.",
    },
    {
      question: "What is inventory for?",
      answer: "Manage Inventory lets you track items sold and the number of items available.",
    },
    {
      question: "Will I be notified when my stock is running low?",
      answer: "Yes, you’ll get automatic alerts when any product hits its minimum stock level, so you never run out unexpectedly.",
    },
    {
      question: "Can I create a receipt for every good sold?",
      answer: "Yes, Sellytics generates clean, professional receipts for every item sold, including customer details, which can be printed or emailed.",
    },
    {
      question: "How do I manage returned items or goods?",
      answer: "Go to the Returns Tracker, select the items being returned, and capture the goods returned and their details.",
    },
    {
      question: "Can I keep track of my business expenses?",
      answer: "Yes, Sellytics allows you to log all expenses like rent and utilities. Click 'Add Expense' and input the details.",
    },
    {
      question: "Can I track customers who owe me money?",
      answer: "Yes, the Debt Manager lets you log customers who purchase on credit, tracking who owes what after registering them.",
    },
    {
      question: "How do I manage multiple stores?",
      answer: "Create an account for each store. Sellytics links them after verification, allowing you to manage all locations from a centralized dashboard.",
    },
    {
      question: "How do I manage attendants (sellers) working for me?",
      answer: "Invite attendants individually and assign them to specific stores. Each attendant manages their account and daily sales within their store.",
    },
    {
      question: "How do I use unpaid supplies?",
      answer: "Unpaid Supplies records third-party sellers who take goods to sell and return or pay after sales.",
    },
    {
      question: "How can I see how my business is performing each day?",
      answer: "Your dashboard shows a daily summary of total sales, top products, and performance trends at a glance.",
    },
    {
      question: "Can I store my customers’ details?",
      answer: "Yes, in the Customer Hub, save names, phone numbers, emails, and addresses to enhance customer service and follow-up.",
    },
    {
      question: "Will I get reports that help me make smarter business decisions?",
      answer: "Yes, Sellytics provides insightful reports on sales performance, profit margins, and top-selling items to guide decisions.",
    },
    {
      question: "Can I export or share my reports?",
      answer: "Yes, download reports instantly as PDF or CSV files for bookkeeping or sharing with your team.",
    },
    {
      question: "How do I create a receipt for a customer?",
      answer: "Go to Quick Receipts, select purchased products, enter quantities, and print or share the receipt instantly.",
    },
    {
      question: "How can I update my product prices?",
      answer: "Navigate to Products & Pricing, find the product, click Edit, adjust the price, and click Save.",
    },
    {
      question: "How can I manage unpaid supplier bills?",
      answer: "In the Unpaid Supplies section, add the supplier name and owed amount, and update the record when payment is completed.",
    },
    {
      question: "Can I manage more than one store in Sellytics?",
      answer: "Yes, in the Multi-Store View, add or select stores to monitor sales, inventory, and staff activity for each location.",
    },
    {
      question: "How do I record business expenses?",
      answer: "Open the Expense Log, enter expense details (type, amount, date), categorize it, and click Save to record the transaction.",
    },
    {
      question: "How do I manage customer information?",
      answer: "In the Customer Hub, click 'Add New Customer,' enter their details, and update or view their information anytime.",
    },
    {
      question: "Where can I access performance reports?",
      answer: "Visit the Reports section to view clear tables showing sales, stock levels, and business trends to support informed decisions.",
    },
    {
      question: "How do I handle product returns?",
      answer: "Go to the Returns Tracker, click 'Add Return,' select the item, enter the reason, and confirm. Your inventory will update automatically.",
    },
  ];

  return (

    
    <motion.section
      className="py-12 sm:py-16 bg-white dark:bg-gray-900 relative overflow-hidden"
      initial="hidden"
      animate="visible"
      variants={sectionVariants}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <motion.h2
          className="text-2xl sm:text-4xl font-bold text-center text-gray-900 dark:text-white mb-8 sm:mb-12 font-sans"
          variants={sectionVariants}
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          Commonly Asked Questions (CAQs)
        </motion.h2>
        <div className="space-y-4 sm:space-y-6">
          {faqs.map((faq, index) => (
            <FAQItem key={index} question={faq.question} answer={faq.answer} index={index} />
          ))}
        </div>
      </div>

      {/* Indigo-600 Wavy Bottom Decoration */}
      <svg
        className="absolute bottom-0 left-0 w-full h-16 sm:h-24"
        viewBox="0 0 1440 100"
        preserveAspectRatio="none"
      >
        <path
          d="M0,100 C360,0 1080,200 1440,0 L1440,100 L0,100 Z"
          fill="#4f46e5"
          className="dark:fill-gray-800"
        />
      </svg>






    </motion.section>
  );
};

export default FAQ;
