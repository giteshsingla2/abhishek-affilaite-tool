import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../lib/axiosInstance';
import GlassCard from '../components/GlassCard';
import Input from '../components/Input';
import { UserPlus, Trash2, Shield, User, Eye } from 'lucide-react';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'user',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const currentUser = JSON.parse(localStorage.getItem('user'));
  const isSuperAdmin = currentUser?.role === 'superadmin';

  const { email, password, role } = formData;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/admin/users', {
        headers: { 'x-auth-token': token },
      });
      setUsers(res.data);
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/admin/users', formData, {
        headers: { 'x-auth-token': token },
      });
      setSuccess('User created successfully');
      setFormData({ email: '', password: '', role: 'user' });
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to create user');
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    setError('');
    setSuccess('');
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/admin/users/${id}`, {
        headers: { 'x-auth-token': token },
      });
      setSuccess('User deleted successfully');
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to delete user');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 text-white p-8">
      <h1 className="text-4xl font-bold mb-8">User Management</h1>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <GlassCard className="p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <UserPlus className="text-purple-400" />
              Add User / Admin
            </h2>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Email</label>
                <Input
                  type="email"
                  name="email"
                  value={email}
                  onChange={onChange}
                  required
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Password</label>
                <Input
                  type="password"
                  name="password"
                  value={password}
                  onChange={onChange}
                  required
                  placeholder="Min 6 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Role</label>
                <select
                  name="role"
                  value={role}
                  onChange={onChange}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="user">User</option>
                  {isSuperAdmin && <option value="admin">Admin</option>}
                  {isSuperAdmin && <option value="superadmin">Super Admin</option>}
                  {!isSuperAdmin && <option value="admin" disabled className="opacity-40">Admin (Super Admin only)</option>}
                </select>
              </div>
              <button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 shadow-lg shadow-purple-500/20"
              >
                Create User
              </button>
            </form>
            {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
            {success && <p className="mt-4 text-green-400 text-sm">{success}</p>}
          </GlassCard>
        </div>

        <div className="lg:col-span-2">
          <GlassCard className="p-6">
            <h2 className="text-2xl font-bold mb-6">Existing Users</h2>
            {loading ? (
              <p>Loading users...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="py-4 px-4 font-semibold text-white/70">User</th>
                      <th className="py-4 px-4 font-semibold text-white/70">Role</th>
                      <th className="py-4 px-4 font-semibold text-white/70 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u._id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                              {u.role === 'superadmin' 
                                ? <Shield size={16} className="text-yellow-400" /> 
                                : u.role === 'admin' 
                                  ? <Shield size={16} className="text-purple-400" /> 
                                  : <User size={16} className="text-blue-400" />
                              }
                            </div>
                            <span>{u.email}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                            u.role === 'superadmin' 
                              ? 'bg-yellow-500/20 text-yellow-400' 
                              : u.role === 'admin' 
                                ? 'bg-purple-500/20 text-purple-400' 
                                : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {u.role === 'superadmin' ? 'Super Admin' : u.role}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => navigate(`/admin/users/${u._id}/overview`)}
                              className="p-2 hover:bg-purple-500/20 text-purple-400 rounded-lg transition-colors"
                              title="View User Details"
                            >
                              <Eye size={18} />
                            </button>
                            <button
                              onClick={() => deleteUser(u._id)}
                              className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                              title="Delete User"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
