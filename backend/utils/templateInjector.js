/**
 * Injects CSV and AI-generated content into an HTML template.
 * @param {string} htmlContent - The base HTML with {{key}} placeholders.
 * @param {object} csvRow - Data from the CSV row (may be empty for redeploys).
 * @param {object} contentJson - AI-generated JSON content.
 * @returns {string} - The final HTML.
 */
function injectIntoTemplate(htmlContent, csvRow = {}, contentJson = {}) {
  let html = htmlContent;

  // First pass — inject CSV values (images, urls, prices etc)
  for (const key in csvRow) {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), csvRow[key] || '');
  }

  // Second pass — inject AI generated JSON content
  for (const [key, value] of Object.entries(contentJson)) {
    html = html.replace(
      new RegExp(`{{${key}}}`, 'g'),
      String(value || '').replace(/<script[\s\S]*?<\/script>/gi, '')
    );
  }

  // Log any slots that were not filled
  const unfilled = [...html.matchAll(/{{([a-zA-Z0-9_]+)}}/g)];
  if (unfilled.length > 0) {
    console.warn('[STATIC] Unfilled slots:', unfilled.map(m => m[1]));
  }

  return html;
}

module.exports = { injectIntoTemplate };
