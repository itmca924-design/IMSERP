(function (window) {
  window.__env = window.__env || {};
  var isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '80' && window.location.port !== '443' && window.location.port !== '';
  if (isLocal) {
    window.__env.API_BASE_URL = 'http://localhost:5000';
    window.__env.API_URL = 'http://localhost:5000/api';
    window.__env.BIOMETRIC_WEBHOOK_URL = 'http://localhost:5000/api/attendance/biometric/hikvision';
  } else {
    var origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://localhost:5000';
    window.__env.API_BASE_URL = origin;
    window.__env.API_URL = origin + '/api';
    window.__env.BIOMETRIC_WEBHOOK_URL = origin + '/api/attendance/biometric/hikvision';
  }
}(this));
