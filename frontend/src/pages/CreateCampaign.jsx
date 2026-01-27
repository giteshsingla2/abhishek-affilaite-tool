import React, { useMemo, useState, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import axios from 'axios';
import GlassCard from '../components/GlassCard';

const MAX_PREVIEW_ROWS = 30;

const CreateCampaign = () => {
  const [step, setStep] = useState(1);

  // Step 1: Template Selection
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Step 2: CSV Upload
  const [csvData, setCsvData] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [parseError, setParseError] = useState('');

  // Step 3: Deployment
  const [platform, setPlatform] = useState('aws_s3');
  const [credentials, setCredentials] = useState([]);
  const [credentialId, setCredentialId] = useState('');
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [bucketName, setBucketName] = useState('');
  const [rootFolder, setRootFolder] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitResult, setSubmitResult] = useState(null);

  const previewRows = useMemo(() => csvData.slice(0, MAX_PREVIEW_ROWS), [csvData]);

  const validateRow = useCallback((row) => {
    if (!selectedTemplate) return { isValid: false, missing: [] };
    const missing = selectedTemplate.requiredCsvHeaders.filter((f) => String(row?.[f] || '').trim() === '');
    return { isValid: missing.length === 0, missing };
  }, [selectedTemplate]);

  const invalidCount = useMemo(() => {
    if (!selectedTemplate) return 0;
    return csvData.reduce((count, row) => {
      const v = validateRow(row);
      return count + (v.isValid ? 0 : 1);
    }, 0);
  }, [csvData, validateRow, selectedTemplate]);

  const parseCsvFile = (file) => {
    setParseError('');
    setSubmitError('');
    setSubmitResult(null);
    setCsvData([]);
    setCsvHeaders([]);

    if (!selectedTemplate) {
        setParseError('Please select a template before uploading a file.');
        return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => (h || '').trim(),
      complete: (results) => {
        if (results.errors && results.errors.length) {
          setParseError(results.errors[0].message || 'Failed to parse CSV');
          return;
        }

        const fields = (results.meta?.fields || []).map((f) => String(f || '').trim());
        const missingHeaders = selectedTemplate.requiredCsvHeaders.filter((h) => !fields.includes(h));

        if (missingHeaders.length) {
          setParseError(`CSV is missing required columns: ${missingHeaders.join(', ')}.`);
          return;
        }

        const data = (results.data || []).filter((r) => Object.values(r).some((v) => String(v || '').trim() !== ''));

        if (!data.length) {
          setParseError('CSV file is empty or contains no data.');
          return;
        }

        setCsvHeaders(fields);
        setCsvData(data);
      },
    });
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseCsvFile(file);
  };

  const updateCell = (rowIndex, key, value) => {
    setCsvData((prev) => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [key]: value };
      return next;
    });
  };

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    setSubmitError('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/templates', { headers: { 'x-auth-token': token } });
      setTemplates(res.data || []);
    } catch (err) {
      setSubmitError(err?.response?.data?.msg || 'Failed to load templates');
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

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
      if (!filtered.some((c) => c._id === credentialId)) {
        setCredentialId(filtered[0]?._id || '');
      }
    } catch (err) {
      setSubmitError(err?.response?.data?.msg || 'Failed to load credentials');
    } finally {
      setLoadingCredentials(false);
    }
  }, [credentialId]);
  
  useEffect(() => {
    if (step === 1) {
      fetchTemplates();
    }
  }, [step, fetchTemplates]);

  const goToStep2 = () => {
    if (!selectedTemplate) {
      setSubmitError('Please select a template to continue.');
      return;
    }
    setSubmitError('');
    setStep(2);
  };

  const goToStep3 = async () => {
    if (!csvData.length) {
      setParseError('Please upload a valid CSV file to continue.');
      return;
    }
    if (invalidCount > 0) {
        setParseError('Please fix the invalid rows before proceeding.');
        return;
    }
    setParseError('');
    await fetchCredentials(platform);
    setStep(3);
  };

  const submitCampaign = async () => {
    setSubmitting(true);
    setSubmitError('');
    setSubmitResult(null);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        '/api/campaigns/start',
        {
          campaignName,
          templateId: selectedTemplate?._id,
          platformConfig: {
            platform,
            credentialId,
            bucketName,
            rootFolder,
          },
          csvData,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token,
          },
        }
      );

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
        <GlassCard className="p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="text-white/80">Step {step} of 3</div>
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
                disabled={!selectedTemplate}
              >
                2. Upload Data
              </button>
              <button
                className={`px-4 py-2 rounded-lg border border-white/10 ${step === 3 ? 'bg-white/10' : 'bg-transparent hover:bg-white/5'}`}
                onClick={goToStep3}
                type="button"
                disabled={!csvData.length || !selectedTemplate || invalidCount > 0}
              >
                3. Deployment
              </button>
            </div>
          </div>
        </GlassCard>

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
                const isSelected = selectedTemplate?._id === t._id;
                return (
                  <button
                    type="button"
                    key={t._id}
                    onClick={() => setSelectedTemplate(t)}
                    className={`text-left rounded-2xl border p-4 bg-white/5 hover:bg-white/10 transition ${isSelected ? 'border-purple-500 ring-2 ring-purple-500' : 'border-white/10'}`}
                  >
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

            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={goToStep2}
                disabled={!selectedTemplate}
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
                [{selectedTemplate?.requiredCsvHeaders.join(', ')}]
              </div>
              <div>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={onFileChange}
                  className="block w-full text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-white/10 file:text-white hover:file:bg-white/20"
                />
              </div>
            </div>

            {parseError && <p className="mt-4 text-red-300">{parseError}</p>}

            {!!csvData.length && (
              <div className="mt-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-white/80">
                    Parsed <span className="font-semibold">{csvData.length}</span> rows. Previewing first {Math.min(csvData.length, MAX_PREVIEW_ROWS)}.
                    {invalidCount > 0 && (
                      <span className="ml-3 text-red-300">{invalidCount} invalid row(s) highlighted</span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={goToStep3}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
                  >
                    Next: Deployment
                  </button>
                </div>

                <div className="mt-4 overflow-auto rounded-xl border border-white/10">
                  <table className="min-w-full text-sm">
                    <thead className="bg-white/5">
                      <tr>
                        {csvHeaders.map((c) => (
                          <th key={c} className="text-left px-4 py-3 font-semibold text-white/90 whitespace-nowrap">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((r, idx) => {
                        const { isValid } = validateRow(r);
                        return (
                          <tr
                            key={idx}
                            className={`border-t border-white/10 ${isValid ? '' : 'bg-red-500/15'}`}
                          >
                            {csvHeaders.map((c) => (
                              <td key={c} className="px-2 py-2 text-white/80 align-top">
                                <input
                                  className="w-full bg-transparent border border-white/10 rounded-lg px-2 py-1 text-white/90 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  value={String(r?.[c] ?? '')}
                                  onChange={(e) => updateCell(idx, c, e.target.value)}
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
                    await fetchCredentials(nextPlatform);
                  }}
                  className="w-full p-3 mb-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="aws_s3">AWS S3</option>
                  <option value="digital_ocean">DigitalOcean</option>
                  <option value="netlify">Netlify</option>
                </select>
              </div>

              {(platform === 'aws_s3' || platform === 'digital_ocean') && (
                <>
                  <div>
                    <label className="block text-white/80 mb-2">Bucket Name</label>
                    <input
                      className="w-full p-3 mb-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      value={bucketName}
                      onChange={(e) => setBucketName(e.target.value)}
                      placeholder="e.g., my-affiliate-sites-bucket"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-white/80 mb-2">Root Folder (Optional)</label>
                    <input
                      className="w-full p-3 mb-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      value={rootFolder}
                      onChange={(e) => setRootFolder(e.target.value)}
                      placeholder="e.g., campaign-v1"
                    />
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
            </div>

            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={submitCampaign}
                disabled={submitting || !csvData.length || !selectedTemplate || !credentialId || !campaignName}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Start Campaign'}
              </button>
            </div>
            {submitError && <p className="mt-4 text-red-300">{submitError}</p>}

            {submitResult && (
              <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-white font-semibold">Result</div>
                <div className="text-white/80 mt-2">{submitResult.message}</div>
              </div>
            )}
          </GlassCard>
        )}
      </div>
    </div>
  );
};

export default CreateCampaign;
