import dotenv from "dotenv";
import { ethers } from "ethers";
import fs from "fs";
import fetch from "node-fetch";
import express from "express";

dotenv.config();

// ---- ENV ----
const RPC_URL = process.env.BASE_RPC_HTTPS;
const SIGN_CONTRACT = process.env.SIGN_CONTRACT;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const SIGNER_UUID = process.env.SIGNER_UUID;

// ---- CONTRACT ----
const abi = JSON.parse(fs.readFileSync("./abi.json", "utf-8"));
const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(SIGN_CONTRACT, abi, provider);

console.log("🌐 WebSocket bağlantısı deneniyor...");
console.log("🟢 VRNouns Listener aktif (Base Mainnet)");

// ---- CAST GÖNDERİMİ ----
async function sendToFarcaster(text, type = "sign") {
  try {
    let imageUrl = "";
    if (type === "sign") {
      imageUrl = "https://baseland.life/vrnouns_sign.jpg";
    } else if (type === "sale") {
      imageUrl = "https://baseland.life/vrnouns_sale.jpg";
    }

    // Mini app linki (senin isteğinle eklendi)
    const miniAppUrl = "https://farcaster.xyz/miniapps/pIFtRBsgnWAF/flooorfun";
    const body = {
      text: `${text}\n\n🎮 ${miniAppUrl}`,
      signer_uuid: SIGNER_UUID,
      embeds: [{ url: imageUrl }],
    };

    const res = await fetch("https://api.neynar.com/v2/farcaster/cast", {
      method: "POST",
      headers: {
        "api_key": NEYNAR_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("❌ Cast gönderilemedi:", await res.text());
    } else {
      console.log("🪶 Cast gönderildi ✅");
    }
  } catch (err) {
    console.error("⚠️ Farcaster API hatası:", err);
  }
}

// ---- EVENTLER ----
let dailySigners = new Set();

contract.on("Staked", async (user, tokenId, epochStart) => {
  dailySigners.add(user.toLowerCase());
  console.log(`🟢 ${user} signed #${tokenId}`);
  const msg = `✅ ${user} just signed #${tokenId} ⚡ Base Mainnet`;
  await sendToFarcaster(msg, "sign");
});

contract.on("Transfer", async (from, to, tokenId) => {
  const msg = `💸 VRNouns #${tokenId} transferred to ${to} ⚡ Base Mainnet`;
  console.log(msg);
  await sendToFarcaster(msg, "sale");
});

// ---- GÜNLÜK RAPOR ----
async function sendDailyReport() {
  const count = dailySigners.size;
  const msg = `
📊 Daily VRNouns Report
👥 ${count} signers today
⚡ Base Mainnet
  `.trim();
  await sendToFarcaster(msg, "sign");
  dailySigners.clear();
  console.log("📅 Günlük rapor gönderildi ve sayaç sıfırlandı.");
}

function scheduleDailyReport() {
  const now = new Date();
  const nextRun = new Date();
  nextRun.setUTCHours(0, 0, 30, 0); // 00:00 UTC → 03:00 Türkiye
  if (now > nextRun) nextRun.setUTCDate(nextRun.getUTCDate() + 1);
  const delay = nextRun - now;

  console.log(
    `⏰ Günlük rapor ${Math.round(delay / 1000 / 60)} dakika sonra paylaşılacak.`
  );

  setTimeout(() => {
    sendDailyReport();
    setInterval(sendDailyReport, 24 * 60 * 60 * 1000);
  }, delay);
}

scheduleDailyReport();

// ---- EXPRESS FALLBACK (Free Plan Keep-Alive) ----
const app = express();
app.get("/", (_, res) => {
  res.send("🟢 VRNouns Bot çalışıyor (Express fallback aktif)");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌍 Express keep-alive aktif, port: ${PORT}`);
});
