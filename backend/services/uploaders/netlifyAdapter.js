const axios = require('axios');
const AdmZip = require('adm-zip');

/**
 * Uploads a single HTML file to Netlify as a new site.
 * @param {string} htmlContent - The raw HTML string.
 * @param {string} subDomain - The desired subdomain (optional).
 * @param {object} credential - The Netlify credentials.
 */
const uploadToNetlify = async (htmlContent, subDomain, credential) => {
  try {
    const zip = new AdmZip();
    zip.addFile("index.html", Buffer.from(htmlContent, "utf8"));
    const zipBuffer = zip.toBuffer();

    let url = 'https://api.netlify.com/api/v1/sites';
    if (subDomain) {
      url += `?name=${subDomain}`;
    }

    console.log(`[Netlify] Attempting to deploy with URL: ${url}`);

    const response = await axios.post(
      url,
      zipBuffer,
      {
        headers: {
          'Authorization': `Bearer ${credential.netlifyAccessToken}`,
          'Content-Type': 'application/zip'
        }
      }
    );

    console.log('[Netlify] Full API Response:', JSON.stringify(response.data, null, 2));

    return {
      success: true,
      url: response.data.ssl_url,
      siteId: response.data.id
    };

  } catch (error) {
    console.error('Netlify Upload Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      return { success: false, error: 'Netlify Access Token is invalid.' };
    }
    if (error.response?.status === 422) {
      return { success: false, error: `The subdomain '${subDomain}' is likely already taken.` };
    }

    return { success: false, error: error.message };
  }
};

module.exports = { uploadToNetlify };
