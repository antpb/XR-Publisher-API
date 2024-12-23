// webpack.config.js
const path = require('path');

module.exports = {
  target: 'webworker',
  entry: './src/worker.js',
  mode: 'production',
  externals: {
    '@langchain/core/documents': '@langchain/core/documents',
    '@langchain/core/utils/tiktoken': '@langchain/core/utils/tiktoken',
    '@langchain/textsplitters': '@langchain/textsplitters',
    'fastembed': 'fastembed',
    '@fal-ai/client': '@fal-ai/client',
    // Add this line:
    'cloudflare:workers': 'self'
  },
  resolve: {
    alias: {
      '@ai16z/eliza': path.resolve(__dirname, 'src/components/eliza-core')
    }
  }
};