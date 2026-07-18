const DEFAULT_PERSISTENCE_WARNING = 'A sessão continua ativa, mas a última alteração não foi salva no disco.';

export function readVttPersistenceWarning(state, role) {
  if (role !== 'master' || state?.persistence?.saved !== false) return '';

  const message = typeof state.persistence.message === 'string'
    ? state.persistence.message.trim().slice(0, 500)
    : '';
  return message || DEFAULT_PERSISTENCE_WARNING;
}
