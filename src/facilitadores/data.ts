// Datos de demostración. Nada de esto proviene de una cuenta ni se guarda de forma persistente.

export type Lesson = {
  title: string;
  time: string;
  school: string;
  grade: string;
  status: string;
};

export type Material = {
  title: string;
  subject: string;
  grade: string;
  type: 'Manual' | 'Índice';
  pages: number;
};

export const lessons: Lesson[] = [
  { title: 'Matemática · Fracciones y decimales', time: '08:00 – 09:30', school: 'Escuela Básica N.º 124 · San José', grade: '5.º grado', status: 'Próxima clase' },
  { title: 'Comunicación · Comprensión lectora', time: '10:00 – 11:30', school: 'Escuela Básica N.º 124 · San José', grade: '4.º grado', status: 'Programada' },
  { title: 'Ciencias Naturales · El ecosistema', time: '14:00 – 15:30', school: 'Colegio Nacional República del Paraguay', grade: '6.º grado', status: 'Programada' },
];

export const materials: Material[] = [
  { title: 'Fracciones y decimales', subject: 'Matemática', grade: '5.º grado', type: 'Manual', pages: 24 },
  { title: 'Comprensión lectora', subject: 'Comunicación', grade: '4.º grado', type: 'Índice', pages: 8 },
  { title: 'Exploramos el ecosistema', subject: 'Ciencias Naturales', grade: '6.º grado', type: 'Manual', pages: 18 },
];

export const institutions = ['Escuela Básica N.º 124 · San José', 'Colegio Nacional República del Paraguay'];

export const materialIndex = [
  '1. Introducción y objetivos',
  '2. Conceptos fundamentales',
  '3. Actividades en el aula',
  '4. Evaluación del aprendizaje',
];

export const grades = ['4.º grado', '5.º grado', '6.º grado'];

// Fecha fija de la demostración: jueves 15 de octubre de 2026.
export const demoToday = { year: 2026, month: 9, day: 15, label: 'Jueves, 15 de octubre de 2026', short: '15 de octubre, 2026' };

export const demoUser = { name: 'María González', initials: 'MG', role: 'Facilitadora', email: 'maria.gonzalez@ejemplo.com', city: 'Asunción' };

export const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const weekDays = [
  { short: 'LUN', long: 'Lunes', date: 12 },
  { short: 'MAR', long: 'Martes', date: 13 },
  { short: 'MIÉ', long: 'Miércoles', date: 14 },
  { short: 'JUE', long: 'Jueves', date: 15 },
  { short: 'VIE', long: 'Viernes', date: 16 },
  { short: 'SÁB', long: 'Sábado', date: 17 },
  { short: 'DOM', long: 'Domingo', date: 18 },
];
