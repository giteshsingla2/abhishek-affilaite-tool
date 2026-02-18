import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import GlassCard from '../components/GlassCard';
import Input from '../components/Input';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const { email, password } = formData;

  const onChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    const user = { email, password };
    try {
      const res = await axios.post('/api/auth/login', user);
      const { token, user: userData } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));

      if (userData.role === 'admin') {
        navigate('/admin/templates');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response.data.msg);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 text-white flex items-center justify-center p-4">
      <GlassCard className="p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-center">Login</h1>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        <form onSubmit={onSubmit}>
          <Input
            type="email"
            placeholder="Email Address"
            name="email"
            value={email}
            onChange={onChange}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            name="password"
            value={password}
            onChange={onChange}
            required
            minLength="6"
          />
          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
          >
            Login
          </button>
        </form>
        <p className="mt-4 text-center">
          Don't have an account?{' '}
          <Link to="/signup" className="text-purple-400 hover:underline">
            Sign Up
          </Link>
        </p>
      </GlassCard>
    </div>
  );
};

export default Login;
