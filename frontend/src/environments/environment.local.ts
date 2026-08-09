// A production build pointed at the local backend, so the dashboard can be signed into and measured
// before anything is deployed. Everything about the bundle is what production ships — optimized,
// hashed, prerendered — only the addresses differ.
//
// production stays true on purpose. It is what isDashHost() keys off, and here it resolves to
// `localhost`, so this build behaves exactly like the dash subdomain: the dashboard sits at the
// root and the marketing pages are not part of it. Measure those against the ordinary production
// build instead, which is the other half of the same split.
export const environment = {
  production: true,
  botUserId: '644984959',
  apiBaseUrl: 'https://localhost:7218',
  frontendBaseUrl: 'https://localhost:4000',

  // Deliberately not this origin: the auth guard sends a visitor without a session here, and
  // pointing it back at the dashboard would bounce between the two forever.
  marketingBaseUrl: 'https://www.yeppbot.com'
};
