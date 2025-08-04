import React, { useState } from 'react';
import { motion } from 'framer-motion';

const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, staggerChildren: 0.1 } },
};

const headerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, type: 'spring', stiffness: 100 } },
};

const featureVariants = {
  collapsed: { opacity: 0, height: 0, marginTop: 0 },
  expanded: { opacity: 1, height: 'auto', marginTop: '0.5rem', transition: { duration: 0.3 } },
};

const buttonVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.05, transition: { type: 'spring', stiffness: 300 } },
};

const features = {
  free: [
    '✅ Manage up to 50 products with ease',
    '✅ Basic sales tracking for daily operations',
    '✅ Inventory, product, and pricing management',
    '✅ Track expenses and customer debts',
    '✅ View sales history (last 30 days)',
    '❌ Team collaboration features',
    '❌ Multi-store management',
    '❌ Staff training resources',
    '❌ Priority support',
    '❌ Printable receipts',
  ],
  premium: [
    '✅ All Free Plan features',
    '✅ Advanced sales analytics dashboard',
    '✅ Full sales history and downloadable reports',
    '✅ Staff onboarding and training',
    '✅ Priority customer support (24/7)',
    '✅ Printable and email-ready receipts',
    '✅ Single-store team collaboration',
    '❌ Multi-store management',
    '❌ Advanced product insights',
  ],
  business: [
    '✅ All Free and Premium Plan features',
    '✅ Manage up to 3 stores with multi-store dashboard',
    '✅ Advanced product insights and analytics',
    '✅ Multi-store team management',
    '✅ Dedicated account manager',
  ],
};

const plans = [
  { id: 1, name: 'Free', price: 0 },
  { id: 2, name: 'Premium', price: 15000 },
  { id: 3, name: 'Business', price: 25000 },
];

export default function SubscriptionPlans() {
  const [expandedPlans, setExpandedPlans] = useState({});

  const toggleDetails = (planId) => {
    setExpandedPlans((prev) => ({
      ...prev,
      [planId]: !prev[planId],
    }));
  };

  return (
    <motion.section
      className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-900 relative overflow-hidden"
      initial="hidden"
      animate="visible"
      variants={sectionVariants}
      role="region"
      aria-labelledby="subscription-plans-title"
    >
      <div className="container mx-auto max-w-7xl relative z-10">
        <div className="text-center mb-8 sm:mb-12 space-y-4">
          <motion.h2
            id="subscription-plans-title"
            className="text-2xl sm:text-4xl font-extrabold text-gray-900 dark:text-white font-sans relative before:absolute before:bottom-[-8px] before:left-1/2 before:-translate-x-1/2 before:w-24 before:h-1 before:bg-gradient-to-r before:from-indigo-500 before:to-indigo-600 dark:before:from-indigo-600 dark:before:to-indigo-700"
            variants={headerVariants}
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Unlock Your Business Potential
          </motion.h2>
          <motion.p
            className="text-base sm:text-lg text-gray-600 dark:text-gray-400 font-medium font-sans max-w-3xl mx-auto"
            variants={headerVariants}
          >
            Whether you’re launching a small shop or scaling multiple stores, our flexible plans empower your growth. Pick from Free, Premium, or Business to find your perfect fit.
          </motion.p>
          <motion.p
            className="text-base sm:text-lg text-gray-600 dark:text-gray-400 font-medium font-sans max-w-3xl mx-auto"
            variants={headerVariants}
          >
            Each plan is crafted to fuel your success with scalable features, analytics, and seamless management tools.
          </motion.p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {plans.map((plan) => {
            const planKey = plan.name.toLowerCase().trim();
            const isFree = plan.price === 0;
            const isPremium = plan.name === 'Premium';
            const isExpanded = expandedPlans[plan.id] || false;

            return (
              <motion.div
                key={plan.id}
                className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 p-4 sm:p-6 flex flex-col justify-between border-t-4 border border-gray-200 dark:border-gray-700 ${
                  isPremium
                    ? 'border-blue-500 dark:border-blue-400'
                    : plan.name === 'Business'
                    ? 'border-purple-500 dark:border-purple-400'
                    : 'border-green-500 dark:border-green-400'
                }`}
                variants={cardVariants}
                whileHover={{ scale: 1.03, y: -5 }}
                aria-label={`${plan.name} Plan Card`}
                tabIndex={0}
              >
                {isPremium && (
                  <span className="absolute top-3 sm:top-4 right-3 sm:right-4 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white text-xs font-semibold px-2.5 sm:px-3 py-1 sm:py-1 rounded-full">
                    Most Popular
                  </span>
                )}
                <div className="space-y-3 sm:space-y-4">
                  <h2
                    className={`text-base sm:text-lg font-bold capitalize ${
                      isPremium
                        ? 'text-blue-600 dark:text-blue-400'
                        : plan.name === 'Business'
                        ? 'text-purple-600 dark:text-purple-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}
                  >
                    {plan.name} Plan
                  </h2>
                  <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
                    {isFree ? '₦0' : `₦${plan.price.toLocaleString()}`}
                    <span className="text-xs sm:text-base text-gray-500 dark:text-gray-400 font-normal"> /month</span>
                  </p>
                  <motion.button
                    className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 text-white py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg font-medium hover:shadow-indigo-500/30 transition-all duration-300"
                    onClick={() => toggleDetails(plan.id)}
                    variants={buttonVariants}
                    initial="rest"
                    whileHover="hover"
                    aria-expanded={isExpanded}
                    aria-controls={`features-${plan.id}`}
                    aria-label={`Toggle ${plan.name} Plan Details`}
                  >
                    {isExpanded ? 'Hide Details' : 'Show Details'}
                  </motion.button>
                  <motion.ul
                    id={`features-${plan.id}`}
                    variants={featureVariants}
                    animate={isExpanded ? 'expanded' : 'collapsed'}
                    className="text-xs sm:text-base text-gray-600 dark:text-gray-400 space-y-2 sm:space-y-3 overflow-hidden"
                  >
                    {features[planKey].map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <span className="mr-2">{feature.startsWith('✅') ? '✅' : '❌'}</span>
                        <span>{feature.slice(2)}</span>
                      </li>
                    ))}
                  </motion.ul>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}