module.exports = {
  apps: [
    {
      name: "zorah-backend",
      script: "./src/app.js",
      env: {
        PORT: 4000,
        NODE_ENV: "production"
      }
    }
  ]
};
