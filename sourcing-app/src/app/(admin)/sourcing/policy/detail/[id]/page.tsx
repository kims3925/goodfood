import { redirect } from 'next/navigation'

export default function PolicyDetailPage() {
  redirect('/settings/prompt?tab=policy')
}
