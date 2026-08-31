import { BookWithData, PageStat } from '@koinsight/common/types';
import { Tooltip } from '@mantine/core';
import { startOfDay } from 'date-fns/startOfDay';
import { sum } from 'ramda';
import { JSX } from 'react';
import { Calendar, CalendarEvent } from '../../components/calendar/calendar';
import { getDuration, shortDuration } from '../../utils/dates';

type BookPageCalendarProps = {
  book: BookWithData;
};

type DayData = {
  events: PageStat[];
};

export function BookPageCalendar({ book }: BookPageCalendarProps): JSX.Element {
  const eventsByDay = new Map<string, CalendarEvent<DayData>>();

  book.stats.forEach((event) => {
    const date = startOfDay(event.start_time);
    const key = date.toISOString();
    const existingEvent = eventsByDay.get(key);

    eventsByDay.set(key, {
      id: book.md5,
      date,
      title: book.title,
      data: {
        events: existingEvent ? [...existingEvent.data.events, event] : [event],
      },
    });
  });

  return (
    <Calendar<DayData>
      events={Array.from(eventsByDay.values())}
      eventRenderer={(spanEvents) => {
        const readingTime = shortDuration(
          getDuration(
            sum(spanEvents.flatMap(({ data }) => data.events.map(({ duration }) => duration)))
          )
        );

        return (
          <Tooltip label={`${readingTime} read`} openDelay={300}>
            <span>{book.title}</span>
          </Tooltip>
        );
      }}
    />
  );
}
