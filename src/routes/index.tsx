import { createFileRoute } from '@tanstack/react-router';
import { HomePage } from '@/components/facilitadores/app';
export const Route = createFileRoute('/')({
 head: () => ({ meta: [
 { title: 'Inicio · Facilitadores' },
 { name: 'description', content: 'Tu espacio educativo para organizar clases, materiales y marcaciones. Facilitadores.' },
 { property: 'og:title', content: 'Inicio · Facilitadores' },
 { property: 'og:description', content: 'Acompañar, enseñar e inspirar. Tu comunidad educativa en Facilitadores.' },
 { property: 'og:type', content: 'website' },
 { name: 'twitter:card', content: 'summary_large_image' }
 ] }),
 component: HomePage,
});
