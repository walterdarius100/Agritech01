import { services } from '../data/services.js';
import { courses } from '../data/formations.js';

export const PARTNERSHIP_NEED = 'Partenariat';
export const ACADEMY_NEED = 'Formation Agri-tech Academy';
export const serviceNeeds = services.map(service => service.title);
export const courseNeeds = courses.map(course => course.need || `Cours en ligne - ${course.title}`);

export function contactRequestType(need) {
  if (courseNeeds.includes(need) || need === ACADEMY_NEED) return 'formation';
  if (need === PARTNERSHIP_NEED) return 'partenariat';
  if (serviceNeeds.includes(need)) return 'service';
  return null;
}
