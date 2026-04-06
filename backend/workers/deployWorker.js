const { Worker, Queue } = require('bullmq');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const Credential = require('../models/Credential');
const Template = require('../models/Template');
const Campaign = require('../models/Campaign');
const Website = require('../models/Website');
const StaticTemplate = require('../models/StaticTemplate');
const StaticWebsite = require('../models/StaticWebsite');
const { uploadToS3 } = require('../services/uploaders/s3Adapter');
const { uploadToNetlify } = require('../services/uploaders/netlifyAdapter');
const { injectIntoTemplate } = require('../utils/templateInjector');

const USER_SITES_BASE_DIR = process.env.USER_SITES_BASE_DIR || '/var/www/user_sites';

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
};

const deployQueue = new Queue('deploy-queue', { connection });

// ============================================================
// DESIGN DNA ENGINE
// ============================================================

const COLOR_PALETTES = [
  {
    name: 'Royal Blue',
    vars: `--primary:#1a3a7a;--primary-dark:#0f2456;--primary-light:#e8eef8;--accent:#f59e0b;--accent-dark:#d97706;--text-dark:#1a1a2e;--text-mid:#374151;--text-light:#6b7280;--white:#ffffff;--bg-light:#f8fafF;--bg-gray:#f3f4f6;--border:#e5e7eb;--shadow:0 4px 24px rgba(26,58,122,0.10);--shadow-lg:0 8px 40px rgba(26,58,122,0.15);`
  },
  {
    name: 'Deep Burgundy',
    vars: `--primary:#7a1a2e;--primary-dark:#5e1222;--primary-light:#f8eaed;--accent:#f59e0b;--accent-dark:#d97706;--text-dark:#1a1a2e;--text-mid:#374151;--text-light:#6b7280;--white:#ffffff;--bg-light:#fdf8f9;--bg-gray:#f3f4f6;--border:#e5e7eb;--shadow:0 4px 24px rgba(122,26,46,0.10);--shadow-lg:0 8px 40px rgba(122,26,46,0.15);`
  },
  {
    name: 'Ocean Teal',
    vars: `--primary:#1a6b7a;--primary-dark:#145260;--primary-light:#e8f5f7;--accent:#f97316;--accent-dark:#ea6300;--text-dark:#1a1a2e;--text-mid:#374151;--text-light:#6b7280;--white:#ffffff;--bg-light:#f7fdfe;--bg-gray:#f3f4f6;--border:#e5e7eb;--shadow:0 4px 24px rgba(26,107,122,0.10);--shadow-lg:0 8px 40px rgba(26,107,122,0.15);`
  },
  {
    name: 'Slate Navy',
    vars: `--primary:#1e3a5f;--primary-dark:#142848;--primary-light:#e8edf5;--accent:#10b981;--accent-dark:#059669;--text-dark:#1a1a2e;--text-mid:#374151;--text-light:#6b7280;--white:#ffffff;--bg-light:#f7f9fc;--bg-gray:#f3f4f6;--border:#e5e7eb;--shadow:0 4px 24px rgba(30,58,95,0.10);--shadow-lg:0 8px 40px rgba(30,58,95,0.15);`
  },
  {
    name: 'Forest Moss',
    vars: `--primary:#3a5c2e;--primary-dark:#2a4420;--primary-light:#eef4eb;--accent:#f59e0b;--accent-dark:#d97706;--text-dark:#1a1a2e;--text-mid:#374151;--text-light:#6b7280;--white:#ffffff;--bg-light:#f8fcf7;--bg-gray:#f3f4f6;--border:#e5e7eb;--shadow:0 4px 24px rgba(58,92,46,0.10);--shadow-lg:0 8px 40px rgba(58,92,46,0.15);`
  },
  {
    name: 'Warm Mahogany',
    vars: `--primary:#7a3a1a;--primary-dark:#5e2c12;--primary-light:#f8f0ea;--accent:#10b981;--accent-dark:#059669;--text-dark:#1a1a2e;--text-mid:#374151;--text-light:#6b7280;--white:#ffffff;--bg-light:#fdf8f5;--bg-gray:#f3f4f6;--border:#e5e7eb;--shadow:0 4px 24px rgba(122,58,26,0.10);--shadow-lg:0 8px 40px rgba(122,58,26,0.15);`
  },
  {
    name: 'Indigo Purple',
    vars: `--primary:#3d1a7a;--primary-dark:#2e1260;--primary-light:#ede8f8;--accent:#f59e0b;--accent-dark:#d97706;--text-dark:#1a1a2e;--text-mid:#374151;--text-light:#6b7280;--white:#ffffff;--bg-light:#faf8fd;--bg-gray:#f3f4f6;--border:#e5e7eb;--shadow:0 4px 24px rgba(61,26,122,0.10);--shadow-lg:0 8px 40px rgba(61,26,122,0.15);`
  },
  {
    name: 'Steel Blue',
    vars: `--primary:#2563a8;--primary-dark:#1a4a82;--primary-light:#e8f1fb;--accent:#f59e0b;--accent-dark:#d97706;--text-dark:#1a1a2e;--text-mid:#374151;--text-light:#6b7280;--white:#ffffff;--bg-light:#f5f9ff;--bg-gray:#f3f4f6;--border:#e5e7eb;--shadow:0 4px 24px rgba(37,99,168,0.10);--shadow-lg:0 8px 40px rgba(37,99,168,0.15);`
  },
  {
    name: 'Terracotta',
    vars: `--primary:#c1440e;--primary-dark:#9a350b;--primary-light:#fdf0eb;--accent:#0ea5e9;--accent-dark:#0284c7;--text-dark:#1a1a2e;--text-mid:#374151;--text-light:#6b7280;--white:#ffffff;--bg-light:#fffaf8;--bg-gray:#f3f4f6;--border:#e5e7eb;--shadow:0 4px 24px rgba(193,68,14,0.10);--shadow-lg:0 8px 40px rgba(193,68,14,0.15);`
  },
  {
    name: 'Charcoal Pro',
    vars: `--primary:#2d3748;--primary-dark:#1a202c;--primary-light:#edf2f7;--accent:#f59e0b;--accent-dark:#d97706;--text-dark:#1a1a2e;--text-mid:#374151;--text-light:#6b7280;--white:#ffffff;--bg-light:#f7fafc;--bg-gray:#f3f4f6;--border:#e5e7eb;--shadow:0 4px 24px rgba(45,55,72,0.10);--shadow-lg:0 8px 40px rgba(45,55,72,0.15);`
  },
  {
    name: 'Sage Green',
    vars: `--primary:#4a7c59;--primary-dark:#365c42;--primary-light:#edf5f0;--accent:#f97316;--accent-dark:#ea6300;--text-dark:#1a1a2e;--text-mid:#374151;--text-light:#6b7280;--white:#ffffff;--bg-light:#f5faf7;--bg-gray:#f3f4f6;--border:#e5e7eb;--shadow:0 4px 24px rgba(74,124,89,0.10);--shadow-lg:0 8px 40px rgba(74,124,89,0.15);`
  },
  {
    name: 'Deep Crimson',
    vars: `--primary:#9b1c1c;--primary-dark:#771414;--primary-light:#fdf0f0;--accent:#f59e0b;--accent-dark:#d97706;--text-dark:#1a1a2e;--text-mid:#374151;--text-light:#6b7280;--white:#ffffff;--bg-light:#fffafa;--bg-gray:#f3f4f6;--border:#e5e7eb;--shadow:0 4px 24px rgba(155,28,28,0.10);--shadow-lg:0 8px 40px rgba(155,28,28,0.15);`
  },
  {
    name: 'Cobalt Cyan',
    vars: `--primary:#0e7490;--primary-dark:#0a5870;--primary-light:#e0f5f9;--accent:#f59e0b;--accent-dark:#d97706;--text-dark:#1a1a2e;--text-mid:#374151;--text-light:#6b7280;--white:#ffffff;--bg-light:#f0fbfe;--bg-gray:#f3f4f6;--border:#e5e7eb;--shadow:0 4px 24px rgba(14,116,144,0.10);--shadow-lg:0 8px 40px rgba(14,116,144,0.15);`
  },
  {
    name: 'Plum',
    vars: `--primary:#6b21a8;--primary-dark:#52187e;--primary-light:#f5eeff;--accent:#10b981;--accent-dark:#059669;--text-dark:#1a1a2e;--text-mid:#374151;--text-light:#6b7280;--white:#ffffff;--bg-light:#fdf9ff;--bg-gray:#f3f4f6;--border:#e5e7eb;--shadow:0 4px 24px rgba(107,33,168,0.10);--shadow-lg:0 8px 40px rgba(107,33,168,0.15);`
  },
  {
    name: 'Midnight Green',
    vars: `--primary:#065f46;--primary-dark:#044733;--primary-light:#ecfdf5;--accent:#f59e0b;--accent-dark:#d97706;--text-dark:#1a1a2e;--text-mid:#374151;--text-light:#6b7280;--white:#ffffff;--bg-light:#f0fdf9;--bg-gray:#f3f4f6;--border:#e5e7eb;--shadow:0 4px 24px rgba(6,95,70,0.10);--shadow-lg:0 8px 40px rgba(6,95,70,0.15);`
  },
];

