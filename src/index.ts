import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// import bs58 from 'bs58';

import {
  KineticSdk,
  KineticSdkConfig,
  MakeTransferBatchOptions,
  TransferDestination,
} from '@kin-kinetic/sdk';
import { Keypair } from '@kin-kinetic/keypair';
import { Commitment } from '@kin-kinetic/solana';
import { TransactionType } from '@kin-tools/kin-memo';
// import { KeypairCompat } from '@kin-tools/keypair-compat';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Set up Kin client
let kinClient;
let appHotWallet;
let appTokenAccounts = [];
try {
  // if deprecated Stellar keypair:
  // appHotWallet = KeypairCompat.getKeypair(process.env.PRIVATE_KEY);

  // if Solana Keypair:
  // appHotWallet = Keypair.fromSecretKey(process.env.PRIVATE_KEY);
  appHotWallet = Keypair.fromMnemonic(process.env.MNEMONIC);
} catch (error) {
  console.log('🚀 ~ error', error);
  console.log('🚀 ~ It looks like your PRIVATE_KEY is missing or invalid.');
}

const kinClientEnv = () => kinClient?.sdkConfig?.environment || 'devnet';

interface User {
  privateKey: string;
  publicKey: string;
  kinTokenAccounts: string[];
}
// List of Users
const users: Record<'mainnet' | 'devnet', Record<string, User>> = {
  mainnet: {},
  devnet: {},
};
interface SaveKinAccount {
  name: string;
  keypair: Keypair;
  kinTokenAccounts: string[];
}
function saveKinAccount({ name, keypair, kinTokenAccounts }: SaveKinAccount) {
  // %%%%%%%%%%%% IMPORTANT %%%%%%%%%%%%
  // TODO - Save your account data securely
  users[kinClientEnv()][name] = {
    keypair,
    publicKey: keypair.publicKey,
    kinTokenAccounts,
  };
  console.log('🚀 ~ users', users);
}

// List of Transactions
const transactions = [];
interface SaveKinTransaction {
  transactionId: string;
}
function saveKinTransaction({ transactionId }: SaveKinTransaction) {
  // TODO - save your transaction data if required
  transactions.push(transactionId);
  console.log('🚀 ~ transactions', transactions);
}

// Endpoints
app.get('/status', (req, res) => {
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('🚀 ~ /status', kinClient?.sdkConfig.index || 'Not Instantiated');
  res.send(
    JSON.stringify({
      appIndex: kinClient ? kinClient.sdkConfig.index : null,
      env: kinClient ? kinClient.sdkConfig.environment : null,
      users: [
        { name: 'App', publicKey: appHotWallet.publicKey },
        ...Object.keys(users[kinClientEnv()]).map(
          (user) =>
            user && {
              name: user,
              publicKey: users[kinClientEnv()][user].publicKey,
            }
        ),
      ],
      transactions,
    })
  );
});

interface AsyncRequest {
  req: Request;
  res: Response;
}
async function setUpKinClient({ req, res }: AsyncRequest) {
  const environment = req.query.env === 'Mainnet' ? 'mainnet' : 'devnet';
  console.log('🚀 ~ environment', environment);

  try {
    const index = Number(process.env.APP_INDEX);
    console.log('🚀 ~ index', index);

    if (!index) throw new Error('No App Index');

    const config: KineticSdkConfig = {
      environment,
      index,
    };

    if (process.env.KINETIC_LOCAL_API) {
      config.endpoint = process.env.KINETIC_LOCAL_API;
    }

    const newKineticClient = await KineticSdk.setup(config);

    // test App Hot Wallet exists
    try {
      const balance = await newKineticClient.getBalance({
        account: appHotWallet.publicKey,
      });
      console.log('🚀 ~ App balance', balance);
    } catch (error) {
      // if not, create the account
      await newKineticClient.createAccount(appHotWallet);
      const balance = await newKineticClient.getBalance({
        account: appHotWallet.publicKey,
      });
      console.log('🚀 ~ App balance', balance);
    }

    appTokenAccounts = await newKineticClient.getTokenAccounts({
      account: appHotWallet.publicKey,
    });
    console.log('🚀 ~ appTokenAccounts', appTokenAccounts);

    kinClient = newKineticClient;
    console.log('🚀 ~ kinClient', kinClient.sdkConfig);

    res.sendStatus(200);
  } catch (error) {
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.log('🚀 ~ error', error);
    res.sendStatus(400);
  }
}

app.post('/setup', (req, res) => {
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('🚀 ~ /setup');
  setUpKinClient({ req, res });
});

