const express = require('express');
const axios = require('axios');
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

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
    if (message) {
      const from = message.from;

      if (message.type === 'text') {
        const text = message.text.body;
        console.log('Text from:', from, ':', text);
        const aiReply = await getAIReply(text);
        await sendMessage(from, aiReply);

      } else if (message.type === 'audio') {
        console.log('Voice note from:', from);
        await sendMessage(from, '⏳ Processing your voice note...');
        const audioId = message.audio.id;
        const transcription = await transcribeAudio(audioId);
        console.log('Transcription:', transcription);
        const aiReply = await getAIReply(transcription);
        await sendMessage(from, aiReply);

      } else {
        await sendMessage(from, 'Hello! I can respond to text and voice messages. How can I help you?');
      }
    }
  }
  res.sendStatus(200);
});

async function transcribeAudio(audioId) {
  try {
    const mediaResponse = await axios.get(
      `https://graph.facebook.com/v18.0/${audioId}`,
      {
        headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
      }
    );
    const audioUrl = mediaResponse.data.url;

    const audioResponse = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
    });

    const audioPath = path.join('/tmp', `audio_${Date.now()}.ogg`);
    fs.writeFileSync(audioPath, audioResponse.data);

    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-large-v3',
      language: 'en'
    });

    fs.unlinkSync(audioPath);
    return transcription.text;
  } catch (error) {
    console.error('Transcription error:', error);
    return 'I received your voice note but could not understand it. Please try sending a text message.';
  }
}

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
- Ankara Gown: 8,500 naira
- Senator Wear: 12,000 naira
- Aso-ebi Package 5 yards: 15,000 naira
- Kaftan: 9,500 naira
- Casual Dress: 6,500 naira

DELIVERY:
- Kano: Free delivery
- Other states: 2,000 to 3,500 naira

PAYMENT:
- Bank transfer: GTBank 0123456789 Zara Collections
- Paystack link sent after order confirmed

WORKING HOURS:
- Monday to Saturday: 8am to 8pm
- Sunday: 12pm to 6pm

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
- Always try to close the sale
- If asked something you don't know say you will check and get back`
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
    return 'Hello! Welcome to Zara Collections. How can I help you today?';
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
