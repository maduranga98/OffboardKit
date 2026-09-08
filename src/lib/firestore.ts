import {
  doc,
  getDoc as firestoreGetDoc,
  setDoc as firestoreSetDoc,
  updateDoc as firestoreUpdateDoc,
  deleteDoc as firestoreDeleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import type {
  DocumentData,
  Firestore,
  QueryConstraint,
  WithFieldValue,
  UpdateData,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Every helper takes an optional Firestore instance so the exit portal can run
 * the same calls against the isolated `portalDb` app (see lib/firebase.ts)
 * without disturbing a signed-in HR user's session. Omitting it keeps the
 * previous behaviour of using the primary app.
 */
type Db = Firestore;

export { serverTimestamp };

export async function getDocument<T>(
  collectionName: string,
  docId: string,
  dbi: Db = db
): Promise<T | null> {
  try {
    const docRef = doc(dbi, collectionName, docId);
    const docSnap = await firestoreGetDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as T;
  } catch (error) {
    console.error(`Error getting document ${collectionName}/${docId}:`, error);
    throw error;
  }
}

export async function setDocument<T extends DocumentData>(
  collectionName: string,
  docId: string,
  data: WithFieldValue<T>,
  dbi: Db = db
): Promise<void> {
  try {
    const docRef = doc(dbi, collectionName, docId);
    await firestoreSetDoc(docRef, data);
  } catch (error) {
    console.error(`Error setting document ${collectionName}/${docId}:`, error);
    throw error;
  }
}

export async function updateDocument<T extends DocumentData>(
  collectionName: string,
  docId: string,
  data: UpdateData<T>,
  dbi: Db = db
): Promise<void> {
  try {
    const docRef = doc(dbi, collectionName, docId);
    await firestoreUpdateDoc(docRef, data);
  } catch (error) {
    console.error(`Error updating document ${collectionName}/${docId}:`, error);
    throw error;
  }
}

export async function deleteDocument(
  collectionName: string,
  docId: string,
  dbi: Db = db
): Promise<void> {
  try {
    const docRef = doc(dbi, collectionName, docId);
    await firestoreDeleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting document ${collectionName}/${docId}:`, error);
    throw error;
  }
}

export async function queryDocuments<T>(
  collectionName: string,
  constraints: QueryConstraint[],
  dbi: Db = db
): Promise<T[]> {
  try {
    const q = query(collection(dbi, collectionName), ...constraints);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(
      (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as T
    );
  } catch (error) {
    console.error(`Error querying collection ${collectionName}:`, error);
    throw error;
  }
}

export function subscribeToDocument<T>(
  collectionName: string,
  docId: string,
  callback: (data: T | null) => void,
  dbi: Db = db
): Unsubscribe {
  const docRef = doc(dbi, collectionName, docId);
  return onSnapshot(docRef, (docSnap) => {
    if (!docSnap.exists()) {
      callback(null);
      return;
    }
    callback({ id: docSnap.id, ...docSnap.data() } as T);
  });
}

export function subscribeToCollection<T>(
  collectionName: string,
  constraints: QueryConstraint[],
  callback: (data: T[]) => void,
  dbi: Db = db
): Unsubscribe {
  const q = query(collection(dbi, collectionName), ...constraints);
  return onSnapshot(q, (querySnapshot) => {
    const results = querySnapshot.docs.map(
      (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as T
    );
    callback(results);
  });
}

export { where, orderBy, limit, collection, doc, query };
