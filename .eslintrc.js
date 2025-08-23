module.exports = {
    "root": true,
    "env": {
        "node": true,
        "commonjs": true,
        "es6": true,
        "jquery": false,
        "jest": true,
        "jasmine": true
    },
    plugins: [ 'n'],
    extends: [
      'plugin:prettier/recommended',
    ],
    ignorePatterns: ['.eslintrc.js'],
    "parserOptions": {
        "sourceType": "module",
        ecmaVersion: 'latest',
    },
    "rules": {
       'n/prefer-node-protocol': 'error',
    curly: ['error', 'all'],
    eqeqeq: 'error',
    'no-console': 'off',
    'no-debugger': 'warn',
    'no-var': 'error',
    }
};
