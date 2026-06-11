import * as supabaseConfig from '../config/supabase-config.js';

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
  /secret/i,
  /private[_-]?key/i
];

let supabaseClient = null;
let initializationAttempted = false;

function readConfigValue(primaryValue, fallbackValue) {
  return String(primaryValue || fallbackValue || '').trim();
}

function isPlaceholder(value) {
  return PLACEHOLDER_VALUES.has(String(value || '').trim());
}

function isSupabaseUrl(value) {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(value);
}

function isSecretKey(value) {
  return SECRET_PATTERNS.some((pattern) => pattern.test(String(value || '')));
}

function maskKey(value) {
  const key = String(value || '');
  if (!key) return '';
  if (key.length <= 12) return `${key.slice(0, 3)}…${key.slice(-2)}`;
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

function getProjectHost(url) {
  try {
    return new URL(url).host;
  } catch (_error) {
    return 'Non détecté';
  }
}

export function getSupabaseDiagnostics() {
  const url = readConfigValue(supabaseConfig.SUPABASE_URL, supabaseConfig.SUPABASE_CONFIG?.url);
  const anonKey = readConfigValue(supabaseConfig.SUPABASE_ANON_KEY, supabaseConfig.SUPABASE_CONFIG?.anonKey);
  const hasPlaceholders = isPlaceholder(url) || isPlaceholder(anonKey);
  const hasSecretKey = isSecretKey(anonKey);
  const validUrl = isSupabaseUrl(url);
  const configured = Boolean(url && anonKey && !hasPlaceholders && !hasSecretKey && validUrl);

  return {
    configured,
    clientInitialized: Boolean(supabaseClient),
    hasPlaceholders,
    hasSecretKey,
    validUrl,
    projectHost: validUrl ? getProjectHost(url) : 'Non configuré',
    maskedKey: anonKey && !hasSecretKey ? maskKey(anonKey) : '',
    message: configured ? 'Supabase config loaded' : 'Supabase config missing'
  };
}

export async function getSupabaseClient() {
  const diagnostics = getSupabaseDiagnostics();

  if (diagnostics.hasSecretKey) {
    console.error('Supabase key rejected: secret key detected');
    return null;
  }

  if (!diagnostics.configured) {
    if (!initializationAttempted) console.warn('Supabase config missing');
    initializationAttempted = true;
    return null;
  }

  console.info('Supabase config loaded', {
    project: diagnostics.projectHost,
    key: diagnostics.maskedKey
  });

  if (supabaseClient) return supabaseClient;

  const sdk = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').catch((error) => {
    initializationAttempted = true;
    console.error('Supabase SDK load failed', error?.message || error);
    return null;
  });

  if (!sdk?.createClient) return null;
  console.info('Supabase SDK loaded');

  try {
    const url = readConfigValue(supabaseConfig.SUPABASE_URL, supabaseConfig.SUPABASE_CONFIG?.url).replace(/\/$/, '');
    const anonKey = readConfigValue(supabaseConfig.SUPABASE_ANON_KEY, supabaseConfig.SUPABASE_CONFIG?.anonKey);
    supabaseClient = sdk.createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    initializationAttempted = true;
    console.info('Supabase client initialized', { project: diagnostics.projectHost });
    return supabaseClient;
  } catch (error) {
    initializationAttempted = true;
    console.error('Supabase client initialization failed', error?.message || error);
    return null;
  }
}

export function isSupabaseConfigured() {
  return getSupabaseDiagnostics().configured;
}
