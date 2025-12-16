import { redirect } from 'next/navigation'

export default function PolicyNewPage() {
  redirect('/settings/prompt?tab=policy')
}
