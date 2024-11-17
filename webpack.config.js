const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    sidepanel: './src/sidepanel/index.tsx',
    content: './src/content/index.tsx',
    background: './src/background/index.ts',
    options: './src/options/index.tsx'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/i,
        type: 'asset/resource',
        generator: {
          filename: '[name][ext]'
        }
      }
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { 
          from: 'public',
          to: '.',
          globOptions: {
            ignore: ['**/manifest.json']
          }
        },
        {
          from: 'public/manifest.json',
          to: 'manifest.json',
          transform(content) {
            return Buffer.from(JSON.stringify({
              ...JSON.parse(content.toString()),
              web_accessible_resources: [{
                resources: ['icon.png'],
                matches: ['<all_urls>']
              }]
            }, null, 2))
          }
        }
      ],
    }),
  ],
};
