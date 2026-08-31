import { ActionIcon, Button, Group, Text } from '@mantine/core';
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from '@tabler/icons-react';
import clsx from 'clsx';
import { addDays } from 'date-fns/addDays';
import { addMonths } from 'date-fns/addMonths';
import { addYears } from 'date-fns/addYears';
import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';
import { endOfMonth } from 'date-fns/endOfMonth';
import { endOfWeek } from 'date-fns/endOfWeek';
import { format } from 'date-fns/format';
import { isSameMonth } from 'date-fns/isSameMonth';
import { isToday } from 'date-fns/isToday';
import { startOfDay } from 'date-fns/startOfDay';
import { startOfMonth } from 'date-fns/startOfMonth';
import { startOfWeek } from 'date-fns/startOfWeek';
import { subMonths } from 'date-fns/subMonths';
import { subYears } from 'date-fns/subYears';
import { JSX, ReactNode, useEffect, useMemo, useState } from 'react';
import { CalendarWeek } from './calendar-week';

import style from './calendar.module.css';

export type CalendarEvent<T> = {
  id: string;
  date: Date;
  title: string;
  data: T;
};

export type CalendarProps<T> = {
  events: CalendarEvent<T>[];
  eventRenderer?: (events: CalendarEvent<T>[]) => ReactNode;
};

type CalendarSpan<T> = {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  events: CalendarEvent<T>[];
};

type WeekSegment<T> = {
  span: CalendarSpan<T>;
  startColumn: number;
  endColumn: number;
  lane: number;
};

const MAX_VISIBLE_LANES = 3;
const weekOptions = { weekStartsOn: 1 as const };

function buildSpans<T>(events: CalendarEvent<T>[]): CalendarSpan<T>[] {
  const eventsById = new Map<string, CalendarEvent<T>[]>();

  events.forEach((event) => {
    const groupedEvents = eventsById.get(event.id) ?? [];
    groupedEvents.push(event);
    eventsById.set(event.id, groupedEvents);
  });

  return Array.from(eventsById.values()).flatMap((groupedEvents) => {
    const sortedEvents = groupedEvents.toSorted(
      (left, right) => left.date.getTime() - right.date.getTime()
    );
    const spans: CalendarSpan<T>[] = [];

    sortedEvents.forEach((event) => {
      const eventDate = startOfDay(event.date);
      const currentSpan = spans.at(-1);
      const followsCurrentSpan =
        currentSpan && differenceInCalendarDays(eventDate, currentSpan.endDate) <= 1;

      if (followsCurrentSpan) {
        currentSpan.endDate = eventDate;
        currentSpan.events.push(event);
        return;
      }

      spans.push({
        id: event.id,
        title: event.title,
        startDate: eventDate,
        endDate: eventDate,
        events: [event],
      });
    });

    return spans;
  });
}

function assignLanes<T>(
  spans: CalendarSpan<T>[],
  weekStart: Date,
  weekEnd: Date
): WeekSegment<T>[] {
  const segments = spans
    .filter((span) => span.startDate <= weekEnd && span.endDate >= weekStart)
    .map((span) => ({
      span,
      startColumn: differenceInCalendarDays(
        span.startDate < weekStart ? weekStart : span.startDate,
        weekStart
      ),
      endColumn: differenceInCalendarDays(
        span.endDate > weekEnd ? weekEnd : span.endDate,
        weekStart
      ),
      lane: 0,
    }))
    .toSorted(
      (left, right) => left.startColumn - right.startColumn || right.endColumn - left.endColumn
    );

  const laneEnds: number[] = [];
  segments.forEach((segment) => {
    const availableLane = laneEnds.findIndex((endColumn) => endColumn < segment.startColumn);
    segment.lane = availableLane === -1 ? laneEnds.length : availableLane;
    laneEnds[segment.lane] = segment.endColumn;
  });

  return segments;
}

function getColorIndex(id: string): number {
  return Array.from(id).reduce((hash, character) => hash + character.charCodeAt(0), 0) % 8;
}

