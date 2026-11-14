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
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
  ],
};
