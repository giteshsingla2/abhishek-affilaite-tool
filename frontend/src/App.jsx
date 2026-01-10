import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Credentials from './pages/Credentials';
import CreateCampaign from './pages/CreateCampaign';
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
      </Routes>
    </Router>
  );
}

export default App;
