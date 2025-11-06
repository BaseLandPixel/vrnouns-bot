import dotenv from "dotenv";
import { ethers } from "ethers";
import fs from "fs";
import fetch from "node-fetch";
import http from "http";  // Express yerine yerleşik HTTP modülü

dotenv.config();

const RPC_HTTPS_URL = process.env.BASE_RPC_HTTPS;
const RPC_WSS_URL = process.env.BASE_RPC_WSS;
const SIGN_CONTRACT = process.env.SIGN_CONTRACT;
const VRNOUNS_CONTRACT = process.env.VRNOUNS_CONTRACT;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const SIGNER_UUID = process.env.SIGNER_UUID;

// Sözleşme arayüzü (Transfer ve Staked için)
const abi = JSON.parse(fs.readFileSync("./abi.json", "utf-8"));

// WebSocket varsa kullan; yoksa HTTP ile devam et
const provider = RPC_WSS_URL
  ? new ethers.WebSocketProvider(RPC_WSS_URL)
  : new ethers.JsonRpcProvider(RPC_HTTPS_URL);

// Staked ve Transfer olaylarını dinlemek için iki ayrı sözleşme örneği
const stakeContract = new ethers.Contract(SIGN_CONTRACT, abi, provider);
const vrnounsContract = new ethers.Contract(VRNOUNS_CONTRACT, abi, provider);

console.log("🌐 RPC bağlantısı deneniyor...");
console.log("🟢 VRNouns listener aktif (Base Mainnet)");

/* ---------------- CAST GÖNDERİMİ ---------------- */
async function sendToFarcaster(text, type = "sign") {
  try {
    let imageUrl = "";
    if (type === "sign") {
      imageUrl = "https://baseland.life/vrnouns_sign.jpg";
    } else if (type === "sale") {
      imageUrl = "https://baseland.life/vrnouns_sale.jpg";
    }

    const res = await fetch("https://api.neynar.com/v2/farcaster/cast", {
      method: "POST",
      headers: {
        "x-api-key": NEYNAR_API_KEY,  // başlık düzeltildi
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        signer_uuid: SIGNER_UUID,
        embeds: imageUrl ? [{ url: imageUrl }] : [],
      }),
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

/* ---------------- EVENT DİNLERİ ---------------- */
let dailySigners = new Set();

// Staked olaylarını imza olarak dinle ve paylaş
stakeContract.on("Staked", async (user, tokenId, epochStart) => {
  dailySigners.add(user.toLowerCase());
  console.log(`🟢 ${user} signed #${tokenId}`);
  const msg = `✅ ${user} just signed #${tokenId} ⚡ Base Mainnet`;
  await sendToFarcaster(msg, "sign");
});

// Transfer olaylarını satış olarak dinle ve paylaş
vrnounsContract.on("Transfer", async (from, to, tokenId) => {
  const msg = `💸 VRNouns #${tokenId} transferred to ${to} ⚡ Base Mainnet`;
  console.log(msg);
  await sendToFarcaster(msg, "sale");
});

/* ---------------- GÜNLÜK RAPOR ---------------- */
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
  // Türkiye saati ile 03:00 (UTC 00:00 + 3 saat)
  nextRun.setUTCHours(0, 0, 30, 0);
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

/* ---------------- KEEP-ALIVE (Render Uyumaz) ---------------- */
const SELF_URL = "https://vrnouns-bot.onrender.com";

setInterval(() => {
  fetch(SELF_URL)
    .then(() => console.log("⏱️ Self-ping sent to keep Render awake"))
    .catch(() => console.log("⚠️ Self-ping failed (Render may sleep)"));
}, 5 * 60 * 1000); // her 5 dakikada bir

// Render’ın ücretsiz planında port taramasını geçmek için yerleşik HTTP sunucusu
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("VRNouns bot is running!\n");
});
server.listen(PORT, () => {
  console.log(`HTTP server listening on ${PORT}`);
});