const DESIGN_STYLES = [
  { name: 'Glassmorphism' },
  { name: 'Neomorphism' },
  { name: 'Minimalism' },
  { name: 'Material Design' },
  { name: 'Skeuomorphism' },
  { name: 'Flat Design' },
  { name: 'Dark Luxury' },
  { name: 'Organic / Nature' },
  { name: 'Swiss / International Style' },
];



const TYPOGRAPHY_PAIRINGS = [
  { heading: 'Playfair Display', body: 'Inter' },
  { heading: 'Montserrat', body: 'Open Sans' },
  { heading: 'Oswald', body: 'Lato' },
  { heading: 'Cormorant Garamond', body: 'Jost' },
  { heading: 'Bebas Neue', body: 'Roboto' },
  { heading: 'Space Grotesk', body: 'DM Sans' },
  { heading: 'Raleway', body: 'Nunito' },
  { heading: 'Libre Baskerville', body: 'Mulish' },
  { heading: 'Anton', body: 'Barlow' },
  { heading: 'Merriweather', body: 'Source Sans Pro' },
];

const UI_MOTIFS = [
  { name: 'Pill shaped buttons with soft rounded cards' },
  { name: 'Sharp rectangular buttons with angular cards' },
  { name: 'Ghost outlined buttons with border accent cards' },
  { name: 'Large icon badges above each feature' },
  { name: 'Numbered steps layout' },
  { name: 'Alternating image text sections' },
];

