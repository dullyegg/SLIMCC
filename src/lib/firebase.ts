import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { firebaseConfig as defaultFirebaseConfig } from './firebase.config';

function resolveFirebaseConfig() {
  const env = (import.meta as any).env ?? {};
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || defaultFirebaseConfig.authDomain,
    projectId: env.VITE_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || defaultFirebaseConfig.storageBucket,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultFirebaseConfig.messagingSenderId,
    appId: env.VITE_FIREBASE_APP_ID || defaultFirebaseConfig.appId,
  };
}

const firebaseConfig = resolveFirebaseConfig();
const isFirebaseConfigured = !!firebaseConfig.projectId;

export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const db = app ? getFirestore(app) : null;

export async function suggestFoodsFromDatabase(prefix: string): Promise<string[]> {
  if (!db || !prefix.trim()) return [];
  try {
    const foodsRef = collection(db, 'foods');
    const q = query(
      foodsRef,
      where('name', '>=', prefix),
      where('name', '<=', prefix + '\uf8ff'),
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data().name).filter(Boolean);
  } catch (error) {
    console.error('Error fetching suggestions from Firebase:', error);
    return [];
  }
}

export async function searchFoodInDatabase(foodName: string) {
  if (!db) {
    console.warn('Firebase is not configured. Skipping database search.');
    return null;
  }

  try {
    const foodsRef = collection(db, 'foods');
    const q = query(foodsRef, where('name', '==', foodName));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as any;
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      console.warn('Firebase permission denied. Falling back to AI.');
    } else {
      console.error('Error searching Firebase:', error);
    }
    return null;
  }
}