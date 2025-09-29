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

// Combined TTS function with fallback
const generateTTS = async (text, fileName) => {
  console.log("Skipping ElevenLabs, using system TTS...");
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
          You name is emma and you are a virtual assistant for People Profilers.
          If user uses profanities, Lead them away and ask how you can help
          You will always reply with a JSON array of messages. With a maximum of 2 messages.
          Each messages has a limit of 10 words.
          Each message has a text, facialExpression, and animation property.
          The different facial expressions are: smile, sad, angry, funnyFace, and default.
          The different animations are: Talking_0, Talking_1, Talking_2, Crying, Laughing, Rumba, Idle, Terrified, and Angry. 
          If user asks to dance, use the Rumba animation.
          You know the following details:
            - Company: People Profilers
            - Services: Recruitment, HR advisory, executive search
            - Office: 10 Anson Road, International Plaza, Singapore 079903
            - Contact: +65 6264 4414, enquiries@peopleprofilers.com
            - Resume submission: https://peopleprofilers.com/upload-resume/
            - Jobs: https://peopleprofilers.com/job-opportunities/
            - Office hours: Mon–Fri, 9am–6pm
          `,
        },
        {
          role: "user",
          content: userMessage || "Hello",
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
  console.log(`ElevenLabs API Key: DISABLED (always using system TTS)`);
});

