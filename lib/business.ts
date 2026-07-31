export const BUSINESS_NAME = "Rack in the Rockies";
export const BUSINESS_EMAIL = "hello@rackintherockies.com";
// Locale only, for website copy.
export const BUSINESS_LOCATION = "Denver, Colorado";
/** Canonical origin for links embedded in emails. No trailing slash. */
export const SITE_URL = "https://rackintherockies.com";
/**
 * CAN-SPAM requires a physical mailing address in every announcement email.
 * While this is null, real sends are refused server-side (see lib/sends.ts)
 * and test sends render a visible placeholder. Manual step P1 in the Phase 2
 * plan: replace null with the full address string to unblock sending.
 */
export const BUSINESS_MAILING_ADDRESS: string | null = null;
