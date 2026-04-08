import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Credentials from './pages/Credentials';
import CreateCampaign from './pages/CreateCampaign';
import Websites from './pages/Websites';
import StaticWebsites from './pages/StaticWebsites';
import EditWebsite from './pages/EditWebsite';
import Domains from './pages/Domains';
import AdminTemplates from './pages/AdminTemplates';
import AdminStaticTemplates from './pages/AdminStaticTemplates';
import AdminUsers from './pages/AdminUsers';
import AdminUserOverview from './pages/AdminUserOverview';
import PrivateRoute from './routing/PrivateRoute';
import Layout from './components/Layout';

const SuperAdminRoute = ({ children }) => {
  const user = JSON.parse(localStorage.getItem('user'));
  const isSuperAdmin = user?.role === 'superadmin';
  
  if (!localStorage.getItem('token')) {
    return <Navigate to="/login" />;
  }
  
  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" />;
  }
  
  return children;
};

const AdminRoute = ({ children }) => {
  const user = JSON.parse(localStorage.getItem('user'));
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  
  if (!localStorage.getItem('token')) {
    return <Navigate to="/login" />;
  }
  
  if (!isAdmin) {
    return <Navigate to="/dashboard" />;
  }
  
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
        <Route path="/credentials" element={<PrivateRoute><Layout><Credentials /></Layout></PrivateRoute>} />
        <Route path="/create-campaign" element={<PrivateRoute><Layout><CreateCampaign /></Layout></PrivateRoute>} />
        <Route path="/websites" element={<PrivateRoute><Layout><Websites /></Layout></PrivateRoute>} />
        <Route path="/static-websites" element={<PrivateRoute><Layout><StaticWebsites /></Layout></PrivateRoute>} />
        <Route path="/edit-website/:id" element={<PrivateRoute><Layout><EditWebsite /></Layout></PrivateRoute>} />
        <Route path="/domains" element={<PrivateRoute><Layout><Domains /></Layout></PrivateRoute>} />
        <Route path="/admin/templates" element={<SuperAdminRoute><Layout><AdminTemplates /></Layout></SuperAdminRoute>} />
        <Route path="/admin/static-templates" element={<SuperAdminRoute><Layout><AdminStaticTemplates /></Layout></SuperAdminRoute>} />
        <Route path="/admin/users" element={<AdminRoute><Layout><AdminUsers /></Layout></AdminRoute>} />
        <Route path="/admin/users/:id/overview" element={<AdminRoute><Layout><AdminUserOverview /></Layout></AdminRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
