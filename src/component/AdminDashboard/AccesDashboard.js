import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FaStore, FaCogs } from 'react-icons/fa';
import StoreAccess from './StoreAccess';
import FeatureAssignment from './FeatureAssignment';

// Animation variants
const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, staggerChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, type: 'spring', stiffness: 100 } },
};

const buttonVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.05, transition: { type: 'spring', stiffness: 300 } },
};

const tools = [
  {
    key: 'store-access',
    label: 'Store Access',
    icon: <FaStore className="text-lg sm:text-xl text-indigo-600" />,
    desc: 'Manage dashboard access for stores',
    component: <StoreAccess />,
  },
  {
    key: 'feature-assignment',
    label: 'Feature Assignment',
    icon: <FaCogs className="text-lg sm:text-xl text-indigo-600" />,
    desc: 'Assign features to stores',
    component: <FeatureAssignment />,
  },
];

const Dashboard = () => {
  const [activeTool, setActiveTool] = useState('store-access');

  const currentTool = tools.find((t) => t.key === activeTool);

  return (
    <motion.div
      className="min-h-screen bg-white dark:bg-gray-900 w-full"
      initial="hidden"
      animate="visible"
      variants={sectionVariants}
    >
      <header className="text-center mb-4">
        <h1 className="text-base sm:text-2xl font-bold text-indigo-800 dark:text-white">
          Admin Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1 text-xs sm:text-sm">
          Manage store access and features.
        </p>
      </header>

      <motion.div variants={cardVariants}>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          {tools.map((tool) => (
            <motion.button
              key={tool.key}
              onClick={() => setActiveTool(tool.key)}
              className={`flex items-center justify-center py-1 px-2 sm:py-2 sm:px-4 rounded-lg shadow hover:shadow-lg transition text-xs sm:text-sm ${
                activeTool === tool.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200'
              }`}
              variants={buttonVariants}
              initial="rest"
              whileHover="hover"
            >
              <span className="sm:hidden">{tool.label}</span>
              <span className="hidden sm:flex items-center">
                {tool.icon}
                <span className="ml-2">{tool.label}</span>
              </span>
            </motion.button>
          ))}
        </div>
        <h2 className="text-base sm:text-xl font-semibold text-indigo-800 dark:text-indigo-200">
          {currentTool.label}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">{currentTool.desc}</p>
        <div className="w-full mt-4">{currentTool.component}</div>
      </motion.div>
    </motion.div>
  );
};

export default Dashboard;