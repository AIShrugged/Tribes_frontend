'use client';

import clsx from 'clsx';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useState,
  useActionState,
  useEffect,
  useRef,
  useSyncExternalStore,
  startTransition,
} from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

import { setActiveOrganization } from '@/features/organization/api/organization';
import { ROUTES } from '@/shared/lib/routes';
import { Button } from '@/shared/ui/button';

import type { OrganizationProps } from '@/entities/organization';

/**
 *
 */
const subscribeToMount = () => {
  return noop;
};
/**
 *
 */
const getMountedSnapshot = () => {
  return true;
};
/**
 *
 */
const getServerMountedSnapshot = () => {
  return false;
};

/**
 *
 */
function noop() {}

function getOrganizationDisplayState(
  organizations: OrganizationProps[],
  organizationActiveId: number | null,
) {
  const active = organizations.find((o) => {
    return String(o.id) === String(organizationActiveId);
  });
  const sortedOrganizations = active
    ? [
        active,
        ...organizations.filter((o) => {
          return o.id !== active.id;
        }),
      ]
    : organizations;

  return { active, sortedOrganizations };
}

/**
 * OrgItem — renders a single organization row inside the dropdown.
 * @param root0 - Props.
 * @param root0.organization - Organization to render.
 * @param root0.isActive - Whether this org is currently active.
 * @param root0.pending - Whether a form action is in flight.
 * @returns JSX element.
 */
function OrgItem({
  organization,
  isActive,
  pending,
}: {
  organization: OrganizationProps;
  isActive: boolean;
  pending: boolean;
}) {
  if (isActive) {
    return (
      <div className='gap-5 px-4 py-2.5 w-full flex flex-row justify-between items-center border-b border-border bg-accent/30'>
        <div>
          <div className='flex items-center gap-2'>
            <p className='text-sm font-medium text-foreground'>
              {organization.name}
            </p>
            {organization.code ? (
              <span className='font-mono text-xs text-muted-foreground'>
                {organization.code}
              </span>
            ) : null}
          </div>
          <p className='text-xs text-muted-foreground'>
            {organization.pivot?.role ?? 'member'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Button
      type='submit'
      variant='ghost'
      size='sm'
      justify='start'
      disabled={pending}
      className='px-4 rounded-none justify-between'
    >
      <span className='flex min-w-0 items-center gap-2'>
        <p className='text-sm text-foreground truncate'>{organization.name}</p>
        {organization.code ? (
          <span className='font-mono text-xs text-muted-foreground'>
            {organization.code}
          </span>
        ) : null}
      </span>
      <p className='text-xs text-muted-foreground'>
        {organization.pivot?.role ?? 'member'}
      </p>
    </Button>
  );
}

/**
 * OrganizationDropdown component.
 * @param root0
 * @param root0.organizations
 * @param root0.organizationActiveId
 * @returns JSX element.
 */
// eslint-disable-next-line complexity
export default function OrganizationDropdown({
  organizations,
  organizationActiveId,
}: {
  organizations: OrganizationProps[];
  organizationActiveId: number | null;
}) {
  const [open, setOpen] = useState(false);
  const isMounted = useSyncExternalStore(
    subscribeToMount,
    getMountedSnapshot,
    getServerMountedSnapshot,
  );
  const [state, action, pending] = useActionState(setActiveOrganization, {
    ok: false,
  });
  const { push, refresh } = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
    minWidth: number;
  } | null>(null);
  const { active, sortedOrganizations } = getOrganizationDisplayState(
    organizations,
    organizationActiveId,
  );

  useEffect(() => {
    const needsDefault = !organizationActiveId && organizations.length > 0;

    if (needsDefault) {
      const formData = new FormData();

      formData.append('organization_id', String(organizations[0].id));
      startTransition(() => {
        action(formData);
      });
    }
  }, []);

  const prevPendingRef = useRef(false);
  useEffect(() => {
    if (prevPendingRef.current && !pending && state.ok) {
      refresh();
    }

    prevPendingRef.current = pending;
  }, [pending, state.ok, refresh]);

  useEffect(() => {
    if (!open) return;

    /**
     * handleClickOutside.
     * @param e - e.
     * @returns Result.
     */
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isOutside =
        !buttonRef.current?.contains(target) &&
        !target.closest('[data-org-dropdown]');

      if (isOutside) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      return document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  /**
   * handleToggle.
   */
  const handleToggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();

      setDropdownPos({
        top: rect.bottom + 4,
        left: Math.min(rect.left, globalThis.innerWidth - 280 - 8),
        minWidth: rect.width,
      });
    }

    setOpen((prev) => {
      return !prev;
    });
  };

  if (!isMounted) {
    return (
      <div className='max-w-[130px] xs:max-w-[180px] sm:max-w-[260px]'>
        <div
          className='w-full rounded-[var(--radius-button)] border border-primary/40 bg-primary/10 px-3 py-2 min-w-0 shadow-[0_0_10px_rgba(124,58,237,0.2)]'
          suppressHydrationWarning
        >
          <div className='text-left min-w-0 flex-1'>
            <div className='text-sm font-medium text-primary truncate'>
              {active?.name ?? 'Select organization'}
            </div>
            <div className='text-xs text-primary/70 truncate'>
              {active?.pivot?.role}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='max-w-[130px] xs:max-w-[180px] sm:max-w-[260px]'>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={clsx(
          'cursor-pointer w-full flex items-center justify-between gap-2 rounded-[var(--radius-button)] border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium transition-all select-none shadow-[0_0_10px_rgba(124,58,237,0.2)] min-w-0',
          open
            ? 'bg-primary/20 border-primary/60 shadow-[0_0_16px_rgba(124,58,237,0.35)]'
            : 'hover:bg-primary/20 hover:border-primary/60 hover:shadow-[0_0_16px_rgba(124,58,237,0.35)]',
        )}
      >
        <div className='text-left min-w-0 flex-1'>
          <div className='text-sm font-medium text-foreground truncate'>
            {active?.name ?? 'Select organization'}
          </div>
          <div className='text-xs text-muted-foreground truncate'>
            {active?.pivot?.role}
          </div>
        </div>

        {open ? (
          <ChevronUp size={18} className='text-primary flex-shrink-0' />
        ) : (
          <ChevronDown size={18} className='text-primary flex-shrink-0' />
        )}
      </button>

      {open &&
        dropdownPos &&
        createPortal(
          <div
            data-org-dropdown=''
            className='fixed z-[9999] rounded-[var(--radius-card)] bg-popover border border-border overflow-hidden'
            style={{
              top: dropdownPos.top,
              left: dropdownPos.left,
              minWidth: dropdownPos.minWidth,
              maxWidth: '280px',
            }}
          >
            {sortedOrganizations.map((organization) => {
              return (
                <form
                  key={organization.id}
                  action={(formData) => {
                    action(formData);
                    setOpen(false);
                    toast.success(`Switched to: ${organization.name}`);
                  }}
                >
                  <input
                    type='hidden'
                    name='organization_id'
                    value={organization.id}
                  />
                  <OrgItem
                    organization={organization}
                    isActive={organization.id === organizationActiveId}
                    pending={pending}
                  />
                </form>
              );
            })}

            <Button
              type='button'
              variant='ghost'
              size='sm'
              justify='start'
              className='px-4 rounded-none text-primary'
              onClick={() => {
                setOpen(false);
                push(`${ROUTES.DASHBOARD.ORGANIZATION}/create`);
              }}
            >
              + Create
            </Button>
          </div>,
          document.body,
        )}
    </div>
  );
}
