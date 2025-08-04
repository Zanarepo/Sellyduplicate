import React from 'react';
import { FiTag, FiShuffle } from 'react-icons/fi';
import { motion } from 'framer-motion';

const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, staggerChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, type: 'spring', stiffness: 100 } },
};

const iconVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.1, transition: { type: 'spring', stiffness: 300 } },
};

const exampleVariants = {
  rest: { y: 0 },
  hover: { y: -3, transition: { duration: 0.3 } },
};

export default function PricingUseCases() {
  const cases = [
    {
      icon: FiTag,
      title: 'Fixed Pricing',
      desc: 'Ideal for shops with fixed prices, like supermarkets or online stores, where rates remain consistent.',
      example: 'A supermarket selling a 50kg bag of rice at ₦5,000 daily with no price changes.',
      badge: 'Fixed Pricing',
    },
    {
      icon: FiShuffle,
      title: 'Negotiable Pricing',
      desc: 'Perfect for open-market vendors where prices vary based on demand, supply, or customer negotiations.',
      example: 'A Lagos phone vendor negotiating smartphone prices between ₦60,000–₦65,000 per customer.',
      badge: 'Dynamic Pricing',
    },
  ];

  return (
    <motion.section
      className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-900 relative overflow-hidden"
      initial="hidden"
      animate="visible"
      variants={sectionVariants}
      role="region"
      aria-labelledby="pricing-use-cases-title"
    >
      <div className="container mx-auto max-w-5xl relative z-10">
        <motion.h2
          id="pricing-use-cases-title"
          className="text-2xl sm:text-4xl font-extrabold text-center text-gray-900 dark:text-white mb-8 sm:mb-12 font-sans relative before:absolute before:bottom-[-8px] before:left-1/2 before:-translate-x-1/2 before:w-24 before:h-1 before:bg-gradient-to-r before:from-indigo-500 before:to-indigo-600 dark:before:from-indigo-600 dark:before:to-indigo-700"
          variants={sectionVariants}
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          Pricing Models for Every Business
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {cases.map((item, idx) => (
            <motion.div
              key={idx}
              className="group relative bg-white dark:bg-gray-800 rounded-lg p-4 md:p-6 shadow-md hover:shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 border-l-4 border-transparent group-hover:border-indigo-500 dark:group-hover:border-indigo-400 transition-all duration-300 border border-gray-200 dark:border-gray-700"
              variants={cardVariants}
              whileHover={{ scale: 1.03, y: -5 }}
              aria-label={`${item.title} Pricing Use Case`}
              tabIndex={0}
            >
              <span className="absolute top-4 right-4 bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 text-white text-xs font-semibold px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                {item.badge}
              </span>
              <div className="flex items-center mb-3 md:mb-4">
                <motion.div
                  className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors text-indigo-600 dark:text-indigo-400"
                  variants={iconVariants}
                  initial="rest"
                  whileHover="hover"
                >
                  <item.icon className="w-8 h-8 md:w-10 md:h-10" />
                </motion.div>
                <h3 className="ml-3 md:ml-4 text-base md:text-lg font-bold text-gray-900 dark:text-white font-sans">
                  {item.title}
                </h3>
              </div>
              <p className="text-xs md:text-base text-gray-600 dark:text-gray-400 font-medium font-sans mb-4 md:mb-6">
                {item.desc}
              </p>
              <motion.div
                className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 md:p-4"
                variants={exampleVariants}
                initial="rest"
                whileHover="hover"
              >
                <span className="font-semibold text-gray-800 dark:text-gray-200">Example:</span>
                <p className="mt-1 md:mt-2 text-xs md:text-base text-gray-600 dark:text-gray-400 italic font-sans">
                  {item.example}
                </p>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}