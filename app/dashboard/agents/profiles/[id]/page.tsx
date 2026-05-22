import { redirect } from 'next/navigation';

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/agents/profiles/${id}/overview`);
}