const DESIGN_DNA = {
  colorPalettes: COLOR_PALETTES,
  designStyles: DESIGN_STYLES,
  typographyPairings: TYPOGRAPHY_PAIRINGS,
  uiMotifs: UI_MOTIFS,
};

/**
 * Generates a fully random Design DNA — different every single deployment.
 */
function getDesignDNA() {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const palette = pick(DESIGN_DNA.colorPalettes);
  const style = pick(DESIGN_DNA.designStyles);
  const typo = pick(DESIGN_DNA.typographyPairings);
  const motif = pick(DESIGN_DNA.uiMotifs);

  return {
    dna: `==================================================
MANDATORY DESIGN DNA — FOLLOW EXACTLY
==================================================
COLOR PALETTE: "${palette.name}"
Apply these CSS variables on :root {}
${palette.vars}

DESIGN STYLE: "${style.name}"
Build the entire page using the ${style.name} design concept.
Apply consistently to every section. Do not mix styles.

TYPOGRAPHY:
Heading font → ${typo.heading} (import from Google Fonts)
Body font    → ${typo.body} (import from Google Fonts)

UI MOTIF: ${motif.name}

RULES:
1. Google Fonts <link> must be first inside <head>
2. Use var(--primary) for buttons, headings, key accents
3. Use var(--accent) for badges, highlights, secondary CTAs
4. Use var(--bg-light) as page background
5. Use var(--shadow) on cards, var(--shadow-lg) on hero
==================================================`,
    summary: `${palette.name} | ${style.name} | ${typo.heading} / ${typo.body} | ${motif.name}`,
  };
}

// ============================================================
// END DESIGN DNA ENGINE
// ============================================================

