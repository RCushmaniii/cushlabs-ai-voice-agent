#!/usr/bin/env node
/**
 * Submit sitemap or single URL to Google Search Console — voice.cushlabs.ai
 *
 * Usage:
 *   node scripts/seo/gsc-submit-urls.mjs --sitemap          # Submit sitemap
 *   node scripts/seo/gsc-submit-urls.mjs --url https://...  # Submit single URL (Indexing API)
 */

import { google } from 'googleapis';
import { getAuthClient, getWebmasters, detectSiteProperty, SITE_URL } from './gsc-client.mjs';

const args = process.argv.slice(2);
const singleUrl = args.includes('--url') ? args[args.indexOf('--url') + 1] : null;
const submitSitemap = args.includes('--sitemap');
const isRemoved = args.includes('--removed');

async function submitToIndexingAPI(url, type = 'URL_UPDATED') {
  const auth = await getAuthClient();
  const indexing = google.indexing({ version: 'v3', auth });
  try {
    const res = await indexing.urlNotifications.publish({ requestBody: { url, type } });
    console.log(`  ✓ ${url} → ${res.data.urlNotificationMetadata?.latestUpdate?.type || 'submitted'}`);
    return true;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.log(`  ✗ ${url} → ${msg}`);
    return false;
  }
}

async function submitSitemapToGSC() {
  const siteUrl = await detectSiteProperty();
  if (!siteUrl) return;

  const webmasters = await getWebmasters();
  const sitemapUrl = `${SITE_URL}/sitemap.xml`;

  try {
    await webmasters.sitemaps.submit({ siteUrl, feedpath: sitemapUrl });
    console.log(`✓ Sitemap submitted: ${sitemapUrl}`);
  } catch (err) {
    console.error(`✗ Sitemap submission failed: ${err.message}`);
  }

  try {
    const res = await webmasters.sitemaps.list({ siteUrl });
    const sitemaps = res.data.sitemap || [];
    if (sitemaps.length) {
      console.log('\nRegistered sitemaps:');
      for (const sm of sitemaps) {
        console.log(`  - ${sm.path} (${sm.lastSubmitted || 'never'}) errors: ${sm.errors || 0}`);
      }
    }
  } catch (err) {
    console.error('Could not list sitemaps:', err.message);
  }
}

async function main() {
  console.log('Google URL Submission Tool — voice.cushlabs.ai\n');

  if (submitSitemap) {
    await submitSitemapToGSC();
    return;
  }

  if (singleUrl) {
    const type = isRemoved ? 'URL_DELETED' : 'URL_UPDATED';
    console.log(`Submitting ${singleUrl} (${type})...`);
    await submitToIndexingAPI(singleUrl, type);
    return;
  }

  console.log('Usage:');
  console.log('  --sitemap        Submit sitemap to GSC');
  console.log('  --url <url>      Submit single URL (Indexing API)');
  console.log('  --removed        (with --url) Notify URL removed');
}

main();
