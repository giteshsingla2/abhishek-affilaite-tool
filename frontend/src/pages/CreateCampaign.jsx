import React, { useMemo, useState, useEffect, useCallback } from 'react';
import axios from '../lib/axiosInstance';
import GlassCard from '../components/GlassCard';
import { CheckCircle } from 'lucide-react';
import CampaignStatus from '../components/CampaignStatus';


const MAX_PREVIEW_ROWS = 30;

const AVAILABLE_MODELS = [
  {
    id: 'anthropic/claude-sonnet-4.6',
    name: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
    description: 'Best quality output. High Pricing.',
    badge: 'Recommended',
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    description: 'Fast and Medium Pricing.',
    badge: 'Fast',
  },
  {
    id: 'qwen/qwen3-coder-plus',
    name: 'Qwen3 Coder Plus',
    provider: 'Qwen',
    description: 'Medium Quality and Medium Speed.',
    badge: 'Balanced',
  },
];

import { PlusCircle, Globe, KeyRound, FileText, Users, Globe2, FileCode, Wand2, Layout, ArrowLeft } from 'lucide-react';

const CreateCampaign = () => {
  const [mode, setMode] = useState(null); // 'ai' or 'static'
  const [step, setStep] = useState(0);

  // Step 1: Template Selection
  const [templates, setTemplates] = useState([]);
  const [selectedTemplates, setSelectedTemplates] = useState([]);
  const [compatibleTemplateIds, setCompatibleTemplateIds] = useState(null); // null = no selection yet
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);

  // Step 2: CSV Upload
  const [csvFile, setCsvFile] = useState(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [parseError, setParseError] = useState('');


  // Step 3: Deployment
  const [platform, setPlatform] = useState('aws_s3');
  const [credentials, setCredentials] = useState([]);
  const [credentialId, setCredentialId] = useState('');
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [domains, setDomains] = useState([]);
  const [domainId, setDomainId] = useState('');
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [bucketName, setBucketName] = useState('');
  const [rootFolder, setRootFolder] = useState('');
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);
  const [useDynamicDomain, setUseDynamicDomain] = useState(false);

  // S3 Listing state
  const [buckets, setBuckets] = useState([]);
  const [loadingBuckets, setLoadingBuckets] = useState(false);
  const [folders, setFolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitResult, setSubmitResult] = useState(null);

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    if (!file.name.endsWith('.csv')) {
      setParseError('Please upload a valid CSV file');
      return;
    }
    setCsvFile(file);
    setCsvFileName(file.name);
  };


  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    setSubmitError('');
    try {
      const token = localStorage.getItem('token');
      const endpoint = mode === 'static' ? '/api/static-templates' : '/api/templates';
      const res = await axios.get(endpoint, { headers: { 'x-auth-token': token } });
      setTemplates(res.data || []);
    } catch (err) {
      setSubmitError(err?.response?.data?.msg || 'Failed to load templates');
    } finally {
      setLoadingTemplates(false);
    }
  }, [mode]);

  const fetchCredentials = useCallback(async (selectedPlatform) => {
    setLoadingCredentials(true);
    setSubmitError('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/credentials', {
        headers: { 'x-auth-token': token },
      });

      const filtered = (res.data || []).filter((c) => c.platform === selectedPlatform);
      setCredentials(filtered);

      // Clear buckets/folders when switching platforms or credentials
      setBuckets([]);
      setFolders([]);

      if (!filtered.some((c) => c._id === credentialId)) {
        setCredentialId(filtered[0]?._id || '');
      }
    } catch (err) {
      setSubmitError(err?.response?.data?.msg || 'Failed to load credentials');
    } finally {
      setLoadingCredentials(false);
    }
  }, [credentialId]);

  const fetchDomains = useCallback(async () => {
    setLoadingDomains(true);
    setSubmitError('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/domains', {
        headers: { 'x-auth-token': token },
      });
      setDomains(res.data || []);
      if (res.data && res.data.length > 0) {
        setDomainId(res.data[0]._id);
      }
    } catch (err) {
      setSubmitError(err?.response?.data?.msg || 'Failed to load domains');
    } finally {
      setLoadingDomains(false);
    }
  }, []);

  const fetchBuckets = useCallback(async (credId) => {
    if (!credId || !['aws_s3', 'digital_ocean', 'backblaze', 'cloudflare_r2'].includes(platform)) return;
    setLoadingBuckets(true);
    setSubmitError('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/credentials/${credId}/buckets`, {
        headers: { 'x-auth-token': token },
      });
      setBuckets(res.data || []);
    } catch (err) {
      console.error('Failed to fetch buckets:', err);
      const msg = err?.response?.data?.msg || err?.response?.data?.error || 'Failed to fetch buckets';
      setSubmitError(`S3 Error: ${msg}`);
    } finally {
      setLoadingBuckets(false);
    }
  }, [platform]);

  const fetchFolders = useCallback(async (credId, bName) => {
    if (!credId || !bName) return;
    setLoadingFolders(true);
    setSubmitError('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/credentials/${credId}/folders`, {
        params: { bucketName: bName },
        headers: { 'x-auth-token': token },
      });
      setFolders(res.data || []);
    } catch (err) {
      console.error('Failed to fetch folders:', err);
      const msg = err?.response?.data?.msg || err?.response?.data?.error || 'Failed to fetch folders';
      setSubmitError(`S3 Error: ${msg}`);
    } finally {
      setLoadingFolders(false);
    }
  }, []);

  useEffect(() => {
    if (credentialId && ['aws_s3', 'digital_ocean', 'backblaze', 'cloudflare_r2'].includes(platform)) {
      fetchBuckets(credentialId);
    }
  }, [credentialId, platform, fetchBuckets]);

  useEffect(() => {
    if (credentialId && bucketName) {
      fetchFolders(credentialId, bucketName);
    }
  }, [credentialId, bucketName, fetchFolders]);

  useEffect(() => {
    if (step === 1) {
      fetchTemplates();
    }
  }, [step, fetchTemplates]);

  const computeCompatibleIds = (anchorTemplate, allTemplates) => {
    const anchorHeaders = [...(anchorTemplate.requiredCsvHeaders || [])].sort().join(',');
    const compatibleSet = new Set(
      allTemplates
        .filter(t => [...(t.requiredCsvHeaders || [])].sort().join(',') === anchorHeaders)
        .map(t => t._id)
    );
    return compatibleSet;
  };

  const handleTemplateClick = (template) => {
    if (mode !== 'static') {
      // AI mode: single select only
      setSelectedTemplates([template]);
      return;
    }

    const isSelected = selectedTemplates.some(t => t._id === template._id);

    if (isSelected) {
      // Deselect it
      const remaining = selectedTemplates.filter(t => t._id !== template._id);
      setSelectedTemplates(remaining);
      if (remaining.length === 0) {
        setCompatibleTemplateIds(null);
      } else {
        setCompatibleTemplateIds(computeCompatibleIds(remaining[0], templates));
      }
    } else {
      // Select it — only allowed if compatible
      if (compatibleTemplateIds !== null && !compatibleTemplateIds.has(template._id)) return;
      setSelectedTemplates(prev => [...prev, template]);
      if (selectedTemplates.length === 0) {
        // First selection: compute compatibility set
        setCompatibleTemplateIds(computeCompatibleIds(template, templates));
      }
    }
  };

  const goToStep2 = () => {
    if (selectedTemplates.length === 0) {
      setSubmitError('Please select a template to continue.');
      return;
    }
    setSubmitError('');
    setStep(2);
  };

  const goToStep3 = async () => {
    if (!csvFile) {
      setParseError('Please upload a CSV file to continue.');
      return;
    }
    setParseError('');
    if (platform === 'custom_domain') {
      await fetchDomains();
    } else {
      await fetchCredentials(platform);
    }
    setStep(3);
  };


  const submitCampaign = async () => {
    setSubmitting(true);
    setSubmitError('');
    setSubmitResult(null);

    try {
      const token = localStorage.getItem('token');
      const selectedDomain = domains.find(d => d._id === domainId);

      const formData = new FormData();
      formData.append('csvFile', csvFile);
      formData.append('campaignName', campaignName);
      formData.append('campaignType', mode);
      formData.append('platform', platform);
      formData.append('model', mode === 'static' ? 'google/gemini-2.0-flash-001' : selectedModel);

      if (mode === 'static') {
        formData.append('staticTemplateId', JSON.stringify(selectedTemplates.map(t => t._id)));
      } else {
        formData.append('templateId', selectedTemplates[0]?._id);
      }

      if (platform !== 'custom_domain') {
        formData.append('credentialId', credentialId);
        if (bucketName) formData.append('bucketName', bucketName);
        if (rootFolder) formData.append('rootFolder', rootFolder);
      } else {
        formData.append('useDynamicDomain', useDynamicDomain);
        if (!useDynamicDomain && selectedDomain) {
          formData.append('domainName', selectedDomain.domain);
        }
      }

      const res = await axios.post('/api/campaign-upload/start', formData, {
        headers: {
          'x-auth-token': token,
          'Content-Type': 'multipart/form-data',
        },
      });

      setSubmitResult(res.data);
    } catch (err) {
      setSubmitError(err?.response?.data?.msg || err?.response?.data?.message || 'Failed to start campaign');
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 text-white p-6">
      <h1 className="text-4xl font-bold mb-6">Create Campaign</h1>

      <div className="max-w-5xl mx-auto space-y-6">
        {step === 0 && (
          <div className="grid md:grid-cols-2 gap-8 py-10 animate-fade-in">
            <button 
              onClick={() => { setMode('ai'); setStep(1); }}
              className="group relative bg-white/5 border border-white/10 p-8 rounded-3xl text-left hover:bg-white/10 transition-all hover:border-purple-500/50 flex flex-col items-center text-center"
            >
              <div className="bg-purple-500/20 p-4 rounded-2xl mb-6 group-hover:scale-110 transition-transform">
                <Wand2 className="text-purple-400" size={48} />
              </div>
              <h2 className="text-2xl font-bold mb-3">Auto AI Website</h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                AI generates the complete HTML page from scratch. Maximum design variety. Best for creative flexibility.
              </p>
              <span className="mt-auto bg-white/10 text-white/50 text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full">Current Method</span>
            </button>

            <button 
              onClick={() => { setMode('static'); setStep(1); }}
              className="group relative bg-white/5 border border-white/10 p-8 rounded-3xl text-left hover:bg-white/10 transition-all hover:border-blue-500/50 flex flex-col items-center text-center"
            >
              <div className="bg-blue-500/20 p-4 rounded-2xl mb-6 group-hover:scale-110 transition-transform">
                <Layout className="text-blue-400" size={48} />
              </div>
              <div className="absolute top-4 right-4 bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-tighter">Recommended</div>
              <h2 className="text-2xl font-bold mb-3">Templatic Website</h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                AI generates only the content and fills a pre-designed HTML template. 10x cheaper. Consistent professional design.
              </p>
              <span className="mt-auto bg-blue-500/20 text-blue-300 text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full">New Method</span>
            </button>
          </div>
        )}

        {step > 0 && (
          <GlassCard className="p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                 <button onClick={() => { setStep(0); setMode(null); setSelectedTemplates([]); setCompatibleTemplateIds(null); }} className="p-2 rounded-full hover:bg-white/10 text-gray-400 transition-colors">
                    <ArrowLeft size={20} />
                 </button>
                 <div className="text-white/80 font-medium">
                    {mode === 'static' ? 'Templatic Mode' : 'Auto AI Mode'} — Step {step} of 3
                 </div>
              </div>
              <div className="flex gap-2">
                <button
                  className={`px-4 py-2 rounded-lg border border-white/10 ${step === 1 ? 'bg-white/10' : 'bg-transparent hover:bg-white/5'}`}
                  onClick={() => setStep(1)}
                  type="button"
                >
                  1. Select Template
                </button>
                <button
                  className={`px-4 py-2 rounded-lg border border-white/10 ${step === 2 ? 'bg-white/10' : 'bg-transparent hover:bg-white/5'}`}
                  onClick={goToStep2}
                  type="button"
                  disabled={selectedTemplates.length === 0}
                >
                  2. Upload Data
                </button>
                <button
                  className={`px-4 py-2 rounded-lg border border-white/10 ${step === 3 ? 'bg-white/10' : 'bg-transparent hover:bg-white/5'}`}
                  onClick={goToStep3}
                  type="button"
                  disabled={!csvFile || selectedTemplates.length === 0}
                >
                  3. Deployment
                </button>

              </div>
            </div>
          </GlassCard>
        )}


        {step === 1 && (
          <GlassCard className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-2xl font-bold">Step 1: Select Template</h2>
              <button
                type="button"
                onClick={fetchTemplates}
                disabled={loadingTemplates}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10"
              >
                {loadingTemplates ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((t) => {
                const isSelected = selectedTemplates.some(s => s._id === t._id);
                const isDisabled = mode === 'static' && compatibleTemplateIds !== null && !compatibleTemplateIds.has(t._id);
                return (
                  <button
                    type="button"
                    key={t._id}
                    onClick={() => !isDisabled && handleTemplateClick(t)}
                    className={`relative text-left rounded-2xl border p-4 bg-white/5 transition ${
                      isDisabled
                        ? 'opacity-40 cursor-not-allowed border-white/10'
                        : isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500 hover:bg-white/10'
                        : 'border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {/* Checkmark badge for selected (static mode) or single-select ring (AI mode) */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-0.5 z-10">
                        <CheckCircle size={16} className="text-white" />
                      </div>
                    )}
                    <div className="w-full h-28 rounded-xl bg-white/5 border border-white/10 overflow-hidden mb-3">
                      {t.thumbnailUrl ? (
                        <img src={t.thumbnailUrl} alt={t.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/50 text-sm">
                          No thumbnail
                        </div>
                      )}
                    </div>
                    <div className="font-semibold text-white mb-2">{t.name}</div>
                    {t.requiredCsvHeaders && t.requiredCsvHeaders.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {t.requiredCsvHeaders.map(header => (
                          <span key={header} className="bg-purple-500/20 text-purple-300 text-xs font-medium px-2 py-1 rounded-full">{header}</span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Info line for static multi-select */}
            {mode === 'static' && (
              <p className="text-sm text-white/50 mt-4">
                {selectedTemplates.length > 0
                  ? `${selectedTemplates.length} template(s) selected — templates with different CSV headers are dimmed`
                  : 'Select one or more templates with matching CSV headers'}
              </p>
            )}

            {selectedTemplates.length > 0 && mode !== 'static' && (
              <div className="mt-8 animate-fade-in-up">
                <h3 className="text-xl font-bold mb-4">Select AI Model</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {AVAILABLE_MODELS.map((model) => {
                    const isSelected = selectedModel === model.id;
                    return (
                      <button
                        type="button"
                        key={model.id}
                        onClick={() => setSelectedModel(model.id)}
                        className={`text-left rounded-2xl border p-4 bg-white/5 hover:bg-white/10 transition flex flex-col h-full ${isSelected ? 'border-purple-500 ring-2 ring-purple-500 bg-purple-500/10' : 'border-white/10'}`}
                      >
                        <div className="flex justify-between items-start w-full mb-2">
                          <div className="font-semibold text-white">{model.name}</div>
                          {model.badge && (
                            <span className="bg-purple-500/20 text-purple-300 text-[10px] uppercase font-bold px-2 py-1 rounded-full whitespace-nowrap ml-2">{model.badge}</span>
                          )}
                        </div>
                        <div className="text-xs text-purple-300 mb-3">{model.provider}</div>
                        <div className="text-sm text-white/70 mt-auto">{model.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={goToStep2}
                disabled={selectedTemplates.length === 0}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:opacity-50"
              >
                Next: Upload Data
              </button>
            </div>

            {submitError && <p className="mt-4 text-red-300">{submitError}</p>}
          </GlassCard>
        )}

        {step === 2 && (
          <GlassCard className="p-6">
            <h2 className="text-2xl font-bold mb-4">Step 2: Upload Data (CSV)</h2>
            <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-8">
              <div className="text-white/80 mb-4">
                This template requires the following columns:
              </div>
              <div className="text-white/70 font-mono text-sm break-words mb-6">
                [{(mode === 'static'
                  ? [...(selectedTemplates[0]?.requiredCsvHeaders || []), 'sub_domain', 'domain']
                  : (selectedTemplates[0]?.requiredCsvHeaders || [])
                ).join(', ')}]
              </div>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={onFileChange}
                className="block w-full text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-white/10 file:text-white hover:file:bg-white/20"
              />
              {csvFileName && (
                <div className="mt-4 flex items-center gap-2 text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3">
                  <CheckCircle size={16} />
                  <span className="text-sm font-medium">{csvFileName} selected and ready to upload</span>
                </div>
              )}
            </div>

            {parseError && <p className="mt-4 text-red-300">{parseError}</p>}

            {csvFile && (
              <div className="mt-6">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={goToStep3}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
                  >
                    Next: Deployment
                  </button>
                </div>
              </div>
            )}
          </GlassCard>
        )}


        {step === 3 && (
          <GlassCard className="p-6">
            <h2 className="text-2xl font-bold mb-4">Step 3: Deployment & Submit</h2>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white/80 mb-2">Campaign Name</label>
                <input
                  className="w-full p-3 mb-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g., January Affiliate Batch"
                />
              </div>

              <div>
                <label className="block text-white/80 mb-2">Platform</label>
                <select
                  value={platform}
                  onChange={async (e) => {
                    const nextPlatform = e.target.value;
                    setPlatform(nextPlatform);
                    if (nextPlatform === 'custom_domain') {
                      await fetchDomains();
                    } else {
                      await fetchCredentials(nextPlatform);
                    }
                  }}
                  className="w-full p-3 mb-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="aws_s3">AWS S3</option>
                  <option value="digital_ocean">DigitalOcean</option>
                  <option value="backblaze">Backblaze B2</option>
                  <option value="cloudflare_r2">Cloudflare R2</option>
                  <option value="netlify">Netlify</option>
                  <option value="custom_domain">Custom Domain</option>
                </select>
              </div>

              {platform === 'custom_domain' ? (
                <div className="md:col-span-2 space-y-4">
                  <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg">
                    <input
                      type="checkbox"
                      id="useDynamicDomain"
                      checked={useDynamicDomain}
                      onChange={(e) => setUseDynamicDomain(e.target.checked)}
                      className="h-5 w-5 rounded bg-white/10 border-white/20 text-purple-500 focus:ring-purple-500"
                    />
                    <label htmlFor="useDynamicDomain" className="text-white/90 cursor-pointer">Use Domains from CSV Column</label>
                  </div>

                  {useDynamicDomain ? (
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-sm text-purple-200">
                      Ensure your CSV has a column named 'domain'. We will verify ownership of each domain before deployment.
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <label className="block text-white/80">Select Domain</label>
                        <button
                          type="button"
                          onClick={fetchDomains}
                          disabled={loadingDomains}
                          className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10"
                        >
                          {loadingDomains ? 'Loading...' : 'Refresh'}
                        </button>
                      </div>
                      <select
                        value={domainId}
                        onChange={(e) => setDomainId(e.target.value)}
                        className="w-full p-3 mt-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="" disabled>
                          Select a domain
                        </option>
                        {domains.map((d) => (
                          <option key={d._id} value={d._id}>
                            {d.domain}
                          </option>
                        ))}
                      </select>
                      {domains.length === 0 && !loadingDomains && (
                        <p className="mt-2 text-sm text-yellow-300">
                          No domains found. Please add a domain in the Custom Domains page first.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {['aws_s3', 'digital_ocean', 'backblaze', 'cloudflare_r2'].includes(platform) && (
                    <>
                      <div>
                        <label className="block text-white/80 mb-2">Bucket Name</label>
                        <div className="flex gap-2">
                          <select
                            className="w-full p-3 mb-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            value={bucketName}
                            onChange={(e) => setBucketName(e.target.value)}
                            required
                          >
                            <option value="">Select a bucket</option>
                            {buckets.map((b) => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => fetchBuckets(credentialId)}
                            disabled={loadingBuckets || !credentialId}
                            className="p-3 mb-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10"
                            title="Refresh Buckets"
                          >
                            {loadingBuckets ? '...' : '↻'}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-white/80 mb-2">Root Folder (Optional)</label>
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            {!isCreatingNewFolder ? (
                              <select
                                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                value={rootFolder}
                                onChange={(e) => {
                                  if (e.target.value === '___NEW___') {
                                    setIsCreatingNewFolder(true);
                                    setRootFolder('');
                                  } else {
                                    setRootFolder(e.target.value);
                                  }
                                }}
                              >
                                <option value="">(Root)</option>
                                {folders.map((f) => (
                                  <option key={f} value={f}>{f}</option>
                                ))}
                                <option value="___NEW___">+ Create New Folder</option>
                              </select>
                            ) : (
                              <div className="relative w-full">
                                <input
                                  className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  value={rootFolder}
                                  onChange={(e) => setRootFolder(e.target.value)}
                                  placeholder="Type new folder name..."
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsCreatingNewFolder(false);
                                    setRootFolder('');
                                  }}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => fetchFolders(credentialId, bucketName)}
                              disabled={loadingFolders || !bucketName}
                              className="p-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10"
                              title="Refresh Folders"
                            >
                              {loadingFolders ? '...' : '↻'}
                            </button>
                          </div>
                          {isCreatingNewFolder && (
                            <p className="text-xs text-purple-300">Enter a name for the new folder. It will be created upon deployment.</p>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <label className="block text-white/80">Saved Credential</label>
                      <button
                        type="button"
                        onClick={() => fetchCredentials(platform)}
                        disabled={loadingCredentials}
                        className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10"
                      >
                        {loadingCredentials ? 'Loading...' : 'Refresh'}
                      </button>
                    </div>
                    <select
                      value={credentialId}
                      onChange={(e) => setCredentialId(e.target.value)}
                      className="w-full p-3 mt-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="" disabled>
                        Select a credential
                      </option>
                      {credentials.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={submitCampaign}
                disabled={submitting || !csvFile || selectedTemplates.length === 0 || (platform !== 'custom_domain' && !credentialId) || (platform === 'custom_domain' && !useDynamicDomain && !domainId) || !campaignName}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Start Campaign'}
              </button>

            </div>
            {submitError && <p className="mt-4 text-red-300">{submitError}</p>}

            {submitResult && submitResult.campaignId && (
              <div className="mt-6 space-y-4">
                <CampaignStatus
                  campaignId={submitResult.campaignId}
                  onComplete={(finalStatus) => console.log('Campaign finished:', finalStatus)}
                />
                <p className="text-center text-sm text-gray-400">
                  You can safely close this page.{' '}
                  <a href="/campaigns" className="text-purple-400 hover:underline">
                    View all campaigns
                  </a>{' '}
                  to check progress later.
                </p>
              </div>
            )}

          </GlassCard>
        )}
      </div>
    </div>
  );
};

export default CreateCampaign;
