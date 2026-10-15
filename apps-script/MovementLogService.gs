function logMovement_(event) {
  appendRecord_('POHYBY_LOG', {
    Movement_ID: uuid_(),
    Timestamp: new Date(),
    Entita_Typ: requiredText_(event.type, 'Entita_Typ', 40),
    Entita_ID: requiredText_(event.id, 'Entita_ID', 120),
    Action: requiredText_(event.action, 'Action', 60),
    Delta_Mnozstvi: event.delta == null ? '' : event.delta,
    Jednotka: event.unit || '',
    From_Box_Number: event.fromBox || '',
    From_Position: event.fromPosition || '',
    To_Box_Number: event.toBox || '',
    To_Position: event.toPosition || '',
    Reference_Type: event.referenceType || '',
    Reference_ID: event.referenceId || '',
    Operation_ID: event.operationId,
    User: event.user,
    Note: optionalText_(event.note, 500)
  });
}
