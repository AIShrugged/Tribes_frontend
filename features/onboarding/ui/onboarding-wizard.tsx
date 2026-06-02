'use client';

import { Check, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type PropsWithChildren,
} from 'react';
import { toast } from 'sonner';

import { ROUTES } from '@/shared/lib/routes';

import {
  acceptStructure,
  generateStructure,
  skipOnboarding,
} from '../api/onboarding';
import { useOnboardingPoll } from '../hooks/use-onboarding-poll';
import { UserRoleSchema } from '../model/schemas';
import {
  EMPTY_INPUT,
  buildInitialState,
  reducer,
} from '../model/wizard-reducer';

import { OnboardingInputStep } from './onboarding-input-step';
import { OnboardingPreviewStep } from './onboarding-preview-step';
import { OnboardingProcessingStep } from './onboarding-processing-step';

import type { OnboardingDraftResponse } from '../model/types';

// ─── Local helpers ────────────────────────────────────────────────────────────

interface StatusScreenProps {
  title: string;
  message: string;
  primaryAction: { label: string; onClick: () => void };
  secondaryAction: { label: string; onClick: () => void };
}

type ShellStep = 'input' | 'processing' | 'preview';

const SHELL_STEPS: Array<{
  id: ShellStep;
  title: string;
  hint: string;
}> = [
  {
    id: 'input',
    title: 'Describe your organization',
    hint: 'A paragraph is enough.',
  },
  {
    id: 'processing',
    title: 'Review the AI draft',
    hint: 'Goals, tasks and team — all editable.',
  },
  {
    id: 'preview',
    title: 'Launch your workspace',
    hint: 'Everything lives in the issue tracker.',
  },
];

const DARK_ONBOARDING_THEME = {
  '--background': 'var(--neutral-1000)',
  '--foreground': 'var(--neutral-100)',
  '--card': 'var(--neutral-900)',
  '--card-foreground': 'var(--neutral-100)',
  '--surface': 'var(--neutral-900)',
  '--surface-2': 'var(--neutral-850)',
  '--surface-3': 'var(--neutral-800)',
  '--muted-foreground': 'var(--neutral-400)',
  '--secondary': 'var(--neutral-850)',
  '--secondary-foreground': 'var(--neutral-300)',
  '--border': 'oklch(24% 0.01 260)',
  '--input': 'oklch(24% 0.01 260)',
  '--ring': 'var(--primary-400)',
  '--primary': 'var(--primary-500)',
  '--primary-foreground': 'var(--neutral-0)',
} as CSSProperties;

