import { keccak256, toHex } from "viem";

interface MeetingInfo {
  platform: string;
  isActive: boolean;
  meetingId: string;
  title: string;
}

interface OverlayState {
  isRecording: boolean;
  recordingStartTime: number | null;
  recordingDuration: number;
  meetingCode: string;
  isTrading: boolean;
  activeOrderId?: string;
}

class CrownieOverlayManager {
  public overlay: HTMLElement | null = null;
  private state: OverlayState = {
    isRecording: false,
    recordingStartTime: null,
    recordingDuration: 0,
    meetingCode: "",
    isTrading: false,
  };
  private updateTimer: NodeJS.Timeout | null = null;
  private hideTimeout: NodeJS.Timeout | null = null;
  private tradePollingInterval: NodeJS.Timeout | null = null;

  showOverlay(meetingInfo: MeetingInfo) {
    if (this.overlay) {
      this.removeOverlay();
    }

    this.generateMeetingCode();
    this.createOverlay(meetingInfo);
  }

  private generateMeetingCode() {
    const timestamp = Date.now().toString(36);
    const randomId = Math.random().toString(36).substring(2, 8);
    this.state.meetingCode = `${timestamp}-${randomId}`;
  }

  hideOverlay() {
    if (this.overlay) {
      this.animateOut(() => {
        this.removeOverlay();
      });
    }
  }

  private createOverlay(meetingInfo: MeetingInfo) {
    const overlay = document.createElement("div");
    overlay.id = "crownie-meeting-overlay";
    overlay.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 48px;
      height: 48px;
      z-index: 10000;
      background: rgba(26, 26, 26, 0.9);
      color: white;
      border-radius: 50%;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(243, 186, 80, 0.2);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(243, 186, 80, 0.3);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    `;

    const logo = document.createElement("img");
    logo.src = "https://crownie-swap.vercel.app/logo.png";
    logo.alt = "Crownie";
    logo.style.cssText = `
      width: 24px;
      height: 24px;
      object-fit: contain;
      transition: all 0.3s ease;
    `;

    const content = document.createElement("div");
    content.id = "crownie-overlay-content";
    content.style.cssText = `
      position: absolute;
      top: 0;
      right: 0;
      width: 280px;
      height: 240px;
      background: rgba(26, 26, 26, 0.95);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
      border: 1px solid rgba(243, 186, 80, 0.2);
      opacity: 0;
      visibility: hidden;
      transform: scale(0.8);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: none;
      z-index: 1;
      overflow: hidden;
      box-sizing: border-box;
    `;

    content.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <img src="https://crownie-swap.vercel.app/logo.png" alt="Crownie" style="width: 20px; height: 20px; object-fit: contain;">
          <span style="font-size: 14px; font-weight: 600;">Crownie</span>
        </div>
        <button id="crownie-close-expanded" style="
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          font-size: 18px;
          padding: 2px;
          border-radius: 4px;
          transition: all 0.2s;
        ">×</button>
      </div>

              <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
          <button id="crownie-toggle-recording" style="
            width: 100%;
            background: transparent;
            border: 1px solid rgba(243, 186, 80, 0.4);
            color: #F3BA50;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 500;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
          ">
            🎙️ Start Recording
          </button>
          <button id="crownie-toggle-trade" style="
            width: 100%;
            background: transparent;
            border: 1px solid rgba(243, 186, 80, 0.4);
            color: #F3BA50;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 500;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
          ">
            💰 Start Trade
          </button>
        </div>

      <button id="crownie-open-popup" style="
        width: 100%;
        background: linear-gradient(135deg, #F3BA50, #E98A48);
        border: none;
        color: #1a1a1a;
        padding: 10px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        box-shadow: 0 2px 8px rgba(243, 186, 80, 0.3);
      ">
        📱 Open Crownie
      </button>

      <div id="crownie-trade-status" style="
        display: none;
        text-align: center;
        margin-top: 12px;
        padding: 8px;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(243, 186, 80, 0.3);
        border-radius: 6px;
        font-size: 11px;
      ">
        <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
          <div style="display: flex; gap: 2px;">
            <div style="width: 4px; height: 4px; background: #F3BA50; border-radius: 50%; animation: pulse 1.5s infinite;"></div>
            <div style="width: 4px; height: 4px; background: #F3BA50; border-radius: 50%; animation: pulse 1.5s infinite 0.2s;"></div>
            <div style="width: 4px; height: 4px; background: #F3BA50; border-radius: 50%; animation: pulse 1.5s infinite 0.4s;"></div>
          </div>
          <span id="trade-status-text" style="color: #F3BA50; font-weight: 500;">Trade Active</span>
        </div>
      </div>
    `;

    overlay.appendChild(logo);
    overlay.appendChild(content);

    const style = document.createElement("style");
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }
      
