import { NextFunction, Request, Response, Router } from 'express';
import { unlink } from 'fs';
import multer from 'multer';
import { appConfig } from '../../config';
import { getBookById } from '../get-book-by-id-middleware';
import { CoversService } from './covers-service';

const router = Router({ mergeParams: true });

/**
 * Fetches a book cover by book id
 */
router.get('/', getBookById, async (req: Request, res: Response) => {
  const book = req.book!;

  try {
    const coverPath = await CoversService.get(book);
    if (coverPath) {
      res.sendFile(coverPath);
    } else {
      res.status(404).send({ error: 'Cover not found' });
    }
  } catch (error) {
    console.error('Error fetching cover:', error);
    res.status(500).send({ error: 'Error fetching cover' });
  }
});

const upload = multer({
  dest: appConfig.coversPath,
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif'];
    if (
      file.mimetype === 'application/octet-stream' ||
      allowedExtensions.some((ext) => file.originalname.endsWith(ext))
    ) {
      cb(null, true); // Accept the file
    } else {
      cb(new Error(`Only ${allowedExtensions.join(', ')} files are allowed`));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * Uploads a book cover by book id
 */
router.post(
  '/',
  getBookById,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    const book = req.book!;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Missing file upload' });
      return next();
    }

    try {
      await CoversService.upload(book, file);

      res.send({ message: 'Cover updated' });
    } catch (error) {
      // Cleanup uploaded file if there's an error
      if (file?.path) {
        try {
          unlink(file.path, () => {});
        } catch (_) {
          // ignore cleanup errors
        }
      }
      console.log('Error uploading cover:', error);
      res.status(500).send({ message: 'Unable to update cover' });
    }
  }
);

/** Downloads a book cover from a public image URL. */
router.put('/', getBookById, async (req: Request, res: Response) => {
  const url = req.body.url;
  if (typeof url !== 'string' || !url.trim()) {
    res.status(400).json({ error: 'Missing cover URL' });
    return;
  }

  try {
    await CoversService.uploadFromUrl(req.book!, url);
    res.send({ message: 'Cover updated' });
  } catch (error) {
    console.log('Error downloading cover:', error);
    res.status(400).send({ message: 'Unable to download cover' });
  }
});

export { router as coversRouter };
