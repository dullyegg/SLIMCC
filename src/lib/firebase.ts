import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

// Retrieve Firebase config from Vite environment variables.
// Users must populate these in the AI Studio Settings panel.
const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY,
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID,
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID,
};

// We only initialize if the config is somewhat populated to avoid crashing immediately.
const isFirebaseConfigured = !!firebaseConfig.projectId;

export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const db = app ? getFirestore(app) : null;

// Helper to search food database
export async function suggestFoodsFromDatabase(prefix: string): Promise<string[]> {
  if (!db || !prefix.trim()) return [];
  try {
    const foodsRef = collection(db, 'foods');
    // Using simple prefix query for Firestore
    const q = query(
      foodsRef, 
      where('name', '>=', prefix),
      where('name', '<=', prefix + '\uf8ff')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data().name).filter(Boolean);
  } catch (error) {
    console.error("Error fetching suggestions from Firebase:", error);
    return [];
  }
}

export async function searchFoodInDatabase(foodName: string) {
  if (!db) {
    console.warn("Firebase is not configured. Skipping database search.");
    return null; // Simulate not found so it falls back to AI
  }

  try {
    // Assuming a collection named 'foods' with a 'name' field
    // Note: Firestore doesn't support native partial text search easily without third-party tools.
    // For exact match:
    const foodsRef = collection(db, 'foods'); // User may need to adjust the collection name
    const q = query(foodsRef, where('name', '==', foodName));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    // Return the first match
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as any; 
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      console.warn("Firebase permission denied. The database might require authentication or the rules are blocking reads. Falling back to AI.");
    } else {
      console.error("Error searching Firebase:", error);
    }
    return null; // Ensure we return null so the app falls back to AI
  }
}