      #crownie-toggle-recording:hover,
      #crownie-toggle-trade:hover {
        background: rgba(243, 186, 80, 0.1) !important;
        border-color: rgba(243, 186, 80, 0.6) !important;
        transform: translateY(-1px);
      }
      
      #crownie-toggle-recording.recording {
        background: rgba(239, 68, 68, 0.15) !important;
        border-color: rgba(239, 68, 68, 0.5) !important;
        color: #ef4444 !important;
      }
      
      #crownie-toggle-trade.trading {
        background: rgba(16, 185, 129, 0.15) !important;
        border-color: rgba(16, 185, 129, 0.5) !important;
        color: #10b981 !important;
      }

      #crownie-open-popup:hover {
        background: linear-gradient(135deg, #E98A48, #D17A3F) !important;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(243, 186, 80, 0.4);
      }

      #crownie-close-expanded:hover {
        background: rgba(255, 255, 255, 0.05) !important;
        color: white !important;
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(overlay);
    this.overlay = overlay;

    this.setupEventListeners();
    this.adjustPositionForPlatform(meetingInfo.platform);

    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      overlay.style.transform = "scale(1)";
    });

    this.setupAutoHideBehavior();
  }

  private adjustPositionForPlatform(platform: string) {
    if (!this.overlay) return;
  }

  private setupEventListeners() {
    if (!this.overlay) return;

    const content = this.overlay.querySelector(
      "#crownie-overlay-content"
    ) as HTMLElement;
    const logo = this.overlay.querySelector("img") as HTMLElement;

    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay || e.target === logo) {
        this.toggleExpansion();
      }
    });

    const closeBtn = this.overlay.querySelector("#crownie-close-expanded");
    closeBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.collapseOverlay();
    });

    const recordingBtn = this.overlay.querySelector(
      "#crownie-toggle-recording"
    );
    recordingBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleRecording();
    });

    const tradeBtn = this.overlay.querySelector("#crownie-toggle-trade");
    tradeBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleTrade();
    });

    const openBtn = this.overlay.querySelector("#crownie-open-popup");
    openBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: "OPEN_POPUP" });
    });

    this.overlay.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.hideOverlay();
    });
  }

  private setupAutoHideBehavior() {
    if (!this.overlay) return;

    const resetHideTimer = () => {
      if (this.hideTimeout) clearTimeout(this.hideTimeout);

      this.hideTimeout = setTimeout(() => {
        if (this.overlay && !this.state.isRecording) {
          this.overlay.style.opacity = "0.6";
          this.overlay.style.transform = "scale(0.9)";
        }
      }, 5000) as NodeJS.Timeout;
    };

    this.overlay.addEventListener("mouseenter", () => {
      if (this.hideTimeout) clearTimeout(this.hideTimeout);
      if (this.overlay) {
        this.overlay.style.opacity = "1";
        this.overlay.style.transform = "scale(1)";
      }
    });

    this.overlay.addEventListener("mouseleave", resetHideTimer);
    resetHideTimer();
  }

  private getMeetingIdFromCurrentPage(): string | null {
    const url = window.location.href;

    if (url.includes("meet.google.com")) {
      const match = url.match(/\/([a-z-]+)(?:\?|$)/);
      return match ? match[1] : null;
    }

    if (url.includes("zoom.us")) {
      const confno = new URLSearchParams(window.location.search).get("confno");
      if (confno) return confno;
      const pathMatch = url.match(/\/j\/(\d+)/);
      return pathMatch ? pathMatch[1] : null;
    }

    if (url.includes("teams.microsoft.com")) {
      const threadId = new URLSearchParams(window.location.search).get(
        "threadId"
      );
      return threadId || null;
    }

    return null;
  }

  private animateOut(callback: () => void) {
    if (this.overlay) {
      this.overlay.style.opacity = "0";
      this.overlay.style.transform = "scale(0.8)";
      setTimeout(callback, 300);
    }
  }

  private removeOverlay() {
    if (this.overlay) {
      if (this.updateTimer) {
        clearInterval(this.updateTimer);
        this.updateTimer = null;
      }
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
        this.hideTimeout = null;
      }
      if (this.tradePollingInterval) {
        clearInterval(this.tradePollingInterval);
        this.tradePollingInterval = null;
      }
      this.overlay.remove();
      this.overlay = null;
    }
  }

  updateRecordingState(isRecording: boolean, _duration: number) {
    this.state.isRecording = isRecording;
  }

  private toggleExpansion() {
    if (!this.overlay) return;

    const content = this.overlay.querySelector(
      "#crownie-overlay-content"
    ) as HTMLElement;
    const logo = this.overlay.querySelector("img") as HTMLElement;

    if (content.style.visibility === "visible") {
      this.collapseOverlay();
    } else {
      this.expandOverlay();
    }
  }

  private expandOverlay() {
    if (!this.overlay) return;

    const content = this.overlay.querySelector(
      "#crownie-overlay-content"
    ) as HTMLElement;
    const logo = this.overlay.querySelector("img") as HTMLElement;

    const viewportWidth = window.innerWidth;
    const expandedWidth = 280;
    const currentRight = parseInt(this.overlay.style.right) || 20;

    const totalRequiredSpace = expandedWidth + currentRight;
    if (totalRequiredSpace > viewportWidth) {
      const newRight = Math.max(10, viewportWidth - expandedWidth - 10);
      this.overlay!.style.right = `${newRight}px`;
    }

    content.style.visibility = "visible";
    content.style.opacity = "1";
    content.style.transform = "scale(1)";
    content.style.pointerEvents = "auto";

    this.overlay!.style.width = "280px";
    this.overlay!.style.height = "240px";
    this.overlay!.style.borderRadius = "12px";

    logo.style.opacity = "0";

    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }
  }

  private collapseOverlay() {
    if (!this.overlay) return;

    const content = this.overlay.querySelector(
      "#crownie-overlay-content"
    ) as HTMLElement;
    const logo = this.overlay.querySelector("img") as HTMLElement;

    content.style.visibility = "hidden";
    content.style.opacity = "0";
    content.style.transform = "scale(0.8)";
    content.style.pointerEvents = "none";

    this.overlay.style.width = "48px";
    this.overlay.style.height = "48px";
    this.overlay.style.borderRadius = "50%";

    this.overlay.style.right = "20px";

    logo.style.opacity = "1";

    this.setupAutoHideBehavior();
  }

  private async toggleRecording() {
    try {
      if (!this.state.isRecording) {
        await chrome.runtime.sendMessage({ action: "START_RECORDING" });
        this.startRecording();
      } else {
        await chrome.runtime.sendMessage({ action: "STOP_RECORDING" });
        this.stopRecording();
      }
    } catch (error) {}
  }

  private async toggleTrade() {
    try {
      const tradeBtn = this.overlay?.querySelector("#crownie-toggle-trade");
      const isTrading = tradeBtn?.classList.contains("trading") || false;

      if (!isTrading) {
        const meetingInfo = getMeetingInfo();
        if (!meetingInfo.isActive || !meetingInfo.meetingId) {
          return;
        }

        const secret = this.generateSecret();
        const hashLock = this.generateHashLock(secret);

        await chrome.runtime.sendMessage({
          action: "SAVE_MEETING_SECRET",
          data: {
            meetingId: meetingInfo.meetingId,
            secret,
            hashLock,
          },
        });

        await chrome.runtime.sendMessage({
          action: "START_TRADE",
          data: {
            meetingId: meetingInfo.meetingId,
            platform: meetingInfo.platform,
            title: meetingInfo.title,
            hashLock,
          },
        });
        this.startTrade();
      } else {
        await chrome.runtime.sendMessage({ action: "STOP_TRADE" });
        this.stopTrade();
      }
    } catch (error) {}
  }

  private generateSecret(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
      ""
    );
  }

  private generateHashLock(secret: string): string {
    return keccak256(toHex(secret));
  }

  private startRecording() {
    this.state.isRecording = true;
    this.state.recordingStartTime = Date.now();

    const recordingBtn = this.overlay?.querySelector(
      "#crownie-toggle-recording"
    );

    if (recordingBtn) {
      recordingBtn.innerHTML = "⏹️ Stop Recording";
      recordingBtn.classList.add("recording");
    }
  }

  private stopRecording() {
    this.state.isRecording = false;
    this.state.recordingStartTime = null;
    this.state.recordingDuration = 0;

    const recordingBtn = this.overlay?.querySelector(
      "#crownie-toggle-recording"
    );

    if (recordingBtn) {
      recordingBtn.innerHTML = "🎙️ Start Recording";
      recordingBtn.classList.remove("recording");
    }
  }

  private startTrade() {
    const tradeBtn = this.overlay?.querySelector("#crownie-toggle-trade");
    const tradeStatus = this.overlay?.querySelector(
      "#crownie-trade-status"
    ) as HTMLElement;

    if (tradeBtn) {
      tradeBtn.innerHTML = "💰 Start Trade";
      tradeBtn.classList.add("trading");
      (tradeBtn as HTMLElement).style.display = "none";
    }

    if (tradeStatus) {
      tradeStatus.style.display = "block";
    }

    this.state.isTrading = true;
    this.startTradeStatusPolling();
  }

  private stopTrade() {
    const tradeBtn = this.overlay?.querySelector("#crownie-toggle-trade");
    const tradeStatus = this.overlay?.querySelector(
      "#crownie-trade-status"
    ) as HTMLElement;

    if (tradeBtn) {
      tradeBtn.innerHTML = "💰 Start Trade";
      tradeBtn.classList.remove("trading");
    }

    if (tradeStatus) {
      tradeStatus.style.display = "none";
    }

    this.state.isTrading = false;
    this.stopTradeStatusPolling();
  }

  private startTradeStatusPolling() {
    if (this.tradePollingInterval) {
      clearInterval(this.tradePollingInterval);
    }

    this.tradePollingInterval = setInterval(async () => {
      await this.checkTradeStatus();
    }, 10000);
  }

  private async checkTradeStatus() {
    try {
      const meetingInfo = getMeetingInfo();
      if (!meetingInfo.isActive || !meetingInfo.meetingId) {
        return;
      }

      const response = await chrome.runtime.sendMessage({
        action: "GET_TRADE_STATUS",
        data: { meetingId: meetingInfo.meetingId },
      });

      if (response && response.activeOrderId) {
        this.state.activeOrderId = response.activeOrderId;

        if (response.isCompleted) {
          this.updateTradeStatus("Trade Completed", "#10b981");
          this.state.isTrading = false;
          this.stopTradeStatusPolling();
        } else if (response.isActive) {
          this.updateTradeStatus("Trade Active", "#F3BA50");
        }
      } else {
        this.updateTradeStatus("Trade Pending", "#F3BA50");
      }
    } catch (error) {}
  }

  updateTradeStatus(status: string, color: string) {
    const tradeStatusText = this.overlay?.querySelector(
      "#trade-status-text"
    ) as HTMLElement;
    if (tradeStatusText) {
      tradeStatusText.textContent = status;
      tradeStatusText.style.color = color;
    }
  }

  stopTradeStatusPolling() {
    if (this.tradePollingInterval) {
      clearInterval(this.tradePollingInterval);
      this.tradePollingInterval = null;
    }
  }

  startOrderPolling(orderId: string, meetingId: string) {
    this.stopOrderPolling(orderId);

    this.tradePollingInterval = setInterval(async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          action: "GET_ORDER_STATUS",
          data: { orderId, meetingId },
        });

        if (response && response.isFilled) {
          this.updateTradeStatus("Order Filled - Complete Swap", "#10b981");
          this.showCompleteSwapButton(orderId, meetingId);
        } else if (response && response.isActive) {
          this.updateTradeStatus("Order Active - Waiting for Fill", "#F3BA50");
        }
      } catch (error) {}
    }, 10000);
  }

  stopOrderPolling(orderId: string) {
    if (this.tradePollingInterval) {
      clearInterval(this.tradePollingInterval);
      this.tradePollingInterval = null;
    }
  }

  showCompleteSwapButton(orderId: string, meetingId: string) {
    const tradeBtn = this.overlay?.querySelector(
      "#crownie-toggle-trade"
    ) as HTMLElement;
    if (tradeBtn) {
      tradeBtn.innerHTML = "🔓 Complete Swap";
      tradeBtn.classList.add("ready-to-complete");
      tradeBtn.addEventListener("click", (e: Event) => {
        e.stopPropagation();
        this.completeSwap(orderId, meetingId);
      });
    }
  }

  async completeSwap(orderId: string, meetingId: string) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "GET_MEETING_SECRET",
        data: { meetingId },
      });

      if (response && response.secret) {
        const forceLocalhost = false;
        const baseUrl =
          process.env.NODE_ENV === "development" || forceLocalhost
            ? "http://localhost:3000"
            : "https://crownie-swap.vercel.app";

        const swapUrl = `${baseUrl}/complete-swap?orderId=${orderId}&meetingId=${meetingId}&secret=${response.secret}`;
        window.open(swapUrl, "_blank");
      }
    } catch (error) {}
  }
}

