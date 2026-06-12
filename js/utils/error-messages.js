const DEFAULT_USER_ERROR_MESSAGE = 'Une erreur est survenue. Veuillez réessayer.';

function getRawErrorMessage(error) {
  return String(error?.message || error?.error_description || error?.statusText || error || '');
}

function maskSensitiveLogValue(value) {
  return String(value || '')
    .replace(/(sb_secret_)[A-Za-z0-9._-]+/gi, '$1…')
    .replace(/(service[_-]?role[^\s:=]*[\s:=]+)[A-Za-z0-9._-]+/gi, '$1…')
    .replace(/(apikey=)[A-Za-z0-9._-]+/gi, '$1…')
    .replace(/(api[_-]?key[^\s:=]*[\s:=]+)[A-Za-z0-9._-]+/gi, '$1…')
    .replace(/(authorization:\s*bearer\s+)[A-Za-z0-9._-]+/gi, '$1…');
}

export function getSafeErrorMessage(context = 'default', error = null) {
  const rawMessage = getRawErrorMessage(error).toLowerCase();

  if (/invalid login|invalid credentials|invalid email or password/.test(rawMessage)) {
    return 'Identifiants incorrects. Vérifiez votre email et votre mot de passe.';
  }

  if (/email not confirmed|confirmation/.test(rawMessage)) {
    return 'Votre compte doit être confirmé avant de pouvoir vous connecter.';
  }

  if (/jwt|session.*expired|refresh token|not authenticated|auth session missing/.test(rawMessage)) {
    return 'Votre session a expiré. Veuillez vous reconnecter.';
  }

  if (/failed to fetch|network|timeout|load failed|connection|offline/.test(rawMessage)) {
    return 'Connexion au serveur impossible. Vérifiez votre connexion internet puis réessayez.';
  }

  if (/row-level security|\brls\b|policy|permission|forbidden|unauthorized|not authorized|access denied/.test(rawMessage)) {
    return 'Action impossible pour le moment. Vérifiez vos droits d’accès ou réessayez.';
  }

  if (context === 'email' || context === 'newsletter') {
    return 'Le message n’a pas pu être envoyé pour le moment. Réessayez dans quelques minutes.';
  }

  if (context === 'articles-list' || context === 'home-articles') {
    return 'Les articles ne sont pas disponibles pour le moment. Réessayez plus tard.';
  }

  if (context === 'article') {
    return 'Article introuvable ou indisponible.';
  }

  if (context === 'upload') {
    if (/not an image|doit être une image|image/.test(rawMessage) && /type|fichier|file/.test(rawMessage)) {
      return 'Le fichier sélectionné doit être une image.';
    }

    if (/limit|size|too large|dépasse/.test(rawMessage)) {
      return 'L’image dépasse la taille autorisée. Choisissez un fichier plus léger.';
    }

    if (/already exists|duplicate|resource already exists|conflict/.test(rawMessage)) {
      return 'L’image n’a pas pu être envoyée. Renommez le fichier ou réessayez.';
    }

    return 'L’image n’a pas pu être envoyée. Vérifiez le fichier puis réessayez.';
  }

  if (context === 'load-admin-articles') {
    return 'Impossible de charger les articles. Vérifiez la connexion ou réessayez.';
  }

  if (context === 'save-article') {
    return 'Impossible d’enregistrer l’article pour le moment. Réessayez.';
  }

  if (context === 'publish-article') {
    return 'Impossible de publier l’article pour le moment. Réessayez.';
  }

  if (context === 'archive-article') {
    return 'Impossible d’archiver l’article pour le moment. Réessayez.';
  }

  if (context === 'delete-article') {
    return 'Impossible de supprimer l’article pour le moment. Réessayez.';
  }

  if (context === 'feature-article') {
    return 'Impossible de mettre cet article à la une pour le moment. Réessayez.';
  }

  return DEFAULT_USER_ERROR_MESSAGE;
}

export function logClientError(scope, error) {
  const safeDetails = {
    name: error?.name || 'Error',
    message: maskSensitiveLogValue(getRawErrorMessage(error)) || 'Aucun message technique disponible',
    status: error?.status || error?.statusCode || null,
    code: maskSensitiveLogValue(error?.code || '') || null
  };

  console.error(`[Agri-tech ${scope}]`, safeDetails);
}
