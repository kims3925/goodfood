import { redirect } from 'next/navigation'

export default function PolicyListPage() {
  redirect('/sourcing/settings/prompt?tab=policy')
}
