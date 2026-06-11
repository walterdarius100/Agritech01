import { SUPABASE_ANON_KEY, SUPABASE_CONFIG, SUPABASE_URL } from '../config/supabase-config.js';

const SUPABASE_SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const PLACEHOLDER_VALUES = new Set([
  '',
  'YOUR_SUPABASE_URL',
  'YOUR_SUPABASE_ANON_KEY',
  'YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY'
]);
const SECRET_PATTERNS = [
  /sb_secret_/i,
  /service[_-]?role/i,
  /SUPABASE_SERVICE_ROLE_KEY/i,
  /DATABASE_URL/i,
  /JWT_SECRET/i,
  /postgres(ql)?:\/\//i,
  /private[_-]?key/i
];

let supabaseClient = null;
let sdkLoadPromise = null;

const state = {
  configured: false,
  initialized: false,
  sdkLoaded: false,
  projectHost: '',
  error: '',
  keyPreview: ''
};

function pickConfigValue(primary, fallback) {
  return typeof primary === 'string' && primary.trim() ? primary.trim() : (typeof fallback === 'string' ? fallback.trim() : '');
}

export function maskSupabaseKey(key = '') {
  if (!key) return '';
  if (key.length <= 12) return `${key.slice(0, 3)}…${key.slice(-2)}`;
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

function normalizeProjectHost(url) {
  try {
    return new URL(url).host;
  } catch (_) {
    return '';
  }
}

function isSupabaseUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co');
  } catch (_) {
    return false;
  }
}

function hasPlaceholder(value) {
  return PLACEHOLDER_VALUES.has(value) || value.includes('YOUR_SUPABASE_');
}

function hasSecret(value) {
  return SECRET_PATTERNS.some((pattern) => pattern.test(value));
}

export function getSupabaseRawConfig() {
  const url = pickConfigValue(SUPABASE_URL, SUPABASE_CONFIG?.url);
  const anonKey = pickConfigValue(SUPABASE_ANON_KEY, SUPABASE_CONFIG?.anonKey);
  return { url, anonKey };
}

export function validateSupabaseConfig() {
  const { url, anonKey } = getSupabaseRawConfig();
  state.configured = false;
  state.initialized = Boolean(supabaseClient);
  state.projectHost = normalizeProjectHost(url);
  state.keyPreview = anonKey ? maskSupabaseKey(anonKey) : '';
  state.error = '';

  if (!url || !anonKey || hasPlaceholder(url) || hasPlaceholder(anonKey)) {
    state.error = 'Supabase config missing';
    console.info('Supabase config missing');
    return { ok: false, reason: state.error, url, anonKey: '' };
  }

  if (!isSupabaseUrl(url)) {
    state.error = 'Supabase URL invalid';
    console.warn('Supabase config missing');
    return { ok: false, reason: state.error, url, anonKey: '' };
  }

  if (hasSecret(anonKey)) {
    state.error = 'Supabase key rejected: secret key detected';
    state.keyPreview = '';
    console.error('Supabase key rejected: secret key detected');
    return { ok: false, reason: state.error, url, anonKey: '' };
  }

  state.configured = true;
  state.error = '';
  console.info('Supabase config loaded', { project: state.projectHost, key: state.keyPreview });
  return { ok: true, reason: '', url, anonKey };
}

async function loadSupabaseSdk() {
  if (window.supabase?.createClient) {
    state.sdkLoaded = true;
    console.info('Supabase SDK loaded');
    return window.supabase;
  }

  if (!sdkLoadPromise) {
    sdkLoadPromise = import(SUPABASE_SDK_URL)
      .then((module) => {
        state.sdkLoaded = true;
        console.info('Supabase SDK loaded');
        return module;
      })
      .catch((error) => {
        state.sdkLoaded = false;
        state.error = 'Supabase SDK not loaded';
        console.error('Supabase SDK not loaded', error?.message || error);
        return null;
      });
  }

  return sdkLoadPromise;
}

export async function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  const config = validateSupabaseConfig();
  if (!config.ok) return null;

  const sdk = await loadSupabaseSdk();
  const createClient = sdk?.createClient;
  if (!createClient) {
    state.initialized = false;
    return null;
  }

  supabaseClient = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  state.initialized = true;
  state.error = '';
  console.info('Supabase client initialized', { project: state.projectHost });
  return supabaseClient;
}

export function getSupabaseDiagnostics() {
  validateSupabaseConfig();
  return { ...state, initialized: Boolean(supabaseClient) };
}

export async function getSupabaseSession() {
  const client = await getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data?.session || null;
}
