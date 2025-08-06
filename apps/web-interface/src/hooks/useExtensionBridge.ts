import { useCallback } from "react";

interface OrderCreatedData {
  orderId: string;
  meetingId: string;
  data?: any;
}

interface OrderUpdatedData {
  orderId: string;
  updates: any;
}

interface OrderCompletedData {
  orderId: string;
  meetingId: string;
  secret: string;
}

export function useExtensionBridge() {
  const isExtensionAvailable =
    typeof window !== "undefined" &&
    typeof (window as any).chrome !== "undefined" &&
    typeof (window as any).chrome.runtime !== "undefined";

  const sendOrderCreated = useCallback(
    (data: OrderCreatedData): Promise<boolean> => {
      return new Promise((resolve) => {
        if (!isExtensionAvailable) {
          console.log("❌ Extension not available, order created:", data);
          resolve(false);
          return;
        }

        try {
          console.log("📤 Sending ORDER_CREATED message to extension:", data);
          const messageId = `order_created_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;
          const handleConfirmation = (event: MessageEvent) => {
            if (
              event.source === window &&
              event.data &&
              event.data.type === "ORDER_CREATED_CONFIRMED" &&
              event.data.messageId === messageId
            ) {
              console.log(
                "✅ ORDER_CREATED confirmation received from extension"
              );
              window.removeEventListener("message", handleConfirmation);
              resolve(true);
            }
          };

          window.addEventListener("message", handleConfirmation);

          setTimeout(() => {
            window.removeEventListener("message", handleConfirmation);
            console.log("⏰ ORDER_CREATED confirmation timeout");
            resolve(false);
          }, 10000);

          window.postMessage(
            {
              type: "ORDER_CREATED",
              messageId,
              orderId: data.orderId,
              meetingId: data.meetingId,
              data: data.data,
            },
            "*"
          );

          console.log(
            "✅ ORDER_CREATED message posted, waiting for confirmation..."
          );
        } catch (error) {
          console.error("❌ Failed to send order created message:", error);
          resolve(false);
        }
      });
    },
    [isExtensionAvailable]
  );

  const sendOrderUpdated = useCallback(
    (data: OrderUpdatedData): Promise<boolean> => {
      return new Promise((resolve) => {
        if (!isExtensionAvailable) {
          console.log("❌ Extension not available, order updated:", data);
          resolve(false);
          return;
        }

        try {
          console.log("📤 Sending ORDER_UPDATED message to extension:", data);

          const messageId = `order_updated_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;

          const handleConfirmation = (event: MessageEvent) => {
            if (
              event.source === window &&
              event.data &&
              event.data.type === "ORDER_UPDATED_CONFIRMED" &&
              event.data.messageId === messageId
            ) {
              console.log(
                "✅ ORDER_UPDATED confirmation received from extension"
              );
              window.removeEventListener("message", handleConfirmation);
              resolve(true);
            }
          };

          window.addEventListener("message", handleConfirmation);

          setTimeout(() => {
            window.removeEventListener("message", handleConfirmation);
            console.log("⏰ ORDER_UPDATED confirmation timeout");
            resolve(false);
          }, 10000);

          window.postMessage(
            {
              type: "ORDER_UPDATED",
              messageId,
              orderId: data.orderId,
              updates: data.updates,
            },
            "*"
          );

          console.log(
            "✅ ORDER_UPDATED message posted, waiting for confirmation..."
          );
        } catch (error) {
          console.error("❌ Failed to send order updated message:", error);
          resolve(false);
        }
      });
    },
    [isExtensionAvailable]
  );

  const sendOrderCompleted = useCallback(
    (data: OrderCompletedData): Promise<boolean> => {
      return new Promise((resolve) => {
        if (!isExtensionAvailable) {
          console.log("❌ Extension not available, order completed:", data);
          resolve(false);
          return;
        }

        try {
          console.log("📤 Sending ORDER_COMPLETED message to extension:", data);

          const messageId = `order_completed_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;
          const handleConfirmation = (event: MessageEvent) => {
            if (
              event.source === window &&
              event.data &&
              event.data.type === "ORDER_COMPLETED_CONFIRMED" &&
              event.data.messageId === messageId
            ) {
              console.log(
                "✅ ORDER_COMPLETED confirmation received from extension"
              );
              window.removeEventListener("message", handleConfirmation);
              resolve(true);
            }
          };

          window.addEventListener("message", handleConfirmation);

          setTimeout(() => {
            window.removeEventListener("message", handleConfirmation);
            console.log("⏰ ORDER_COMPLETED confirmation timeout");
            resolve(false);
          }, 10000);

          window.postMessage(
            {
              type: "ORDER_COMPLETED",
              messageId,
              orderId: data.orderId,
              meetingId: data.meetingId,
              secret: data.secret,
            },
            "*"
          );

          console.log(
            "✅ ORDER_COMPLETED message posted, waiting for confirmation..."
          );
        } catch (error) {
          console.error("❌ Failed to send order completed message:", error);
          resolve(false);
        }
      });
    },
    [isExtensionAvailable]
  );

  const onMessage = useCallback((callback: (message: any) => void) => {
    if (typeof window === "undefined") return;

    const handleMessage = (event: MessageEvent) => {
      if (
        event.data &&
        typeof event.data === "object" &&
        "type" in event.data
      ) {
        callback(event.data);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return {
    sendOrderCreated,
    sendOrderUpdated,
    sendOrderCompleted,
    onMessage,
    isExtensionAvailable,
  };
}
