/**
 * Export Registry — public surface (T-05).
 *
 * Consumers (Export Center, Backup/Restore/Migration Centers, the future export API)
 * import from '@/lib/export' and nothing deeper. Entity declarations arrive in T-06…T-11
 * and will be re-exported here as `REGISTRY`.
 */
export type {
  ColumnType,
  PiiClass,
  ColumnDescriptor,
  ExportDomain,
  ExportFormat,
  EntityScope,
  EntityNature,
  BackupPolicy,
  EntityDescriptor,
  ExportRegistry,
  RegistryProblem,
} from './registry.types';

export {
  ROLE_RANK,
  roleAtLeast,
  findCycle,
  topoOrder,
  validateRegistry,
} from './registry.types';

export {
  REGISTRY,
  getEntity,
  entitiesInDomain,
  backupEntities,
  restorableEntities,
} from './registry';
