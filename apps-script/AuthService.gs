const ROLE_VALUES = Object.freeze(['ADMIN', 'VEDOUCI', 'SKLAD', 'VYROBA', 'READONLY']);
const ACTION_ROLES = Object.freeze({
  dashboard: ROLE_VALUES,
  pack_read: ROLE_VALUES,
  history: ROLE_VALUES,
  sklad: ['ADMIN', 'VEDOUCI', 'SKLAD'],
  pack_receive: ['ADMIN', 'VEDOUCI', 'SKLAD'],
  pack_move: ['ADMIN', 'VEDOUCI', 'SKLAD'],
  pack_use: ['ADMIN', 'VEDOUCI', 'SKLAD', 'VYROBA'],
  pack_empty: ['ADMIN', 'VEDOUCI', 'SKLAD'],
  qr_print: ['ADMIN', 'VEDOUCI', 'SKLAD'],
  vyroba: ['ADMIN', 'VEDOUCI', 'VYROBA'],
  baleni: ['ADMIN', 'VEDOUCI', 'VYROBA'],
  expedition: ['ADMIN', 'VEDOUCI'],
  config: ['ADMIN', 'VEDOUCI'],
  user_admin: ['ADMIN']
});

function currentActor_() {
  let email = '';
  try { email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase(); } catch (ignored) {}
  if (!email) throw appError_('Google Apps Script neposkytl identitu přihlášeného uživatele. Přístup je odmítnut; zkontrolujte režim nasazení.', 'AUTH_ERROR');
  const user = records_('DB_UZIVATELE').find(function(row) {
    return String(row.Email || '').trim().toLowerCase() === email && boolValue_(row.Aktivni);
  });
  if (!user) throw appError_('Účet ' + email + ' není aktivně povolen v DB_UZIVATELE.', 'FORBIDDEN');
  const role = String(user.Role || '').trim().toUpperCase();
  if (ROLE_VALUES.indexOf(role) === -1) throw appError_('Účet má neplatnou roli. Kontaktujte správce.', 'FORBIDDEN');
  return { email: email, role: role };
}

function requireAction_(action) {
  const actor = currentActor_();
  const allowed = ACTION_ROLES[action];
  if (!allowed || allowed.indexOf(actor.role) === -1) throw appError_('Tato akce není pro vaši roli povolena.', 'FORBIDDEN');
  return actor;
}

/** Run manually in the Apps Script editor only. Never expose the user's email as a public API. */
function provisionFirstAdmin_() {
  const email = Session.getActiveUser().getEmail().trim().toLowerCase();
  if (!email) throw new Error('Nelze určit Google účet. Spusťte funkci pod autorizovaným účtem.');
  const users = records_('DB_UZIVATELE');
  if (users.some(function(user) { return String(user.Role).toUpperCase() === 'ADMIN' && boolValue_(user.Aktivni); })) {
    throw new Error('Aktivní ADMIN už existuje. Další správce se přidává autorizovaným postupem.');
  }
  appendRecord_('DB_UZIVATELE', { Email: email, Role: 'ADMIN', Aktivni: true, Created_At: new Date(), Updated_At: new Date() });
  return 'První ADMIN vytvořen: ' + email;
}
