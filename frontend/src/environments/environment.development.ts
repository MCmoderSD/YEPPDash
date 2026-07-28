// Used by the "development" build configuration (ng serve's default) via the fileReplacements
// entry in angular.json. Matches the backend's https launch profile (PLAN.md#auth) and ng
// serve's default port — see backend/YEPPDash.Api/appsettings.Development.json for the
// matching AllowedFrontendOrigins/CORS entry.
export const environment = {
  apiBaseUrl: 'https://localhost:7218',
  frontendBaseUrl: 'https://localhost:4200',
};
