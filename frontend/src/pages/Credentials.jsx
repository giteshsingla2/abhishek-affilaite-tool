import React, { useState, useEffect } from 'react';
import axios from 'axios';
import GlassCard from '../components/GlassCard';
import Input from '../components/Input';

const initialFormState = {
  name: '',
  platform: 'aws_s3',
  accessKey: '',
  secretKey: '',
  region: '',
  accountId: '',
  cdnUrl: '',
  netlifyAccessToken: '',
  siteId: '',
};

const Credentials = () => {
  const [formData, setFormData] = useState(initialFormState);
  const [credentials, setCredentials] = useState([]);

  const { name, platform, accessKey, secretKey, region, accountId, cdnUrl, netlifyAccessToken, siteId } = formData;

  useEffect(() => {
    const fetchCredentials = async () => {
      try {
        const token = localStorage.getItem('token');
        const config = { headers: { 'x-auth-token': token } };
        const res = await axios.get('/api/credentials', config);
        setCredentials(res.data);
      } catch (err) {
        console.error(err.response ? err.response.data : err.message);
      }
    };
    fetchCredentials();
  }, []);

  const onChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { 'Content-Type': 'application/json', 'x-auth-token': token } };
      const res = await axios.post('/api/credentials', formData, config);
      setCredentials([...credentials, res.data]);
      setFormData(initialFormState);
    } catch (err) {
      console.error(err.response ? err.response.data : err.message);
    }
  };

  const renderPlatformFields = () => {
    if (platform === 'aws_s3' || platform === 'digital_ocean' || platform === 'backblaze') {
      return (
        <>
          <Input type="text" placeholder={platform === 'backblaze' ? "Key ID (Access Key)" : "Access Key"} name="accessKey" value={accessKey} onChange={onChange} required />
          <Input type="password" placeholder={platform === 'backblaze' ? "Application Key (Secret Key)" : "Secret Key"} name="secretKey" value={secretKey} onChange={onChange} required />
          <Input type="text" placeholder="Region (e.g. us-east-1 or us-west-004)" name="region" value={region} onChange={onChange} required />
        </>
      );
    }
    if (platform === 'cloudflare_r2') {
      return (
        <>
          <Input type="text" placeholder="Access Key" name="accessKey" value={accessKey} onChange={onChange} required />
          <Input type="password" placeholder="Secret Key" name="secretKey" value={secretKey} onChange={onChange} required />
          <Input type="text" placeholder="Account ID" name="accountId" value={accountId} onChange={onChange} required />
          <Input type="text" placeholder="CDN/Public URL (e.g. https://pub-xxx.r2.dev)" name="cdnUrl" value={cdnUrl} onChange={onChange} />
        </>
      );
    }
    if (platform === 'netlify') {
      return (
        <>
          <Input type="password" placeholder="Netlify Access Token" name="netlifyAccessToken" value={netlifyAccessToken} onChange={onChange} required />
          <Input type="text" placeholder="Site ID" name="siteId" value={siteId} onChange={onChange} />
        </>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 text-white p-8">
      <h1 className="text-4xl font-bold mb-8">Manage Credentials</h1>
      <div className="grid md:grid-cols-2 gap-8">
        <GlassCard className="p-8">
          <h2 className="text-2xl font-bold mb-6">Add New Credential</h2>
          <form onSubmit={onSubmit}>
            <Input type="text" placeholder="Credential Name (e.g., My Personal AWS)" name="name" value={name} onChange={onChange} required />
            <select name="platform" value={platform} onChange={onChange} className="w-full p-3 mb-4 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option value="aws_s3">AWS S3</option>
              <option value="digital_ocean">DigitalOcean Spaces</option>
              <option value="backblaze">Backblaze B2</option>
              <option value="cloudflare_r2">Cloudflare R2</option>
              <option value="netlify">Netlify</option>
            </select>
            {renderPlatformFields()}
            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300">
              Save Credentials
            </button>
          </form>
        </GlassCard>
        <GlassCard className="p-8">
          <h2 className="text-2xl font-bold mb-6">Saved Credentials</h2>
          <div className="space-y-4">
            {credentials.map((cred) => (
              <div key={cred._id} className="p-4 bg-white/5 rounded-lg flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg">{cred.name}</h3>
                  <p className="text-sm text-white/70">Platform: {cred.platform.replace('_', ' ').toUpperCase()}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default Credentials;
