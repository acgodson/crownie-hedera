import * as Sdk from '@1inch/cross-chain-sdk';
import { JsonRpcProvider, Wallet, parseUnits } from 'ethers';
import { uint8ArrayToHex } from '@1inch/byte-utils';

export class FusionICPBridge {
  private provider: JsonRpcProvider;
  private wallet: Wallet;
  
  constructor(rpcUrl: string, privateKey: string, chainId: number = 1) {
    this.provider = new JsonRpcProvider(rpcUrl, chainId);
    this.wallet = new Wallet(privateKey, this.provider);
  }


  async getQuote(fromToken: string, toToken: string, amount: string, apiKey: string) {
    const response = await fetch(`https://api.1inch.dev/swap/v6.0/1/quote?src=${fromToken}&dst=${toToken}&amount=${amount}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    if (!response.ok) {
      throw new Error(`1inch API error: ${response.status}`);
    }
    
    return await response.json();
  }


  async createCrossChainOrder(
    fromToken: string,
    toToken: string,
    makingAmount: string,
    takingAmount: string,
    makerAddress: string,
    srcChainId: number = 1,
    dstChainId: number = 56
  ) {
    const secret = uint8ArrayToHex(crypto.getRandomValues(new Uint8Array(32)));
    const hashLock = Sdk.HashLock.forSingleFill(secret);
    const timestamp = BigInt((await this.provider.getBlock('latest'))!.timestamp);
    
    const order = Sdk.CrossChainOrder.new(
      new Sdk.Address('0x1111111254eeb25477b68fb85ed929f73a960582'), 
      {
        salt: Sdk.randBigInt(1000n),
        maker: new Sdk.Address(makerAddress),
        makingAmount: BigInt(makingAmount),
        takingAmount: BigInt(takingAmount),
        makerAsset: new Sdk.Address(fromToken),
        takerAsset: new Sdk.Address(toToken)
      },
      {
        hashLock,
        timeLocks: Sdk.TimeLocks.new({
          srcWithdrawal: 10n,
          srcPublicWithdrawal: 120n,
          srcCancellation: 121n,
          srcPublicCancellation: 122n,
          dstWithdrawal: 10n,
          dstPublicWithdrawal: 100n,
          dstCancellation: 101n
        }),
        srcChainId,
        dstChainId,
        srcSafetyDeposit: parseUnits('0.001', 18),
        dstSafetyDeposit: parseUnits('0.001', 18)
      },
      {
        auction: new Sdk.AuctionDetails({
          initialRateBump: 0,
          points: [],
          duration: 120n,
          startTime: timestamp
        }),
        whitelist: [
          {
            address: new Sdk.Address(makerAddress),
            allowFrom: 0n
          }
        ],
        resolvingStartTime: 0n
      },
      {
        nonce: Sdk.randBigInt(1000000n),
        allowPartialFills: false,
        allowMultipleFills: false
      }
    );

    return {
      order,
      secret,
      orderHash: order.getOrderHash(srcChainId)
    };
  }

  async signOrder(order: any, chainId: number) {
    const domain = {
      name: '1inch Limit Order Protocol',
      version: '4',
      chainId,
      verifyingContract: '0x1111111254eeb25477b68fb85ed929f73a960582'
    };

    return await this.wallet.signTypedData(domain, order.getTypes(), order.getStructHash());
  }
}