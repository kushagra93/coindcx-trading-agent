import { Keypair, Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, getMint, getAccount } from '@solana/spl-token';
import bs58 from 'bs58';
import { config } from '../core/config.js';
import { createChildLogger } from '../core/logger.js';
import { generateEncryptedKey, decryptKey } from './key-manager.js';
import type { EncryptedKey, WalletInfo, TransferParams, TransferResult } from './types.js';

const log = createChildLogger('solana-wallet');

let connection: Connection;

function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(config.solana.rpcUrl, 'confirmed');
  }
  return connection;
}

/**
 * Generate a new Solana wallet for a user.
 * Returns the encrypted key and the public address.
 */
export async function createSolanaWallet(userId: string): Promise<{ encryptedKey: EncryptedKey; address: string }> {
  const keypair = Keypair.generate();
  const address = keypair.publicKey.toBase58();

  log.info({ userId, address }, 'Created new Solana wallet');

  const encryptedKey = await generateEncryptedKey(userId, 'solana', keypair.secretKey);

  return { encryptedKey, address };
}

/**
 * Restore a Keypair from an encrypted key.
 */
export async function getKeypair(encryptedKey: EncryptedKey): Promise<Keypair> {
  const secretKey = await decryptKey(encryptedKey);
  return Keypair.fromSecretKey(new Uint8Array(secretKey));
}

/**
 * Get wallet info (address + SOL balance).
 */
export async function getWalletInfo(encryptedKey: EncryptedKey): Promise<WalletInfo> {
  const keypair = await getKeypair(encryptedKey);
  const conn = getConnection();
  const balance = await conn.getBalance(keypair.publicKey);

  return {
    address: keypair.publicKey.toBase58(),
    chain: 'solana',
    balance: (balance / LAMPORTS_PER_SOL).toString(),
  };
}

/**
 * Get SPL token balance for a wallet.
 */
export async function getTokenBalance(
  walletAddress: string,
  tokenMint: string
): Promise<string> {
  const conn = getConnection();
  const wallet = new PublicKey(walletAddress);
  const mint = new PublicKey(tokenMint);

  const ata = await getAssociatedTokenAddress(mint, wallet);

  try {
    const account = await getAccount(conn, ata);
    const mintInfo = await getMint(conn, mint);
    const balance = Number(account.amount) / Math.pow(10, mintInfo.decimals);
    return balance.toString();
  } catch {
    return '0';
  }
}

/**
 * Transfer SOL or SPL token from agent wallet.
 */
export async function transferSolana(
  encryptedKey: EncryptedKey,
  params: TransferParams
): Promise<TransferResult> {
  const keypair = await getKeypair(encryptedKey);
  const conn = getConnection();
  const toPubkey = new PublicKey(params.to);

  try {
    const tx = new Transaction();

    if (params.token === 'SOL' || params.token === 'So11111111111111111111111111111111111111112') {
      // Native SOL transfer
      const lamports = Math.floor(parseFloat(params.amount) * LAMPORTS_PER_SOL);
      tx.add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey,
          lamports,
        })
      );
    } else {
      // SPL token transfer
      const mint = new PublicKey(params.token);
      const mintInfo = await getMint(conn, mint);
      const amount = BigInt(Math.floor(parseFloat(params.amount) * Math.pow(10, mintInfo.decimals)));

      const fromAta = await getAssociatedTokenAddress(mint, keypair.publicKey);
      const toAta = await getAssociatedTokenAddress(mint, toPubkey);

      tx.add(
        createTransferInstruction(fromAta, toAta, keypair.publicKey, amount)
      );
    }

    if (config.dryRun) {
      log.info({ to: params.to, amount: params.amount, token: params.token }, 'DRY_RUN: Would send Solana transfer');
      return { success: true, txHash: 'dry-run-' + Date.now() };
    }

    const txHash = await sendAndConfirmTransaction(conn, tx, [keypair]);
    log.info({ txHash, to: params.to, amount: params.amount }, 'Solana transfer confirmed');

    return { success: true, txHash };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.error({ error, to: params.to }, 'Solana transfer failed');
    return { success: false, error };
  }
}
