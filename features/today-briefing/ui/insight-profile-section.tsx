import { BrainCircuit } from 'lucide-react';

import { EmptyState } from '@/shared/ui/feedback/empty-state';
import { CollapsibleSection } from '@/shared/ui/layout/collapsible-section';

import { getMyInsightProfile } from '../api/insight';

import type {
  InsightCategory,
  InsightCategoryContent,
  InsightContentCommunicationStyle,
  InsightContentDevelopmentAreas,
  InsightContentGoalsMotivations,
  InsightContentPsychologicalProfile,
  InsightContentStrengths,
  InsightContentWorkPatterns,
  InsightProfileCategory,
} from '../model/types';

// Record<InsightCategory, string> — compile error if InsightCategory gains a new value
// without a corresponding label entry
const CATEGORY_LABELS: Record<InsightCategory, string> = {
  communication_style: 'Communication Style',
  work_patterns: 'Work Patterns',
  strengths: 'Strengths',
  development_areas: 'Development Areas',
  goals_motivations: 'Goals & Motivations',
  psychological_profile: 'Psychological Profile',
};

function Pill({ children }: { children: string }) {
  return (
    <span className='rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs'>
      {children}
    </span>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex flex-col gap-0.5'>
      <span className='text-xs text-muted-foreground capitalize'>
        {label.replaceAll('_', ' ')}
      </span>
      <span className='text-xs text-foreground bg-accent/40 rounded-[var(--radius-button)] px-3 py-1.5'>
        {value}
      </span>
    </div>
  );
}

function PillList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className='flex flex-col gap-1.5'>
      <span className='text-xs text-muted-foreground capitalize'>
        {label.replaceAll('_', ' ')}
      </span>
      <div className='flex flex-wrap gap-1.5'>
        {items.map((item) => {
          return <Pill key={item}>{item}</Pill>;
        })}
      </div>
    </div>
  );
}

function CommunicationStyleContent({
  content,
}: {
  content: InsightContentCommunicationStyle;
}) {
  return (
    <div className='flex flex-col gap-3'>
      {content.tone ? <KeyValue label='tone' value={content.tone} /> : null}
      {content.listening ? (
        <KeyValue label='listening' value={content.listening} />
      ) : null}
      {content.preferred_format ? (
        <KeyValue label='preferred format' value={content.preferred_format} />
      ) : null}
      {content.language_patterns && content.language_patterns.length > 0 ? (
        <PillList label='language patterns' items={content.language_patterns} />
      ) : null}
    </div>
  );
}

function WorkPatternsContent({
  content,
}: {
  content: InsightContentWorkPatterns;
}) {
  return (
    <div className='flex flex-col gap-3'>
      {content.meeting_role ? (
        <KeyValue label='meeting role' value={content.meeting_role} />
      ) : null}
      {content.decision_style ? (
        <KeyValue label='decision style' value={content.decision_style} />
      ) : null}
      {content.deadline_reliability ? (
        <KeyValue
          label='deadline reliability'
          value={content.deadline_reliability}
        />
      ) : null}
      {content.collaboration_preference ? (
        <KeyValue
          label='collaboration preference'
          value={content.collaboration_preference}
        />
      ) : null}
    </div>
  );
}

function StrengthsContent({ content }: { content: InsightContentStrengths }) {
  return (
    <div className='flex flex-col gap-3'>
      {content.items && content.items.length > 0 ? (
        <PillList label='strengths' items={content.items} />
      ) : null}
    </div>
  );
}

function DevelopmentAreasContent({
  content,
}: {
  content: InsightContentDevelopmentAreas;
}) {
  return (
    <div className='flex flex-col gap-3'>
      {content.items && content.items.length > 0 ? (
        <PillList label='areas' items={content.items} />
      ) : null}
    </div>
  );
}

function GoalsMotivationsContent({
  content,
}: {
  content: InsightContentGoalsMotivations;
}) {
  return (
    <div className='flex flex-col gap-3'>
      {content.current_goals && content.current_goals.length > 0 ? (
        <PillList label='current goals' items={content.current_goals} />
      ) : null}
      {content.motivators && content.motivators.length > 0 ? (
        <PillList label='motivators' items={content.motivators} />
      ) : null}
      {content.concerns && content.concerns.length > 0 ? (
        <PillList label='concerns' items={content.concerns} />
      ) : null}
    </div>
  );
}

function PsychologicalProfileContent({
  content,
}: {
  content: InsightContentPsychologicalProfile;
}) {
  return (
    <div className='flex flex-col gap-3'>
      {content.personality_traits && content.personality_traits.length > 0 ? (
        <PillList
          label='personality traits'
          items={content.personality_traits}
        />
      ) : null}
      {content.stress_indicators && content.stress_indicators.length > 0 ? (
        <PillList label='stress indicators' items={content.stress_indicators} />
      ) : null}
      {content.trust_level ? (
        <KeyValue label='trust level' value={content.trust_level} />
      ) : null}
      {content.conflict_style ? (
        <KeyValue label='conflict style' value={content.conflict_style} />
      ) : null}
    </div>
  );
}

function CategoryContent({
  category,
  content,
}: {
  category: InsightCategory;
  content: InsightCategoryContent;
}) {
  switch (category) {
    case 'communication_style': {
      return (
        <CommunicationStyleContent
          content={content as InsightContentCommunicationStyle}
        />
      );
    }
    case 'work_patterns': {
      return (
        <WorkPatternsContent content={content as InsightContentWorkPatterns} />
      );
    }
    case 'strengths': {
      return <StrengthsContent content={content as InsightContentStrengths} />;
    }
    case 'development_areas': {
      return (
        <DevelopmentAreasContent
          content={content as InsightContentDevelopmentAreas}
        />
      );
    }
    case 'goals_motivations': {
      return (
        <GoalsMotivationsContent
          content={content as InsightContentGoalsMotivations}
        />
      );
    }
    case 'psychological_profile': {
      return (
        <PsychologicalProfileContent
          content={content as InsightContentPsychologicalProfile}
        />
      );
    }
  }
}

function sourceSuffix(count: number): string {
  return count === 1 ? 'source' : 'sources';
}

function InsightCategoryCard({
  category,
}: {
  category: InsightProfileCategory;
}) {
  const label = CATEGORY_LABELS[category.category];

  return (
    <CollapsibleSection label={label} defaultOpen={false}>
      <div className='flex flex-col gap-2 px-4 pb-4'>
        <CategoryContent
          category={category.category}
          content={category.content}
        />
        <p className='text-xs text-muted-foreground pt-1'>
          {category.source_count} {sourceSuffix(category.source_count)}
          {category.last_updated ? ` · updated ${category.last_updated}` : ''}
        </p>
      </div>
    </CollapsibleSection>
  );
}

export async function InsightProfileSection() {
  const profile = await getMyInsightProfile();

  if (!profile || !profile.is_ready || profile.profiles.length === 0) {
    return (
      <EmptyState
        icon={BrainCircuit}
        title='Collecting your insights'
        description='Your AI profile is being built from meetings. Check back after a few sessions.'
      />
    );
  }

  return (
    <section>
      <div className='flex items-center gap-2 mb-3'>
        <BrainCircuit className='h-4 w-4 text-primary' />
        <h2 className='text-sm font-semibold text-foreground'>
          Your AI Profile
        </h2>
      </div>
      <div className='flex flex-col gap-2'>
        {profile.profiles.map((cat) => {
          return <InsightCategoryCard key={cat.category} category={cat} />;
        })}
      </div>
    </section>
  );
}
