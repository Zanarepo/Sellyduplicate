import React from 'react';
import { FiUserPlus, FiBox, FiPrinter, FiBarChart2 } from 'react-icons/fi';
import { motion } from 'framer-motion';

const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, staggerChildren: 0.4 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, type: 'spring', stiffness: 100 } },
};

const iconVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.2, transition: { type: 'spring', stiffness: 300 } },
};

export default function HowItWorks() {
  const steps = [
    {
      icon: <FiUserPlus size={40} />,
      title: 'Sign Up & Create Store',
      desc: 'Quickly register and set up your store in minutes.',
      ariaLabel: 'Step 1: Sign Up & Create Store',
    },
    {
      icon: <FiBox size={40} />,
      title: 'Add Products',
      desc: 'List your phones, laptops and lots more with quantities and pricing.',
      ariaLabel: 'Step 2: Add Products',
    },
    {
      icon: <FiPrinter size={40} />,
      title: 'Record Sales & Track Stock',
      desc: 'Instantly log sales, monitor inventory levels, and manage returns.',
      ariaLabel: 'Step 3: Record Sales & Track Stock',
    },
    {
      icon: <FiBarChart2 size={40} />,
      title: 'Get Insights Instantly',
      desc: 'View easy-to-read tables of stock, sales, and expenses for smarter decisions.',
      ariaLabel: 'Step 4: Get Insights Instantly',
    },
  ];

  return (
    <motion.section
      id="how-it-works"
      className="py-20 md:py-8 px-6 md:px-20 bg-gradient-to-b from-indigo-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 relative overflow-hidden"
      initial="hidden"
      animate="visible"
      variants={sectionVariants}
    >
      {/* Animated Buzzy Market SVG Background */}
      <svg
        className="absolute top-0 left-0 w-full h-full z-0 animate-pulse opacity-30"
        viewBox="0 0 1440 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="marketPattern" patternUnits="userSpaceOnUse" width="100" height="100">
            <circle cx="20" cy="20" r="4" fill="#4f46e5">
              <animate attributeName="cy" values="20;80;20" dur="4s" repeatCount="indefinite" />
            </circle>
            <circle cx="60" cy="60" r="3" fill="#6366f1">
              <animate attributeName="cy" values="60;10;60" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle cx="80" cy="30" r="2.5" fill="#818cf8">
              <animate attributeName="cy" values="30;70;30" dur="5s" repeatCount="indefinite" />
            </circle>
          </pattern>
        </defs>
        <rect width="1440" height="800" fill="url(#marketPattern)" />
      </svg>

      {/* Wavy Top Border */}
      <svg className="absolute top-0 w-full z-10" viewBox="0 0 1440 100" preserveAspectRatio="none">
        <path
          d="M0,0 C280,100 720,0 1440,100 L1440,0 Z"
          fill="#4f46e5"
          className="dark:fill-gray-800"
        />
      </svg>

      {/* Connecting Animated Arrows */}
      <div className="hidden lg:flex absolute top-[55%] left-[12.5%] w-[75%] h-[2px] bg-indigo-300 z-10 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute w-5 h-5 border-r-2 border-b-2 border-indigo-600 rotate-45"
            initial={{ x: `${i * 33}%`, opacity: 0 }}
            animate={{ x: `${(i + 1) * 25}%`, opacity: 1 }}
            transition={{ delay: i * 1.2, duration: 0.8, ease: 'easeInOut' }}
          />
        ))}
      </div>

      <div className="lg:hidden absolute top-[24%] left-[calc(50%-1px)] h-[60%] w-[2px] bg-indigo-300 z-10 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute w-3 h-3 border-r-2 border-b-2 border-indigo-600 rotate-45"
            initial={{ y: `${i * 33}%`, opacity: 0 }}
            animate={{ y: `${(i + 1) * 25}%`, opacity: 1 }}
            transition={{ delay: i * 1.2, duration: 0.8, ease: 'easeInOut' }}
          />
        ))}
      </div>

      {/* Wavy Bottom Border */}
      <svg className="absolute bottom-0 w-full z-10" viewBox="0 0 1440 100" preserveAspectRatio="none">
        <path
          d="M0,100 C280,0 720,100 1440,0 L1440,100 Z"
          fill="#4f46e5"
          className="dark:fill-gray-800"
        />
      </svg>

      <div className="container mx-auto max-w-7xl relative z-20">
        <motion.h2
          className="text-3xl md:text-4xl font-extrabold text-center text-indigo-900 dark:text-white mb-12 font-sans relative before:absolute before:bottom-[-8px] before:left-1/2 before:-translate-x-1/2 before:w-24 before:h-1 before:bg-gradient-to-r before:from-indigo-500 before:to-indigo-700"
          variants={sectionVariants}
        >
          How It Works
        </motion.h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              className="flex flex-col items-center text-center p-2 bg-white/70 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-lg hover:shadow-xl hover:shadow-indigo-500/20 hover:bg-gradient-to-r hover:from-indigo-100/80 hover:to-indigo-200/80 transition-all duration-300 space-y-4"
              variants={cardVariants}
              whileHover={{ scale: 1.05, y: -10 }}
              aria-label={step.ariaLabel}
            >
              <motion.div
                className="text-indigo-600 dark:text-indigo-400 mb-4 hover:shadow-indigo-500/30 rounded-full p-2"
                variants={iconVariants}
                initial="rest"
                whileHover="hover"
              >
                {step.icon}
              </motion.div>
              <h3 className="text-xl font-bold text-indigo-900 dark:text-white mb-3 font-sans">
                {step.title}
              </h3>
              <p className="text-base md:text-lg text-gray-600 dark:text-gray-300 font-medium font-sans">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}