import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import {
  Client,
  Environment,
  kinToQuarks,
  PrivateKey,
  quarksToKin,
  TransactionType,
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
const appPrivateKey = PrivateKey.fromString(process.env.SECRET_KEY);

// List of Users
const users = {};

// Endpoints
app.get('/status', (req, res) => {
  console.log('🚀 ~ /status', kinClient?.appIndex || 'Not Instantiated');
  res.send(
    JSON.stringify({
      appIndex: kinClient ? kinClient.appIndex : 0,
      users: Object.keys(users),
    })
  );
});

async function setUpServer(req, res) {
  const env = req.query.env === 'Prod' ? Environment.Prod : Environment.Test;
  const appIndex = Number(req.query.appIndex);
  kinClient = new Client(env, { appIndex });
  console.log('🚀 ~ kinClient', kinClient);

  res.sendStatus(201);
}

app.post('/setup', (req, res) => {
  console.log('🚀 ~ /setup');
  setUpServer(req, res);
});

async function createKinAccount(req, res) {
  const name = req.query.name;
  console.log('🚀 ~ name', name);
  try {
    const privateKey = PrivateKey.random();
    // Create Account
    await kinClient.createAccount(privateKey);
    // Resolve Token Account
    const kinTokenAccounts = await kinClient.resolveTokenAccounts(
      privateKey.publicKey()
    );
    users[name] = { privateKey, kinTokenAccounts };
    console.log('🚀 ~ users', users);
    res.sendStatus(201);
  } catch (error) {
    console.log('🚀 ~ error', error);
    res.sendStatus(400);
  }
}

app.post('/account', (req, res) => {
  console.log('🚀 ~ /account');
  createKinAccount(req, res);
});

async function getBalance(req, res) {
  const user = req?.query?.user || '';
  if (typeof user === 'string') {
    console.log('🚀 ~ getBalance ', user);
    try {
      let account;
      if (users[user]) {
        const { kinTokenAccounts } = users[user];
        account = kinTokenAccounts[0];
      } else {
        account = appPrivateKey.publicKey();
      }
      const balance = await kinClient.getBalance(account);
      console.log('🚀 ~ balance', balance);

      const balanceInKin = quarksToKin(balance);
      console.log('🚀 ~ balanceInKin', balanceInKin);

      res.send(balanceInKin);
    } catch (error) {
      console.log('🚀 ~ error', error);
      res.sendStatus(400);
    }
  }
}

app.get('/balance', (req, res) => {
  console.log('🚀 ~ /balance ');
  getBalance(req, res);
});

async function requestAirdrop(req, res) {
  const to = req?.query?.to || '';
  const amount = req?.query?.amount || '';
  if (typeof to === 'string') {
    try {
      let destination;
      if (users[to]) {
        const { kinTokenAccounts } = users[to];
        destination = kinTokenAccounts[0];
      } else {
        destination = appPrivateKey.publicKey();
      }

      const quarks = kinToQuarks(amount);
      await kinClient.requestAirdrop(destination, quarks);

      console.log('🚀 ~ airdrop successful', to, amount);
      res.sendStatus(200);
    } catch (error) {
      console.log('🚀 ~ error', error);
      res.sendStatus(400);
    }
  }
}

app.post('/airdrop', (req, res) => {
  console.log('🚀 ~ /airdrop ');
  requestAirdrop(req, res);
});

async function makePayment(req, res) {
  console.log('🚀 ~ makePayment', req.body);
  const { from, to, amount, memo, type } = req.body;

  if (typeof from === 'string' && typeof to === 'string') {
    try {
      let sender;
      if (users[from]) {
        const { privateKey } = users[from];
        sender = privateKey;
      } else {
        sender = appPrivateKey;
      }

      let destination;
      if (users[to]) {
        const { kinTokenAccounts } = users[to];
        destination = kinTokenAccounts[0];
      } else {
        destination = appPrivateKey.publicKey();
      }
      const quarks = kinToQuarks(amount);
      const paymentObject = {
        sender,
        destination,
        quarks,
        type: TransactionType[type],
      };

      if (memo) paymentObject['memo'] = memo;

      console.log('🚀 ~ paymentObject', paymentObject);
      await kinClient.submitPayment(paymentObject);

      console.log('🚀 ~ payment successful', from, to, amount);
      res.sendStatus(200);
    } catch (error) {
      console.log('🚀 ~ error', error);
      res.sendStatus(400);
    }
  }
}

app.post('/send', (req, res) => {
  console.log('🚀 ~ /send ');
  makePayment(req, res);
});

// Webhooks
app.use(
  '/events',
  EventsHandler((events: Event[]) => {
    console.log('🚀 ~ /events');
    console.log('🚀 ~ events', events);
    for (const e of events) {
      console.log(`received event: ${JSON.stringify(e)}`);
    }
  }, process.env.SERVER_WEBHOOK_SECRET)
);

app.use(
  '/sign_transaction',
  SignTransactionHandler(
    Environment.Test,
    (req: SignTransactionRequest, resp: SignTransactionResponse) => {
      console.log('🚀 ~ /sign_transaction');
      console.log('🚀 ~ req', req);

      // TODO
      // Implement transaction approval here!
      // This webhook will approve all incoming transactions
      // It is not safe for a production application

      function checkIsValid() {
        return true;
      }

      const isValid = checkIsValid();
      console.log('🚀 ~ isValid', isValid);

      if (isValid) {
        resp.sign(appPrivateKey);
      } else {
        resp.reject();
      }

      return;

      // console.log(
      //   `sign request for <'${req.userId}', '${
      //     req.userPassKey
      //   }'>: ${bs58.encode(req.txId())}`
      // );

      // for (let i = 0; i < req.payments.length; i++) {
      //   const p = req.payments[i];

      //   // Double check that the transaction isn't trying to impersonate us
      //   if (p.sender.equals(appPrivateKey.publicKey())) {
      //     resp.reject();
      //     return;
      //   }

      //   // In this example, we don't want to whitelist transactions that aren't sending
      //   // kin to us.
      //   //
      //   // Note: this is purely demonstrating WrongDestination. Some apps may wish to
      //   // whitelist everything.
      //   if (!p.destination.equals(appPrivateKey.publicKey())) {
      //     resp.markWrongDestination(i);
      //   }

      //   if (p.invoice) {
      //     for (const item of p.invoice.Items) {
      //       if (!item.sku) {
      //         // Note: in general the sku is optional. However, in this example we
      //         //       mark it as SkuNotFound to facilitate testing.
      //         resp.markSkuNotFound(i);
      //       }
      //     }
      //   }
      // }

      // // Note: if we _don't_ do this check here, the SDK won't send back a signed
      // //       transaction if this is set.
      // if (resp.isRejected()) {
      //   return;
      // }
    },
    process.env.SERVER_WEBHOOK_SECRET
  )
);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  res.sendStatus(404);
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
