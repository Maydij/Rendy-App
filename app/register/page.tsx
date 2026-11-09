import { redirect } from 'next/navigation';

/**
 * @name RegisterRedirectPage
 * @description [Business Logic]: Canonical route redirect from /register to /registro.
 */
export default function RegisterRedirectPage() {
  redirect('/registro');
}

