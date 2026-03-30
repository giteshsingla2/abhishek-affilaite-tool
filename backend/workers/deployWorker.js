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
const { uploadToS3 } = require('../services/uploaders/s3Adapter');
const { uploadToNetlify } = require('../services/uploaders/netlifyAdapter');

const USER_SITES_BASE_DIR = process.env.USER_SITES_BASE_DIR || '/var/www/user_sites';

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
};

const deployQueue = new Queue('deploy-queue', { connection });

// ============================================================
// DESIGN DNA ENGINE
// ============================================================

const DESIGN_DNA = {
  colorPalettes: [
    {
      name: 'Ocean blue',
      primary: '#0077B6', secondary: '#023E8A', accent: '#90E0EF',
      bg: '#03045E', text: '#FFFFFF', subtle: '#CAF0F8',
    },
    {
      name: 'Sunset orange',
      primary: '#E76F51', secondary: '#264653', accent: '#F4A261',
      bg: '#1A1A2E', text: '#FFFFFF', subtle: '#FFDDD2',
    },
    {
      name: 'Forest green',
      primary: '#2D6A4F', secondary: '#1B4332', accent: '#95D5B2',
      bg: '#081C15', text: '#FFFFFF', subtle: '#D8F3DC',
    },
    {
      name: 'Gold luxury',
      primary: '#D4A017', secondary: '#1A1A1A', accent: '#FFD700',
      bg: '#0D0D0D', text: '#FFFFFF', subtle: '#FFF8DC',
    },
    {
      name: 'Crimson power',
      primary: '#C1121F', secondary: '#780000', accent: '#FF6B6B',
      bg: '#03071E', text: '#FFFFFF', subtle: '#FFE8E8',
    },
    {
      name: 'Purple galaxy',
      primary: '#7B2FBE', secondary: '#240046', accent: '#E0AAFF',
      bg: '#10002B', text: '#FFFFFF', subtle: '#F0E6FF',
    },
    {
      name: 'Teal emerald',
      primary: '#06D6A0', secondary: '#073B4C', accent: '#00B4D8',
      bg: '#012A36', text: '#FFFFFF', subtle: '#CCFBF1',
    },
    {
      name: 'Rose gold',
      primary: '#C9184A', secondary: '#590D22', accent: '#FF758F',
      bg: '#2D0012', text: '#FFFFFF', subtle: '#FFD6E0',
    },
    {
      name: 'Slate minimal',
      primary: '#334155', secondary: '#0F172A', accent: '#38BDF8',
      bg: '#F8FAFC', text: '#0F172A', subtle: '#E2E8F0',
    },
    {
      name: 'Amber fire',
      primary: '#D97706', secondary: '#451A03', accent: '#FCD34D',
      bg: '#1C0A00', text: '#FFFFFF', subtle: '#FEF3C7',
    },
    {
      name: 'Cyan futurist',
      primary: '#00B4D8', secondary: '#023E8A', accent: '#48CAE4',
      bg: '#03045E', text: '#FFFFFF', subtle: '#CAF0F8',
    },
    {
      name: 'Olive earth',
      primary: '#6B7C3E', secondary: '#2C2C0E', accent: '#BFD96F',
      bg: '#1A1A00', text: '#FFFFFF', subtle: '#F0F4DA',
    },
    {
      name: 'Midnight indigo',
      primary: '#4361EE', secondary: '#3A0CA3', accent: '#7209B7',
      bg: '#10002B', text: '#FFFFFF', subtle: '#E0AAFF',
    },
    {
      name: 'Ice nordic',
      primary: '#4CC9F0', secondary: '#4361EE', accent: '#F72585',
      bg: '#F0F4FF', text: '#0D1B2A', subtle: '#E2EAFF',
    },
    {
      name: 'Coral reef',
      primary: '#FF6B6B', secondary: '#C9184A', accent: '#FFE66D',
      bg: '#1A0A0A', text: '#FFFFFF', subtle: '#FFE8E8',
    },
    {
      name: 'Sage wellness',
      primary: '#52B788', secondary: '#1B4332', accent: '#D8F3DC',
      bg: '#F0FFF4', text: '#1B4332', subtle: '#E9F5EE',
    },
  ],

  designStyles: [
    {
      name: 'Glassmorphism',
      css: `
        Cards use backdrop-filter: blur(16px) with semi-transparent backgrounds rgba(255,255,255,0.10).
        Borders are 1px rgba(255,255,255,0.20). Heavy frosted glass panels throughout.
        Hero background is a vivid gradient mesh behind a floating glass card.
        Buttons have glass effect with subtle colored glow on hover.
        Section dividers use semi-transparent lines. Everything feels airy and layered.`,
    },
    {
      name: 'Neomorphism',
      css: `
        Background is a single flat muted color (light: #E0E5EC or dark: #1E1E2E).
        ALL elements use double box-shadow: outset light shadow top-left, dark shadow bottom-right.
        Example: box-shadow: 6px 6px 12px rgba(0,0,0,0.15), -6px -6px 12px rgba(255,255,255,0.07).
        Buttons look pressed into the surface using inset shadows on :active.
        No harsh borders anywhere. Tactile 3D feel. Cards appear to float off the surface.`,
    },
    {
      name: 'Dark luxury',
      css: `
        Very dark near-black background (#0A0A0A or #0D0D0D).
        Gold or platinum accent color used for ALL headings, borders, and highlights.
        Thin 1px gold borders on every card. Fine gold gradient lines as section dividers.
        Serif heading font required. Premium editorial magazine feel.
        Subtle gold shimmer animation on hero headline using CSS gradient animation.`,
    },
    {
      name: 'Clean minimal',
      css: `
        Maximum white space — generous padding everywhere (80px+ sections).
        Pure white or very light background. ONE strong accent color only, used sparingly.
        Large bold sans-serif headlines. Zero decorative elements anywhere.
        Strict grid-based layout. Buttons are simple outlined or flat.
        Content breathes. Trust and clarity above all else.`,
    },
    {
      name: 'Bold editorial',
      css: `
        High contrast — black and white base with ONE vivid accent color.
        Oversized typography — hero headline 72px minimum, extremely bold (900 weight).
        Asymmetric layouts deliberately. Large full-bleed image sections.
        Bold thick horizontal rules between sections. Magazine newspaper aesthetic.
        Text deliberately overlaps images in hero. Dramatic and confident.`,
    },
    {
      name: 'Gradient vivid',
      css: `
        Every section has its OWN bold gradient — vary direction per section (135deg, 45deg, etc).
        Mesh gradient hero background. Gradient text on main headlines using background-clip: text.
        Bright saturated colors. Glowing colored box-shadows on buttons and cards.
        Gradient borders on feature cards using border-image or pseudo-element trick.
        Energy and excitement. Nothing is flat or neutral.`,
    },
    {
      name: 'Retro Y2K',
      css: `
        Chunky 3px solid black borders on ALL elements — cards, buttons, sections.
        Hard offset box-shadows: box-shadow: 4px 4px 0px #000000 (no blur).
        Bright pop colors — yellows, hot pinks, electric greens mixed boldly.
        Sticker-style badges with jagged or star burst shapes using clip-path.
        Fun chunky display font for headings. Playful and nostalgic energy.`,
    },
    {
      name: 'Nature organic',
      css: `
        Very soft rounded corners everywhere — border-radius 24px to 48px on cards.
        Earthy warm color palette. Organic blob SVG shapes as background decorations.
        Gentle subtle gradients — never harsh. Lots of breathing room and padding.
        Feels calm, trustworthy, health and wellness oriented.
        Soft sans-serif fonts. Section backgrounds use very subtle texture patterns.`,
    },
    {
      name: 'Cyberpunk neon',
      css: `
        Dark or black background always. Neon glowing colors — cyan, magenta, lime green.
        Text and borders glow using text-shadow and box-shadow with colored blur.
        Diagonal angled design elements — skewed sections using clip-path or transform: skewY.
        Monospace or condensed tech font for headings. Grid line background pattern.
        Futuristic and high-energy. Feels like a sci-fi interface.`,
    },
    {
      name: 'Soft pastel',
      css: `
        Very light pastel backgrounds — pale pink, lavender, mint, peach rotated per section.
        Rounded pill shapes everywhere — buttons especially radius: 50px.
        Soft drop shadows — no harsh edges. Watercolor or gradient blob decorations.
        Friendly approachable font pairing. Ideal for health beauty wellness products.
        Colors never saturated — always tinted toward white. Gentle and inviting.`,
    },
  ],

  heroLayouts: [
    'SPLIT LAYOUT: Headline, subheadline, bullet benefits, and CTA button stacked on the LEFT half (50%). Large product image with drop shadow on the RIGHT half (50%). Vertically centered.',
    'CENTERED LAYOUT: All hero content centered. Giant headline top. Subheadline below. CTA button below that. Product image displayed large and centered BELOW the CTA inside a styled showcase container.',
    'FULL-WIDTH OVERLAY: Large product/lifestyle image as full hero background. Dark semi-transparent overlay (rgba 0,0,0,0.55). White text headline and CTA overlaid centered on top.',
    'REVERSE SPLIT: Product image large on the LEFT half. Headline, benefits, and CTA stacked on the RIGHT half. Creates visual balance opposite of standard split.',
    'MAGAZINE GRID: Giant oversized headline spanning top-left 60%. Product image top-right 40%. Subheadline and CTA span full width below as a second row. Editorial feel.',
    'FLOATING CARD HERO: Full gradient or image background. A floating card (glassmorphism or elevated white) centered containing headline, subheadline, rating stars, and CTA. Card appears to float above the background.',
  ],

  typographyPairings: [
    {
      heading: "'Playfair Display', serif",
      body: "'Inter', sans-serif",
      feel: 'elegant editorial — classic meets modern',
      import: 'Playfair+Display:wght@700;900&family=Inter:wght@400;500;600',
    },
    {
      heading: "'Montserrat', sans-serif",
      body: "'Open Sans', sans-serif",
      feel: 'modern clean professional',
      import: 'Montserrat:wght@700;800;900&family=Open+Sans:wght@400;500;600',
    },
    {
      heading: "'Oswald', sans-serif",
      body: "'Lato', sans-serif",
      feel: 'strong bold impactful',
      import: 'Oswald:wght@600;700&family=Lato:wght@400;700',
    },
    {
      heading: "'Merriweather', serif",
      body: "'Source Sans Pro', sans-serif",
      feel: 'trustworthy authoritative',
      import: 'Merriweather:wght@700;900&family=Source+Sans+Pro:wght@400;600',
    },
    {
      heading: "'Raleway', sans-serif",
      body: "'Nunito', sans-serif",
      feel: 'friendly premium approachable',
      import: 'Raleway:wght@700;800;900&family=Nunito:wght@400;600;700',
    },
    {
      heading: "'Bebas Neue', sans-serif",
      body: "'Roboto', sans-serif",
      feel: 'impact sports energy bold',
      import: 'Bebas+Neue&family=Roboto:wght@400;500;700',
    },
    {
      heading: "'Cormorant Garamond', serif",
      body: "'Jost', sans-serif",
      feel: 'luxury refined high-end',
      import: 'Cormorant+Garamond:wght@600;700&family=Jost:wght@400;500;600',
    },
    {
      heading: "'Space Grotesk', sans-serif",
      body: "'DM Sans', sans-serif",
      feel: 'tech forward startup modern',
      import: 'Space+Grotesk:wght@600;700&family=DM+Sans:wght@400;500',
    },
    {
      heading: "'Anton', sans-serif",
      body: "'Barlow', sans-serif",
      feel: 'aggressive high energy performance',
      import: 'Anton&family=Barlow:wght@400;500;600',
    },
    {
      heading: "'Libre Baskerville', serif",
      body: "'Mulish', sans-serif",
      feel: 'academic credible medical health',
      import: 'Libre+Baskerville:wght@700&family=Mulish:wght@400;600;700',
    },
  ],

  uiMotifs: [
    'PILL BUTTONS: All buttons border-radius: 50px. Feature cards radius: 24px. Testimonial cards radius: 32px. Soft and approachable. Icon circles for feature icons.',
    'SHARP ANGULAR: All buttons border-radius: 2px. Cards radius: 4px. Professional precise corporate feel. Use thin divider lines between sections.',
    'GHOST OUTLINED: Primary buttons are outlined (transparent bg, colored border 2px, colored text). Fill on hover. Cards have subtle left-border accent stripe (4px). Editorial feel.',
    'ICON-FORWARD: Large icon or emoji displayed ABOVE each feature card headline. Benefit icons in a 3-column icon grid. CTA section has a large centered icon above headline.',
    'NUMBERED STEPS: Benefits and features presented as numbered steps (01, 02, 03) with large displayed numbers. Timeline style. Trust-building sequential narrative.',
    'ALTERNATING SECTIONS: Features section alternates every row — image LEFT text RIGHT, then text LEFT image RIGHT. Creates dynamic visual rhythm. Each alternating pair is a full-width row.',
    'CARD GRID HEAVY: Most content lives inside elevated cards with shadows. Features in 3-column card grid. Testimonials in 2-column card grid. Pricing in 3-column card row.',
    'FULL-WIDTH BANDS: Each section is a full-width colored band. Alternating dark/light bands. Content inside each band is max-width contained and centered.',
  ],
};

