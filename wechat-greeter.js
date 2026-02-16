/**
 * WeChat Greeter v14.4 (Code Cleanup & Robust)
 * 核心升级：
 * 1. 修复了 v14.3 的语法错误 (Duplicate Code Block)。
 * 2. 保留了双重历史记录检查 (Double Scan History)。
 * 3. 保留了空历史记录保护 (Empty History = Skip)。
 * 4. 保留了全屏 OCR 找 ID。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// --- Configuration ---
const WORKSPACE = path.join(process.env.HOME, '.openclaw/workspace');
const CLICKED_FILE = path.join(WORKSPACE, 'wechat_cny_2026_clicked.json');
const SENT_FILE = path.join(WORKSPACE, 'wechat_cny_2026_sent.json');
const LOG_FILE = path.join(WORKSPACE, 'wechat_cny_2026_log.txt');

const CONFIG = {
  batchLimit: 8000, 
  delay: { min: 3000, max: 5000 }, 
  listRegion: { x: 0, y: 100, w: 350, h: 900 }, 
  scrollTicks: -8, 
  anchorX: 150
};

const DRY_RUN = process.argv.includes('--dry-run');

// State
let CLICKED_SET = new Set(); 
let SENT_MAP = new Map(); 

// --- Logging ---
function log(msg) { 
    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const logLine = `[${timestamp}] [🦞 WeGreeter] ${msg}`;
    console.log(logLine);
    try { fs.appendFileSync(LOG_FILE, logLine + '\n'); } catch(e) {}
}

// --- Persistence ---
function initLedgers() {
    try {
        if (fs.existsSync(CLICKED_FILE)) {
            const data = JSON.parse(fs.readFileSync(CLICKED_FILE, 'utf8'));
            data.forEach(n => CLICKED_SET.add(n));
            log(`🧹 Loaded ${CLICKED_SET.size} clicked items.`);
        } else {
            CLICKED_SET = new Set();
        }
    } catch (e) { CLICKED_SET = new Set(); }

    try {
        if (fs.existsSync(SENT_FILE)) {
            const data = JSON.parse(fs.readFileSync(SENT_FILE, 'utf8'));
            data.forEach(item => {
                const key = item.id || item.name;
                if (key) SENT_MAP.set(key, item);
            });
            log(`📖 Loaded ${SENT_MAP.size} SENT records.`);
        }
    } catch (e) {}
}

function saveClicked(name) {
    CLICKED_SET.add(name);
    try { fs.writeFileSync(CLICKED_FILE, JSON.stringify([...CLICKED_SET], null, 2)); } catch(e) {}
}

function saveSent(info) {
    const key = info.id || info.name;
    if (key) SENT_MAP.set(key, info);
    try {
        if (!DRY_RUN) {
             fs.writeFileSync(SENT_FILE, JSON.stringify([...SENT_MAP.values()], null, 2));
        }
    } catch(e) {}
}

// --- Helpers ---
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function randomSleep(min, max) {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return sleep(ms);
}
function ensureFocus() { 
    try { 
        execSync('open -a WeChat'); 
        const script = `
        tell application "System Events" to tell process "WeChat"
            set position of window 1 to {0, 0}
            set size of window 1 to {1000, 900}
        end tell
        `;
        try { execSync(`osascript -e '${script}'`); } catch(e) {}
        sleep(500); 
    } catch (e) {} 
}
function normalizeName(name) { return name ? name.replace(/[^\w\u4e00-\u9fa5]/g, '').toLowerCase() : ""; }

// 1. 👁️ Scan List
function scanContacts() {
    const screenshotPath = `/tmp/wechat_list_current.png`;
    execSync(`screencapture -R${CONFIG.listRegion.x},${CONFIG.listRegion.y},${CONFIG.listRegion.w},${CONFIG.listRegion.h} "${screenshotPath}"`);
    
    const swiftScript = `
import Vision
import AppKit
let url = URL(fileURLWithPath: "${screenshotPath}")
if let image = NSImage(contentsOf: url), let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) {
    let request = VNRecognizeTextRequest { (request, error) in
        guard let observations = request.results as? [VNRecognizedTextObservation] else { return }
        for observation in observations {
            let topCandidate = observation.topCandidates(1).first
            if let text = topCandidate?.string, text.count > 0 {
                let box = observation.boundingBox
                let y = 1 - (box.origin.y + box.size.height/2)
                let x = box.origin.x + box.size.width/2
                print("\\(text)|\\(x),\\(y)")
            }
        }
    }
    request.recognitionLanguages = ["zh-Hans", "en-US"]
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try? handler.perform([request])
}
    `;
    
    try {
        const output = execSync(`swift -e '${swiftScript}'`).toString().trim();
        if (!output) return [];
        return output.split('\n').map(line => {
            const parts = line.split('|');
            if (parts.length < 2) return null;
            const name = parts[0].trim();
            const coords = parts[1];
            const [nx, ny] = coords.split(',').map(Number);
            
            if (nx < 0.15) return null; 
            if (/^\d+$/.test(name)) return null; 
            if (/^\d{1,2}:\d{2}$/.test(name)) return null; 
            if (name.length < 2 && !/[\u4e00-\u9fa5]/.test(name)) return null; 

            const screenX = CONFIG.listRegion.x + (nx * CONFIG.listRegion.w);
            const screenY = CONFIG.listRegion.y + (ny * CONFIG.listRegion.h);
            return { name: name, x: Math.round(screenX), y: Math.round(screenY) };
        }).filter(item => item !== null);
    } catch (e) {
        log("Scan Error: " + e.message);
        return [];
    }
}

// 2. 🕵️‍♀️ Scan Profile (Full Screen Strategy)
async function scanProfile(fallbackName) {
    let profile = { name: "", id: "" };
    
    // Try up to 3 times
    for (let i = 0; i < 3; i++) {
        const screenshotPath = `/tmp/wechat_fullscreen_current.png`;
        execSync(`screencapture -x "${screenshotPath}"`); // Full Screen
        
        const text = getScreenText(screenshotPath); 
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        // Find ID
        let foundId = "";
        for (const line of lines) {
            const match = line.match(/(WeChat ID|微信号)[:：]?\s*([a-zA-Z0-9_\-]+)/i);
            if (match) { foundId = match[2].trim(); break; }
            if (line.startsWith('wxid_')) { foundId = line; break; }
        }
        
        if (foundId) {
            return { name: fallbackName || "Unknown", id: foundId };
        }
        await sleep(1000);
    }
    
    // Safety for Truncated Names
    if (fallbackName.endsWith("...") || fallbackName.endsWith("…")) {
        log(`🛑 DANGER: Truncated Name "${fallbackName}" and No ID found. Skipping.`);
        return { name: fallbackName, id: null };
    }

    return { name: fallbackName, id: fallbackName };
}

// 3. Scroll
function scrollList(ticks) {
    const swiftScript = `
import Quartz
let scroll = CGEvent(scrollWheelEvent2Source: nil, units: .line, wheelCount: 1, wheel1: ${ticks}, wheel2: 0, wheel3: 0)
scroll?.post(tap: .cghidEventTap)
    `;
    try { 
        execSync(`peekaboo move --coords ${CONFIG.anchorX},500`); 
        execSync(`swift -e '${swiftScript}'`); 
    } catch(e) {}
}

// 4. Find Button
function findSendMessageButton() {
  const screenshotPath = `/tmp/wechat_screen_current.png`;
  try {
    execSync(`screencapture -x "${screenshotPath}"`);
    const swiftScript = `
import Vision
import AppKit
let url = URL(fileURLWithPath: "${screenshotPath}")
if let image = NSImage(contentsOf: url), let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) {
    let request = VNRecognizeTextRequest { (request, error) in
        guard let observations = request.results as? [VNRecognizedTextObservation] else { return }
        for observation in observations {
            if let text = observation.topCandidates(1).first?.string {
                if text.contains("Messages") || text.contains("Message") || text.contains("发消息") || text.contains("發消息") || text.contains("傳送訊息") || text.contains("Send Message") {
                    let box = observation.boundingBox
                    let x = box.origin.x + (box.size.width / 2)
                    let y = 1 - (box.origin.y + box.size.height / 2)
                    print("\\(x),\\(y)")
                    exit(0)
                }
            }
        }
    }
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try? handler.perform([request])
}
    `;
    const result = execSync(`swift -e '${swiftScript}'`).toString().trim();
    if (result && result.includes(',')) {
        const W = 1920; const H = 1080; 
        const [nx, ny] = result.split(',').map(Number);
        return { x: Math.round(nx * W), y: Math.round(ny * H) };
    }
  } catch (e) {}
  return null;
}

// 5. Get Text Helper
function getScreenText(imgPath) {
    const swiftScript = `
import Vision
import AppKit
let url = URL(fileURLWithPath: "${imgPath}")
if let image = NSImage(contentsOf: url), let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) {
    let request = VNRecognizeTextRequest { (request, error) in
        guard let observations = request.results as? [VNRecognizedTextObservation] else { return }
        for observation in observations { print(observation.topCandidates(1).first?.string ?? "") }
    }
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try? handler.perform([request])
}
    `;
    try { return execSync(`swift -e '${swiftScript}'`).toString(); } catch (e) { return ""; }
}

// 6. Send (Humanized)
function sendViaAppleScript(text) {
    const escapedText = text.replace(/"/g, '\\"').replace(/`/g, '\\`');
    const delayBeforeEnter = (Math.random() * 0.8 + 0.5).toFixed(2); // 0.5s - 1.3s
    const script = `
      set the clipboard to "${escapedText}"
      tell application "System Events" to tell process "WeChat"
        set frontmost to true
        keystroke "v" using command down
        delay ${delayBeforeEnter}
        key code 36 -- Enter
      end tell
    `;
    try { execSync(`osascript -e '${script}'`); } catch(e) {}
}

// 🐎 2026 Messages
const MESSAGES = [
    `🧨 新春快乐！\n我是 Kelly 的 AI 助理「小龙虾🦞」，奉主人之命，特意翻山越岭爬过网线来给您拜年啦！\n祝您在 2026 马年：\n🐎 马力全开，霉运全退散！\n💰 钱包鼓鼓，发量多多！\n(本条祝福由 Kelly 亲自监制，小龙虾人工+智能发送，诚意 100%！🧧)\n—— Kelly & 🦞小龙虾 敬上`,
    `🎉 马年大吉！\n我是 Kelly 的专属 AI「小龙虾🦞」。Kelly 让我一定要在这个特别的时刻，把最热乎的祝福送到您手里！\n愿新的一年，您的生活如行云流水般顺畅，好运连连，惊喜不断！身体健康，万事顺遂！\n(Kelly 正在和家人欢度春节，派我来送个大红包……的表情包！🧧)\n—— Kelly Chan 祝您新春快乐！`,
    `🚀 2026 新春快乐！\nKelly 派我——AI 小龙虾🦞 来给您拜年了！\n祝您马年行大运，马到成功！🐎✨`
];

// --- Main ---
async function main() {
  log("🚀 Starting WeChat Greeter v14.4 (Code Cleanup)...");
  if (DRY_RUN) log("🚧 DRY RUN MODE");
  
  initLedgers();
  ensureFocus();
  execSync(`osascript -e 'tell application "System Events" to keystroke "2" using command down'`);
  await randomSleep(1000, 2000);

  let totalCount = 0;
  let consecutiveEmptyScans = 0;

  while (totalCount < CONFIG.batchLimit) {
    log("👁️ Scanning visible contacts...");
    const candidates = scanContacts();
    
    // Filter with CLICKED_SET (Names in List)
    const newItems = candidates.filter(c => !CLICKED_SET.has(normalizeName(c.name)));
    log(`Found ${candidates.length} visible, ${newItems.length} unclicked.`);
    
    if (newItems.length === 0) {
        log("⚠️ No unclicked items found. Scrolling...");
        consecutiveEmptyScans++;
        if (consecutiveEmptyScans > 2) {
            log("🛑 Force scrolling REVERSE (Big Jump)...");
            scrollList(-20); // Big jump
        } else {
            scrollList(CONFIG.scrollTicks); // Standard -8
        }
        await randomSleep(3000, 5000);
        continue;
    }
    
    consecutiveEmptyScans = 0; 
    
    for (const item of newItems) {
        if (totalCount >= CONFIG.batchLimit) break;
        
        const normName = normalizeName(item.name);
        saveClicked(normName); // Mark list item as clicked
        
        if (["新的朋友", "群聊", "标签", "公众号", "enterprise"].some(k => normName.includes(k))) {
            log(`⏩ Skip system: ${item.name}`);
            continue;
        }

        log(`--- Processing List Item: ${item.name} ---`);
        
        ensureFocus();
        try { execSync(`peekaboo click --coords ${item.x},${item.y}`); } catch(e) {}
        await randomSleep(3000, 5000); 
        
        // 2. OCR Profile (Full Screen)
        const profile = await scanProfile(item.name);
        
        if (!profile.id) {
            log(`❌ SKIPPING: No ID found (System/Truncated).`);
            continue; 
        }

        log(`👤 Profile ID="${profile.id}"`);
        
        // 3. Check Sent (Business Logic)
        if (SENT_MAP.has(profile.id)) {
            log(`⚠️ Already SENT to ${profile.id}. Skipping.`);
            continue;
        }
        
        // [HUMAN] Decide
        await randomSleep(500, 1500);

        // 4. Find Button
        const btn = findSendMessageButton();
        if (btn) {
            log(`🖱️ Found 'Messages'. Clicking...`);
            try { execSync(`peekaboo click --coords ${btn.x},${btn.y}`); } catch(e) {}
            await randomSleep(3000, 5000); 
            
            // History Check Loop (Double Check)
            let skipReason = "";
            for (let h = 0; h < 2; h++) {
                const chatImg = `/tmp/wechat_chat_current.png`;
                execSync(`screencapture -x "${chatImg}"`);
                const text = getScreenText(chatImg);
                
                const lastLines = text.split('\n').slice(-20).join(' ');
                const preview = lastLines.length > 50 ? lastLines.substring(0, 50) + "..." : lastLines;
                log(`📜 History Check (${h+1}/2): "${preview}"`);

                if (lastLines.length < 5) {
                    if (h === 1) skipReason = "Empty History (Unsafe)";
                    log("⚠️ History empty/short. Waiting...");
                    await sleep(2000);
                    continue;
                }
                
                if (lastLines.includes("Kelly") || lastLines.includes("小龙虾") || lastLines.includes("文件传输助手") || lastLines.includes("WeChat Team")) {
                    skipReason = "Already Sent / System";
                    break;
                }
                
                if (h === 0) await sleep(1500);
            }
            
            if (skipReason) {
                log(`⚠️ Skipping: ${skipReason}`);
                if (skipReason.includes("Already")) {
                     saveSent({ id: profile.id, time: new Date().toISOString(), msg: "ALREADY_SENT_HISTORY_CHECK" });
                }
            } else {
                // Safe to Send
                const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
                log(`🎯 Sending...`);
                await randomSleep(500, 1500);
                
                if (!DRY_RUN) {
                    sendViaAppleScript(msg);
                    saveSent({ id: profile.id, time: new Date().toISOString(), msg: msg });
                    log(`✅ SENT SUCCESS.`);
                } else {
                    log(`🚧 DRY RUN: Would send...`);
                }
            }
            
            log("🔙 Returning...");
            ensureFocus();
            // Switch back to Contacts (Cmd+2)
            try { execSync(`osascript -e 'tell application "System Events" to keystroke "2" using command down'`); } catch(e) {}
            await randomSleep(1500, 3000);
        } else {
            log(`⏩ No button (Group?). Skip.`);
        }
        
        totalCount++;
        await randomSleep(CONFIG.delay.min, CONFIG.delay.max);
    }
    
    log("📜 Page Done. Scrolling...");
    scrollList(CONFIG.scrollTicks);
    await randomSleep(3000, 5000);
  }
}

main();