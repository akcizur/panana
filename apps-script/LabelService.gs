function requestPackLabel_(packId, reprint, actor) {
  const id = validatePackId_(packId);
  const pack = findRecord_('SKLAD_SUROVIN', 'Pack_ID', id);
  if (!pack) throw appError_('Pack nebyl nalezen.', 'NOT_FOUND');
  const payload = buildPackQrPayload_(id);
  const format = configValue_('QR_LABEL_FORMAT_DEFAULT') || APP_CONFIG.DEFAULT_LABEL_FORMAT;
  appendRecord_('QR_LABEL_LOG', {
    Label_Event_ID: uuid_(),
    Timestamp: new Date(),
    Pack_ID: id,
    Action: reprint ? 'REPRINT_REQUESTED' : 'PRINT_REQUESTED',
    Payload_Mode: configValue_('QR_PAYLOAD_MODE') || APP_CONFIG.QR_MODE,
    Payload_Version: '1',
    App_Base_URL: configValue_('APP_BASE_URL'),
    Label_Format: format,
    User: actor.email,
    Note: 'Požadavek na tisk; fyzické vytištění nelze z prohlížeče garantovat.'
  });
  return {
    pack: publicRecord_(pack),
    surovinaName: surovinaName_(pack.Surovina_ID),
    payload: payload,
    format: format
  };
}
