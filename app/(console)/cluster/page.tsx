import { redirect } from 'next/navigation';

/** @deprecated /cluster renamed to /orchestration */
export default function ClusterPageRedirect() {
  redirect('/orchestration');
}