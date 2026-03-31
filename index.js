const express = require('express');
const app = express();

app.use(express.json());

app.post('/webhook', (req, res) => {
  const message = req.body;
  console.log('Message received:', JSON.stringify(message));
  res.sendStatus(200);
});

app.get('/webhook', (req, res) => {
  res.send('Bot is running!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Bot server running on port ' + PORT);
});
