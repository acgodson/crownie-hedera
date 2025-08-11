export function detectPlatform(): string | null {
  const url = window.location.href;
  if (url.includes("meet.google.com")) return "Google Meet";
  if (url.includes("zoom.us")) return "Zoom";
  if (url.includes("teams.microsoft.com")) return "Microsoft Teams";
  if (url.includes("webex.com")) return "Cisco Webex";
  if (url.includes("discord.com")) return "Discord";
  return null;
}

export function isMeetingActive(): boolean {
  const platform = detectPlatform();
  const url = window.location.href;

  switch (platform) {
    case "Google Meet":
      const hasSlash = url.includes("/");
      const notLanding = !url.includes("/landing");
      const notMeetPath = !url.includes("/_meet/");
      return hasSlash && notLanding && notMeetPath;

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

export function getMeetingInfo() {
  const platform = detectPlatform();
  const active = isMeetingActive();

  const detectedMeeting = {
    platform: platform || "Unknown",
    isActive: active,
    meetingId: "",
    title: document.title || "",
    url: window.location.href,
  };

  if (active) {
    const url = window.location.href;

    if (url.includes("meet.google.com")) {
      const match = url.match(/\/([a-z-]+)(?:\?|$)/);
      detectedMeeting.meetingId = match ? match[1] : "";
    } else if (url.includes("zoom.us")) {
      const confno = new URLSearchParams(window.location.search).get("confno");
      if (confno) {
        detectedMeeting.meetingId = confno;
      } else {
        const pathMatch = url.match(/\/j\/(\d+)/);
        detectedMeeting.meetingId = pathMatch ? pathMatch[1] : "";
      }
    } else if (url.includes("teams.microsoft.com")) {
      const threadId = new URLSearchParams(window.location.search).get(
        "threadId"
      );
      detectedMeeting.meetingId = threadId || "";
    }
  }

  return detectedMeeting;
} 