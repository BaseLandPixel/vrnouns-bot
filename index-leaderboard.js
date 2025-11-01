import dotenv from "dotenv";
import { ethers } from "ethers";
import fs from "fs";
import fetch from "node-fetch";

dotenv.config();

const RPC_URL = process.env.BASE_RPC_HTTPS;
const VRNOUNS_CONTRACT = process.env.VRNOUNS_CONTRACT;
const SIGN_CONTRACT = process.env.SIGN_CONTRACT;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const SIGNER_UUID = process.env.SIGNER_UUID;

const abi = JSON.parse(fs.readFileSync("./abi.json", "utf-8"));
const provider = new ethers.JsonRpcProvider(RPC_URL);

const vrnouns = new ethers.Contract(VRNOUNS_CONTRACT, abi, provider);
console.log("🧱 VRNouns Staked Listener aktif (Base Mainnet)");

// === STAKED Event Dinleyici ===
vrnouns.on("Staked", async (user, tokenId, epochStart, event) => {
  try {
    const tx = await event.getTransactionReceipt();
    const block = await provider.getBlock(tx.blockNumber);
    const date = new Date(block.timestamp * 1000).toLocaleString();

    const message = `
🧱 VRNouns #${tokenId} staked!
👤 User: ${user}
🕓 ${date}
⚡ Base Mainnet
`.trim();

    console.log(message);
    await sendToFarcaster(message);
    console.log(`🪶 Cast gönderildi: VRNoun #${tokenId}`);
  } catch (err) {
    console.error("❌ Staked listener hatası:", err);
  }
});

// === Leaderboard (opsiyonel olarak kalıyor, istersen aktif ederiz) ===
async function getSignersLeaderboard() {
  const latestBlock = await provider.getBlockNumber();
  const step = 50;
  const fromBlock = latestBlock - 500;

  console.log(`🔎 Tarama: ${fromBlock} → ${latestBlock} (step: ${step})`);

  const signers = {};
  for (let start = fromBlock; start < latestBlock; start += step) {
    const end = Math.min(start + step, latestBlock);
    try {
      const events = await vrnouns.queryFilter("Staked", start, end);
      for (const e of events) {
        const user = e.args.user;
        if (!signers[user]) signers[user] = 0;
        signers[user] += 1;
      }
    } catch (err) {
      console.warn(`⚠️ Skip aralık ${start}-${end}: ${err.shortMessage || err.message}`);
    }
  }

  const leaderboard = Object.entries(signers)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([addr, count], i) => `${i + 1}. ${addr.slice(0, 6)}...${addr.slice(-4)} — ${count} stake(s)`);

  console.log("\n🏆 VRNouns Top Stakers:\n" + leaderboard.join("\n"));
  return leaderboard;
  }
}
