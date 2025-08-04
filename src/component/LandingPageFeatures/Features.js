import {
  FiBox, FiTrendingUp, FiDollarSign, FiUsers, FiCamera,
  FiBarChart2, FiFileText, FiRefreshCw, FiPrinter, FiTag,
  FiBookOpen, FiActivity, FiLayers
} from 'react-icons/fi';
import { motion } from 'framer-motion';

const cardVariants = {
  hidden: { opacity: 0, y: 20, rotate: 0 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: { duration: 0.4, delay: i * 0.1, type: 'spring', stiffness: 100 },
  }),
};

const iconVariants = {
  rest: { scale: 1, rotate: 0 },
  hover: { scale: 1.1, rotate: 5, transition: { type: 'spring', stiffness: 300 } },
};

function Features() {
  const featureGroups = [
    {
      title: "Inventory & Operations",
      features: [
        { icon: FiBox, title: 'Live Stock Alerts', desc: 'Get instant notifications when stock runs low.' },
        { icon: FiCamera, title: 'Barcode Scanner', desc: 'Quickly add products into your store using our scanner.' },
        { icon: FiRefreshCw, title: 'Returns Tracker', desc: 'Manage returned items seamlessly.' },
        { icon: FiPrinter, title: 'Quick Receipts', desc: 'Generate customer receipts on the spot.' },
        { icon: FiLayers, title: 'Multi-Store View', desc: 'Control all your shops from one dashboard.' },
      ],
    },
    {
      title: "Financial Management",
      features: [
        { icon: FiTrendingUp, title: 'Daily Sales Overview', desc: 'See your sales numbers at a glance.' },
        { icon: FiDollarSign, title: 'Easy Expense Log', desc: 'Quickly record and categorize expenses.' },
        { icon: FiTag, title: 'Dynamic Pricing', desc: 'Adjust prices on the go for any item.' },
        { icon: FiBookOpen, title: 'Debt Manager', desc: 'Keep tabs on loans and repayments.' },
        { icon: FiActivity, title: 'Outstanding Bills', desc: 'Monitor unpaid supplies and credits.' },
      ],
    },
    {
      title: "Customer & Insights",
      features: [
        { icon: FiUsers, title: 'Customer Hub', desc: 'Store customer info and track interactions.' },
        { icon: FiBarChart2, title: 'Insightful Reports', desc: 'Simple tables for smarter decisions.' },
        { icon: FiFileText, title: 'Download Reports', desc: 'Export data as CSV or PDF in one click.' },
      ],
    },
  ];

  return (
    <section className="relative pt-28 pb-28 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Top Wavy Shape (reverse of bottom) */}
      <svg className="absolute top-0 w-full h-24" viewBox="0 0 1440 100" preserveAspectRatio="none">
        <path
          d="M0,100 C280,0 720,100 1440,0 L1440,100 Z"
          fill="#4f46e5"
        />
      </svg>

      {/* Bottom Wavy Shape (reverse of top) */}
      <svg className="absolute bottom-0 w-full h-24" viewBox="0 0 1440 100" preserveAspectRatio="none">
        <path
          d="M0,0 C280,100 720,0 1440,100 L1440,0 Z"
          fill="#4f46e5"
        />
      </svg>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.h2
          className="text-2xl sm:text-4xl font-bold text-center text-gray-900 dark:text-white mb-8 sm:mb-12 font-sans"
          style={{ fontFamily: 'Inter, sans-serif' }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          All-in-One Business Toolkit
        </motion.h2>

        {featureGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="mb-8 sm:mb-12">
            <motion.h3
              className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6 font-sans relative"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: groupIndex * 0.2 }}
            >
              <span className="relative inline-block">
                {group.title}
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 transition-all duration-300 group-hover:w-full"></span>
              </span>
            </motion.h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {group.features.map((feature, index) => (
                <motion.div
                  key={index}
                  className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-md hover:shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-all duration-300 group"
                  initial="hidden"
                  animate="visible"
                  custom={index}
                  variants={cardVariants}
                  whileHover={{ scale: 1.03, translateY: -3 }}
                  aria-label={`Learn more about ${feature.title}`}
                  tabIndex={0}
                >
                  <motion.div
                    className="text-indigo-600 dark:text-indigo-400 bg-gray-100 dark:bg-gray-700 rounded-full p-1.5 sm:p-2 mt-1 group-hover:text-indigo-500 dark:group-hover:text-indigo-300"
                    variants={iconVariants}
                    initial="rest"
                    whileHover="hover"
                  >
                    <feature.icon className="w-6 h-6 sm:w-7 sm:h-7" />
                  </motion.div>
                  <div>
                    <h4 className="text-sm sm:text-lg font-bold text-gray-900 dark:text-white font-sans group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      {feature.title}
                    </h4>
                    <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium font-sans">
                      {feature.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Features;