/**
 * Generates a fully random Design DNA — different every single deployment.
 */
function getDesignDNA() {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const palette = pick(DESIGN_DNA.colorPalettes);
  const style = pick(DESIGN_DNA.designStyles);
  const hero = pick(DESIGN_DNA.heroLayouts);
  const typo = pick(DESIGN_DNA.typographyPairings);
  const motif = pick(DESIGN_DNA.uiMotifs);

  return {
    dna: `
===========================================================
MANDATORY DESIGN DNA — FOLLOW EVERY INSTRUCTION BELOW EXACTLY
===========================================================

GOOGLE FONTS IMPORT (MUST be first thing inside <head>):
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${typo.import}&display=swap" rel="stylesheet">

COLOR PALETTE: "${palette.name}"
  Primary color   → ${palette.primary}   (headlines, main CTA buttons, key accents)
  Secondary color → ${palette.secondary}  (section backgrounds, dark fills)
  Accent color    → ${palette.accent}    (highlights, badges, hover states, underlines)
  Page background → ${palette.bg}        (main body background color)
  Body text       → ${palette.text}      (all paragraph and body text)
  Subtle fills    → ${palette.subtle}    (testimonial bg, light tint sections)

DESIGN STYLE: "${style.name}"
${style.css}

HERO SECTION LAYOUT:
  ${hero}

TYPOGRAPHY:
  Heading font → ${typo.heading}   (use for ALL h1 h2 h3 headings)
  Body font    → ${typo.body}      (use for ALL paragraphs, labels, buttons)
  Design feel  → ${typo.feel}

UI MOTIF:
  ${motif}

ABSOLUTE RULES — NEVER VIOLATE THESE:
  1. Apply the design style to EVERY section — not just hero. Consistent throughout.
===========================================================
`,
    summary: `${palette.name} | ${style.name} | ${typo.feel} | ${motif.split(':')[0]}`,
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

const generateHtml = async (systemPrompt, row) => {
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
      model: process.env.OPENROUTER_MODEL,
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
  const { platform, credentialId, templateId, row, campaignId, domainName: dynamicDomain } = job.data;
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
    const htmlContent = await generateHtml(template.systemPrompt, row);
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

module.exports = { deployQueue };