const overlayManager = new CrownieOverlayManager();

function detectPlatform(): string | null {
  const url = window.location.href;
  if (url.includes("meet.google.com")) return "Google Meet";
  if (url.includes("zoom.us")) return "Zoom";
  if (url.includes("teams.microsoft.com")) return "Microsoft Teams";
  if (url.includes("webex.com")) return "Cisco Webex";
  if (url.includes("discord.com")) return "Discord";
  return null;
}

function isMeetingActive(): boolean {
  const platform = detectPlatform();
  const url = window.location.href;

  switch (platform) {
    case "Google Meet":
      const hasSlash = url.includes("/");
      const notLanding = !url.includes("/landing");
      const notMeetPath = !url.includes("/_meet/");

      const isGoogleMeetActive = hasSlash && notLanding && notMeetPath;
      return isGoogleMeetActive;

    case "Zoom":
      return !!(
        document.querySelector(".meeting-app") ||
        (document.querySelector('[title*="mute"]') &&
          document.querySelector('[title*="camera"]')) ||
        document.querySelector(".ReactModal__Content") ||
        document.querySelector('[data-testid="participants-button"]') ||
        url.includes("/j/") ||
        url.includes("confno=")
      );

    case "Microsoft Teams":
      return !!(
        document.querySelector('[data-tid="toggle-mute"]') ||
        document.querySelector('[data-tid="toggle-video"]') ||
        document.querySelector(".ts-calling-screen") ||
        document.querySelector('[data-tid="calling-join-button"]') ||
        url.includes("threadId=")
      );

    case "Cisco Webex":
      return !!(
        document.querySelector('[data-testid="mute-audio-button"]') ||
        document.querySelector('[data-testid="mute-video-button"]') ||
        document.querySelector(".meeting-controls") ||
        url.includes("/meet/")
      );

    case "Discord":
      return !!(
        document.querySelector('[aria-label*="Mute"]') ||
        document.querySelector('[aria-label*="Deafen"]') ||
        document.querySelector(".panels-3wFtMD") ||
        url.includes("/channels/")
      );

    default:
      return false;
  }
}

