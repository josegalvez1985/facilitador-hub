import { createFileRoute } from '@tanstack/react-router';
import { MaterialsPage } from '@/components/facilitadores/app';
export const Route = createFileRoute('/materiales')({
 head: () => ({ meta: [
 { title: 'Mis materiales · Facilitadores' },
 { name: 'description', content: 'Tu espacio educativo para organizar clases, materiales y marcaciones. Facilitadores.' },
 { property: 'og:title', content: 'Mis materiales · Facilitadores' },
 { property: 'og:description', content: 'Acompañar, enseñar e inspirar. Tu comunidad educativa en Facilitadores.' },
 { property: 'og:type', content: 'website' },
 { name: 'twitter:card', content: 'summary_large_image' }
 ] }),
 component: MaterialsPage,
});