async function createKinAccount({ req, res }: AsyncRequest) {
  const name = req.query.name;
  console.log('🚀 ~ createKinAccount', name);

  try {
    if (typeof name === 'string') {
      const mnemonic = Keypair.generateMnemonic();
      const keypair = Keypair.fromMnemonic(mnemonic);

      await kinClient.createAccount({
        owner: keypair,
        commitment: Commitment.Confirmed,
      });

      // Resolve Token Account
      // Array of Public Keys in case there are multiple Token Accounts
      const kinTokenAccounts = await kinClient.getTokenAccounts({
        account: keypair.publicKey,
      });
      console.log('🚀 ~ kinTokenAccounts', kinTokenAccounts);

      saveKinAccount({ name, keypair, kinTokenAccounts });
      res.sendStatus(201);
    } else {
      throw new Error('No valid name');
    }
  } catch (error) {
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.log('🚀 ~ error', error);
    res.sendStatus(400);
  }
}

app.post('/account', (req, res) => {
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('🚀 ~ /account');
  createKinAccount({ req, res });
});

async function getBalance({ req, res }: AsyncRequest) {
  const user = req?.query?.user || '';
  console.log('🚀 ~ getBalance ', user);
  try {
    if (typeof user === 'string') {
      let publicKey; // use for first attempt

      if (users[kinClientEnv()][user]) {
        const { publicKey: pk } = users[kinClientEnv()][user];
        publicKey = pk;
      } else {
        publicKey = appHotWallet.publicKey;
      }
      console.log('🚀 ~ publicKey', publicKey);
      const { balance } = await kinClient.getBalance({
        account: publicKey,
      });
      console.log('🚀 ~ balance', balance);

      const balanceInKin = Number(balance) / 100000;
      console.log('🚀 ~ balanceInKin', balanceInKin);

      res.send(balanceInKin.toString());
    } else {
      throw new Error('No valid user');
    }
  } catch (error) {
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.log('🚀 ~ error', error);
    res.sendStatus(400);
  }
}

app.get('/balance', (req, res) => {
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('🚀 ~ /balance');
  getBalance({ req, res });
});

async function requestAirdrop({ req, res }: AsyncRequest) {
  const to = req?.query?.to || '';
  const amount = req?.query?.amount || '0';
  console.log('🚀 ~ requestAirdrop', to, amount);

  if (typeof to === 'string' && typeof amount === 'string') {
    let publicKey;

    if (users[kinClientEnv()][to]) {
      const { publicKey: pk } = users[kinClientEnv()][to];
      publicKey = pk;
    } else {
      publicKey = appHotWallet.publicKey;
    }

    try {
      const airdrop = await kinClient.requestAirdrop({
        account: publicKey,
        amount: amount,
      });
      console.log('🚀 ~ airdrop', airdrop);

      saveKinTransaction({ transactionId: airdrop.signature });
      res.sendStatus(200);
    } catch (error) {
      console.log(
        '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
      );
      console.log(
        '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
      );
      console.log('🚀 ~ error', error);
      res.sendStatus(400);
    }
  }
}

app.post('/airdrop', (req, res) => {
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('🚀 ~ /airdrop');
  requestAirdrop({ req, res });
});

async function getTransaction({ req, res }: AsyncRequest) {
  const transaction = req?.query?.transaction_id || '';
  console.log('🚀 ~ getTransaction', transaction);
  if (typeof transaction === 'string') {
    try {
      throw new Error('getTransaction not implemented yet!!!');

      // const transactionBuffer = bs58.decode(transaction);
      // const { txId, txState, payments } = await kinClient.getTransaction(
      //   transactionBuffer
      // );

      // if (txState === 0) throw new Error("Can't find transaction");

      // console.log('🚀 ~ Got Transaction!');
      // console.log('🚀 ~ txId', bs58.encode(txId));

      // let decodedPayments;
      // if (payments?.length > 0) {
      //   decodedPayments = payments.map(
      //     ({ sender, destination, quarks, type, memo }) => {
      //       const paymentObject = {
      //         type,
      //         quarks,
      //         sender: sender.toBase58(),
      //         destination: destination.toBase58(),
      //         memo,
      //       };

      //       return paymentObject;
      //     }
      //   );
      //   console.log('🚀 ~ decodedPayments', decodedPayments);
      // }
      // res.send(JSON.stringify({ txState, payments: decodedPayments || [] }));
    } catch (error) {
      console.log(
        '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
      );
      console.log(
        '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
      );
      console.log('🚀 ~ error', error);
      res.sendStatus(400);
    }
  }
}

app.get('/transaction', (req, res) => {
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('🚀 ~ /transaction');
  getTransaction({ req, res });
});

