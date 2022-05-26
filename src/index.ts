import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bs58 from 'bs58';

import {
  Client,
  Payment,
  Environment,
  kinToQuarks,
  PrivateKey,
  quarksToKin,
  TransactionType,
  PublicKey,
} from '@kinecosystem/kin-sdk-v2';

import {
  Event,
  EventsHandler,
  SignTransactionRequest,
  SignTransactionResponse,
  SignTransactionHandler,
} from '@kinecosystem/kin-sdk-v2/dist/webhook';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Set up Kin client
let kinClient;
let kinClientEnv = 'Test';
let appHotWallet;
let appTokenAccounts = [];
try {
  appHotWallet = PrivateKey.fromString(process.env.PRIVATE_KEY);
} catch (error) {
  console.log('🚀 ~ It looks like your PRIVATE_KEY is missing or invalid.');
}

interface User {
  privateKey: PrivateKey;
  publicKey: PublicKey;
  kinTokenAccounts: PublicKey[];
}
// List of Users
const users: Record<'Test' | 'Prod', Record<string, User>> = {
  Test: {},
  Prod: {},
};
interface SaveKinAccount {
  name: string;
  privateKey: PrivateKey;
  kinTokenAccounts: PublicKey[];
}
function saveKinAccount({
  name,
  privateKey,
  kinTokenAccounts,
}: SaveKinAccount) {
  // %%%%%%%%%%%% IMPORTANT %%%%%%%%%%%%
  // TODO - Save your account data securely
  users[kinClientEnv][name] = {
    privateKey,
    publicKey: privateKey.publicKey(),
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
  console.log('🚀 ~ /status', kinClient?.appIndex || 'Not Instantiated');
  res.send(
    JSON.stringify({
      appIndex: kinClient ? kinClient.appIndex : null,
      env: kinClient ? kinClient.env : null,
      users: [
        { name: 'App', publicKey: appHotWallet.publicKey().toBase58() },
        ...Object.keys(users[kinClientEnv]).map(
          (user) =>
            user && {
              name: user,
              publicKey: users[kinClientEnv][user].publicKey.toBase58(),
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
  const env = req.query.env === 'Prod' ? Environment.Prod : Environment.Test;

  try {
    const appIndex = Number(process.env.APP_INDEX);

    if (!appIndex) throw new Error('No App Index');

    const newKinClient = new Client(env, { appIndex });

    // test App Hot Wallet exists
    try {
      const balance = await newKinClient.getBalance(appHotWallet.publicKey());
      console.log('🚀 ~ App balance', balance);
    } catch (error) {
      // if not, create the account
      await newKinClient.createAccount(appHotWallet);
      const balance = await newKinClient.getBalance(appHotWallet.publicKey());
      console.log('🚀 ~ App balance', balance);
    }

    appTokenAccounts = await newKinClient.resolveTokenAccounts(
      appHotWallet.publicKey()
    );

    kinClient = newKinClient;
    kinClientEnv = env === Environment.Prod ? 'Prod' : 'Test';

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
      const privateKey = PrivateKey.random();

      // Creates a Solana Account and a Kin Token Account for Receving Kin
      await kinClient.createAccount(privateKey);

      // Resolve Token Account
      // Array of Public Keys in case there are multiple Token Accounts
      const kinTokenAccounts = await kinClient.resolveTokenAccounts(
        privateKey.publicKey()
      );

      saveKinAccount({ name, privateKey, kinTokenAccounts });
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

      if (users[kinClientEnv][user]) {
        const { publicKey: pk } = users[kinClientEnv][user];
        publicKey = pk;
      } else {
        publicKey = appHotWallet.publicKey();
      }
      console.log('🚀 ~ publicKey', publicKey);
      const balance = await kinClient.getBalance(publicKey);
      console.log('🚀 ~ balance', balance);

      const balanceInKin = quarksToKin(balance);
      console.log('🚀 ~ balanceInKin', balanceInKin);

      res.send(balanceInKin);
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
  console.log('🚀 ~ /balance ');
  getBalance({ req, res });
});

async function requestAirdrop({ req, res }: AsyncRequest) {
  const to = req?.query?.to || '';
  const amount = req?.query?.amount || '0';
  console.log('🚀 ~ requestAirdrop', to, amount);

  if (typeof to === 'string' && typeof amount === 'string') {
    let publicKey;
    let tokenAccount;

    if (users[kinClientEnv][to]) {
      const { publicKey: pk, kinTokenAccounts } = users[kinClientEnv][to];
      publicKey = pk;
      tokenAccount = kinTokenAccounts[0];
    } else {
      publicKey = appHotWallet.publicKey();
      tokenAccount = appTokenAccounts[0];
    }

    const quarks = kinToQuarks(amount);

    // Try to airdrop to publicKey
    try {
      const buffer = await kinClient.requestAirdrop(publicKey, quarks);
      console.log('🚀 ~ airdrop successful to publicKey', to, amount);
      const transactionId = bs58.encode(buffer);
      saveKinTransaction({ transactionId });
      res.sendStatus(200);
    } catch (error) {
      console.log('🚀 ~ error airdrop to publicKey failed', error);
      // If publicKey fails, try again to tokenAccount. This might be a bug. It should work withe the publicKey
      try {
        const buffer = await kinClient.requestAirdrop(tokenAccount, quarks);
        console.log('🚀 ~ airdrop successful to tokenAccount', to, amount);
        const transactionId = bs58.encode(buffer);
        console.log('🚀 ~ transactionId', transactionId);
        saveKinTransaction({ transactionId });
        res.sendStatus(200);
      } catch (err) {
        console.log(
          '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
        );
        console.log(
          '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
        );
        console.log('🚀 ~ err', err);
        res.sendStatus(400);
      }
    }
  }
}

app.post('/airdrop', (req, res) => {
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('🚀 ~ /airdrop ');
  requestAirdrop({ req, res });
});

async function getTransaction({ req, res }: AsyncRequest) {
  const transaction = req?.query?.transaction_id || '';
  console.log('🚀 ~ getTransaction', transaction);
  if (typeof transaction === 'string') {
    try {
      const transactionBuffer = bs58.decode(transaction);
      const { txId, txState, payments } = await kinClient.getTransaction(
        transactionBuffer
      );

      if (txState === 0) throw new Error("Can't find transaction");

      console.log('🚀 ~ Got Transaction!');
      console.log('🚀 ~ txId', bs58.encode(txId));

      let decodedPayments;
      if (payments?.length > 0) {
        decodedPayments = payments.map(
          ({ sender, destination, quarks, type, memo }) => {
            const paymentObject = {
              type,
              quarks,
              sender: sender.toBase58(),
              destination: destination.toBase58(),
              memo,
            };

            return paymentObject;
          }
        );
        console.log('🚀 ~ decodedPayments', decodedPayments);
      }
      res.send(JSON.stringify({ txState, payments: decodedPayments || [] }));
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
  console.log('🚀 ~ /transaction ');
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
      if (users[kinClientEnv][from]) {
        const { privateKey } = users[kinClientEnv][from];
        sender = privateKey;
      } else {
        sender = appHotWallet;
      }

      let destination;
      if (users[kinClientEnv][to]) {
        const { publicKey } = users[kinClientEnv][to];
        destination = publicKey;
      } else {
        destination = appHotWallet.publicKey();
      }

      const quarks = kinToQuarks(amount);
      const typeEnum = getTypeEnum(type);

      const paymentObject: Payment = {
        sender,
        destination,
        quarks,
        type: typeEnum,
      };

      const buffer = await kinClient.submitPayment(paymentObject);
      const transactionId = bs58.encode(buffer);
      saveKinTransaction({ transactionId });

      console.log('🚀 ~ payment successful', from, to, amount, type);
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
  console.log('🚀 ~ /send ');
  submitPayment({ req, res });
});

async function submitEarnBatch({ req, res }: AsyncRequest) {
  const { from, to, amount, type } = req.body;
  console.log('🚀 ~ submitEarnBatch', from, to, amount, type);

  if (typeof from === 'string' && typeof to === 'string') {
    try {
      let sender;
      if (users[kinClientEnv][from]) {
        const { privateKey } = users[kinClientEnv][from];
        sender = privateKey;
      } else {
        sender = appHotWallet;
      }

      const buffer = await kinClient.submitEarnBatch({
        sender: sender,
        earns: Object.values(users[kinClientEnv]).map((destination) => {
          return {
            destination: (destination as any).publicKey,
            quarks: kinToQuarks('1'),
          };
        }),
      });

      console.log('🚀 ~ earn batch payment successful', from, to, amount, type);
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
  console.log('🚀 ~ /earn_batch ');
  submitEarnBatch({ req, res });
});

// Webhooks

// I use localtunnel for doing local development
// https://theboroer.github.io/localtunnel-www/

// You could also use ngrok
// https://ngrok.com/

app.use(
  '/events',
  EventsHandler((events: Event[]) => {
    console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
    console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
    console.log('🚀 ~ /events', events);

    // TODO use these events to trigger actions in your App if required
  }, process.env.SERVER_WEBHOOK_SECRET)
);

app.use(
  '/sign_transaction',
  SignTransactionHandler(
    Environment.Test,
    (req: SignTransactionRequest, resp: SignTransactionResponse) => {
      console.log(
        '%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%'
      );
      console.log(
        '%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%'
      );
      console.log('🚀 ~ /sign_transaction', req);

      function checkIsValid() {
        // IMPORTANT!
        // Implement transaction approval here!
        // This webhook will approve all incoming transactions
        return true;
      }

      const isValid = checkIsValid();
      console.log('🚀 ~ isValid', isValid);

      if (isValid) {
        resp.sign(appHotWallet);
      } else {
        resp.reject();
      }
    },
    process.env.SERVER_WEBHOOK_SECRET
  )
);

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
Public Key ${appHotWallet.publicKey().toBase58()}
Listening at http://localhost:${port}`
    );
  } catch (error) {
    console.log('🚀 ~ Have you included all of your Environment variables?');
    throw new Error('Missing .env file?');
  }
});
