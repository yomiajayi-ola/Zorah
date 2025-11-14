import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.json());

app.post("/send-notification", async (req, res) => {
  const { token, title, message } = req.body;

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: token,
      sound: "default",
      title,
      body: message,
    }),
  });

  const data = await response.json();
  res.json(data);
});

const PORT = 4000;
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));

// import "./cron/payoutCron.js"