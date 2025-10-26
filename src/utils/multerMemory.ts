import multer, { StorageEngine } from 'multer';

// store uploads in memory so we can forward to Firebase without writing to disk
const storage: StorageEngine = multer.memoryStorage();
const upload = multer({ storage });

export default upload;
