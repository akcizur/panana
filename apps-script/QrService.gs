function validateAppBaseUrl_(url) {
  const value = String(url || '').trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(value)) {
    throw appError_('CONFIG.APP_BASE_URL musí být platná produkční Google Apps Script URL končící /exec.', 'CONFIG_ERROR');
  }
  return value;
}

function buildPackQrPayload_(packId) {
  const id = validatePackId_(packId);
  const baseUrl = validateAppBaseUrl_(configValue_('APP_BASE_URL'));
  return baseUrl + '?view=pack&id=' + encodeURIComponent(id);
}

function publicQrConfig_() {
  return {
    appBaseUrlConfigured: !!configValue_('APP_BASE_URL'),
    labelFormat: configValue_('QR_LABEL_FORMAT_DEFAULT') || APP_CONFIG.DEFAULT_LABEL_FORMAT,
    cameraScannerEnabled: configValue_('QR_ENABLE_CAMERA_SCANNER') === 'TRUE'
  };
}
