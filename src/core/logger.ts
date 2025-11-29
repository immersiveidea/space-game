import log from 'loglevel';

// Check localStorage for custom level (enables production debugging)
const storedLevel = localStorage.getItem('log-level');

// Set level: localStorage override > environment default
if (storedLevel) {
    log.setLevel(storedLevel as log.LogLevelDesc);
} else {
    const isDev = window.location.hostname === 'localhost' ||
                  window.location.hostname.includes('dev.');
    log.setLevel(isDev ? 'debug' : 'warn');
}

export default log;