function getMeetingInfo() {
  const platform = detectPlatform();
  const isActive = isMeetingActive();

  let meetingId = "";
  let title = "";

  if (platform === "Google Meet") {
    const urlMatch = window.location.pathname.match(/\/([a-z\-]+)$/);
    meetingId = urlMatch ? urlMatch[1] : "";
    title = document.title || `Google Meet - ${meetingId}`;
  } else if (platform === "Zoom") {
    meetingId =
      new URLSearchParams(window.location.search).get("confno") ||
      window.location.pathname.split("/").pop() ||
      "";
    title = document.title || `Zoom Meeting - ${meetingId}`;
  } else if (platform === "Microsoft Teams") {
    meetingId =
      new URLSearchParams(window.location.search).get("threadId") ||
      Math.random().toString(36).substring(2, 11);
    title = document.title || `Teams Meeting - ${meetingId}`;
  }

  return {
    platform,
    isActive,
    meetingId,
    title,
    url: window.location.href,
  };
}

chrome.runtime.onMessage.addListener(
  (
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void
  ) => {
    switch (message.action) {
      case "GET_MEETING_STATUS":
        const meetingInfo = getMeetingInfo();
        sendResponse({
          isMeetingDetected: !!meetingInfo.platform && meetingInfo.isActive,
          platform: meetingInfo.platform || "Unknown",
          meetingId: meetingInfo.meetingId,
          title: meetingInfo.title,
          isRecording: false,
          recordingDuration: 0,
        });
        break;

      case "START_RECORDING":
        sendResponse({ success: true, message: "Recording started" });
        break;

      case "STOP_RECORDING":
        sendResponse({ success: true, message: "Recording stopped" });
        break;

      case "START_TRADE":
        sendResponse({ success: true, message: "Trade started" });
        break;

      case "STOP_TRADE":
        sendResponse({ success: true, message: "Trade stopped" });
        break;

      case "UPDATE_TRADE_STATE":
        overlayManager.updateRecordingState(
          message.data.isTrading,
          message.data.duration
        );
        sendResponse({ success: true });
        break;

      case "TRADE_STATUS_UPDATE":
        if (message.data.isCompleted) {
          overlayManager.updateTradeStatus("Trade Completed", "#10b981");
          overlayManager.stopTradeStatusPolling();
        }
        sendResponse({ success: true });
        break;

      case "ORDER_CREATED":
        handleOrderCreated(message.data);
        sendResponse({ success: true });
        break;

      case "ORDER_COMPLETED":
        handleOrderCompleted(message.data);
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: `Unknown action: ${message.action}` });
    }

    return true;
  }
);

