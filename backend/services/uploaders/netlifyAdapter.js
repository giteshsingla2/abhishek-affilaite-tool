const axios = require('axios');
const AdmZip = require('adm-zip');

/**
 * Uploads a single HTML file to Netlify as a new site.
 * @param {string} htmlContent - The raw HTML string.
 * @param {string} subDomain - The desired subdomain (optional).
 * @param {object} credential - The Netlify credentials.
 */
const uploadToNetlify = async (htmlContent, subDomain, credential) => {
  let siteId;
  let finalSubdomain = subDomain;

  try {
    // Step 1: Create the site record
    console.log(`[Netlify] Step 1: Creating site with name: ${finalSubdomain}`);
    const createSiteResponse = await axios.post(
      'https://api.netlify.com/api/v1/sites',
      { name: finalSubdomain },
      {
        headers: {
          'Authorization': `Bearer ${credential.netlifyAccessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    siteId = createSiteResponse.data.id;
    finalSubdomain = createSiteResponse.data.name; // Use the name returned by Netlify
    console.log(`[Netlify] Step 1: Site created successfully. Site ID: ${siteId}, Subdomain: ${finalSubdomain}`);

  } catch (error) {
    if (error.response?.status === 422) {
      console.log(`[Netlify] Step 1: Subdomain '${finalSubdomain}' is taken. Trying with a random suffix.`);
      const randomSuffix = Math.floor(100 + Math.random() * 9000); // 3-4 random digits
      finalSubdomain = `${subDomain}-${randomSuffix}`;
      
      try {
        console.log(`[Netlify] Step 1 (Retry): Creating site with name: ${finalSubdomain}`);
        const createSiteResponse = await axios.post(
          'https://api.netlify.com/api/v1/sites',
          { name: finalSubdomain },
          {
            headers: {
              'Authorization': `Bearer ${credential.netlifyAccessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        siteId = createSiteResponse.data.id;
        finalSubdomain = createSiteResponse.data.name;
        console.log(`[Netlify] Step 1 (Retry): Site created successfully. Site ID: ${siteId}, Subdomain: ${finalSubdomain}`);
      } catch (retryError) {
        console.error('Netlify Site Creation Error (Retry):', retryError.response?.data || retryError.message);
        return { success: false, error: 'Failed to create Netlify site even with a random suffix.' };
      }
    } else {
      console.error('Netlify Site Creation Error:', error.response?.data || error.message);
      return { success: false, error: 'Failed to create Netlify site.' };
    }
  }

  try {
    // Step 2: Deploy the content
    console.log(`[Netlify] Step 2: Zipping and deploying content to site ID: ${siteId}`);
    const zip = new AdmZip();
    zip.addFile("index.html", Buffer.from(htmlContent, "utf8"));

    // Add _headers file to ensure proper MIME types on Netlify
    const headersContent = `/*\n  Content-Type: text/html; charset=utf-8\n\n/*.html\n  Content-Type: text/html; charset=utf-8\n\n/*.css\n  Content-Type: text/css; charset=utf-8\n\n/*.js\n  Content-Type: application/javascript; charset=utf-8`;
    zip.addFile("_headers", Buffer.from(headersContent, "utf8"));
    console.log('[Netlify] Added _headers file to zip.');

    // Add netlify.toml configuration file
    const tomlContent = `[build]\n  publish = "."\n\n[[headers]]\n  for = "/*"\n  [headers.values]\n    Content-Type = "text/html; charset=utf-8"\n\n[[headers]]\n  for = "/*.html"\n  [headers.values]\n    Content-Type = "text/html; charset=utf-8"\n\n[[headers]]\n  for = "/*.css"\n  [headers.values]\n    Content-Type = "text/css; charset=utf-8"\n\n[[headers]]\n  for = "/*.js"\n  [headers.values]\n    Content-Type = "application/javascript; charset=utf-8"\n\n[[headers]]\n  for = "/*.xml"\n  [headers.values]\n    Content-Type = "application/xml; charset=utf-8"`;
    zip.addFile("netlify.toml", Buffer.from(tomlContent, "utf8"));
    console.log('[Netlify] Added netlify.toml file to zip.');

    const zipBuffer = zip.toBuffer();

    const deployUrl = `https://api.netlify.com/api/v1/sites/${siteId}/deploys`;

    await axios.post(
      deployUrl,
      zipBuffer,
      {
        headers: {
          'Authorization': `Bearer ${credential.netlifyAccessToken}`,
          'Content-Type': 'application/zip'
        }
      }
    );
    console.log(`[Netlify] Step 2: Content deployed successfully.`);

    // Step 3: Return the manually constructed URL
    const deploymentUrl = `https://${finalSubdomain}.netlify.app`;
    console.log(`[Netlify] Step 3: Constructed URL: ${deploymentUrl}`);

    return {
      success: true,
      url: deploymentUrl,
      siteId: siteId,
    };

  } catch (error) {
    console.error('Netlify Deploy Error:', error.response?.data || error.message);
    return { success: false, error: 'Failed to deploy content to Netlify.' };
  }
};

module.exports = { uploadToNetlify };
