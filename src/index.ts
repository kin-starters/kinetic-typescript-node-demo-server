import express from 'express';
import cors from 'cors';

import { Kin } from './kin';
console.log('TypeScript Eslint Prettier Starter Template!');
console.log('A project by Caelin Sutch, follow him at @caelin_sutch');

const app = express();
app.use(cors());

const port = 3001;

app.get('/healthcheck', (req, res) => {
  console.log('🚀 ~ /healthcheck');
  res.sendStatus(200);
});

async function createKinAccount(res) {
  const key = await Kin.generateKey();
  console.log('🚀 ~ key', key);
  res.send('okay!');
}
app.post('/account', (req, res) => {
  console.log('🚀 ~ /account');
  createKinAccount(res);
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  res.sendStatus(404);
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
