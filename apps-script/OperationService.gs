/** Serializes a critical mutation and blocks duplicate submissions. Logs recoverable partial failures. */
function withOperation_(type, idempotencyKey, payload, callback) {
  const actor = currentActor_();
  const key = requiredText_(idempotencyKey, 'Idempotency_Key', 120);
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(key)) throw appError_('Neplatný Idempotency_Key.', 'VALIDATION_ERROR');
  const hashBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(payload || {}), Utilities.Charset.UTF_8);
  const payloadHash = hashBytes.map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw appError_('Systém právě zpracovává jinou operaci. Zkuste to znovu.', 'BUSY');
  let op = null;
  try {
    const previous = findRecord_('OPERATIONS_LOG', 'Idempotency_Key', key);
    if (previous) {
      if (String(previous.Payload_Hash) !== payloadHash) throw appError_('Idempotency key byl použit pro jiný požadavek.', 'IDEMPOTENCY_CONFLICT');
      if (previous.Status === 'COMPLETED') return { ok: true, duplicate: true, entityId: String(previous.Entity_ID || ''), operationId: previous.Operation_ID };
      throw appError_('Tato operace už byla zahájena a vyžaduje kontrolu v OPERATIONS_LOG. Neopakujte ji automaticky.', 'RECOVERY_REQUIRED');
    }
    op = {
      Operation_ID: uuid_(),
      Idempotency_Key: key,
      Operation_Type: type,
      Entity_ID: '',
      Requested_By: actor.email,
      Started_At: new Date(),
      Completed_At: '',
      Status: 'STARTED',
      Payload_Hash: payloadHash,
      Error_Code: '',
      Error_Message: ''
    };
    appendRecord_('OPERATIONS_LOG', op);
    op._rowNumber = sheet_('OPERATIONS_LOG').getLastRow();
    const result = callback({ operationId: op.Operation_ID, actor: actor });
    const entityId = result && result.entityId ? String(result.entityId) : '';
    updateRecord_('OPERATIONS_LOG', 'Operation_ID', op.Operation_ID, { Entity_ID: entityId, Completed_At: new Date(), Status: 'COMPLETED', Error_Code: '', Error_Message: '' });
    return { ok: true, duplicate: false, operationId: op.Operation_ID, entityId: entityId, data: result && result.data !== undefined ? result.data : null };
  } catch (err) {
    if (op) {
      const status = ['VALIDATION_ERROR', 'NOT_FOUND', 'FORBIDDEN', 'CONFIG_ERROR', 'AUTH_ERROR', 'IDEMPOTENCY_CONFLICT'].indexOf(err.code) >= 0 ? 'FAILED' : 'RECOVERY_REQUIRED';
      try {
        updateRecord_('OPERATIONS_LOG', 'Operation_ID', op.Operation_ID, {
          Completed_At: new Date(), Status: status,
          Error_Code: String(err.code || 'UNEXPECTED_ERROR'),
          Error_Message: String(err.message || err).slice(0, 500)
        });
      } catch (logError) {}
    }
    throw err;
  } finally {
    lock.releaseLock();
  }
}
