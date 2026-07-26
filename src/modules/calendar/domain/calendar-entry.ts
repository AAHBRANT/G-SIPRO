export type CalendarEntryType = "DEADLINE" | "DELIVERY" | "MEETING";

export type CalendarEntry = {
  id: string;
  type: CalendarEntryType;
  title: string;
  startAt: string;
  endAt?: string;
  responsibleId?: string;
  responsibleName?: string;
  editable: boolean;
  href?: string;
};

export type DeadlineSource = {
  id: string;
  event: string;
  dueAt: Date;
  responsibleId: string;
  responsible: { displayName: string };
  tender: { id: string };
};

export type ProposalSource = {
  id: string;
  code: string;
  opportunity: {
    id: string;
    deliveryAt: Date | null;
    ownerId: string | null;
    owner: { displayName: string } | null;
  };
};

export type MeetingSource = {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date | null;
  responsibleId: string;
  responsible: { displayName: string };
  opportunityId: string | null;
  tenderId: string | null;
};

export function mergeCalendarEntries(sources: Readonly<{
  deadlines: readonly DeadlineSource[];
  proposals: readonly ProposalSource[];
  meetings: readonly MeetingSource[];
}>): CalendarEntry[] {
  const entries: CalendarEntry[] = [
    ...sources.deadlines.map((item): CalendarEntry => ({
      id: item.id,
      type: "DEADLINE",
      title: item.event,
      startAt: item.dueAt.toISOString(),
      responsibleId: item.responsibleId,
      responsibleName: item.responsible.displayName,
      editable: false,
      href: `/tenders/${item.tender.id}`,
    })),
    ...sources.proposals.flatMap((item): CalendarEntry[] =>
      item.opportunity.deliveryAt
        ? [{
            id: item.id,
            type: "DELIVERY",
            title: `Entrega — ${item.code}`,
            startAt: item.opportunity.deliveryAt.toISOString(),
            responsibleId: item.opportunity.ownerId ?? undefined,
            responsibleName: item.opportunity.owner?.displayName,
            editable: false,
            href: `/opportunities/${item.opportunity.id}`,
          }]
        : []),
    ...sources.meetings.map((item): CalendarEntry => ({
      id: item.id,
      type: "MEETING",
      title: item.title,
      startAt: item.startAt.toISOString(),
      ...(item.endAt && { endAt: item.endAt.toISOString() }),
      responsibleId: item.responsibleId,
      responsibleName: item.responsible.displayName,
      editable: true,
      href: item.opportunityId ? `/opportunities/${item.opportunityId}` : item.tenderId ? `/tenders/${item.tenderId}` : undefined,
    })),
  ];
  return entries.sort((left, right) => left.startAt.localeCompare(right.startAt));
}