const stripMarkdownCodeFences = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/```html\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
};

const generateHtml = async (systemPrompt, row, model) => {
  const systemRole = "You are a Helpful AI Assistant who creates HTML Websites. Return only a valid complete HTML document — no markdown, no code fences, no explanations, no commentary before or after the HTML.";

  // Generate fresh random Design DNA for every deployment
  const { dna, summary } = getDesignDNA();
  console.log(`[DESIGN_DNA] Selected: ${summary}`);

  // Hydrate placeholders in system prompt
  let finalHydratedPrompt = systemPrompt;
  for (const key in row) {
    if (Object.hasOwnProperty.call(row, key)) {
      const value = row[key] || '';
      const placeholder = new RegExp(`\\{${key}\\}`, 'g');
      finalHydratedPrompt = finalHydratedPrompt.replace(placeholder, value);
    }
  }

  // Remove any remaining unfilled placeholders
  finalHydratedPrompt = finalHydratedPrompt.replace(/\{[a-zA-Z0-9_]+\}/g, '');

  // Inject Design DNA BEFORE the main prompt
  const fullPrompt = dna + '\n\n' + finalHydratedPrompt;

  try {
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: model || process.env.OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: systemRole },
        { role: 'user', content: fullPrompt },
      ],
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5173',
      }
    });

    let htmlContent = response.data.choices[0].message.content;
    htmlContent = stripMarkdownCodeFences(htmlContent);

    const headerCode = String(row.header_code || '').trim();
    if (headerCode) {
      htmlContent = htmlContent.replace('</head>', `${headerCode}\n</head>`);
    }

    return htmlContent;
  } catch (error) {
    console.error('Error generating HTML from OpenRouter:', error.response ? error.response.data : error.message);
    throw new Error('Failed to generate HTML content.');
  }
};

const worker = new Worker('deploy-queue', async (job) => {
  console.log(`[JOB_START] Job ${job.id} received with data:`, job.data);
  const { platform, credentialId, templateId, row, campaignId, domainName: dynamicDomain, model } = job.data;
  const subDomain = row?.sub_domain;

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new Error(`Campaign with ID ${campaignId} not found.`);
  }

  const targetDomain = dynamicDomain || campaign.domainName;

  const website = await Website.create({
    userId: campaign.userId,
    campaignId,
    productName: row.name || row.product_name || row.productName || row.main_product || 'Unnamed Product',
    subdomain: subDomain,
    domain: targetDomain,
    platform: platform,
    status: 'Pending',
  });

  console.log(`[JOB_PROGRESS] ${job.id}: Initial website record created: ${website._id}.`);

  try {
    console.log(`[JOB_PROGRESS] ${job.id}: Step 1 - Fetching template...`);
    const template = await Template.findById(templateId);
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found.`);
    }
    console.log(`[JOB_PROGRESS] ${job.id}: Step 1 - Template fetched successfully.`);

    console.log(`[JOB_PROGRESS] ${job.id}: Step 2 - Generating HTML with random Design DNA...`);
    const htmlContent = await generateHtml(template.systemPrompt, row, model);
    console.log(`[JOB_PROGRESS] ${job.id}: Step 2 - HTML generated (length: ${htmlContent.length}).`);

    console.log(`[JOB_PROGRESS] ${job.id}: Step 3 - Fetching credentials...`);
    let credential = null;
    if (platform !== 'custom_domain') {
      const credentialDoc = await Credential.findById(credentialId);
      if (!credentialDoc) {
        throw new Error(`Credential with ID ${credentialId} not found.`);
      }
      credential = credentialDoc.getDecrypted();
      console.log(`[JOB_PROGRESS] ${job.id}: Step 3 - Credentials decrypted.`);
    } else {
      console.log(`[JOB_PROGRESS] ${job.id}: Step 3 - Custom domain, skipping credentials.`);
    }

    console.log(`[JOB_PROGRESS] ${job.id}: Step 4 - Uploading to ${platform}...`);
    let result;
    switch (platform) {
      case 'aws_s3':
      case 'digital_ocean':
      case 'backblaze':
      case 'cloudflare_r2':
        result = await uploadToS3(htmlContent, subDomain, credential, campaign);
        break;
      case 'netlify':
        result = await uploadToNetlify(htmlContent, subDomain, credential);
        break;
      case 'custom_domain':
        const sitePath = path.join(USER_SITES_BASE_DIR, targetDomain, subDomain);
        try {
          fs.mkdirSync(sitePath, { recursive: true });
          fs.writeFileSync(path.join(sitePath, 'index.html'), htmlContent);
          result = {
            success: true,
            url: `http://${subDomain}.${targetDomain}`,
          };
        } catch (fsErr) {
          console.error(`[ERROR] File System Error in custom_domain deploy:`, fsErr);
          result = {
            success: false,
            error: `Failed to create site directory or write file: ${fsErr.message}`,
          };
        }
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    console.log(`[JOB_PROGRESS] ${job.id}: Step 4 - Upload completed. Result:`, result);

    if (!result.success) {
      throw new Error(result.error || 'Upload failed for an unknown reason.');
    }

    console.log(`[JOB_PROGRESS] ${job.id}: Step 5 - Updating website document...`);
    website.status = 'Live';
    website.url = result.url;
    if (result.siteId) {
      website.siteId = result.siteId;
    }
    website.htmlContent = htmlContent;
    website.headerCode = String(row.header_code || '').trim();
    await website.save();
    console.log(`[JOB_PROGRESS] ${job.id}: Step 5 - Website updated successfully.`);

    console.log(`Job ${job.id} completed. URL: ${result.url}`);
    return { ...result, websiteId: website._id };

  } catch (error) {
    console.error(`Job ${job.id} failed:`, error.message);
    website.status = 'Failed';
    await website.save();
    console.log(`[JOB_PROGRESS] ${job.id}: Website status updated to 'Failed'.`);
    throw error;
  }
}, { connection });

