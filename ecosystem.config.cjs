module.exports = {
  apps: [
    {
      name: "zorah-backend",
      script: "./src/app.js",
      cwd: "/home/ec2-user/Zorah",
      kill_timeout: 5000,
      listen_timeout: 8000,
      wait_ready: false,
      max_restarts: 10,
      env: {
        PORT: 4000,
        NODE_ENV: "production",
        DOTENV_CONFIG_PATH: ".env.production"
      }
    },
    {
      name: "zorah-staging",
      script: "./src/app.js",
      cwd: "/home/ec2-user/Zorah",
      kill_timeout: 5000,
      listen_timeout: 8000,
      wait_ready: false,
      max_restarts: 10,
      env: {
        PORT: 4001,
        NODE_ENV: "staging",
        DOTENV_CONFIG_PATH: ".env.staging"
      }
    }
  ]
};
