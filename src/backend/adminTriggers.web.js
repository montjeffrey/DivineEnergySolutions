/**
 * src/backend/adminTriggers.web.js
 * TEMPORARY — delete after first successful sync.
 * Admin-only web method to manually trigger the Google Reviews sync.
 */
import { Permissions, webMethod } from 'wix-web-module';
import { syncReviewsToDatabase } from 'backend/googleReviewsSync';

export const runReviewSync = webMethod(
  Permissions.Admin,
  async () => syncReviewsToDatabase()
);
