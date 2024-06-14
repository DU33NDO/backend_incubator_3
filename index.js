import connectDB from "./db.js";
import express from "express";
import axios from "axios";
import cheerio from "cheerio";
import dotenv from "dotenv";
import Article from "./models/Article.js";
import TelegramBot from "node-telegram-bot-api";
import User from "./models/User.js";
import cron from "node-cron";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

let articles = [];

connectDB();

app.use(express.json());

app.get("/scrape", async (req, res) => {
  try {
    const { data } = await axios.get(
      "https://techxplore.com/computer-sciences-news/page3.html"
    );
    const $ = cheerio.load(data);
    articles = [];
    $(".sorted-article-content.d-flex.flex-column.ie-flex-1").each(
      (index, element) => {
        const title = $(element)
          .find(".text-middle.mb-3 a.news-link")
          .text()
          .trim();
        const link = $(element)
          .find(".text-middle.mb-3 a.news-link")
          .attr("href");
        const description = $(element).find(".mb-4").text().trim();
        articles.push({ title, link, description });
      }
    );
    res.json(articles);
  } catch (error) {
    console.error("Scraping error:", error.message);
    res.status(500).send("An error occurred while fetching the data.");
  }
});

app.post("/save-articles", async (req, res) => {
  try {
    const savedArticles = await Article.insertMany(articles);
    res.status(201).json(savedArticles);
  } catch (error) {
    console.error("Saving articles error:", error.message);
    res.status(500).send("An error occurred while saving the data.");
  }
});

app.get("/random-article", (req, res) => {
  if (articles.length === 0) {
    return res.status(404).send("No articles available. Please scrape first.");
  }
  const randomIndex = Math.floor(Math.random() * articles.length);
  const randomArticle = articles[randomIndex];
  res.json(randomArticle);
});

app.get("/random-db-article", async (req, res) => {
  try {
    const count = await Article.countDocuments();
    if (count === 0) {
      return res.status(404).send("No articles in the database.");
    }
    const randomIndex = Math.floor(Math.random() * count);
    const randomArticle = await Article.findOne().skip(randomIndex);
    res.json(randomArticle);
  } catch (error) {
    console.error("Fetching random article error:", error.message);
    res.status(500).send("An error occurred while fetching a random article.");
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// Telegram Bot 
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await User.findOneAndUpdate({ chatId }, { chatId }, { upsert: true });
  bot.sendMessage(
    chatId,
    "Welcome! Type /articles to get the first 5 articles or /random to get a random article."
  );
});

bot.onText(/\/articles/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const articles = await Article.find().limit(5);
    if (articles.length === 0) {
      bot.sendMessage(
        chatId,
        "No articles found. Please scrape and save articles first."
      );
      return;
    }
    const articlesText = articles
      .map(
        (article, index) =>
          `${index + 1}. [${article.title}](${article.link})\n${
            article.description
          }\n`
      )
      .join("\n");
    bot.sendMessage(chatId, articlesText, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Telegram bot error:", error.message);
    bot.sendMessage(chatId, "An error occurred while fetching articles.");
  }
});

bot.onText(/\/random/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const count = await Article.countDocuments();
    if (count === 0) {
      bot.sendMessage(chatId, "No articles found in the database.");
      return;
    }
    const randomIndex = Math.floor(Math.random() * count);
    const randomArticle = await Article.findOne().skip(randomIndex);
    bot.sendMessage(
      chatId,
      `${randomArticle.title}\n${randomArticle.link}\n${randomArticle.description}`
    );
  } catch (error) {
    console.error("Telegram bot error:", error.message);
    bot.sendMessage(
      chatId,
      "An error occurred while fetching a random article."
    );
  }
});

// Cron 
cron.schedule("*/5 * * * * *", async () => {
  try {
    const users = await User.find();
    if (users.length === 0) {
      console.log("No users to notify.");
      return;
    }

    const count = await Article.countDocuments();
    if (count === 0) {
      users.forEach((user) => {
        bot.sendMessage(user.chatId, "No articles found in the database.");
      });
      return;
    }

    users.forEach(async (user) => {
      const randomIndex = Math.floor(Math.random() * count);
      const randomArticle = await Article.findOne().skip(randomIndex);
      bot.sendMessage(
        user.chatId,
        `${randomArticle.title}\n${randomArticle.link}\n${randomArticle.description}`
      );
    });
  } catch (error) {
    console.error("Cron job error:", error.message);
    const users = await User.find();
    users.forEach((user) => {
      bot.sendMessage(
        user.chatId,
        "An error occurred while fetching a random article."
      );
    });
  }
});
