const express = require('express');
const mongooseModel = require('mongoose').model;
const alert = require('alert');
const _ = require('lodash');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const port = 3000;
require('./db');

app.get('/', (req, res) => {
  res.sendFile(_.join([__dirname, 'index.html'], '/'));
});

app.post('/', (req, res) => {
  const { content } = req.body;
  const Post = mongooseModel('Post');
  const newPost = new Post({ content });

  newPost.save((err) => {
    if (err) console.log(err);
    res.redirect('/');
  });
});

app.listen(port, () => console.log('listening on port: ' + port));
