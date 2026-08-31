import { BookWithData } from '@koinsight/common/types';
import { Anchor, Badge, Flex, Image, Progress, Stack, Table, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconEyeClosed, IconHighlight } from '@tabler/icons-react';
import { JSX } from 'react';
import { NavLink } from 'react-router';
import { API_URL } from '../../api/api';
import { getBookPath } from '../../routes';
import { getLatestReadPage } from '../../utils/book-progress';
import { formatRelativeDate, getDuration, shortDuration } from '../../utils/dates';
import style from './books-table.module.css';

type BooksTableProps = {
  books: BookWithData[];
};

export function BooksTable({ books }: BooksTableProps): JSX.Element {
  const media = useMediaQuery(`(max-width: 62em)`);

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Title</Table.Th>
          <Table.Th style={{ width: '200px' }} visibleFrom="md">
            Read
          </Table.Th>
          <Table.Th style={{ width: '120px' }}>Status</Table.Th>
          <Table.Th visibleFrom="md">Pages</Table.Th>
          <Table.Th visibleFrom="md">Tracked time</Table.Th>
          <Table.Th visibleFrom="md">Last open</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {books.map((book) => {
          const bookPages =
            book.reference_pages ||
            book.device_data.reduce((acc, device) => Math.max(acc, device.pages), 0) ||
            0;
          const progressPages = book.finished ? bookPages : getLatestReadPage(book);
          const progressPercent =
            bookPages > 0 ? Math.round((progressPages / bookPages) * 100) : 0;

          return (
            <Table.Tr key={book.id}>
              <Table.Td>
                <Flex align="center" gap="sm">
                  <Anchor
                    to={getBookPath(book.id)}
                    component={NavLink}
                    className={style.BookCoverLink}
                  >
                    {book.soft_deleted ? (
                      <Tooltip label="This book is hidden" withArrow>
                        <IconEyeClosed size={13} className={style.BookHiddenIndicator} />
                      </Tooltip>
                    ) : null}
                    <Image
                      src={`${API_URL}/books/${book.id}/cover`}
                      style={{ aspectRatio: '1/1.5' }}
                      w={media ? 40 : 60}
                      fit="contain"
                      alt={book.title}
                      fallbackSrc="/book-placeholder-small.png"
                      radius="sm"
                      className={book.soft_deleted ? style.BookHidden : undefined}
                    />
                  </Anchor>
                  <Stack gap={2} justify="center">
                    <Anchor to={getBookPath(book.id)} component={NavLink} fw={800}>
                      {book.title}
                    </Anchor>
                    <span className={style.SubTitle}>
                      {book.authors ?? 'Unknown author'}
                      {book.series !== 'N/A' ? ` · ${book.series}` : ''}
                    </span>
                    {book.annotations.length > 0 && (
                      <Tooltip label={`${book.annotations.length} imported annotations`} withArrow>
                        <Flex align="center">
                          <IconHighlight size={13} />
                          &nbsp;{book.annotations.length}
                        </Flex>
                      </Tooltip>
                    )}
                  </Stack>
                </Flex>
              </Table.Td>
              <Table.Td visibleFrom="md">
                {progressPercent}%
                <Progress
                  value={progressPercent}
                  aria-label="Percentage read"
                  aria-valuetext={`${progressPercent}%`}
                />
              </Table.Td>
              <Table.Td>
              <Badge color={book.finished ? 'green' : 'gray'} variant="light" miw={90}>
                {book.finished ? 'Finished' : 'Unfinished'}
                </Badge>
              </Table.Td>
              <Table.Td visibleFrom="md">{book.total_pages}</Table.Td>
              <Table.Td visibleFrom="md">
                {book.total_read_time ? shortDuration(getDuration(book.total_read_time)) : 'N/A'}
              </Table.Td>
              <Table.Td visibleFrom="md">{formatRelativeDate(book.last_open * 1000)}</Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
