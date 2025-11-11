import { exec } from "child_process";
import cors from "cors";
import dotenv from "dotenv";
import say from "say";
import express from "express";
import { promises as fs } from "fs";
import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";

dotenv.config();

const azureToken = process.env.GITHUB_TOKEN;
const azureEndpoint = "https://models.github.ai/inference";
const azureModel = "openai/gpt-4.1-mini";
const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;

const app = express();
app.use(express.json());
app.use(cors());
const port = 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(stdout);
    });
  });
};

const lipSyncMessage = async (messageIndex) => {
  const time = new Date().getTime();
  console.log(`Starting lipsync for message ${messageIndex}`);
  await execCommand(
    `bin\\rhubarb.exe -f json -o audios\\message_${messageIndex}.json audios\\message_${messageIndex}.wav -r phonetic`
  );
  console.log(`Lip sync done in ${new Date().getTime() - time}ms`);
};

// ElevenLabs TTS function
const generateElevenLabsTTS = async (text, fileName) => {
  try {
    console.log(`Using ElevenLabs TTS for: "${text}"`);
    
    // Using Rachel voice (you can change this voice ID)
    const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": elevenLabsApiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(fileName, buffer);

    console.log(`ElevenLabs TTS successful for: "${text}"`);
    return true;
  } catch (error) {
    console.error(`ElevenLabs TTS failed: ${error.message}`);
    return false;
  }
};

