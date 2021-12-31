import express from 'express';
import cors from 'cors';

import {
  Client,
  Environment,
  kinToQuarks,
  PrivateKey,
  PublicKey,
  quarksToKin,
  TransactionType,
} from '@kinecosystem/kin-sdk-v2';

const app = express();
app.use(cors());

const port = 3001;

// Set up Kin client
let kinClient;
const users = {};

app.get('/status', (req, res) => {
  console.log('🚀 ~ /status', kinClient?.appIndex || 'Not Instantiated');
  res.send(
    JSON.stringify({
      appIndex: kinClient ? kinClient.appIndex : 0,
      users: Object.keys(users),
    })
  );
});

app.post('/setup', (req, res) => {
  console.log('🚀 ~ /setup');
  const env = req.query.env === 'Prod' ? Environment.Prod : Environment.Test;
  const appIndex = Number(req.query.appIndex);
  kinClient = new Client(env, { appIndex });
  res.sendStatus(201);
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
  const name = req?.query?.name || '';
  if (typeof name === 'string') {
    console.log('🚀 ~ getBalance ', name);
    try {
      const { privateKey } = users[name];
      const balance = await kinClient.getBalance(privateKey.publicKey());
      console.log('🚀 ~ balance', balance);

      const balanceInKin = quarksToKin(balance);
      console.log('🚀 ~ balanceInKin', balanceInKin);

      res.send(balanceInKin);
    } catch (error) {
      res.sendStatus(400);
    }
  }
}

app.get('/balance', (req, res) => {
  console.log('🚀 ~ /balance ');
  getBalance(req, res);
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  res.sendStatus(404);
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