export function Calendar<T>({ events, eventRenderer }: CalendarProps<T>): JSX.Element {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, weekOptions);
  const calendarEnd = endOfWeek(monthEnd, weekOptions);
  const spans = useMemo(() => buildSpans(events), [events]);
  const weeks = [];

  let weekStart = calendarStart;
  while (weekStart <= calendarEnd) {
    const weekEnd = endOfWeek(weekStart, weekOptions);
    const visibleWeekStart = weekStart < monthStart ? monthStart : weekStart;
    const visibleWeekEnd = weekEnd > monthEnd ? monthEnd : weekEnd;
    const segments = assignLanes(spans, visibleWeekStart, visibleWeekEnd).map((segment) => ({
      ...segment,
      startColumn: differenceInCalendarDays(
        segment.span.startDate < visibleWeekStart ? visibleWeekStart : segment.span.startDate,
        weekStart
      ),
      endColumn: differenceInCalendarDays(
        segment.span.endDate > visibleWeekEnd ? visibleWeekEnd : segment.span.endDate,
        weekStart
      ),
    }));
    const hiddenByDay = Array.from({ length: 7 }, () => 0);

    segments
      .filter((segment) => segment.lane >= MAX_VISIBLE_LANES)
      .forEach((segment) => {
        for (let column = segment.startColumn; column <= segment.endColumn; column += 1) {
          hiddenByDay[column] += 1;
        }
      });

    weeks.push(
      <div className={style.CalendarWeekRow} key={weekStart.toISOString()}>
        {Array.from({ length: 7 }, (_, index) => {
          const date = addDays(weekStart, index);
          const isCurrentMonth = isSameMonth(date, currentDate);

          return (
            <div
              className={clsx(
                style.CalendarDate,
                !isCurrentMonth && style.CalendarDateDisabled,
                isCurrentMonth && isToday(date) && style.CalendarDateToday
              )}
              key={date.toISOString()}
              style={{ gridColumn: index + 1 }}
            >
              {isCurrentMonth && <span className={style.CalendarDay}>{format(date, 'd')}</span>}
            </div>
          );
        })}

        {segments
          .filter((segment) => segment.lane < MAX_VISIBLE_LANES)
          .map((segment) => (
            <div
              className={style.CalendarEvent}
              data-color={getColorIndex(segment.span.id)}
              key={`${segment.span.id}-${segment.span.startDate.toISOString()}`}
              style={{
                gridColumn: `${segment.startColumn + 1} / ${segment.endColumn + 2}`,
                gridRow: segment.lane + 2,
              }}
              title={segment.span.title}
            >
              {eventRenderer?.(segment.span.events) ?? segment.span.title}
            </div>
          ))}

        {hiddenByDay.map(
          (count, index) =>
            count > 0 && (
              <span
                className={style.CalendarOverflow}
                key={`overflow-${index}`}
                style={{ gridColumn: index + 1 }}
              >
                +{count}
              </span>
            )
        )}
      </div>
    );

    weekStart = addDays(weekStart, 7);
  }

  useEffect(() => {
    function bindShortcuts(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentDate((date) => subMonths(date, 1));
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentDate((date) => addMonths(date, 1));
      }
    }

    window.addEventListener('keydown', bindShortcuts);
    return () => window.removeEventListener('keydown', bindShortcuts);
  }, []);

  return (
    <div className={style.Calendar}>
      <div className={style.CalendarHeader}>
        <Group gap={4}>
          <ActionIcon
            aria-label="Previous year"
            onClick={() => setCurrentDate((date) => subYears(date, 1))}
            variant="subtle"
          >
            <IconChevronsLeft size={18} />
          </ActionIcon>
          <ActionIcon
            aria-label="Previous month"
            onClick={() => setCurrentDate((date) => subMonths(date, 1))}
            variant="subtle"
          >
            <IconChevronLeft size={18} />
          </ActionIcon>
        </Group>

        <div className={style.CalendarHeading}>
          <Text fw={700} tt="capitalize">
            {format(currentDate, 'MMMM yyyy')}
          </Text>
          <Button
            className={style.CalendarToday}
            onClick={() => setCurrentDate(new Date())}
            size="compact-xs"
            variant="subtle"
          >
            Today
          </Button>
        </div>

        <Group gap={4}>
          <ActionIcon
            aria-label="Next month"
            onClick={() => setCurrentDate((date) => addMonths(date, 1))}
            variant="subtle"
          >
            <IconChevronRight size={18} />
          </ActionIcon>
          <ActionIcon
            aria-label="Next year"
            onClick={() => setCurrentDate((date) => addYears(date, 1))}
            variant="subtle"
          >
            <IconChevronsRight size={18} />
          </ActionIcon>
        </Group>
      </div>
      <div className={style.CalendarViewport}>
        <CalendarWeek currentDate={currentDate} />
        <div className={style.CalendarGrid}>{weeks}</div>
      </div>
    </div>
  );
}
