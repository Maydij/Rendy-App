import { redirect } from 'next/navigation';

/**
 * @name OrganizacionPage
 * @description Alias redirect from /dashboard/organizacion to /dashboard/configuracion.
 */
export default function OrganizacionPage() {
  redirect('/dashboard/configuracion');
}
