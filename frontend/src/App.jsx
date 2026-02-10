import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Credentials from './pages/Credentials';
import CreateCampaign from './pages/CreateCampaign';
import Websites from './pages/Websites';
import Domains from './pages/Domains';
import AdminTemplates from './pages/AdminTemplates';
import AdminUsers from './pages/AdminUsers';
import PrivateRoute from './routing/PrivateRoute';
import Layout from './components/Layout';

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
        <Route path="/domains" element={<PrivateRoute><Layout><Domains /></Layout></PrivateRoute>} />
        <Route path="/admin/templates" element={<PrivateRoute><Layout><AdminTemplates /></Layout></PrivateRoute>} />
        <Route path="/admin/users" element={<PrivateRoute><Layout><AdminUsers /></Layout></PrivateRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
