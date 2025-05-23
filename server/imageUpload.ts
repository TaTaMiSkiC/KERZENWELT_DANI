import multer from 'multer';
import sharp from 'sharp';
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

// Stvaranje direktorija za upload ako ne postoji
const uploadDir = path.join(process.cwd(), 'public', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfiguracija za pohranu uploadanih datoteka
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generiramo jedinstveno ime datoteke
    const uniqueSuffix = randomBytes(8).toString('hex');
    const extension = path.extname(file.originalname);
    cb(null, `image-${uniqueSuffix}${extension}`);
  }
});

// Filtriranje datoteka - samo slike su dozvoljene
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Dozvoljene su samo slike'));
  }
};

// Stvaranje middleware-a za upload
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB limit
  }
});

// Middleware za obradu slike nakon uploada
export const resizeImage = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return next();
  }

  try {
    const filePath = req.file.path;
    const resizedFilePath = path.join(
      path.dirname(filePath),
      `resized-${path.basename(filePath)}`
    );

    // Smanji sliku na 800x800 piksela uz očuvanje omjera
    await sharp(filePath)
      .resize(800, 800, {
        fit: sharp.fit.inside,
        withoutEnlargement: true
      })
      .toFile(resizedFilePath);

    // Obriši originalnu datoteku
    fs.unlinkSync(filePath);

    // Preimenuj smanjenu datoteku u originalno ime
    fs.renameSync(resizedFilePath, filePath);

    // Dodaj URL slike u request
    const imageUrl = `/uploads/${path.basename(filePath)}`;
    req.body.imageUrl = imageUrl;
    
    console.log(`Slika uspješno procesirana i dostupna na: ${imageUrl}`);
    
    next();
  } catch (error) {
    next(error);
  }
};