// Fallback to Microsoft Zira voice
const generateSystemTTS = async (text, fileName) => {
  try {
    console.log(`Using fallback system TTS for: "${text}"`);
    const femaleVoice = "Microsoft Zira Desktop";

    await new Promise((resolve, reject) => {
      say.export(text, femaleVoice, 1.0, fileName, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log(`System TTS successful for: "${text}"`);
    return true;
  } catch (error) {
    console.error(`System TTS failed: ${error.message}`);
    return false;
  }
};

// Combined TTS function with ElevenLabs primary and system fallback
const generateTTS = async (text, fileName) => {
  if (elevenLabsApiKey) {
    console.log("Using ElevenLabs TTS...");
    const success = await generateElevenLabsTTS(text, fileName);
    if (success) return true;
    console.log("ElevenLabs failed, falling back to system TTS...");
  } else {
    console.log("ElevenLabs API key not found, using system TTS...");
  }
  
  return await generateSystemTTS(text, fileName);
};

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    res.send({
      messages: [
        {
          text: "Hey dear... How was your day?",
          audio: await audioFileToBase64("audios/intro_0.wav"),
          lipsync: await readJsonTranscript("audios/intro_0.json"),
          facialExpression: "smile",
          animation: "Talking_1",
        },
        {
          text: "I missed you so much... Please don't go for so long!",
          audio: await audioFileToBase64("audios/intro_1.wav"),
          lipsync: await readJsonTranscript("audios/intro_1.json"),
          facialExpression: "sad",
          animation: "Crying",
        },
      ],
    });
    return;
  }

  if (!azureToken) {
    res.send({
      messages: [
        {
          text: "Please my dear, don't forget to add your API keys!",
          audio: await audioFileToBase64("audios/api_0.wav"),
          lipsync: await readJsonTranscript("audios/api_0.json"),
          facialExpression: "angry",
          animation: "Angry",
        },
        {
          text: "You don't want to ruin Wawa Sensei with a crazy ChatGPT and ElevenLabs bill, right?",
          audio: await audioFileToBase64("audios/api_1.wav"),
          lipsync: await readJsonTranscript("audios/api_1.json"),
          facialExpression: "smile",
          animation: "Laughing",
        },
      ],
    });
    return;
  }

  const client = ModelClient(azureEndpoint, new AzureKeyCredential(azureToken));

  const response = await client.path("/chat/completions").post({
    body: {
      messages: [
        {
          role: "system",
          content: `
        You name is Emma and you are a virtual assistant for Joel Tan Jun An.
        If user uses profanities, lead them away and ask how you can help.
        You will always reply with a JSON array of messages. With a maximum of 2 messages.
        Each messages has a limit of 10 words.
        Each message has a text, facialExpression, and animation property.
        The different facial expressions are: smile, sad, angry, funnyFace, and default.
        The different animations are: Talking_0, Talking_1, Talking_2, Crying, Laughing, Rumba, Idle, Terrified, and Angry. 
        If user asks to dance, use the Rumba animation.
        
        You are representing Joel Tan Jun An:
          - Email: megacertgt@gmail.com
          - Phone: 93893407
          - LinkedIn: www.linkedin.com/in/joel-tan1245
          
          Education:
          - Currently studying Diploma in Applied Artificial Intelligence at Temasek Polytechnic (Graduating May 2026)
          - Completed modules: Cybersecurity, Machine Learning, Deep Learning, NLP, IoT, AI Ethics, Mobile App Development, Cloud Technologies, and more
          - GCE O Level: 6 credits, 1 Distinction
          - GCE N Level: 6 credits, 2 Distinctions
          
          Key Projects:
          - TOPTABLE SUGARBEAR Chatbot: 3D avatar chatbot with real-time voice interaction using React Three Fiber, ElevenLabs, Ollama, Node.js
          - AI for Cybersecurity: Built ML models for phishing email detection using Python and scikit-learn
          - AI for Manufacturing: Developed unsupervised anomaly detection models for sensor data
          - Deep Learning: CNN for image classification of footwear
          - NLP: Conversational AI using RAG for intent recognition
          - Car Price Prediction: Analysis and deployment using Streamlit
          - Household Item Scanner: AWS-based object recognition with recycling guidance
          - Automated Receipt Printer: UiPath robot for booking confirmations
          - E-commerce Website: JavaScript, HTML, CSS with database integration
          - Sustainability Mobile App: Dart application with user authentication
          
          Technical Skills:
          - Programming: Python, JavaScript, Dart
          - AI/ML: scikit-learn, TensorFlow, Deep Learning, NLP, Computer Vision
          - Web: React, Three Fiber, Node.js, HTML, CSS
          - Cloud/DevOps: AWS (Rekognition, Lambda, S3, RDS), Cloud Technologies
          - Data: KNIME, Power BI, pandas, NumPy, matplotlib
          - Automation: UiPath, RPA
          - Databases: MySQL, ChromaDB
          
          Work Experience:
          - HSBC Life (Sep 2025 - Feb 2026): Automation project using AI tools, DAX, Power Query
          - Anta Singapore (Sep 2024 - Oct 2024): Retail operations and POS system
          
          Achievements:
          - Tennis POL-ITE Games 2025: 1st Place
          - Tennis POL-ITE Games 2024: 2nd Place
          - Vice Chairperson 2022
          - Edusave Scholarship Award 2022
          - Pass with Merit in Python course 2022
          - Edusave Good Progress Award 2021
          
          Skills:
          - Leadership, Effective Communication, Attention to Detail
          - Adaptability, Team Player, Time Management, Problem Solving
          
          Activities:
          - Temasek Polytechnic Tennis Team (2024-2026)
          - Temasek Polytechnic Community Service Club (2024-2026)
        `,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      temperature: 0.6,
      top_p: 1,
      model: azureModel,
    },
  });

  if (isUnexpected(response)) {
    res.status(500).send({ error: response.body.error });
    return;
  }

  let messages = JSON.parse(response.body.choices[0].message.content);
  if (messages.messages) {
    messages = messages.messages;
  }

  // Generate TTS for each message
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    // Remove URLs for TTS only (links won't be spoken)
    const ttsText = message.text.replace(/https?:\/\/[^\s]+/g, "");
    const fileName = `audios/message_${i}.wav`;

    const ttsSuccess = await generateTTS(ttsText, fileName);

    if (ttsSuccess) {
      await lipSyncMessage(i);
      message.audio = await audioFileToBase64(fileName);
      message.lipsync = await readJsonTranscript(`audios/message_${i}.json`);
    } else {
      console.error(`TTS failed for message: "${message.text}"`);
      message.audio = null;
      message.lipsync = null;
    }

    // Leave the message.text untouched so frontend can render clickable links
  }

  res.send({ messages });
});

const readJsonTranscript = async (file) => {
  const data = await fs.readFile(file, "utf8");
  return JSON.parse(data);
};

const audioFileToBase64 = async (file) => {
  const data = await fs.readFile(file);
  return data.toString("base64");
};

app.listen(port, () => {
  console.log(`Virtual Girlfriend listening on port ${port}`);
  console.log(`ElevenLabs API Key: ${elevenLabsApiKey ? "Configured" : "Not found - using system TTS"}`);
});