import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-markup';
import 'prismjs/themes/prism-tomorrow.css'; // Using a dark theme
import { Save, Eye, Loader, CheckCircle } from 'lucide-react';

const GlassCard = ({ children, className = '' }) => (
  <div className={`backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 shadow-lg ${className}`}>
    {children}
  </div>
);

const EditWebsite = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [website, setWebsite] = useState(null);
  const [htmlContent, setHtmlContent] = useState('');
  const [headerCode, setHeaderCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchWebsite = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/websites/${id}`, {
        headers: { 'x-auth-token': token },
      });
      setWebsite(response.data);
      setHtmlContent(response.data.htmlContent || '');
      setHeaderCode(response.data.headerCode || '');
    } catch (err) {
      setError('Failed to load website data. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchWebsite();
  }, [fetchWebsite]);

  const handleSaveAndRepublish = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const token = localStorage.getItem('token');
      const body = { htmlContent, headerCode };
      const response = await axios.put(`/api/websites/${id}`, body, {
        headers: { 'x-auth-token': token },
      });
      setSuccess('Website updated and live!');
      setWebsite(response.data.website); // Update local state with new data
    } catch (err) {
      setError('Failed to save and republish. Please check your code and try again.');
      console.error(err);
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(''), 3000); // Clear success message after 3s
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><Loader className="animate-spin text-purple-400" size={48} /></div>;
  }

  if (error && !website) {
    return <div className="flex items-center justify-center h-screen text-red-400">{error}</div>;
  }

  return (
    <div className="min-h-screen p-6 text-white">
      <div className="max-w-8xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Edit Website: {website?.productName}</h1>
            <p className="text-gray-400">Make changes to your HTML and add tracking scripts.</p>
          </div>
          <div className="flex items-center gap-4">
            {website?.url && (
              <a href={website.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-colors">
                <Eye size={16} />
                <span>Live Preview</span>
              </a>
            )}
            <button 
              onClick={handleSaveAndRepublish}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader className="animate-spin" size={16} /> : <Save size={16} />}
              <span>{saving ? 'Republishing...' : 'Save & Republish'}</span>
            </button>
          </div>
        </motion.div>

        {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-lg mb-4">{error}</div>}
        {success && <div className="bg-green-500/20 text-green-300 p-3 rounded-lg mb-4 flex items-center gap-2"><CheckCircle size={16} /> {success}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main HTML Editor */}
          <div className="lg:col-span-2">
            <GlassCard className="h-full flex flex-col">
              <label className="p-4 text-lg font-semibold border-b border-white/10">Main HTML Body</label>
              <div className="p-1 flex-grow relative h-[70vh]">
                <Editor
                  value={htmlContent}
                  onValueChange={code => setHtmlContent(code)}
                  highlight={code => highlight(code, languages.markup, 'markup')}
                  padding={10}
                  className="font-mono text-sm absolute inset-0 w-full h-full overflow-auto bg-transparent"
                  style={{'::selection': { background: 'rgba(139, 92, 246, 0.3)' }}}
                />
              </div>
            </GlassCard>
          </div>

          {/* Settings Panel */}
          <div>
            <GlassCard>
              <label className="p-4 text-lg font-semibold border-b border-white/10 block">Settings</label>
              <div className="p-4">
                <h3 className="font-semibold mb-2">Custom Header Code / Pixels</h3>
                <p className="text-sm text-gray-400 mb-3">Add tracking scripts (e.g., Google Analytics, Facebook Pixel) here. They will be injected into the `<head>` tag.</p>
                <div className="relative h-64">
                  <Editor
                    value={headerCode}
                    onValueChange={code => setHeaderCode(code)}
                    highlight={code => highlight(code, languages.markup, 'markup')}
                    padding={10}
                    className="font-mono text-sm absolute inset-0 w-full h-full overflow-auto bg-black/20 rounded-lg border border-white/10"
                    style={{'::selection': { background: 'rgba(139, 92, 246, 0.3)' }}}
                  />
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditWebsite;