worker.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

worker.on('failed', (job, err) => {
  console.log(`Job ${job.id} failed:`, err.message);
});

async function generateFromStaticTemplate(staticTemplate, csvRow, model) {
  // Step 1 — hydrate the prompt with CSV values
  let prompt = staticTemplate.jsonPrompt;
  for (const key in csvRow) {
    prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), csvRow[key] || '');
  }

  // Step 2 — call AI, ask for JSON only
  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: model || process.env.OPENROUTER_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a conversion copywriter. Return ONLY valid JSON. No markdown, no code fences, no explanation before or after.'
        },
        { role: 'user', content: prompt }
      ]
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5173'
      }
    }
  );

  // Step 3 — parse JSON
  let raw = response.data.choices[0].message.content;
  raw = raw.replace(/```json|```/g, '').trim();

  let contentJson;
  try {
    contentJson = JSON.parse(raw);
  } catch (e) {
    throw new Error('AI returned invalid JSON: ' + raw.substring(0, 200));
  }

  // Step 4 — inject into HTML and return both
  const finalHtml = injectIntoTemplate(
    staticTemplate.htmlContent,
    csvRow,
    contentJson
  );

  return { finalHtml, contentJson };
}

const staticDeployQueue = new Queue('static-deploy-queue', { connection });

const staticWorker = new Worker('static-deploy-queue', async (job) => {
  const { 
    staticTemplateId, row, campaignId, 
    platform, credentialId, domainName: dynamicDomain, model 
  } = job.data;

  const subDomain = row?.sub_domain;

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  const targetDomain = dynamicDomain || campaign.domainName;

  // Create initial record
  const staticWebsite = await StaticWebsite.create({
    userId: campaign.userId,
    campaignId,
    staticTemplateId,
    productName: row.name || row.product_name || 'Unnamed Product',
    subdomain: subDomain,
    domain: targetDomain,
    platform,
    status: 'Pending'
  });

  try {
    // Fetch template
    const staticTemplate = await StaticTemplate.findById(staticTemplateId);
    if (!staticTemplate) throw new Error(`StaticTemplate ${staticTemplateId} not found`);

    // Generate content and HTML
    const { finalHtml, contentJson } = await generateFromStaticTemplate(
      staticTemplate, row, model
    );

    // Inject header code if present
    let htmlToUpload = finalHtml;
    const headerCode = String(row.header_code || '').trim();
    if (headerCode) {
      htmlToUpload = htmlToUpload.replace('</head>', `${headerCode}\n</head>`);
    }

    // Fetch credentials if needed
    let credential = null;
    if (platform !== 'custom_domain') {
      const credentialDoc = await Credential.findById(credentialId);
      if (!credentialDoc) throw new Error(`Credential ${credentialId} not found`);
      credential = credentialDoc.getDecrypted();
    }

    // Upload — same logic as existing worker
    let result;
    switch (platform) {
      case 'aws_s3':
      case 'digital_ocean':
      case 'backblaze':
      case 'cloudflare_r2':
        result = await uploadToS3(htmlToUpload, subDomain, credential, campaign);
        break;
      case 'netlify':
        result = await uploadToNetlify(htmlToUpload, subDomain, credential);
        break;
      case 'custom_domain':
        const sitePath = path.join(USER_SITES_BASE_DIR, targetDomain, subDomain);
        try {
          fs.mkdirSync(sitePath, { recursive: true });
          fs.writeFileSync(path.join(sitePath, 'index.html'), htmlToUpload);
          result = { success: true, url: `http://${subDomain}.${targetDomain}` };
        } catch (fsErr) {
          result = { success: false, error: fsErr.message };
        }
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    if (!result.success) throw new Error(result.error || 'Upload failed');

    // Save — store generatedJson but NOT htmlContent
    staticWebsite.status = 'Live';
    staticWebsite.url = result.url;
    staticWebsite.generatedJson = contentJson;
    staticWebsite.headerCode = headerCode;
    if (result.siteId) staticWebsite.siteId = result.siteId;
    await staticWebsite.save();

    return { url: result.url, staticWebsiteId: staticWebsite._id };

  } catch (error) {
    console.error(`Static job ${job.id} failed:`, error.message);
    staticWebsite.status = 'Failed';
    await staticWebsite.save();
    throw error;
  }
}, { connection });

staticWorker.on('completed', (job, result) => {
  console.log(`Static job ${job.id} completed:`, result);
});

staticWorker.on('failed', (job, err) => {
  console.log(`Static job ${job.id} failed:`, err.message);
});

module.exports = { deployQueue, staticDeployQueue };