import { useState, useCallback } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseUnits, keccak256, encodePacked, encodeAbiParameters } from "viem";
import RESOLVER from "../assets/Resolver.json";

const RESOLVER_ABI = RESOLVER.abi;

interface SwapState {
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  setSellToken: (token: string) => void;
  setBuyToken: (token: string) => void;
  setSellAmount: (amount: string) => void;
  setBuyAmount: (amount: string) => void;
  createOrder: () => Promise<string | null>;
  isLoading: boolean;
  error?: string;
}

const RESOLVER_ADDRESS =
  import.meta.env.VITE_RESOLVER_CONTRACT_ADDRESS ||
  "0x689b5A63B715a3bA57a900B58c74dA60F98F1370";

const ERC20_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export function useSwapState(
  hashLock?: string | null,
  meetingId?: string | null
): SwapState {
  const [sellToken, setSellToken] = useState("USDT");
  const [buyToken, setBuyToken] = useState("USDC");
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();

  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const createOrder = useCallback(async (): Promise<string | null> => {
    if (!address || !walletClient || !publicClient || !hashLock || !meetingId) {
      setError("Missing required parameters");
      return null;
    }

    if (!sellAmount || sellAmount === "0") {
      setError("Please enter a valid sell amount");
      return null;
    }

    if (!buyAmount || buyAmount === "0") {
      setError("Please enter a valid buy amount");
      return null;
    }

    setIsLoading(true);
    setError(undefined);

    try {
      const makerAmount = parseUnits(sellAmount, 6);
      const takerAmount = parseUnits(buyAmount, 6);

      const currentBlock = await publicClient.getBlock();
      const currentTimestamp =
        currentBlock?.timestamp || BigInt(Math.floor(Date.now() / 1000));

      let minTimelock: bigint;
      try {
        minTimelock = (await publicClient.readContract({
          address: RESOLVER_ADDRESS as `0x${string}`,
          abi: RESOLVER_ABI,
          functionName: "MIN_TIMELOCK",
        })) as bigint;
      } catch (error) {
        console.error("Failed to read MIN_TIMELOCK:", error);
        minTimelock = 3600n; // Default to 1 hour
      }

      const timelock = Number(currentTimestamp + minTimelock + 60n);
      const nonce = Math.floor(Math.random() * 1000000);
      const salt = keccak256(encodePacked(["string"], [`salt_${Date.now()}`]));

      if (!hashLock || hashLock.length !== 66 || !hashLock.startsWith("0x")) {
        setError(
          "Invalid hashLock format. Expected 66-character hex string starting with 0x"
        );
        return null;
      }

      const hashLockBytes = hashLock as `0x${string}`;

      const order = {
        maker: address,
        makerToken:
          "0xf7f007dc8Cb507e25e8b7dbDa600c07FdCF9A75B" as `0x${string}`,
        makerAmount,
        takerToken:
          "0x4C2AA252BEe766D3399850569713b55178934849" as `0x${string}`,
        takerAmount,
        hashLock: hashLockBytes,
        timelock: BigInt(timelock),
        nonce: BigInt(nonce),
        salt,
      };

      const orderHash = keccak256(
        encodeAbiParameters(
          [
            { name: "maker", type: "address" },
            { name: "makerToken", type: "address" },
            { name: "makerAmount", type: "uint256" },
            { name: "takerToken", type: "address" },
            { name: "takerAmount", type: "uint256" },
            { name: "hashLock", type: "bytes32" },
            { name: "timelock", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "salt", type: "bytes32" },
          ],
          [
            order.maker,
            order.makerToken,
            order.makerAmount,
            order.takerToken,
            order.takerAmount,
            order.hashLock,
            order.timelock,
            order.nonce,
            order.salt,
          ]
        )
      );

      console.log(
        "Order hash:",
        `${orderHash.slice(0, 10)}...${orderHash.slice(-8)}`
      );

      let creationFee: bigint;
      try {
        creationFee = (await publicClient.readContract({
          address: RESOLVER_ADDRESS as `0x${string}`,
          abi: RESOLVER_ABI,
          functionName: "CREATION_FEE",
        })) as bigint;
      } catch (error) {
        console.error("Failed to read creation fee:", error);
        creationFee = 0n;
      }

      if (order.timelock < currentTimestamp + minTimelock) {
        setError("Invalid timelock - too short");
        return null;
      }

      const escrowAddresses = (await publicClient.readContract({
        address: RESOLVER_ADDRESS as `0x${string}`,
        abi: RESOLVER_ABI,
        functionName: "computeEscrowAddresses",
        args: [orderHash, order.salt],
      })) as [`0x${string}`, `0x${string}`];

      const [predictedMakerEscrow] = escrowAddresses;

      const userBalance = await publicClient.readContract({
        address: order.makerToken,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      });

      if (userBalance < makerAmount) {
        setError(
          `Insufficient USDT balance. You have ${userBalance.toString()} but need ${makerAmount.toString()}`
        );
        return null;
      }

      const { request: approveMakerRequest } =
        await publicClient.simulateContract({
          address: order.makerToken,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [predictedMakerEscrow, makerAmount],
          account: address,
        });

      const approveMakerHash = await walletClient.writeContract(
        approveMakerRequest
      );
      await publicClient.waitForTransactionReceipt({ hash: approveMakerHash });

      const { request } = await publicClient.simulateContract({
        address: RESOLVER_ADDRESS as `0x${string}`,
        abi: RESOLVER_ABI,
        functionName: "createOrder",
        args: [order],
        account: address,
        value: creationFee,
      });

      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });

      console.log(
        "✅ Order created:",
        `${orderHash.slice(0, 10)}...${orderHash.slice(-8)}`
      );
      return orderHash;
    } catch (err) {
      console.error("Failed to create order:", err);
      setError(err instanceof Error ? err.message : "Failed to create order");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [
    address,
    walletClient,
    publicClient,
    hashLock,
    meetingId,
    sellAmount,
    buyAmount,
  ]);

  return {
    sellToken,
    buyToken,
    sellAmount,
    buyAmount,
    setSellToken,
    setBuyToken,
    setSellAmount,
    setBuyAmount,
    createOrder,
    isLoading,
    error,
  };
}
