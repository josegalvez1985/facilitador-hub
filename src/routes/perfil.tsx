import { createFileRoute } from '@tanstack/react-router';
import { ProfilePage } from '@/components/facilitadores/app';
export const Route = createFileRoute('/perfil')({
 head: () => ({ meta: [
 { title: 'Mi perfil · Facilitadores' },
 { name: 'description', content: 'Tu espacio educativo para organizar clases, materiales y marcaciones. Facilitadores.' },
 { property: 'og:title', content: 'Mi perfil · Facilitadores' },
 { property: 'og:description', content: 'Acompañar, enseñar e inspirar. Tu comunidad educativa en Facilitadores.' },
 { property: 'og:type', content: 'website' },
 { name: 'twitter:card', content: 'summary_large_image' }
 ] }),
 component: ProfilePage,
});
