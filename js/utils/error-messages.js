const DEFAULT_USER_ERROR_MESSAGE = 'Une erreur est survenue. Veuillez réessayer.';

function getRawErrorMessage(error) {
  return [
    error?.message,
    error?.details,
    error?.hint,
    error?.code,
    error?.error_description,
    error?.statusText,
    typeof error === 'string' ? error : ''
  ].filter(Boolean).join(' ');
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

  if (context === 'upload') {
    if (/bucket.*not found|not found.*bucket|nosuchbucket|storage bucket|bucket introuvable/.test(rawMessage)) {
      return 'Bucket Supabase Storage introuvable. Vérifiez que le bucket article-images existe.';
    }

    if (/row-level security|\brls\b|policy|permission|forbidden|unauthorized|not authorized|access denied|403/.test(rawMessage)) {
      return 'Upload refusé par Supabase. Vérifiez les policies Storage et vos droits admin.';
    }

    if (/not an image|doit être une image|invalid mime|mime|type.*file|file.*type|fichier/.test(rawMessage) && /image|mime|type|fichier|file/.test(rawMessage)) {
      return 'Le fichier sélectionné doit être une image.';
    }

    if (/limit|size|too large|payload too large|413|dépasse|trop lourd/.test(rawMessage)) {
      return 'L’image dépasse la taille autorisée. Choisissez un fichier de 4 Mo maximum.';
    }

    if (/already exists|duplicate|resource already exists|conflict/.test(rawMessage)) {
      return 'L’image n’a pas pu être envoyée. Renommez le fichier ou réessayez.';
    }

    return 'L’image n’a pas pu être envoyée. Vérifiez le fichier, le bucket article-images et vos droits.';
  }

  if (context === 'save-article') {
    if (/duplicate key|23505|already exists|unique constraint|articles_slug|slug/.test(rawMessage)) {
      return 'Un article utilise déjà ce slug. Modifiez le slug avant d’enregistrer.';
    }

    if (/column.*does not exist|could not find.*column|schema cache|pgrst204|undefined column|42703/.test(rawMessage)) {
      return 'La structure de la table articles ne correspond pas encore au formulaire.';
    }

    if (/row-level security|\brls\b|policy|permission|forbidden|unauthorized|not authorized|access denied|42501|403/.test(rawMessage)) {
      return 'Permission Supabase insuffisante pour enregistrer l’article.';
    }

    if (/not-null|null value|violates not-null|23502|required/.test(rawMessage)) {
      return 'Certains champs obligatoires de l’article sont manquants.';
    }

    if (/check constraint|invalid.*status|23514|articles_status/.test(rawMessage)) {
      return 'Le statut de l’article est invalide. Utilisez brouillon ou publié.';
    }

    return 'Impossible d’enregistrer l’article pour le moment. Réessayez.';
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

  if (context === 'load-admin-articles') {
    return 'Impossible de charger les articles. Vérifiez la connexion ou réessayez.';
  }

  if (context === 'publish-article') {
    return 'Impossible de publier l’article pour le moment. Réessayez.';
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
    code: maskSensitiveLogValue(error?.code || '') || null,
    details: maskSensitiveLogValue(error?.details || '') || null,
    hint: maskSensitiveLogValue(error?.hint || '') || null
  };

  console.error(`[Agri-tech ${scope}]`, safeDetails, error);
}
