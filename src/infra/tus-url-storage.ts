import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

const PREFIX = 'cloud.media.tus::';

/** La forme persistée attendue par tus-js-client. */
type StoredUpload = {
  size: number | null;
  metadata: Record<string, string>;
  creationTime: string;
  urlStorageKey: string;
  uploadUrl: string | null;
  parallelUploadUrls: string[] | null;
};

/**
 * React Native n'a pas `localStorage`. Sans cet adaptateur, TUS reprend une
 * coupure pendant le même lancement mais oublie tout quand l'app est tuée.
 */
export const tusUrlStorage = {
  async findAllUploads(): Promise<StoredUpload[]> {
    return read(PREFIX);
  },

  async findUploadsByFingerprint(fingerprint: string): Promise<StoredUpload[]> {
    return read(`${PREFIX}${fingerprint}::`);
  },

  async removeUpload(urlStorageKey: string): Promise<void> {
    await AsyncStorage.removeItem(urlStorageKey);
  },

  async addUpload(fingerprint: string, upload: StoredUpload): Promise<string> {
    const key = `${PREFIX}${fingerprint}::${randomUUID()}`;
    await AsyncStorage.setItem(key, JSON.stringify(upload));
    return key;
  },
};

async function read(prefix: string): Promise<StoredUpload[]> {
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(prefix));
  if (keys.length === 0) return [];

  const entries = await AsyncStorage.multiGet(keys);
  return entries.flatMap(([key, serialized]) => {
    if (serialized === null) return [];
    try {
      return [{ ...(JSON.parse(serialized) as StoredUpload), urlStorageKey: key }];
    } catch {
      // Une entrée abîmée ne doit pas condamner toutes les sauvegardes.
      void AsyncStorage.removeItem(key);
      return [];
    }
  });
}