window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  try {
    const message = event.data;
    if (message && typeof message === "object" && "type" in message) {
      switch (message.type) {
        case "ORDER_CREATED":
          handleOrderCreated(message);
          break;
        case "ORDER_UPDATED":
          handleOrderUpdated(message);
          break;
        case "ORDER_COMPLETED":
          handleOrderCompleted(message);
          break;
        default:
          break;
      }
    }
  } catch (error) {}
});

function handleOrderCreated(data: any) {
  chrome.runtime
    .sendMessage({
      action: "SAVE_ORDER",
      data: {
        orderId: data.orderId,
        meetingId: data.meetingId,
        orderData: data.data,
      },
    })
    .then((response) => {
      overlayManager.startOrderPolling(data.orderId, data.meetingId);
      overlayManager.updateTradeStatus(
        "Order Created - Waiting for Fill",
        "#F3BA50"
      );

      const tradeBtn = overlayManager.overlay?.querySelector(
        "#crownie-toggle-trade"
      );
      if (tradeBtn) {
        tradeBtn.innerHTML = "📱 Manage Orders";
        (tradeBtn as HTMLElement).style.display = "block";
        tradeBtn.classList.remove("trading");
      }

      if (data.messageId) {
        window.postMessage(
          {
            type: "ORDER_CREATED_CONFIRMED",
            messageId: data.messageId,
          },
          "*"
        );
      }
    })
    .catch((error) => {
      if (data.messageId) {
        window.postMessage(
          {
            type: "ORDER_CREATED_ERROR",
            messageId: data.messageId,
            error: error.message,
          },
          "*"
        );
      }
    });
}

