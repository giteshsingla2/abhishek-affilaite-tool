import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Globe, Plus, Trash2, CheckCircle, XCircle, RefreshCw, AlertCircle } from 'lucide-react';

const GlassCard = ({ children, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`
      backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 
      shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:shadow-[0_12px_48px_rgba(0,0,0,0.2)]
      transition-all duration-300 ${className}
    `}
  >
    {children}
  </motion.div>
);

const Domains = () => {
  const [domains, setDomains] = useState([]);
  const [newDomain, setNewDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/domains', {
        headers: {
          'x-auth-token': token
        }
      });
      if (response.ok) {
        const data = await response.json();
        setDomains(data);
      }
    } catch (err) {
      console.error('Error fetching domains:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDomain = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/domains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({ domain: newDomain })
      });

      const data = await response.json();

      if (response.ok) {
        setDomains([data, ...domains]);
        setNewDomain('');
        setSuccess('Domain added successfully! Please follow the instructions below to verify.');
      } else {
        setError(data.msg || 'Failed to add domain');
      }
    } catch (err) {
      setError('Server error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDomain = async (id) => {
    if (!window.confirm('Are you sure you want to remove this domain?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/domains/${id}`, {
        method: 'DELETE',
        headers: {
          'x-auth-token': token
        }
      });

      if (response.ok) {
        setDomains(domains.filter(d => d._id !== id));
      }
    } catch (err) {
      console.error('Error deleting domain:', err);
    }
  };

  const handleVerify = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/domains/${id}/verify`, {
        method: 'PUT',
        headers: {
          'x-auth-token': token
        }
      });

      const data = await response.json();
      if (data.verified) {
        setDomains(domains.map(d => d._id === id ? { ...d, verified: true } : d));
        alert('Domain verified successfully!');
      } else {
        alert(data.msg || 'Verification failed. Please check your DNS settings.');
      }
    } catch (err) {
      alert('Error during verification. Please try again later.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">Custom Domains</h1>
          <p className="text-gray-400">Manage your own domains for your affiliate websites</p>
        </motion.div>

        {/* Add Domain Form */}
        <GlassCard className="p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-cyan-400" />
            Add New Domain
          </h2>
          <form onSubmit={handleAddDomain} className="space-y-4">
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="example.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                required
              />
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                Add Domain
              </button>
            </div>
            {error && <p className="text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</p>}
            {success && <p className="text-green-400 text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</p>}
          </form>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
            <h3 className="text-cyan-400 font-medium mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Setup Instructions
            </h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              To use your custom domain, please add the following <strong>A Records</strong> in your domain's DNS settings:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-gray-400">
              <li>• Host: <strong>@</strong> points to <strong>[Your_Server_IP]</strong></li>
              <li>• Host: <strong>*</strong> (wildcard) points to <strong>[Your_Server_IP]</strong></li>
            </ul>
          </div>
        </GlassCard>

        {/* Domains List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white mb-4">Your Domains</h2>
          {domains.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No domains added yet.</p>
          ) : (
            domains.map((domain) => (
              <GlassCard key={domain._id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-full ${domain.verified ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
                    <Globe className={`w-5 h-5 ${domain.verified ? 'text-green-400' : 'text-yellow-400'}`} />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">{domain.domain}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {domain.verified ? (
                        <span className="text-green-400 text-xs flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Verified
                        </span>
                      ) : (
                        <span className="text-yellow-400 text-xs flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Unverified
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {!domain.verified && (
                    <button
                      onClick={() => handleVerify(domain._id)}
                      className="px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Verify
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteDomain(domain._id)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </GlassCard>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Domains;
