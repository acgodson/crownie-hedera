// Bridge listener for communication between web page and extension
console.log("🔗 Bridge Listener: Starting...");

interface OrderCreatedMessage {
  type: "ORDER_CREATED";
  orderId: string;
  meetingId: string;
  data?: any;
}

interface OrderUpdatedMessage {
  type: "ORDER_UPDATED";
  orderId: string;
  updates: any;
}

type BridgeMessage = OrderCreatedMessage | OrderUpdatedMessage;

class BridgeListener {
  private isListening = false;

  constructor() {
    this.setupMessageListener();
  }

  private setupMessageListener() {
    if (this.isListening) return;

    window.addEventListener("message", (event) => {
      const trustedOrigins = [
        "https://crownie-demo.vercel.app",
        "http://localhost:3000",
      ];

      if (!trustedOrigins.includes(event.origin)) {
        console.log(
          "🔗 Bridge: Ignoring message from untrusted origin:",
          event.origin
        );
        return;
      }

      try {
        const message = event.data;

        if (!message || typeof message !== "object" || !("type" in message)) {
          console.log("🔗 Bridge: Invalid message format:", message);
          return;
        }

        this.handleMessage(message as BridgeMessage);
      } catch (error) {
        console.error("🔗 Bridge: Error handling message:", error);
      }
    });

    this.isListening = true;
    console.log("✅ Bridge Listener: Message listener set up");
  }

  private async handleMessage(message: any) {
    console.log("🔗 Bridge: Received message:", message);

    try {
      switch (message.type) {
        case "ORDER_CREATED":
          await this.handleOrderCreated(message as OrderCreatedMessage);
          break;
        case "ORDER_UPDATED":
          await this.handleOrderUpdated(message as OrderUpdatedMessage);
          break;
        default:
          console.log("🔗 Bridge: Unknown message type:", message.type);
      }
    } catch (error) {
      console.error("🔗 Bridge: Error handling message:", error);
    }
  }

  private async handleOrderCreated(message: OrderCreatedMessage) {
    console.log(
      "📋 Bridge: Order created:",
      message.orderId,
      "for meeting:",
      message.meetingId
    );

    try {
      const response = await chrome.runtime.sendMessage({
        action: "ORDER_CREATED",
        data: {
          orderId: message.orderId,
          meetingId: message.meetingId,
          ...message.data,
        },
      });

      console.log("✅ Bridge: Order created response:", response);
    } catch (error) {
      console.error("❌ Bridge: Failed to send order created message:", error);
    }
  }

  private async handleOrderUpdated(message: OrderUpdatedMessage) {
    console.log(
      "📋 Bridge: Order updated:",
      message.orderId,
      "with updates:",
      message.updates
    );

    try {
      const response = await chrome.runtime.sendMessage({
        action: "ORDER_UPDATED",
        data: {
          orderId: message.orderId,
          updates: message.updates,
        },
      });

      console.log("✅ Bridge: Order updated response:", response);
    } catch (error) {
      console.error("❌ Bridge: Failed to send order updated message:", error);
    }
  }

  sendMessageToWebPage(message: any) {
    try {
      window.postMessage(message, "*");
      console.log("🔗 Bridge: Sent message to web page:", message);
    } catch (error) {
      console.error("❌ Bridge: Failed to send message to web page:", error);
    }
  }
}

const bridgeListener = new BridgeListener();

export { bridgeListener, BridgeListener };
export type { BridgeMessage, OrderCreatedMessage, OrderUpdatedMessage };

console.log("✅ Bridge Listener: Initialized successfully");
