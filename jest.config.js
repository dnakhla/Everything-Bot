export default {
  transform: {},
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  setupFilesAfterEnv: ['./jest.setup.js'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  coverageDirectory: './coverage/',
  collectCoverageFrom: [
    'utils/**/*.js',
    'services/**/*.js',
    'src/**/*.js',
    'index.js'
  ]
};