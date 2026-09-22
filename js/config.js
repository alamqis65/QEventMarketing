// EventQ - Frontend configuration
//
// Direct-to-backend (what you described for testing):
window.API_BASE = '/EventQ/api';

// Once IIS + ARR reverse proxy is set up on 90.23 (recommended for production -
// avoids CORS and http/https mixed-content issues), switch to a relative path
// and let IIS forward /api/* to 192.168.90.93:3000 internally:
// window.API_BASE = '/api';
