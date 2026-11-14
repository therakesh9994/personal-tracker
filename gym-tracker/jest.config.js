/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      // Pure logic + real SQLite (better-sqlite3) tests. Runs in Node.
      displayName: 'logic',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
      transform: { '^.+\\.[jt]sx?$': ['babel-jest', { configFile: './babel.config.js' }] },
      transformIgnorePatterns: ['node_modules/(?!(drizzle-orm|date-fns|fflate)/)'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
      setupFiles: ['<rootDir>/jest.setup.logic.js'],
    },
    {
      // Component tests using the Expo preset.
      displayName: 'ui',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/src/**/__tests__/**/*.test.tsx'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        // The package's ESM entry is .mjs, which jest-expo does not transform.
        '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
      },
      // jest-expo's default list plus the ESM-only packages that screens import.
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|lucide-react-native|victory-native|@shopify/.*|drizzle-orm|date-fns|fflate|standard-navigation)',
      ],
      setupFiles: ['<rootDir>/jest.setup.logic.js'],
    },
  ],
};
