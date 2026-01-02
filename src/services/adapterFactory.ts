import { IAdapter } from './adapters/IAdapter';
import { RestAdapter } from './adapters/RestAdapter';

// Permanently set to 'rest' mode - no local fallback
// This ensures we fail fast if the backend is down rather than silently using local storage
const adapter: IAdapter = new RestAdapter();

export const getAdapter = (): IAdapter => adapter;


