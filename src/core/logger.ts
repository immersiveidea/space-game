import log from 'loglevel';

// Check URL query parameter for log level override
const urlParams = new URLSearchParams(window.location.search);
const queryLevel = urlParams.get('loglevel');
if (queryLevel && ['debug', 'info', 'warn', 'error'].includes(queryLevel)) {
    localStorage.setItem('log-level', queryLevel);
}

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