function handleOrderUpdated(data: any) {
  chrome.runtime
    .sendMessage({
      action: "UPDATE_ORDER",
      data: {
        orderId: data.orderId,
        updates: data.updates,
      },
    })
    .then((response) => {
      if (data.updates.status === "active") {
        overlayManager.updateTradeStatus(
          "Order Filled - Ready to Complete",
          "#10b981"
        );
      } else if (data.updates.status === "fulfilled") {
        overlayManager.updateTradeStatus("Swap Completed", "#059669");
      }

      if (data.messageId) {
        window.postMessage(
          {
            type: "ORDER_UPDATED_CONFIRMED",
            messageId: data.messageId,
          },
          "*"
        );
      }
    })
    .catch((error) => {
      if (data.messageId) {
        window.postMessage(
          {
            type: "ORDER_UPDATED_ERROR",
            messageId: data.messageId,
            error: error.message,
          },
          "*"
        );
      }
    });
}

function handleOrderCompleted(data: any) {
  chrome.runtime
    .sendMessage({
      action: "COMPLETE_ORDER",
      data: {
        orderId: data.orderId,
        meetingId: data.meetingId,
        secret: data.secret,
      },
    })
    .then((response) => {
      overlayManager.stopOrderPolling(data.orderId);
      overlayManager.updateTradeStatus("Swap Completed", "#10b981");

      if (data.messageId) {
        window.postMessage(
          {
            type: "ORDER_COMPLETED_CONFIRMED",
            messageId: data.messageId,
          },
          "*"
        );
      }
    })
    .catch((error) => {
      if (data.messageId) {
        window.postMessage(
          {
            type: "ORDER_COMPLETED_ERROR",
            messageId: data.messageId,
            error: error.message,
          },
          "*"
        );
      }
    });
}

function initializeContentScript() {
  const currentUrl = window.location.href;

  const isSwapPage =
    currentUrl.includes("localhost:3000") ||
    currentUrl.includes("crownie-swap.vercel.app");

  if (isSwapPage) {
    return;
  }

  const meetingInfo = getMeetingInfo();

  if (meetingInfo.platform && meetingInfo.isActive) {
    overlayManager.showOverlay({
      platform: meetingInfo.platform,
      isActive: meetingInfo.isActive,
      meetingId: meetingInfo.meetingId,
      title: meetingInfo.title,
    });

    chrome.runtime
      .sendMessage({
        action: "MEETING_DETECTED",
        data: meetingInfo,
      })
      .catch((error) => {});
  } else {
    overlayManager.hideOverlay();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeContentScript);
} else {
  initializeContentScript();
}

let currentUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    setTimeout(initializeContentScript, 1000);
  }
}, 1000);
