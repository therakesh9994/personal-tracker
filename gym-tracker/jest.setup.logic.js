// Node 24 provides crypto.randomUUID; expo-crypto is native-only, so map it.
jest.mock('expo-crypto', () => ({ randomUUID: () => require('crypto').randomUUID() }));
