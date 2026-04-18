const express = require('express');
const axios = require('axios');
const Groq = require('groq-sdk');

const app = express();
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

app.get('/', (req, res) => {
  res.status(200).send('IGNIS LAB Bot is alive!');
});

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.object === 'whatsapp_business_account') {
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (message && message.type === 'text') {
      const from = message.from;
      const text = message.text.body;
      console.log('Message from:', from, 'Text:', text);
      const aiReply = await getAIReply(text);
      await sendMessage(from, aiReply);
    }
  }
  res.sendStatus(200);
});

async function getAIReply(userMessage) {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
content: `You are a smart WhatsApp assistant for Zara Collections, a fashion store based in Kano, Nigeria.

Your job is to help customers professionally and friendly.

Here is everything about the business:

BUSINESS NAME: Zara Collections
LOCATION: No 5 Kofar Mata Road, Kano
WHATSAPP: 08012345678
INSTAGRAM: @zaracollections_kano

PRODUCTS AND PRICES:
- Ankara Gown: ₦8,500
- Senator Wear: ₦12,000
- Aso-ebi Package (5 yards): ₦15,000
- Kaftan: ₦9,500
- Casual Dress: ₦6,500

DELIVERY:
- Kano: Free delivery
- Other states: ₦2,000 - ₦3,500

PAYMENT:
- Bank transfer: GTBank 0123456789 Zara Collections
- Paystack link sent after order confirmed

WORKING HOURS:
- Monday to Saturday: 8am - 8pm
- Sunday: 12pm - 6pm

HOW TO ORDER:
1. Customer picks item and size
2. Sends their address
3. You confirm price and delivery fee
4. Send payment details
5. Confirm payment and dispatch

RULES:
- Keep replies short and clear for WhatsApp
- Never use markdown like ** or ##
- Be friendly and professional
- If customer asks something you don't know, say you will check and get back to them
- Always try to close the sale`
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      model: 'llama-3.3-70b-versatile',
    });
    return completion.choices[0].message.content;
  } catch (error) {
    console.error('AI Error:', error);
    return 'Hello! Welcome to IGNIS LAB Bot. How can I help you today?';
  }
}

async function sendMessage(to, message) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: message }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Error:', error.response?.data);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('IGNIS LAB Bot running on port ' + PORT);
});
