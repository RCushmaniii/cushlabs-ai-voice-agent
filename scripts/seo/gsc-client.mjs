/**
 * Google Search Console API Client — voice.cushlabs.ai
 *
 * Authenticated access to GSC for sitemap submission and URL inspection.
 *
 * Credentials: GOOGLE_SA_KEY_BASE64 in .env (base64-encoded service-account JSON).
 * Service account: seo-api-access@seo-automation-489217.iam.gserviceaccount.com
 * (Same SA covers cushlabs.ai, voice.cushlabs.ai, nyenglishteacher.com, marketsignal.cushlabs.ai)
 */

import { google } from 'googleapis';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', override: true });
loadEnv({ path: '.env' });

export const SITE_URL = 'https://voice.cushlabs.ai';
export const SITE_PROPERTY = 'sc-domain:voice.cushlabs.ai';
export const SITE_PROPERTY_URL = 'https://voice.cushlabs.ai/';

function decodeCredentials() {
  const b64 = process.env.GOOGLE_SA_KEY_BASE64;
  if (!b64) {
    throw new Error(
      'GOOGLE_SA_KEY_BASE64 is not set. Add the base64-encoded service-account JSON to .env (gitignored).'
    );
  }
  try {
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  } catch (err) {
    throw new Error(
      `Failed to decode GOOGLE_SA_KEY_BASE64: ${err.message}. ` +
      `Verify the value is a single-line base64 of a valid service-account JSON.`
    );
  }
}

let _authClient = null;

export async function getAuthClient() {
  if (_authClient) return _authClient;

  const credentials = decodeCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/webmasters',
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/indexing',
    ],
  });
  _authClient = await auth.getClient();
  return _authClient;
}

export async function getWebmasters() {
  const auth = await getAuthClient();
  return google.webmasters({ version: 'v3', auth });
}

export async function detectSiteProperty() {
  const webmasters = await getWebmasters();
  try {
    const res = await webmasters.sites.list();
    const sites = res.data.siteEntry || [];
    console.log('Available GSC properties:');
    sites.forEach((s) => console.log(`  - ${s.siteUrl} (${s.permissionLevel})`));

    const match = sites.find(
      (s) => s.siteUrl === SITE_PROPERTY || s.siteUrl === SITE_PROPERTY_URL
    );
    if (match) {
      console.log(`\nUsing property: ${match.siteUrl}`);
      return match.siteUrl;
    }
    console.log(`\n${SITE_PROPERTY} not found.`);
    return null;
  } catch (err) {
    console.error('Error listing sites:', err.message);
    return null;
  }
}
