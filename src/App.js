import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./component/HomePage";
import LandingFooterLayout from "./component/LandingFooterLayout";
import Navbar from "./component/Navbar";
import Registration from './component/Auth/Registration';
import SignaturePad from "./component/VariexContents/SignaturePad";

import AdminRegistration from './component/Auth/AdminRegistration';
import Login from "./component/Auth/Login";
import Forgotpassword from './component/Auth/Forgotpassword';
import ResetPassword from './component/Auth/ResetPassword';

import Tools from './component/Tools';
import RegisteredDashboards from './component/RegisteredDashboards';
import UserHomepage from './component/UserDashboard/UserHomepage';
import TeamSignup from './component/Auth/TeamSignup';
import StoreUsersHome from './component/UserDashboard/StoreUsersHome';
import Admins from './component/AdminAuth/Admins';
import AdminHome from './component/AdminDashboard/AdminHome';
import SalesMetrics from "./component/UserDashboard/SalesMetrics";
import PoductPurchaseCost from "./component/UserDashboard/ProductsPurchaseCost";
import MainDashboard from './component/UserDashboard/Simplex';
import SalesTracker from './component/UserDashboard/SalesTracker';
import StoresAdmin from './component/Ops/StoresAdmin';
import Profile from './component/UserDashboard/Profile';
import SellyticsPayment from './component/Payments/SellyticsPayment';
import PremiumHomepage from './component/Premiums/PremiumHomepage';
import PushNotifications from "./component/Premiums/PushNotifications";
import Test from './component/UserDashboard/Test';
import Tests from './component/UserDashboard/Tests';
import ReceiptQRCode from "./component/VariexContents/ReceiptQRCode";
import ReceiptQRCodeWrapper from "./component/VariexContents/ReceiptQRCodeWrapper";


const App = () => {
  useEffect(() => {

  }, []);

  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        {/* All public routes with Navbar and Landing Footer */}
        <Routes>
          <Route
            element={
              <>
                <Navbar />
                <LandingFooterLayout />
              </>
            }
          >
            <Route path="/" element={<HomePage />} />
            <Route path="/forgot-password" element={<Forgotpassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/team-signup" element={<TeamSignup />} />
            <Route path="/push-notifications" element={<PushNotifications />} />
            <Route path="/signaturepad" element={<SignaturePad />} />
          </Route>
        </Routes>

        {/* Routes without Navbar or Footer */}
        <Routes>
          <Route path="/register" element={<Registration />} />
          <Route path="/login" element={<Login />} />
          <Route path="/adminregister" element={<AdminRegistration />} />
          <Route path="/admin" element={<Admins />} />
          <Route path="/regdashboard" element={<RegisteredDashboards />} />
          <Route path="/dashboard" element={<UserHomepage />} />
          <Route path="/admin-dashboard" element={<AdminHome />} />
          <Route path="/team-dashboard" element={<StoreUsersHome />} />
          <Route path="/sales-metrics" element={<SalesMetrics />} />
          <Route path="/product-cost" element={<PoductPurchaseCost />} />
          <Route path="/main" element={<MainDashboard />} />
          <Route path="/salestrack" element={<SalesTracker />} />
          <Route path="/owner-dashboard" element={<StoresAdmin />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/payment" element={<SellyticsPayment />} />
          <Route path="/premiumdashboard" element={<PremiumHomepage />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/test" element={<Test />} />
          <Route path="/tests" element={<Tests />} />
          <Route path="/qrcodes" element={<ReceiptQRCode />} />
          <Route path="/receipt/:receiptId" element={<ReceiptQRCodeWrapper />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
