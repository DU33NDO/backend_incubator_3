import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import Article from "./models/Article.js";
import connectDB from "./db.js";

dotenv.config();
connectDB();

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Welcome! Type /articles to get the first 5 articles."
  );
});

bot.onText(/\/random/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Welcome! Type /articles to get the first 5 articles."
  );
});


bot.onText(/\/articles/, async (msg) => {
  try {
    const articles = await Article.find().limit(5);
    if (articles.length === 0) {
      bot.sendMessage(
        msg.chat.id,
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
    bot.sendMessage(msg.chat.id, articlesText, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Telegram bot error:", error.message);
    bot.sendMessage(msg.chat.id, "An error occurred while fetching articles.");
  }
});
