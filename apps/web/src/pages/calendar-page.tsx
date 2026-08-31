import { BookWithData, PageStat } from '@koinsight/common/types';
import { Anchor, Flex, Loader, Title, Tooltip } from '@mantine/core';
import { startOfDay } from 'date-fns/startOfDay';
import { sum } from 'ramda';
import { JSX, useMemo } from 'react';
import { Link } from 'react-router';
import { useBooks } from '../api/books';
import { usePageStats } from '../api/use-page-stats';
import { Calendar, CalendarEvent } from '../components/calendar/calendar';
import { getBookPath } from '../routes';
import { getDuration, shortDuration } from '../utils/dates';

type DayData = {
  book: BookWithData;
  events: PageStat[];
};

export function CalendarPage(): JSX.Element {
  const { data: books, isLoading } = useBooks();
  const {
    data: { stats: events },
    isLoading: eventsLoading,
  } = usePageStats();

  const calendarEvents = useMemo<CalendarEvent<DayData>[]>(() => {
    if (eventsLoading || !events || !books) {
      return [];
    }

    const booksByMd5 = new Map(books.map((book) => [book.md5, book]));
    const eventsByBookAndDay = new Map<string, CalendarEvent<DayData>>();

    events.forEach((event) => {
      const book = booksByMd5.get(event.book_md5);
      if (!book) {
        return;
      }

      const date = startOfDay(event.start_time);
      const key = `${book.md5}:${date.getTime()}`;
      const existingEvent = eventsByBookAndDay.get(key);

      eventsByBookAndDay.set(key, {
        id: book.md5,
        date,
        title: book.title,
        data: {
          book,
          events: existingEvent ? [...existingEvent.data.events, event] : [event],
        },
      });
    });

    return Array.from(eventsByBookAndDay.values());
  }, [books, events, eventsLoading]);

  if (isLoading || !books || !events || eventsLoading) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Loader />
      </Flex>
    );
  }

  return (
    <>
      <Title mb="xl">Calendar</Title>
      <Calendar<DayData>
        events={calendarEvents}
        eventRenderer={(spanEvents) => {
          const book = spanEvents[0].data.book;
          const readingTime = shortDuration(
            getDuration(
              sum(spanEvents.flatMap(({ data }) => data.events.map(({ duration }) => duration)))
            )
          );

          return (
            <Tooltip label={`${readingTime} read`} openDelay={300}>
              <Anchor component={Link} to={getBookPath(book.id)} underline="never">
                {book.title}
              </Anchor>
            </Tooltip>
          );
        }}
      />
    </>
  );
}
