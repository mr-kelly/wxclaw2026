# 🧧 2026 春节祝福 Skill for OpenClaw 🦞

> **Skill 源代码已开源。**
> 结果出来的时候，我自己都愣住了。

[![OpenClaw](https://img.shields.io/badge/Powered%20by-OpenClaw-orange?style=flat-square&logo=anthropic)](https://claude.com/claude-code)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![WeChat](https://img.shields.io/badge/WeChat-Mac-green?style=flat-square&logo=wechat&logoColor=white)](https://mac.weixin.qq.com/)
[![Token Cost](https://img.shields.io/badge/Token%20Cost-ZERO-red?style=flat-square)](https://github.com/mr-kelly/wxclaw2026)

---

## 📖 The Story / 故事背景

**农历新年，我让 OpenClaw 🦞 AI 发了 9000 条祝福。**

你猜 AI 消耗了多少 Token？

每年过年，我最累的其实不是拜年。是回祝福。
消息一条条进来。你不回，不太好意思。认真回，又真的很累。群发还有 200 人上限。

所以今年我干脆让 **OpenClaw 🦞 AI** 帮我发。

不是几十条。是 **9000 条**。

而且我是晚饭饭桌上，一边啃长脚蟹 🤣 一边开始弄的。
最后在打车路上完成。

左手 **iPhone + Telegram + OpenClaw**，
右手 **Honor 折叠屏 + 远程 Mac Mini 桌面**看运行。

一路对话，它自己一路改到 15.0 版本。
我连代码都没看，就直接跑起来了。

跑了两个小时之后，我才突然想起一件事：
*“这到底消耗了多少 token？”* （主要是担心破产 🤣）

于是我去翻了 LLM 的日志后台，看模型调用记录和 token 统计。

结果我当场愣住——

# **0！ 0！ 0！**

不是很少。是完全没有。

然后它足足跑了 24 个小时……
（现在还在按拼音 A、B、C、D 一路往下跑，已经跑到 J 了 🤣）

不吃不喝。不睡觉。一直在后台干活。
我睡了两觉。它还在发。

**连续 24 小时。9000 条祝福。没有调用任何大模型。**

---

## 🚀 Features / 核心功能

本项目是 OpenClaw 的一个 Skill，专为 Mac 微信客户端设计，实现全自动化的智能祝福发送。

*   **🦞 0 Token Cost (零消耗)**
    纯本地运行，不依赖昂贵的大模型 API，省钱又高效。
*   **💾 State Persistence (状态记忆)**
    自动记录发送进度，支持断点续传，不惧中断。
*   **🛡️ Double De-duplication (双重防重)**
    *   **Log Check**: 通过本地 JSON 日志文件记录已发送好友。
    *   **Vision Check**: 通过 OCR 识别聊天记录，避免重复打扰。
*   **🎨 Smart Matching (智能匹配)**
    根据聊天上下文风格，自动选择最合适的祝福语模板（幽默/温馨/极简）。
*   **🤖 AI Persona (AI 身份)**
    明确署名“Kelly & AI 小龙虾🦞”，主打真诚与趣味。

---

## 🛠️ Tech Stack / 技术实现

*   **Core**: OpenClaw Skill System
*   **Language**: JavaScript (Node.js)
*   **Environment**: macOS + WeChat Desktop
*   **Key Logic**:
    1.  **Initialize**: 聚焦微信窗口，读取日志。
    2.  **Iterate**: 遍历联系人列表。
    3.  **Analyze**: 截图 + OCR 分析最近 3 条消息（判断是否是群发助手、是否已祝福）。
    4.  **Action**: 选择对应模板（Template A/B/C）并模拟键盘输入发送。

---

## 📦 Usage / 安装与使用

### Prerequisites / 前置条件
*   macOS 系统
*   微信 Mac 客户端
*   OpenClaw CLI 环境

### Installation / 运行步骤
1.  克隆本项目到本地：
    ```bash
    git clone https://github.com/mr-kelly/wxclaw2026.git
    cd wxclaw2026
    ```
2.  将 Skill 文件移动到 OpenClaw 的 workspace 或直接运行脚本。
3.  在 OpenClaw 中呼叫：
    > "KK 发春节祝福" 或 "KK run wechat greeter"

---

## 🧧 Support / 赞赏

如果觉得有用，发个红包当压岁钱 🧧
（Skill 源代码已开源，需要的自己拿去，还在持续进化中）

<img src="redpack.jpg" width="300" />

## ⚠️ Disclaimer / 免责声明

**温馨提示：自动发送有平台风险，后果自负。**
请合理使用工具，避免对他人造成骚扰。

---
*Generated with [Claude Code](https://claude.com/claude-code)*
