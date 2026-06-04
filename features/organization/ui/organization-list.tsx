import { ChevronRight } from 'lucide-react';

import { selectOrganizationAction } from '@/features/organization/api/organization';

import type { OrganizationProps } from '@/entities/organization';

export default async function OrganizationList({
  organizations,
}: {
  organizations: OrganizationProps[];
}) {
  if (!organizations?.length) {
    return (
      <p className='text-sm text-muted-foreground py-4'>
        still no organizations
      </p>
    );
  }

  return (
    <div className='max-h-[280px] overflow-y-auto'>
      {organizations.map((organization) => {
        return (
          <form key={organization.id} action={selectOrganizationAction}>
            <input
              type='hidden'
              name='organization_id'
              value={organization.id}
            />

            <button
              type='submit'
              className='w-full flex items-center justify-between gap-4 py-4 border-b border-border text-left cursor-pointer transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:bg-accent/10'
            >
              <div className='flex flex-col gap-1 min-w-0'>
                <span className='text-base font-semibold truncate'>
                  {organization.name}
                </span>
                <span className='text-sm text-muted-foreground'>
                  Your role: {organization.pivot?.role ?? 'member'}
                </span>
              </div>

              <ChevronRight className='text-primary size-5 shrink-0' />
            </button>
          </form>
        );
      })}
    </div>
  );
}
