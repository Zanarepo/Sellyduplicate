import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Features from './LandingPageFeatures/Features';
import HowItWorks from './LandingPageFeatures/HowItWorks';
import UseCases from './LandingPageFeatures/UseCases';
import Reviews from './LandingPageFeatures/Reviews';
import WhosIsSellyticsFor from './LandingPageFeatures/WhosIsSellyticsFor';
import CAQ from './LandingPageFeatures/CAQ';
import PricingPlanLandingPage from './Payments/PricingPlanLandingPage';
import { motion } from 'framer-motion';
import WhatsAppChatPopup from './UserDashboard/WhatsAppChatPopup';
import HappyCustomer from './LandingPageFeatures/HappyCustomer';
import AIPoweredFeatures from './LandingPageFeatures/AIPoweredFeatures';

const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const textVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const buttonVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.05, transition: { type: 'spring', stiffness: 300 } },
};

export default function LandingPage() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <div className="w-full flex flex-col bg-gray-900 text-white dark">
      <WhatsAppChatPopup />

      {/* Hero Section */}
      <section className="relative min-h-screen w-full flex flex-col-reverse md:flex-row items-center justify-between px-4 sm:px-6 md:px-8 pt-32 pb-32 gap-8 sm:gap-12 bg-gray-900 max-w-7xl mx-auto overflow-hidden">
        {/* Wavy Background Top */}
        <svg className="absolute top-0 left-0 w-full h-24 z-10" viewBox="0 0 1440 100" preserveAspectRatio="none">
          <path d="M0,100 C280,0 720,100 1440,0 L1440,100 Z" fill="#4f46e5" />
        </svg>

        {/* Wavy Background Bottom */}
        <svg className="absolute bottom-0 left-0 w-full h-24 z-10" viewBox="0 0 1440 100" preserveAspectRatio="none">
          <path d="M0,0 C280,100 720,0 1440,100 L1440,0 Z" fill="#4f46e5" />
        </svg>

        {/* Starry Sky Animated Background */}
        <div className="absolute inset-x-0 top-24 bottom-24 z-0 pointer-events-none overflow-hidden">
          <div className="w-full h-full bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px] animate-[moveStars_40s_linear_infinite] opacity-80"></div>
        </div>

        {/* Text Block */}
        <motion.div
          className="relative z-20 w-full md:w-1/2 bg-gray-900 dark:bg-gray-800/90 backdrop-blur-md rounded-xl p-6 sm:p-8 shadow-md"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0, y: 40 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.6, staggerChildren: 0.2 } },
          }}
        >
          <motion.h1
            className="text-3xl sm:text-5xl md:text-4xl font-extrabold text-white leading-tight mb-6 font-inter"
            variants={textVariants}
          >
            Track Inventory, Sales & Monitor Your Business — Without Stress
          </motion.h1>
          <motion.p
            className="text-base sm:text-lg md:text-xl text-gray-300 mb-8 font-medium font-inter"
            variants={textVariants}
          >
            Sellytics empowers SME businesses to manage stock, monitor sales, set pricing, track expenses & more — all in one simple, mobile-friendly dashboard.
          </motion.p>
          <Link to="/register">
            <motion.button
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg rounded-full shadow-md transition duration-300 ease-in-out font-medium font-inter min-w-[120px]"
              variants={buttonVariants}
              initial="rest"
              whileHover="hover"
              aria-label="Start for Free"
            >
              Start for Free
            </motion.button>
          </Link>
        </motion.div>

        {/* Image Block */}
       <motion.div
  className="relative z-20 w-full md:w-1/2 h-full flex items-center justify-center"
  initial={{ opacity: 0, x: 100 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ duration: 0.6, type: 'spring', stiffness: 100 }}
>
  <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-indigo-400/10 rounded-2xl"></div>
  <img
    src="images/welcome.jpg"
    alt="Nigerian shop owner managing inventory"
    className="w-full h-full object-cover rounded-2xl shadow-xl relative z-10"
  />
</motion.div>
      </section>

      {/* Sections */}
      <motion.section id="ai-features" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants} className="w-full py-12 sm:py-16 px-4 sm:px-6 md:px-8 bg-gray-900 max-w-7xl mx-auto">
        <AIPoweredFeatures />
      </motion.section>
      <motion.section id="features" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants} className="w-full py-12 sm:py-16 px-4 sm:px-6 md:px-8 bg-gray-800 max-w-7xl mx-auto">
        <Features />
      </motion.section>
      <motion.section id="how-it-works" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants} className="w-full py-12 sm:py-16 px-4 sm:px-6 md:px-8 bg-gray-900 max-w-7xl mx-auto">
        <HowItWorks />
      </motion.section>
      <motion.section id="pricing" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants} className="w-full py-12 sm:py-16 px-4 sm:px-6 md:px-8 bg-gray-800 max-w-7xl mx-auto">
        <PricingPlanLandingPage />
      </motion.section>
      <motion.section id="use-cases" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants} className="w-full py-12 sm:py-16 px-4 sm:px-6 md:px-8 bg-gray-900 max-w-7xl mx-auto">
        <UseCases />
      </motion.section>
      <motion.section id="who-is-it-for" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants} className="w-full py-12 sm:py-16 px-4 sm:px-6 md:px-8 bg-gray-800 max-w-7xl mx-auto">
        <WhosIsSellyticsFor />
      </motion.section>
      <motion.section id="reviews" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants} className="w-full py-12 sm:py-16 px-4 sm:px-6 md:px-8 bg-gray-900 max-w-7xl mx-auto">
        <Reviews />
      </motion.section>
      <motion.section id="happy-customer" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants} className="w-full py-12 sm:py-16 px-4 sm:px-6 md:px-8 bg-gray-800 max-w-7xl mx-auto">
        <HappyCustomer />
      </motion.section>
      <motion.section id="faq" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants} className="w-full py-12 sm:py-16 px-4 sm:px-6 md:px-8 bg-gray-900 max-w-7xl mx-auto">
        <CAQ />
      </motion.section>
    </div>
  );
}
