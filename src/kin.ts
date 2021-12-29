import {
  Client,
  Environment,
  kinToQuarks,
  PrivateKey,
  PublicKey,
  TransactionType,
} from '@kinecosystem/kin-sdk-v2';

export class Kin {
  static generateKey() {
    console.log('🚀 ~ generateKey');
    return PrivateKey.random();
  }

  readonly client: Client;

  constructor(env: Environment, appIndex?: number) {
    this.client = new Client(env, { appIndex });
  }

  async createAccount(privateKey: PrivateKey): Promise<PublicKey[]> {
    // Create Account
    await this.client.createAccount(privateKey);
    // Resolve Token Account
    return this.client.resolveTokenAccounts(privateKey.publicKey());
  }

  async getBalance(account: PublicKey) {
    return this.client.getBalance(account);
  }

  async requestAirdrop(publicKey: PublicKey, amount: string) {
    return this.client.requestAirdrop(publicKey, kinToQuarks(amount));
  }

  async submitPayment(
    sender: PrivateKey,
    destination: PublicKey,
    amount: string,
    type: TransactionType,
    memo?: string
  ) {
    return this.client.submitPayment({
      sender,
      destination,
      type,
      memo,
      quarks: kinToQuarks(amount),
    });
  }

  async submitEarn(
    sender: PrivateKey,
    destination: PublicKey,
    amount: string,
    memo?: string
  ) {
    return this.submitPayment(
      sender,
      destination,
      amount,
      TransactionType.Earn,
      memo
    );
  }

  async submitSpend(
    sender: PrivateKey,
    destination: PublicKey,
    amount: string,
    memo?: string
  ) {
    return this.submitPayment(
      sender,
      destination,
      amount,
      TransactionType.Spend,
      memo
    );
  }

  async submitP2P(
    sender: PrivateKey,
    destination: PublicKey,
    amount: string,
    memo?: string
  ) {
    return this.submitPayment(
      sender,
      destination,
      amount,
      TransactionType.P2P,
      memo
    );
  }
}
