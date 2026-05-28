'use client';

import { Plus } from 'lucide-react';

import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button/Button';
import Textarea from '@/shared/ui/input/textarea';

import { OnboardingGoalCard } from './onboarding-goal-card';
import { OnboardingTeamMemberRow } from './onboarding-team-member-row';

import type {
  EditableGoal,
  EditableTeamMember,
  PreviewData,
} from '../model/types';

interface Props {
  data: PreviewData;
  isSubmitting: boolean;
  onOrgDescriptionChange: (value: string) => void;
  onGoalUpdate: (index: number, goal: EditableGoal) => void;
  onGoalRemove: (index: number) => void;
  onMemberUpdate: (id: string, member: EditableTeamMember) => void;
  onMemberRemove: (id: string) => void;
  onMemberAdd: () => void;
  onAccept: () => void;
  onBack: () => void;
}

export function OnboardingPreviewStep({
  data,
  isSubmitting,
  onOrgDescriptionChange,
  onGoalUpdate,
  onGoalRemove,
  onMemberUpdate,
  onMemberRemove,
  onMemberAdd,
  onAccept,
  onBack,
}: Props) {
  return (
    <div className='flex flex-col gap-8'>
      <div>
        <h1 className='text-2xl font-semibold text-foreground'>
          Review your organization structure
        </h1>
        <p className='mt-1 text-sm text-muted-foreground'>
          Edit anything before confirming. You can always update these later.
        </p>
      </div>

      {/* Organization card */}
      <section className='flex flex-col gap-3'>
        <h2 className='text-sm font-semibold uppercase tracking-wider text-muted-foreground'>
          Organization
        </h2>
        <div className='rounded-[var(--radius-card)] border border-border bg-surface/40 p-4'>
          <p className='text-base font-semibold text-foreground mb-3'>
            {data.organization.name}
          </p>
          <Textarea
            label='Description'
            value={data.organization.description}
            onChange={(e) => {
              return onOrgDescriptionChange(e.target.value);
            }}
          />
        </div>
      </section>

      {/* Goals */}
      <section className='flex flex-col gap-3'>
        <h2 className='text-sm font-semibold uppercase tracking-wider text-muted-foreground'>
          Goals ({data.goals.length})
        </h2>
        {data.goals.length === 0 && (
          <p className='text-sm text-muted-foreground'>
            No goals were generated. You can add them after onboarding.
          </p>
        )}
        <div className='flex flex-col gap-2'>
          {data.goals.map((goal, index) => {
            return (
              <OnboardingGoalCard
                key={goal._id}
                goal={goal}
                index={index}
                disabled={isSubmitting}
                onUpdate={(updated) => {
                  return onGoalUpdate(index, updated);
                }}
                onRemove={() => {
                  return onGoalRemove(index);
                }}
              />
            );
          })}
        </div>
      </section>

      {/* Team members */}
      <section className='flex flex-col gap-3'>
        <div className='flex items-center justify-between'>
          <h2 className='text-sm font-semibold uppercase tracking-wider text-muted-foreground'>
            Team ({data.team.length})
          </h2>
          <Button
            type='button'
            variant={BUTTON_VARIANT.secondary}
            className='h-7 gap-1 px-2 text-xs'
            onClick={onMemberAdd}
          >
            <Plus className='h-3 w-3' />
            Add member
          </Button>
        </div>
        {data.team.length === 0 && (
          <p className='text-sm text-muted-foreground'>
            No team members detected. Add them manually or invite later.
          </p>
        )}
        <div className='flex flex-col gap-2'>
          {data.team.map((member) => {
            return (
              <OnboardingTeamMemberRow
                key={member._id}
                member={member}
                onUpdate={(updated) => {
                  return onMemberUpdate(member._id, updated);
                }}
                onRemove={() => {
                  return onMemberRemove(member._id);
                }}
              />
            );
          })}
        </div>
      </section>

      <div className='flex flex-col gap-2 pt-2'>
        {data.goals.length === 0 && (
          <p className='text-xs text-destructive text-right'>
            At least one goal is required to proceed.
          </p>
        )}
        <div className='flex items-center justify-between gap-3'>
          <Button
            type='button'
            variant={BUTTON_VARIANT.ghost}
            className='text-muted-foreground'
            onClick={onBack}
            disabled={isSubmitting}
          >
            Back
          </Button>
          <Button
            type='button'
            variant={BUTTON_VARIANT.primary}
            onClick={onAccept}
            disabled={isSubmitting || data.goals.length === 0}
          >
            {isSubmitting ? 'Saving...' : 'Confirm and continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}
