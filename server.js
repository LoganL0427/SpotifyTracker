const express = require('express');
const router = require('./router');
require('dotenv').config();

const app = express()

app.use(express.static('public'));

app.use('/', router);

app.use((req, res, next) => {
  console.log(`Request to: ${req.path}`);
  next();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})