module.exports = {
  apps: [
    {
      name: "zorah-backend",
      script: "./src/app.js",
      args: "dotenv_config_path=.env.production",
      node_args: "--require dotenv/config",
      env: {
        PORT: 4000,
        NODE_ENV: "production"
      }
    },
    {
      name: "zorah-staging",
      script: "./src/app.js",
      args: "dotenv_config_path=.env.staging",
      node_args: "--require dotenv/config",
      env: {
        PORT: 4001,
        NODE_ENV: "staging"
      }
    }
  ]
};
