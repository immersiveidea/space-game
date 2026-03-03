const urlParams = new URLSearchParams(window.location.search);

export const useWebGPU = urlParams.get('webGPU') === 'true';
