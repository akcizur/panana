function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const view = String(params.view || '').trim() === 'pack' ? 'pack' : 'dashboard';
  let packId = '';
  if (view === 'pack') {
    try { packId = validatePackId_(params.id); } catch (ignored) { packId = ''; }
  }
  const template = HtmlService.createTemplateFromFile('Index');
  template.initialView = view;
  template.initialPackId = packId;
  return template.evaluate()
    .setTitle(APP_CONFIG.NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function include_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
