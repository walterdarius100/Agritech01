export function isEmailValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getDelayClass(index) {
  if (index % 3 === 1) return 'reveal-delay-1';
  if (index % 3 === 2) return 'reveal-delay-2';
  return '';
}
