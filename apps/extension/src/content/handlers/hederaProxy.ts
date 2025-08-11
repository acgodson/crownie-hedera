export function handleHederaProxyOperation(
  data: any,
  sendResponse: (response: any) => void
) {
  (async () => {
    try {
      console.log("🔧 [HEDERA PROXY] Starting operation:", data);
      const { operation, ...operationData } = data;
      
      console.log("🔧 [HEDERA PROXY] Getting agent identity from background...");
      const agentStateResponse = await chrome.runtime.sendMessage({
        action: "GET_AGENT_STATE",
      });

      if (!agentStateResponse?.identity) {
        console.error("❌ [HEDERA PROXY] No agent identity found");
        throw new Error("No agent identity found");
      }

      console.log("✅ [HEDERA PROXY] Agent identity retrieved:", {
        accountId: agentStateResponse.identity.accountId,
        network: agentStateResponse.identity.network
      });

      const { DirectHederaService } = await import("../../services/DirectHederaService");
      const directService = new DirectHederaService(agentStateResponse.identity);
      console.log("✅ [HEDERA PROXY] DirectHederaService initialized");

      let result;
      
      switch (operation) {
        case 'CREATE_TOPIC':
          console.log("🎯 [HEDERA PROXY] Creating topic with memo:", operationData.memo);
          const memo = operationData.memo || `Crownie meeting topic - ${new Date().toISOString()}`;
          console.log("📝 [HEDERA PROXY] Final memo:", memo);
          
          const topicId = await directService.createTopic(memo);
          console.log("🎉 [HEDERA PROXY] Topic created successfully! Topic ID:", topicId);
          
          result = { topicId, status: "success" };
          break;
          
        case 'SUBMIT_MESSAGE':
          console.log("📤 [HEDERA PROXY] Submitting message to topic:", operationData.topicId);
          await directService.submitMessage(operationData.topicId, operationData.message);
          console.log("✅ [HEDERA PROXY] Message submitted successfully");
          result = { status: "success" };
          break;
          
        default:
          throw new Error(`Unknown Hedera operation: ${operation}`);
      }

      directService.close();
      console.log("🔒 [HEDERA PROXY] DirectHederaService closed");

      console.log("✅ [HEDERA PROXY] Operation completed successfully:", result);
      sendResponse({
        success: true,
        result
      });
    } catch (error) {
      console.error("❌ [HEDERA PROXY] Operation failed:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  })();
}