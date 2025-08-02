import { useState, useCallback } from 'react';
import { getFusionService, getICPService } from '@crownie-bridge/fusion-icp-bridge';
import type { FusionQuoteParams, SwapQuote } from '@crownie-bridge/shared-types';

export const useFusionBridge = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getQuote = useCallback(async (params: FusionQuoteParams) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const fusionService = getFusionService(process.env.VITE_FUSION_API_KEY);
      const result = await fusionService.getQuote(params);
      setQuote(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get quote';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createCrossChainOrder = useCallback(async (
    sellToken: string,
    buyToken: string,
    amount: string,
    walletAddress: string,
    destinationChain: string
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const fusionService = getFusionService(process.env.VITE_FUSION_API_KEY);
      const order = await fusionService.createCrossChainOrder(
        sellToken,
        buyToken,
        amount,
        walletAddress,
        destinationChain
      );
      return order;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create order';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    quote,
    error,
    getQuote,
    createCrossChainOrder,
  };
};