module.exports = {
  apps: [
    {
      name: "zorah-backend",
      script: "./src/app.js",
      env: {
        PORT: 4000,
        NODE_ENV: "production",
        DOTENV_CONFIG_PATH: ".env.production"
      }
    },
    {
      name: "zorah-staging",
      script: "./src/app.js",
      env: {
        PORT: 4001,
        NODE_ENV: "staging",
        DOTENV_CONFIG_PATH: ".env.staging"
      }
    }
  ]
};
