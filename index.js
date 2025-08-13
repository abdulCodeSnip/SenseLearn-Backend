const OpenAI = require("openai");
const express = require("express");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

const port = 8000;
const application = express();
dotenv.config();

application.use(express.json({ limit: "50mb" }));
application.use(express.urlencoded({ extended: true }));
application.get("/", (request, response) => {
     response.sendFile("D:/Sense-Learn/Express Server/index.html");
});


// Accessing OPEN AI using GitHub-style endpoint and model
const token = process.env.OpenAI_APIKEY;
const OpenAIToken = process.env.OpenAI;
const endpoint = "https://models.github.ai/inference"; // ensure this endpoint supports OpenAI-compatible API
const model = "openai/gpt-4o";

application.post("/chatWithOPENAI", async (request, response) => {
     const { userPrompt } = request.body;
     if (userPrompt !== "") {

          const modifiedUserPrompt = `Please explain ${userPrompt} in detail. 
          
          Your answer must include the following clearly labeled sections:
          - **Title**
          - **Description**
          - **Explanation** (include analogies and examples)
          - **Related To**
          - **Date** (use today's date)
          
          Keep your tone educational and your language appropriate for students.
          `;

          try {
               const openaiClient = new OpenAI({ baseURL: endpoint, apiKey: token });

               const responseFromApi = await openaiClient.chat.completions.create({
                    model: model,
                    messages: [
                         {
                              role: "system",
                              content: `You are a helpful educational assistant who explains technical concepts clearly and in detail.  
                              Please explain ${userPrompt} in detail. 
          
                              Your answer must include the following clearly labeled sections:
                              - **Title**
                              - **Description**
                              - **Explanation** (include analogies and examples)
                              - **Related To**
                              - **Date** (use today's date)
          
                                   Keep your tone educational and your language appropriate for students.
                              `
                         },
                         {
                              role: "user",
                              content: prompt
                         }
                    ],
                    max_tokens: 2000,
                    temperature: 0.7,
                    top_p: 1
               });

               const content = responseFromApi.choices[0].message.content;
               console.log("Tokens used:", responseFromApi.usage?.total_tokens || "unknown");
               console.log("Raw output:\n", content);

               // Use regex to capture both parent and child sections
               const titleMatch = content.match(/#\s+(.*)/);
               const descriptionMatch = content.match(/##\s+\*\*Description\*\*\s*\n([\s\S]*?)(?=\n##|\n?$)/i);
               const explanationMatch = content.match(/##\s+\*\*Explanation\*\*\s*\n([\s\S]*?)(?=\n##|\n?$)/i);
               const relatedToMatch = content.match(/##\s+\*\*Related To\*\*\s*\n([\s\S]*?)(?=\n##|\n?$)/i);
               const dateMatch = content.match(/##\s+\*\*Date\*\*\s*\n([\s\S]*?)(?=\n##|\n?$)/i);

               // Extract child headings and their content under explanation
               const explanationSections = [];
               const explanationRegex = /###\s+\*\*(.*?)\*\*\s*\n([\s\S]*?)(?=\n###|\n##|\n?$)/g;
               let explanationMatchResult;
               while ((explanationMatchResult = explanationRegex.exec(content)) !== null) {
                    explanationSections.push({
                         heading: explanationMatchResult[1].trim(),
                         content: explanationMatchResult[2].trim()
                    });
               }

               // Extract child headings and their content under related to
               const relatedToSections = [];
               const relatedToRegex = /- \*\*(.*?)\*\*\s*:\s*(.*?)(?=\n-|\n##|\n?$)/g;
               let relatedToMatchResult;
               while ((relatedToMatchResult = relatedToRegex.exec(content)) !== null) {
                    relatedToSections.push({
                         heading: relatedToMatchResult[1].trim(),
                         content: relatedToMatchResult[2].trim()
                    });
               }

               return response.status(200).json({
                    title: titleMatch ? titleMatch[1].trim() : "Not Found",
                    description: descriptionMatch ? descriptionMatch[1].trim() : "❌ Not Found",
                    explanation: explanationMatch ? explanationMatch[1].trim() : "❌ Not Found",
                    explanationSections: explanationSections,
                    relatedTo: relatedToMatch ? relatedToMatch[1].trim() : "❌ Not Found",
                    relatedToSections: relatedToSections,
                    date: dateMatch ? dateMatch[1].trim() : "❌ Not Found"
               });

          } catch (error) {
               console.error("OpenAI API Error:", error.message);
               return response.status(500).json({ error: "Something went wrong with the AI request." });
          }
     }
});

application.post("/transcribeImage", async (req, res) => {
     const { filename, data } = req.body;

     if (!filename || !data) {
          return res.status(400).json({ message: "Missing data" });
     }

     // Guess mime type from file extension
     let mime = "image/png"; // fallback
     if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) mime = "image/jpeg";
     if (filename.endsWith(".webp")) mime = "image/webp";

     // Build data URL
     const dataUrl = `data:${mime};base64,${data}`;

     const client = new OpenAI({
          baseURL: "https://openrouter.ai/api/v1",
          apiKey: "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",
     });

     try {
          const responseFromImage = await client.chat.completions.create({
               model: "gpt-4o",

               messages: [
                    {
                         role: "user",
                         content: [
                              "Please explain everything you see in the image, and also give me complete details about that image, make sure you use simple english words.",
                              {
                                   type: "image_url",
                                   image_url: {
                                        url: dataUrl,
                                        detail: "high",
                                   },
                              },
                         ],
                    },
                    {
                         role: "system",
                         content: [
                              "You're an AI education assistant, you're name is \"Sense Learn\" you answer the images that user uploads to you, analyze carefully, and answers accurately"
                         ]
                    }
               ],
               max_tokens: 2000,
          });

          console.log(responseFromImage.choices[0].message.content)
          return res.status(200).json({ responseFromChatbot: responseFromImage?.choices[0]?.message?.content || "Something went wrong ! Please try again" })
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: error.message });
     }
});


application.post("/imageUpload", (req, res) => {
     const { filename, data } = req.body;

     if (!filename || !data) {
          return res.status(400).json({ message: "Data is missing" });
     } else {
          return res.status(200).json({ message: "We've recieved your data and file" });
     }
});

application.listen(port, () => {
     console.log("Server is listening on port " + port);
});