function OnboardingShell({
  children,
  currentStep,
  statusText,
}: PropsWithChildren<{
  currentStep: ShellStep;
  statusText?: string;
}>) {
  const activeIndex = SHELL_STEPS.findIndex((step) => {
    return step.id === currentStep;
  });

  return (
    <div
      className='relative min-h-screen overflow-hidden bg-[#030407] text-foreground'
      style={DARK_ONBOARDING_THEME}
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_8%,oklch(56%_0.205_271_/_0.36)_0%,transparent_35%),radial-gradient(circle_at_86%_94%,oklch(56%_0.205_271_/_0.22)_0%,transparent_34%)]'
      />
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(oklch(22%_0.012_260_/_0.6)_1px,transparent_1px),linear-gradient(90deg,oklch(22%_0.012_260_/_0.6)_1px,transparent_1px)] [background-position:-1px_-1px] [background-size:56px_56px] [mask-image:linear-gradient(90deg,black_0%,black_78%,transparent_100%)]'
      />

      <div className='relative mx-auto grid min-h-screen w-full max-w-[1440px] items-center gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[360px_minmax(0,720px)] lg:gap-12 lg:px-12 lg:py-10 xl:grid-cols-[420px_minmax(0,760px)] xl:gap-14 xl:px-16'>
        <aside className='flex flex-col gap-8 lg:min-h-[min(760px,calc(100vh-80px))] lg:py-4'>
          <div className='inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground'>
            <span className='inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] bg-primary text-primary-foreground shadow-[0_12px_28px_-14px_var(--primary)]'>
              <Shield className='h-4 w-4' />
            </span>
            TRIBES
          </div>

          <div className='flex flex-col gap-5'>
            <h1 className='max-w-[10.5ch] text-[clamp(2.25rem,4vw,3rem)] font-semibold leading-[1.08] text-foreground'>
              Let&apos;s get your workspace{' '}
              <em className='font-serif text-[0.92em] font-normal italic text-[var(--primary-300)]'>
                ready
              </em>
              .
            </h1>
            <p className='max-w-[340px] text-[clamp(1rem,1.7vw,1.25rem)] leading-[1.5] text-muted-foreground'>
              Tell us a bit about what you do — we&apos;ll draft your goals,
              tasks and team in seconds.
            </p>
          </div>

          <ol className='mt-1 flex flex-col gap-5'>
            {SHELL_STEPS.map((step, index) => {
              const isActive = index === activeIndex;
              const isDone = index < activeIndex;

              return (
                <li
                  key={step.id}
                  className='grid grid-cols-[30px_1fr] items-start gap-3'
                >
                  <span
                    className={[
                      'inline-flex h-7 w-7 items-center justify-center rounded-full border text-sm font-semibold',
                      isDone
                        ? 'border-transparent bg-[var(--success-500)] text-white'
                        : '',
                      isActive
                        ? 'border-transparent bg-primary text-primary-foreground shadow-[0_0_0_5px_color-mix(in_oklab,var(--primary)_22%,transparent)]'
                        : '',
                      !isDone && !isActive
                        ? 'border-border bg-[#07090d] text-muted-foreground'
                        : '',
                    ].join(' ')}
                  >
                    {isDone ? <Check className='h-3.5 w-3.5' /> : index + 1}
                  </span>
                  <span className='flex flex-col gap-0.5'>
                    <span
                      className={[
                        'text-base',
                        isActive || isDone
                          ? 'font-medium text-foreground'
                          : 'font-normal text-muted-foreground',
                      ].join(' ')}
                    >
                      {step.title}
                    </span>
                    <span className='text-xs text-[var(--neutral-500)]'>
                      {step.hint}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>

          <div className='mt-auto inline-flex items-center gap-2 text-xs text-[var(--neutral-500)]'>
            <span className='h-2 w-2 rounded-full bg-[var(--success-500)] shadow-[0_0_0_4px_color-mix(in_oklab,var(--success-500)_18%,transparent)]' />
            {currentStep === 'input'
              ? 'Draft auto-saved'
              : (statusText ?? 'Draft auto-saved')}
          </div>
        </aside>

        <main className='w-full min-w-0 rounded-[20px] border border-border bg-[#07090d]/90 p-5 shadow-[0_24px_80px_-40px_rgb(0_0_0_/_0.9)] backdrop-blur-2xl sm:p-7 lg:p-8'>
          {children}
        </main>
      </div>
    </div>
  );
}

function WizardStatusScreen({
  title,
  message,
  primaryAction,
  secondaryAction,
}: StatusScreenProps) {
  return (
    <div className='flex flex-col items-center justify-center gap-6 py-16 text-center'>
      <p className='text-xl font-semibold text-foreground'>{title}</p>
      <p className='text-sm text-muted-foreground max-w-sm'>{message}</p>
      <div className='flex gap-3'>
        <button
          type='button'
          className='text-sm text-primary hover:underline focus-visible:outline-none focus-visible:underline'
          onClick={primaryAction.onClick}
        >
          {primaryAction.label}
        </button>
        <button
          type='button'
          className='text-sm text-muted-foreground hover:underline focus-visible:outline-none focus-visible:underline'
          onClick={secondaryAction.onClick}
        >
          {secondaryAction.label}
        </button>
      </div>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  orgId: number;
  orgName: string;
  initialDraft: OnboardingDraftResponse | null;
  statusText?: string;
  redirectAfterSkip?: string;
  redirectAfterAccept?: string;
}

export function OnboardingWizard({
  orgId,
  orgName,
  initialDraft,
  statusText,
  redirectAfterSkip,
  redirectAfterAccept,
}: Props) {
  const router = useRouter();
  const [state, dispatch] = useReducer(
    reducer,
    initialDraft,
    buildInitialState,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasFilePending, setHasFilePending] = useState(false);
  const isSubmittingRef = useRef(false);

  const inputState = 'inputState' in state ? state.inputState : EMPTY_INPUT;

  useOnboardingPoll(
    orgId,
    state.step === 'processing',
    (draft) => {
      return dispatch({ type: 'POLL_RESULT', draft });
    },
    () => {
      return dispatch({ type: 'POLL_TIMEOUT' });
    },
  );

  async function handleGenerate() {
    if (isSubmitting || hasFilePending) return;

    // Snapshot current inputState directly to avoid stale closure when
    // template chip and generate button are clicked in the same render cycle.
    const currentInput = 'inputState' in state ? state.inputState : EMPTY_INPUT;

    const payload = {
      description: currentInput.description.trim(),
      ...(currentInput.template !== null && {
        template: currentInput.template,
      }),
      ...(currentInput.uploadToken &&
        currentInput.attachments.length > 0 && {
          upload_token: currentInput.uploadToken,
        }),
      ...(currentInput.links.some(Boolean) && {
        links: currentInput.links.filter(Boolean),
      }),
    };

    dispatch({ type: 'GENERATE_STARTED' });

    try {
      const result = await generateStructure(orgId, payload);

      if (result.error) {
        toast.error(result.error);
        dispatch({ type: 'BACK_TO_INPUT' });
      }
    } catch (error) {
      dispatch({ type: 'BACK_TO_INPUT' });
      throw error;
    }
  }

  async function handleAccept() {
    if (state.step !== 'preview' || isSubmittingRef.current) return;

    const { previewData } = state;

    const teamPayload = previewData.team
      .filter((m) => {
        return m.name.trim();
      })
      .map(({ name, email, role }) => {
        const parsedRole = UserRoleSchema.safeParse(role);
        return {
          name: name.trim(),
          ...(email ? { email } : {}),
          ...(parsedRole.success ? { role: parsedRole.data } : {}),
        };
      });

    const payload = {
      organization: {
        name: orgName,
        description: previewData.organization.description,
      },
      goals: previewData.goals.map((g) => {
        return {
          title: g.title,
          description: g.description,
          tasks: g.tasks.map((t) => {
            return {
              title: t.title,
              description: t.description,
              type: t.type,
              priority: t.priority,
            };
          }),
        };
      }),
      team: teamPayload,
      ...(inputState.template !== null && { template: inputState.template }),
    };

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await acceptStructure(orgId, payload);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success('Organization set up!', {
        description: 'Your goals are ready in the Today section.',
        duration: 5000,
      });
      router.refresh();
      router.push(redirectAfterAccept ?? ROUTES.DASHBOARD.ISSUES_LIST);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function handleSkip() {
    try {
      await skipOnboarding(orgId);
    } catch {
      // Cookie write failed — navigate anyway; user can skip again if redirected back
    }
    router.push(redirectAfterSkip ?? ROUTES.DASHBOARD.TODAY);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (state.step === 'processing') {
    return (
      <OnboardingShell currentStep='processing' statusText={statusText}>
        <OnboardingProcessingStep
          onCancel={async () => {
            dispatch({ type: 'CANCEL_GENERATION' });
            await handleSkip();
          }}
        />
      </OnboardingShell>
    );
  }

  if (state.step === 'timeout') {
    return (
      <OnboardingShell currentStep='processing' statusText={statusText}>
        <WizardStatusScreen
          title='Generation is taking longer than expected'
          message='The AI is still working. You can wait or come back later — your draft will be saved automatically.'
          primaryAction={{
            label: 'Keep waiting',
            onClick: () => {
              return dispatch({ type: 'GENERATE_STARTED' });
            },
          }}
          secondaryAction={{ label: 'Go to dashboard', onClick: handleSkip }}
        />
      </OnboardingShell>
    );
  }

  if (state.step === 'error') {
    return (
      <OnboardingShell currentStep='input' statusText={statusText}>
        <WizardStatusScreen
          title='Something went wrong'
          message={state.message}
          primaryAction={{
            label: 'Try again',
            onClick: () => {
              return dispatch({ type: 'BACK_TO_INPUT' });
            },
          }}
          secondaryAction={{ label: 'Skip for now', onClick: handleSkip }}
        />
      </OnboardingShell>
    );
  }

  if (state.step === 'preview') {
    return (
      <OnboardingShell currentStep='preview' statusText={statusText}>
        <OnboardingPreviewStep
          data={state.previewData}
          isSubmitting={isSubmitting}
          onOrgDescriptionChange={(value) => {
            return dispatch({ type: 'ORG_DESC_CHANGE', value });
          }}
          onGoalUpdate={(index, goal) => {
            return dispatch({ type: 'GOAL_UPDATE', index, goal });
          }}
          onGoalRemove={(index) => {
            return dispatch({ type: 'GOAL_REMOVE', index });
          }}
          onMemberUpdate={(id, member) => {
            return dispatch({ type: 'MEMBER_UPDATE', id, member });
          }}
          onMemberRemove={(id) => {
            return dispatch({ type: 'MEMBER_REMOVE', id });
          }}
          onMemberAdd={() => {
            return dispatch({ type: 'MEMBER_ADD' });
          }}
          onAccept={handleAccept}
          onBack={() => {
            return dispatch({ type: 'BACK_TO_INPUT' });
          }}
        />
      </OnboardingShell>
    );
  }

  // input | needs_info
  const needsInfoData =
    state.step === 'needs_info' ? state.needsInfoData : undefined;

  return (
    <OnboardingShell currentStep='input' statusText={statusText}>
      <OnboardingInputStep
        state={inputState}
        needsInfoData={needsInfoData}
        isSubmitting={isSubmitting}
        hasFilePending={hasFilePending}
        template={inputState.template}
        organizationId={orgId}
        onTemplateChange={(value) => {
          return dispatch({ type: 'SET_TEMPLATE', value });
        }}
        onDescriptionChange={(value) => {
          return dispatch({ type: 'SET_DESCRIPTION', value });
        }}
        onLinkAdd={() => {
          return dispatch({ type: 'LINK_ADD' });
        }}
        onLinkChange={(index, value) => {
          return dispatch({ type: 'LINK_CHANGE', index, value });
        }}
        onLinkRemove={(index) => {
          return dispatch({ type: 'LINK_REMOVE', index });
        }}
        onUploaded={(attachment) => {
          return dispatch({ type: 'ATTACHMENT_UPLOADED', attachment });
        }}
        onDeleted={(id) => {
          return dispatch({ type: 'ATTACHMENT_DELETED', id });
        }}
        onPendingChange={setHasFilePending}
        onSubmit={handleGenerate}
        onSkip={handleSkip}
      />
    </OnboardingShell>
  );
}