function getTypeEnum(type) {
  let transactionType: TransactionType = TransactionType.None;
  if (type === 'P2P') {
    transactionType = TransactionType.P2P;
  }
  if (type === 'Spend') {
    transactionType = TransactionType.Spend;
  }
  if (type === 'Earn') {
    transactionType = TransactionType.Earn;
  }

  return transactionType;
}

async function submitPayment({ req, res }: AsyncRequest) {
  const { from, to, amount, type } = req.body;
  console.log('🚀 ~ submitPayment', from, to, amount, type);

  if (typeof from === 'string' && typeof to === 'string') {
    try {
      let sender;
      if (users[kinClientEnv()][from]) {
        sender = users[kinClientEnv()][from];
      } else {
        sender = appHotWallet;
      }

      let destination;
      if (users[kinClientEnv()][to]) {
        const { publicKey } = users[kinClientEnv()][to];
        destination = publicKey;
      } else {
        destination = appHotWallet.publicKey();
      }

      // const quarks = kinToQuarks(amount);
      const typeEnum = getTypeEnum(type);

      const transactionOptions = {
        amount,
        destination,
        owner: sender,
        type: typeEnum,
        commitment: Commitment.Confirmed,
      };
      console.log('🚀 ~ transactionOptions', transactionOptions);

      const transaction = await kinClient.makeTransfer(transactionOptions);
      console.log('🚀 ~ transaction', transaction);

      if (transaction.errors.length) {
        throw new Error(transaction.errors[0].message);
      }

      saveKinTransaction({ transactionId: transaction.signature });

      console.log(
        '🚀 ~ payment successful',
        from,
        to,
        amount,
        type,
        transaction.signature
      );
      res.sendStatus(200);
    } catch (error) {
      console.log(
        '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
      );
      console.log(
        '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
      );
      console.log('🚀 ~ error', error);
      res.sendStatus(400);
    }
  }
}

app.post('/send', (req, res) => {
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('🚀 ~ /send');
  submitPayment({ req, res });
});

async function submitEarnBatch({ req, res }: AsyncRequest) {
  const { from, batch } = req.body;
  console.log('🚀 ~ submitEarnBatch', from, batch);

  if (typeof from === 'string') {
    try {
      let sender;
      if (users[kinClientEnv()][from]) {
        sender = users[kinClientEnv()][from];
      } else {
        sender = appHotWallet;
      }

      const destinations = batch.map((earn) => {
        let destination;
        if (users[kinClientEnv()][earn.to]) {
          const { publicKey } = users[kinClientEnv()][earn.to];
          destination = publicKey;
        } else {
          throw new Error("Can't find user to send to!");
        }

        const newTransaction: TransferDestination = {
          amount: earn.amount,
          destination,
        };

        return newTransaction;
      });

      const batchOptions: MakeTransferBatchOptions = {
        commitment: Commitment.Confirmed,
        owner: sender,
        type: TransactionType.P2P,
        destinations,
      };

      const transaction = await kinClient.makeTransferBatch(batchOptions);
      console.log('🚀 ~ transaction', transaction);

      if (transaction.errors.length) {
        throw new Error(transaction.errors[0].message);
      }

      saveKinTransaction({ transactionId: transaction.signature });

      console.log(
        '🚀 ~ earn batch payment successful: ',
        transaction.signature
      );
      res.sendStatus(200);
    } catch (error) {
      console.log(
        '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
      );
      console.log(
        '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
      );
      console.log('🚀 ~ error', error);
      res.sendStatus(400);
    }
  }
}

app.post('/earn_batch', async (req, res) => {
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('🚀 ~ /earn_batch');
  submitEarnBatch({ req, res });
});

// Webhooks

// I use localtunnel for doing local development
// https://theboroer.github.io/localtunnel-www/

// You could also use ngrok
// https://ngrok.com/

app.use('/events', async (req, res) => {
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('🚀 ~ /events');
  console.log('🚀 ~ req.body', req.body);

  res.sendStatus(200);
});

app.use('/verify', async (req, res) => {
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('🚀 ~ /verify');
  console.log('🚀 ~ req.body', req.body);

  // TODO
  // Do stuff to verify the transaction
  const verified = true;

  if (verified) {
    res.sendStatus(200);
  } else {
    res.sendStatus(400);
  }
});

// catch 404 and forward to error handler
app.use(function (req, res) {
  res.sendStatus(404);
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  try {
    console.log(
      `Kin Node SDK App
App Index ${process.env.APP_INDEX}
Public Key ${appHotWallet.publicKey}
Listening at http://localhost:${port}`
    );
  } catch (error) {
    console.log('🚀 ~ Have you included all of your Environment variables?');
    throw new Error('Missing .env file?');
  }
});
