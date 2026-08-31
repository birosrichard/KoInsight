import { Book } from '@koinsight/common/types';
import { Button, FileInput, Flex, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { FormEvent, useState } from 'react';
import { mutate } from 'swr';
import { uploadBookCover, uploadBookCoverFromUrl } from '../../../api/books';

export type BookUploadCoverProps = {
  book: Book;
  showTitle?: boolean;
  onChange?: () => void;
};

export function BookUploadCover({ book, showTitle = true, onChange }: BookUploadCoverProps) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState('');

  const onSuccess = async () => {
    // FIXME: this doesn't seem to work.
    await mutate('books');
    await mutate(`books/${book.id}`);
    notifications.show({
      title: 'Success',
      message: 'Cover updated successfully.',
      position: 'top-center',
      color: 'green',
    });
    setMessage('Cover updated');
    onChange?.();
    close();
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file && !url.trim()) {
      return;
    }

    try {
      let response: Response;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        response = await uploadBookCover(book.id, formData);
      } else {
        response = await uploadBookCoverFromUrl(book.id, url.trim());
      }

      if (response.ok) {
        await onSuccess();
      } else {
        setMessage('Failed to update cover.');
      }
    } catch (error) {
      setMessage(`Error: ${error}`);
    }
  };

  return (
    <div>
      {showTitle && (
        <Title order={3} mb="md">
          Upload cover
        </Title>
      )}
      <form onSubmit={handleUpload} encType="multipart/form-data">
        <Flex align="flex-end" gap="md" wrap="wrap">
          <FileInput
            w={200}
            label="File"
            placeholder="cover.png"
            value={file}
            onChange={(value) => {
              setFile(value);
              if (value) setUrl('');
            }}
            accept=".png,.jpg,.jpeg,.gif"
          />
          <TextInput
            w={360}
            label="Image URL"
            type="url"
            placeholder="https://example.com/cover.jpg"
            value={url}
            onChange={(event) => {
              setUrl(event.currentTarget.value);
              if (event.currentTarget.value) setFile(null);
            }}
          />
          <Button type="submit" color="violet" disabled={!file && !url.trim()}>
            Upload
          </Button>
        </Flex>
        {message && <p>{message}</p>}
      </form>
    </div>
  );
}
