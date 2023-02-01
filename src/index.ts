import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import {
  KineticSdk,
  KineticSdkConfig,
  MakeTransferBatchOptions,
  MakeTransferOptions,
  TransferDestination,
} from '@kin-kinetic/sdk';
import { Keypair } from '@kin-kinetic/keypair';
import { Commitment, TransactionType } from '@kin-kinetic/solana';
// import { KeypairCompat } from '@kin-tools/keypair-compat';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Set up Kin client
let kineticClient;
let appHotWallet;
try {
  // if deprecated Stellar keypair:
  // appHotWallet = KeypairCompat.getKeypair(process.env.PRIVATE_KEY);

  // if Solana Keypair: use either mnemonic or byte array
  // appHotWallet = Keypair.fromSecret(process.env.MNEMONIC);
  const byteArray = process.env?.BYTE_ARRAY;
  console.log('🚀 ~ byteArray', byteArray);
  appHotWallet = Keypair.fromSecret(byteArray);
} catch (error) {
  console.log('🚀 ~ error', error);
  console.log('🚀 ~ It looks like your PRIVATE_KEY is missing or invalid.');
}

const kineticClientEnv = () =>
  kineticClient?.sdkConfig?.environment || 'devnet';

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
  users[kineticClientEnv()][name] = {
    keypair,
    publicKey: keypair.publicKey,
    kinTokenAccounts,
  };
  console.log('🚀 ~ users', users);
}
function deleteKinAccount({ name }: { name: string }) {
  delete users[kineticClientEnv()][name];
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
  console.log(
    '🚀 ~ /status',
    kineticClient?.sdkConfig.index || 'Not Instantiated'
  );
  res.send(
    JSON.stringify({
      appIndex: kineticClient ? kineticClient.sdkConfig.index : null,
      env: kineticClient ? kineticClient.sdkConfig.environment : null,
      users: [
        { name: 'App', publicKey: appHotWallet.publicKey },
        ...Object.keys(users[kineticClientEnv()]).map(
          (user) =>
            user && {
              name: user,
              publicKey: users[kineticClientEnv()][user].publicKey,
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
async function setUpKineticClient({ req, res }: AsyncRequest) {
  const environment = req.query.env === 'Mainnet' ? 'mainnet' : 'devnet';
  console.log('🚀 ~ environment', environment);

  const endpoint =
    req.query.env === 'Mainnet'
      ? process.env.KINETIC_ENDPOINT
      : process.env.KINETIC_ENDPOINT || 'https://sandbox.kinetic.host/';

  try {
    const index = Number(process.env.APP_INDEX);
    console.log('🚀 ~ index', index);

    if (!index) throw new Error('No App Index');

    const commitment = Commitment.Processed;

    const config: KineticSdkConfig = {
      environment,
      endpoint,
      index,
      commitment,
    };

    console.log('🚀 ~ config', config);
    const newKineticClient = await KineticSdk.setup(config);
    console.log('🚀 ~ newKineticClient', newKineticClient);

    // test App Hot Wallet exists
    try {
      const balance = await newKineticClient.getBalance({
        account: appHotWallet.publicKey,
      });
      console.log('🚀 ~ App balance', balance);
    } catch (error) {
      // if not, create the account
      await newKineticClient.createAccount({
        owner: appHotWallet,
      });
      const balance = await newKineticClient.getBalance({
        account: appHotWallet.publicKey,
      });
      console.log('🚀 ~ App balance', balance);
    }

    kineticClient = newKineticClient;
    console.log('🚀 ~ kineticClient', kineticClient.sdkConfig);

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
  setUpKineticClient({ req, res });
});

async function createKinAccount({ req, res }: AsyncRequest) {
  const name = req.query.name;
  console.log('🚀 ~ createKinAccount', name);

  try {
    if (typeof name === 'string') {
      const mnemonic = Keypair.generateMnemonic();
      console.log('🚀 ~ mnemonic', mnemonic);
      const keypair = Keypair.fromSecret(mnemonic);
      console.log('🚀 ~ keypair', keypair);

      const account = await kineticClient.createAccount({
        owner: keypair,
      });
      console.log('🚀 ~ account', account);

      const { errors } = account;
      if (errors?.length) {
        throw new Error(errors[0]?.message);
      }

      // Resolve Token Account
      // Array of Public Keys in case there are multiple Token Accounts
      const kinTokenAccounts = await kineticClient.getTokenAccounts({
        account: keypair.publicKey,
      });

      console.log('🚀 ~ kinTokenAccounts', kinTokenAccounts);

      saveKinTransaction({ transactionId: account.signature });
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

async function closeAccount({ req, res }: AsyncRequest) {
  const user = req?.query?.user || '';
  console.log('🚀 ~ closeAccount ', user);
  try {
    if (typeof user === 'string') {
      let publicKey; // use for first attempt

      if (users[kineticClientEnv()][user]) {
        const { publicKey: pk } = users[kineticClientEnv()][user];
        publicKey = pk;
      } else {
        publicKey = appHotWallet.publicKey;
      }
      console.log('🚀 ~ publicKey', publicKey);
      const transaction = await kineticClient.closeAccount({
        account: publicKey,
      });
      saveKinTransaction({ transactionId: transaction.signature });
      deleteKinAccount({ name: user });

      res.sendStatus(201);
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

app.post('/close-account', (req, res) => {
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('🚀 ~ /close-account');
  closeAccount({ req, res });
});

async function getBalance({ req, res }: AsyncRequest) {
  const user = req?.query?.user || '';
  console.log('🚀 ~ getBalance ', user);
  try {
    if (typeof user === 'string') {
      let publicKey; // use for first attempt

      if (users[kineticClientEnv()][user]) {
        const { publicKey: pk } = users[kineticClientEnv()][user];
        publicKey = pk;
      } else {
        publicKey = appHotWallet.publicKey;
      }
      console.log('🚀 ~ publicKey', publicKey);
      const { balance } = await kineticClient.getBalance({
        account: publicKey,
      });
      console.log('🚀 ~ balance', balance);

      res.send(balance);
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

    if (users[kineticClientEnv()][to]) {
      const { publicKey: pk } = users[kineticClientEnv()][to];
      publicKey = pk;
    } else {
      publicKey = appHotWallet.publicKey;
    }

    try {
      const airdrop = await kineticClient.requestAirdrop({
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
      if (users[kineticClientEnv()][from]) {
        const { keypair } = users[kineticClientEnv()][from];
        sender = keypair;
      } else {
        sender = appHotWallet;
        console.log('🚀 ~ sender', sender);
      }

      let destination;
      if (users[kineticClientEnv()][to]) {
        const { publicKey } = users[kineticClientEnv()][to];
        destination = publicKey;
      } else {
        destination = appHotWallet.publicKey;
      }

      const typeEnum = getTypeEnum(type);

      const transactionOptions: MakeTransferOptions = {
        amount,
        destination,
        owner: sender,
        type: typeEnum,
      };
      console.log('🚀 ~ transactionOptions', transactionOptions);

      const transaction = await kineticClient.makeTransfer(transactionOptions);
      console.log('🚀 ~ transaction', transaction);

      const { errors } = transaction;
      if (errors?.length) {
        throw new Error(errors[0]?.message);
      }

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
      if (users[kineticClientEnv()][from]) {
        sender = users[kineticClientEnv()][from];
      } else {
        sender = appHotWallet;
      }

      const destinations = batch.map((earn) => {
        let destination;
        if (users[kineticClientEnv()][earn.to]) {
          const { publicKey } = users[kineticClientEnv()][earn.to];
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
        owner: sender,
        type: TransactionType.Earn,
        destinations,
      };

      const transaction = await kineticClient.makeTransferBatch(batchOptions);
      console.log('🚀 ~ transaction', transaction);

      const { errors } = transaction;
      if (errors?.length) {
        throw new Error(errors[0]?.message);
      }

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

async function getTransaction({ req, res }: AsyncRequest) {
  const signature = req?.query?.transaction_id || '';
  console.log('🚀 ~ getTransaction', signature);
  if (typeof signature === 'string') {
    try {
      const transaction = await kineticClient.getTransaction({
        signature,
      });
      console.log('🚀 ~ transaction', transaction);
      res.send(JSON.stringify(transaction));
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

async function getHistory({ req, res }: AsyncRequest) {
  const user = req?.query?.user || '';
  console.log('🚀 ~ getHistory', user);
  if (typeof user === 'string') {
    try {
      let publicKey;

      if (users[kineticClientEnv()][user]) {
        const { publicKey: pk } = users[kineticClientEnv()][user];
        publicKey = pk;
      } else {
        publicKey = appHotWallet.publicKey;
      }
      console.log('🚀 ~ publicKey', publicKey);
      const history = await kineticClient.getHistory({
        account: publicKey,
      });
      console.log('🚀 ~ history', history);

      res.send(JSON.stringify(history));
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

app.get('/history', (req, res) => {
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('🚀 ~ /transaction');
  getHistory({ req, res });
});

async function getAccountInfo({ req, res }: AsyncRequest) {
  const user = req?.query?.user || '';
  console.log('🚀 ~ getAccountInfo', user);
  if (typeof user === 'string') {
    try {
      let publicKey;

      if (users[kineticClientEnv()][user]) {
        const { publicKey: pk } = users[kineticClientEnv()][user];
        publicKey = pk;
      } else {
        publicKey = appHotWallet.publicKey;
      }
      console.log('🚀 ~ publicKey', publicKey);
      const info = await kineticClient.getAccountInfo({
        account: publicKey,
      });
      console.log('🚀 ~ info', info);

      res.send(JSON.stringify(info));
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

app.get('/account-info', (req, res) => {
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('🚀 ~ /transaction');
  getAccountInfo({ req, res });
});

async function getTokenAccounts({ req, res }: AsyncRequest) {
  const user = req?.query?.user || '';
  console.log('🚀 ~ getTokenAccounts', user);
  if (typeof user === 'string') {
    try {
      let publicKey;

      if (users[kineticClientEnv()][user]) {
        const { publicKey: pk } = users[kineticClientEnv()][user];
        publicKey = pk;
      } else {
        publicKey = appHotWallet.publicKey;
      }
      console.log('🚀 ~ publicKey', publicKey);
      const tokenAccounts = await kineticClient.getTokenAccounts({
        account: publicKey,
      });
      console.log('🚀 ~ tokenAccounts', tokenAccounts);

      res.send(JSON.stringify(tokenAccounts));
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

app.get('/token-accounts', (req, res) => {
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('🚀 ~ /token-accounts');
  getTokenAccounts({ req, res });
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

  // always verify
  const verified = true;
  if (verified) {
    res.sendStatus(200);
  } else {
    res.status(400).json({ message: 'Failed to Verify' });
  }

  // random verification
  // if (Math.random() < 0.5) {
  //   console.log('verify');
  //   res.sendStatus(200);
  // } else {
  //   console.log('reject');
  //   res.status(400).json({ message: 'Failed to Verify Randomly' });
  // }
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
