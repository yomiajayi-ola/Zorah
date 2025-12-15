module.exports = {
    apps: [
      {
        name: "zorah",
        script: "./src/app.js",
        env: {
          PORT: 4000,
          NODE_ENV: "production",
          SMTP_HOST: "smtp.gmail.com",
          SMTP_PORT: 587,
          SMTP_USER: "getzorah@gmail.com",
          SMTP_PASS: "fktz cnbs byjy edim",
          // ...all other vars
        }
      }
    ]
  };
  