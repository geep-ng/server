import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

export function initFirebase(): admin.app.App {
    if (admin.apps.length) return admin.app();

    const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '../../firebase-service-account.json';
    if (!fs.existsSync(keyPath)) {
        console.warn('Firebase service account file not found at', keyPath);
    }

    const serviceAccount = JSON.parse(
        fs.readFileSync(path.resolve(keyPath), 'utf8')
    ) as admin.ServiceAccount;

    const appOptions: admin.AppOptions = {
        credential: admin.credential.cert(serviceAccount),
        ...(process.env.FIREBASE_STORAGE_BUCKET ? { storageBucket: process.env.FIREBASE_STORAGE_BUCKET } : {}),
    };

    return admin.initializeApp(appOptions);
}
