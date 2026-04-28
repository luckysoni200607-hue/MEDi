import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  photoURL?: string;
}

export interface EmergencyContact {
  id?: string;
  name: string;
  phoneNumber: string;
  relationship?: string;
  userId: string;
}

export interface EmergencyAlert {
  id?: string;
  userId: string;
  userName: string;
  status: 'active' | 'resolved';
  latitude: number;
  longitude: number;
  timestamp: any;
}

export const userService = {
  async saveProfile(profile: UserProfile) {
    const path = `users/${profile.uid}`;
    try {
      await setDoc(doc(db, 'users', profile.uid), profile, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },
  async getProfile(uid: string) {
    const path = `users/${uid}`;
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      return snap.exists() ? (snap.data() as UserProfile) : null;
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, path);
    }
  }
};

export const contactService = {
  async addContact(contact: Omit<EmergencyContact, 'id'>) {
    const path = `users/${contact.userId}/contacts`;
    try {
      const colRef = collection(db, 'users', contact.userId, 'contacts');
      await addDoc(colRef, contact);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  },
  async deleteContact(userId: string, contactId: string) {
    const path = `users/${userId}/contacts/${contactId}`;
    try {
      await deleteDoc(doc(db, 'users', userId, 'contacts', contactId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  },
  getContacts(userId: string, callback: (contacts: EmergencyContact[]) => void) {
    const path = `users/${userId}/contacts`;
    const colRef = collection(db, 'users', userId, 'contacts');
    return onSnapshot(colRef, (snap) => {
      const contacts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmergencyContact));
      callback(contacts);
    }, (e) => {
      handleFirestoreError(e, OperationType.GET, path);
    });
  }
};

export const alertService = {
  async triggerAlert(alert: Omit<EmergencyAlert, 'id' | 'timestamp'>) {
    const path = 'alerts';
    try {
      const docRef = await addDoc(collection(db, 'alerts'), {
        ...alert,
        timestamp: serverTimestamp()
      });
      return docRef.id;
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  },
  async updateAlertLocation(alertId: string, lat: number, lng: number) {
    const path = `alerts/${alertId}`;
    try {
      await setDoc(doc(db, 'alerts', alertId), {
        latitude: lat,
        longitude: lng,
        timestamp: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  },
  async resolveAlert(alertId: string) {
    const path = `alerts/${alertId}`;
    try {
      await setDoc(doc(db, 'alerts', alertId), { status: 'resolved' }, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  }
};
